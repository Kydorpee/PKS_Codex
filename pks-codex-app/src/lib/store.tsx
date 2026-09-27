import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import type { Data, Result } from './engine';
import { firebase } from './firebase';
import { newId } from './ids';
import { toSharedPhoto } from './photos';
import { addToInventory, applyClass, normalizeCharacter, normalizeCodex, startingClassOf, toCharacterAbility } from './rules';
import { CACHE_CHARACTERS_KEY, CACHE_UID_KEY, CHARACTERS_KEY, CODEXES_KEY, MIGRATED_KEY } from './storage-keys';
import { diffData, replaceDoc, sameDoc, withOwner, type DocChange, type DocKind, type Doc } from './sync';
import { refreshWidget } from '@/widget';
import { MAX_CHARACTERS, type Character, type Codex, type CodexAbility, type CodexClass, type Mount } from './types';

type Store = Data & {
  /** Há dados para mostrar (do servidor ou da cópia guardada no aparelho). */
  loaded: boolean;
  /** Os dados já vieram do servidor nesta abertura do app. */
  synced: boolean;
  /** Erro de conexão/permissão com o Firebase, se houver. */
  error?: string;
  /** Reconecta ao servidor depois de um erro. */
  retry: () => void;
  /** Conta (anônima) deste aparelho. */
  uid?: string;
  /** Personagens deste aparelho (`characters` inclui também os colegas de Codex). */
  myCharacters: Character[];
  /** Codex em que este aparelho é o Mestre (`codexes` inclui também os que os personagens entraram). */
  myCodexes: Codex[];
  /** Cria ou atualiza. Retorna mensagem de erro, se houver. */
  saveCharacter: (character: Character) => string | null;
  updateCharacter: (id: string, change: (character: Character) => Character) => void;
  deleteCharacter: (id: string) => void;
  saveCodex: (codex: Codex) => void;
  updateCodex: (id: string, change: (codex: Codex) => Codex) => void;
  deleteCodex: (id: string) => void;
  /** Procura o código no servidor; retorna mensagem de erro, se houver. */
  joinCodex: (characterId: string, code: string) => Promise<string | null>;
  leaveCodex: (characterId: string) => void;
  /** O Mestre tira um personagem do Codex. Retorna mensagem de erro, se houver. */
  removeFromCodex: (codexId: string, characterId: string) => string | null;
  buyItem: (characterId: string, codexId: string, shopId: string, itemId: string) => string | null;
  /** Cria/edita uma habilidade do Codex e atualiza quem já a possui. */
  saveAbility: (codexId: string, ability: CodexAbility) => void;
  deleteAbility: (codexId: string, abilityId: string) => void;
  respondAbilityOffer: (characterId: string, codexId: string, abilityId: string, accept: boolean) => void;
  revokeAbility: (characterId: string, abilityId: string) => void;
  /** Cria/edita uma classe do Codex. */
  saveClass: (codexId: string, klass: CodexClass) => void;
  /** Apaga a classe e as habilidades dela; quem a tinha fica sem classe. */
  deleteClass: (codexId: string, classId: string) => void;
  /** Classe que o personagem recebe ao entrar no Codex. */
  setStartingClass: (codexId: string, classId: string) => void;
  /** O jogador escolhe (troca para) ou recusa uma classe liberada pelo Mestre. */
  respondClassOffer: (characterId: string, codexId: string, classId: string, accept: boolean) => void;
  /** Cria/edita uma montaria e define quem a tem (`ownerIds`). */
  saveMount: (codexId: string, mount: Mount, ownerIds: string[]) => void;
  /** Apaga a montaria: sai dos personagens e das lojas. */
  deleteMount: (codexId: string, mountId: string) => void;
  /** Executa uma regra do engine (batalha, nível). Retorna mensagem de erro, se houver. */
  act: (rule: (data: Data) => Result) => string | null;
};

/** Remove um personagem das lojas, ofertas de habilidade e classe e eventos de nível pendentes de um Codex. */
const withoutCharacter = (codex: Codex, characterId: string): Codex => ({
  ...codex,
  classes: codex.classes.map((k) => ({ ...k, offeredTo: k.offeredTo.filter((id) => id !== characterId) })),
  levelUps: codex.levelUps.filter((e) => e.resolved || e.characterId !== characterId),
  shops: codex.shops.map((s) => ({ ...s, visibleTo: s.visibleTo.filter((id) => id !== characterId) })),
  abilities: codex.abilities.map((a) => ({ ...a, offeredTo: a.offeredTo.filter((id) => id !== characterId) })),
});

/** Personagem saindo do Codex: perde a classe (e as habilidades dela) e as montarias. */
const leaveClass = (data: Data, c: Character): Character => {
  const codex = data.codexes.find((x) => x.id === c.codexId);
  return { ...(codex ? applyClass(c, codex, undefined) : c), codexId: undefined, mountIds: [] };
};

const mapCharacter = (data: Data, id: string, change: (c: Character) => Character): Data => ({
  ...data,
  characters: data.characters.map((c) => (c.id === id ? change(c) : c)),
});

const mapCodex = (data: Data, id: string, change: (c: Codex) => Codex): Data => ({
  ...data,
  codexes: data.codexes.map((c) => (c.id === id ? change(c) : c)),
});

const StoreContext = createContext<Store | null>(null);

/** Uma regra do engine que falhou dentro da transação (os dados mudaram em outro celular). */
class ActionError extends Error {}

const normalize = (kind: DocKind, id: string, data: object): Doc =>
  kind === 'characters' ? normalizeCharacter({ ...(data as Character), id }) : normalizeCodex({ ...(data as Codex), id });

/** Relógio usado para expirar alterações pendentes (fora do componente: não é chamado na renderização). */
const clock = () => Date.now();

const byCreation = (a: { createdAt: number }, b: { createdAt: number }) => a.createdAt - b.createdAt;

/** Mensagem legível para erros do Firebase. */
function describe(e: unknown): string {
  if (e instanceof ActionError) return e.message;
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('permission-denied')) return 'Sem permissão no servidor. Confira as regras do Firestore (arquivo firestore.rules).';
  if (code.includes('unavailable')) return 'Sem conexão com o servidor. Verifique a internet.';
  if (code.includes('admin-restricted-operation') || code.includes('operation-not-allowed') || code.includes('configuration-not-found')) {
    return 'Ative o login "Anônimo" no Firebase (Authentication > Método de login).';
  }
  return (e as Error)?.message ?? String(e);
}

/** Envia os dados salvos só neste celular (versões antigas do app) para o Firebase, uma vez. */
async function migrateLocalData(uid: string) {
  if (await AsyncStorage.getItem(MIGRATED_KEY)) return;
  const [c, x] = await Promise.all([AsyncStorage.getItem(CHARACTERS_KEY), AsyncStorage.getItem(CODEXES_KEY)]);
  const characters = c ? (JSON.parse(c) as Character[]).map(normalizeCharacter) : [];
  const codexes = x ? (JSON.parse(x) as Codex[]).map(normalizeCodex) : [];
  // Fotos antigas eram arquivos do aparelho; viram imagens compartilháveis.
  const share = async (uri?: string) => (uri && !uri.startsWith('data:') ? await toSharedPhoto(uri) : uri);
  for (const ch of characters) ch.photoUri = await share(ch.photoUri);
  for (const cx of codexes) for (const m of cx.monsters) m.photoUri = await share(m.photoUri);

  const { db } = firebase();
  const docs: [DocKind, Doc][] = [...characters.map((d) => ['characters', d] as [DocKind, Doc]), ...codexes.map((d) => ['codexes', d] as [DocKind, Doc])];
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    for (const [kind, value] of docs.slice(i, i + 400)) batch.set(doc(db, kind, value.id), withOwner(value, uid));
    await batch.commit();
  }
  await AsyncStorage.setItem(MIGRATED_KEY, '1');
}

type Pending = { value: Doc | null; expires: number };

/** Lê a cópia da última sincronização (só existe depois que os dados antigos foram enviados). */
async function readCache(): Promise<{ uid: string; data: Data } | null> {
  const [migrated, uid, c, x] = await Promise.all(
    [MIGRATED_KEY, CACHE_UID_KEY, CACHE_CHARACTERS_KEY, CODEXES_KEY].map((k) => AsyncStorage.getItem(k)),
  );
  if (!migrated || !uid || !c) return null;
  return {
    uid,
    data: {
      characters: (JSON.parse(c) as Character[]).map(normalizeCharacter),
      codexes: x ? (JSON.parse(x) as Codex[]).map(normalizeCodex) : [],
    },
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [synced, setSynced] = useState(false);
  const [hasCache, setHasCache] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [uid, setUid] = useState<string>();
  const [cacheUid, setCacheUid] = useState<string>();
  const [data, setData] = useState<Data>({ characters: [], codexes: [] });
  // Espelho síncrono do estado: as ações leem sempre a versão mais recente.
  const current = useRef(data);
  const uidRef = useRef<string>(undefined);

  // O que chegou do servidor, por origem.
  const sources = useRef({
    myCharacters: new Map<string, Character>(),
    ownedCodexes: new Map<string, Codex>(),
    joinedCodexes: new Map<string, Codex>(),
    /** Personagens de cada Codex acompanhado (colegas de campanha). */
    codexCharacters: new Map<string, Map<string, Character>>(),
  });
  // Alterações feitas aqui que o servidor ainda não confirmou (mostradas na hora).
  const pending = useRef(new Map<string, Pending>());
  const watchers = useRef(new Map<string, Unsubscribe>());
  // Até tudo chegar do servidor, a tela mostra a cópia guardada no aparelho.
  const cache = useRef<Data | null>(null);
  const isSynced = useRef(false);
  const ready = useRef({ characters: false, codexes: false });
  /** Assinaturas de Codex que já receberam a primeira resposta. */
  const received = useRef(new Set<string>());

  const rebuild = () => {
    const s = sources.current;
    watchCodexes();
    const allReceived = [...watchers.current.keys()].every((k) => received.current.has(k));
    if (!isSynced.current && ready.current.characters && ready.current.codexes && allReceived) {
      isSynced.current = true;
      cache.current = null;
      setSynced(true);
    }

    const lists: Record<DocKind, Map<string, Doc>> = { characters: new Map(), codexes: new Map() };
    if (!isSynced.current && cache.current) {
      for (const ch of cache.current.characters) lists.characters.set(ch.id, ch);
      for (const cx of cache.current.codexes) lists.codexes.set(cx.id, cx);
    } else {
      lists.codexes = new Map([...s.joinedCodexes, ...s.ownedCodexes]);
      for (const group of s.codexCharacters.values()) for (const [id, ch] of group) lists.characters.set(id, ch);
      for (const [id, ch] of s.myCharacters) lists.characters.set(id, ch);
    }

    const now = clock();
    for (const [key, p] of pending.current) {
      const [kind, id] = key.split('/') as [DocKind, string];
      const server = lists[kind].get(id);
      if (p.expires < now || (p.expires !== Infinity && sameDoc(server, p.value))) {
        pending.current.delete(key);
        continue;
      }
      if (p.value) lists[kind].set(id, p.value);
      else lists[kind].delete(id);
    }

    const next: Data = {
      characters: ([...lists.characters.values()] as Character[]).sort(byCreation),
      codexes: ([...lists.codexes.values()] as Codex[]).sort(byCreation),
    };
    current.current = next;
    setData(next);
  };

  /** Acompanha os Codex do Mestre e os que os personagens daqui entraram, com seus jogadores. */
  const watchCodexes = () => {
    const { db } = firebase();
    const s = sources.current;
    const ids = new Set([...s.ownedCodexes.keys()]);
    for (const ch of s.myCharacters.values()) if (ch.codexId) ids.add(ch.codexId);

    const wanted = new Set<string>();
    for (const id of ids) {
      wanted.add(`players/${id}`);
      if (!s.ownedCodexes.has(id)) wanted.add(`codex/${id}`);
    }
    for (const [key, unsubscribe] of watchers.current) {
      if (wanted.has(key)) continue;
      unsubscribe();
      watchers.current.delete(key);
      received.current.delete(key);
      const id = key.split('/')[1];
      if (key.startsWith('players/')) s.codexCharacters.delete(id);
      else s.joinedCodexes.delete(id);
    }
    for (const key of wanted) {
      if (watchers.current.has(key)) continue;
      const id = key.split('/')[1];
      const unsubscribe = key.startsWith('players/')
        ? onSnapshot(
            query(collection(db, 'characters'), where('codexId', '==', id)),
            (snap) => {
              s.codexCharacters.set(id, new Map(snap.docs.map((d) => [d.id, normalize('characters', d.id, d.data()) as Character])));
              received.current.add(key);
              rebuild();
            },
            (e) => setError(describe(e)),
          )
        : onSnapshot(
            doc(db, 'codexes', id),
            (snap) => {
              if (snap.exists()) s.joinedCodexes.set(id, normalize('codexes', id, snap.data()) as Codex);
              else s.joinedCodexes.delete(id);
              received.current.add(key);
              rebuild();
            },
            (e) => setError(describe(e)),
          );
      watchers.current.set(key, unsubscribe);
    }
  };

  /** Descarta a cópia se ela for de outra conta (app reinstalado, por exemplo). */
  const dropForeignCache = (owner: string | undefined) => {
    const me = uidRef.current;
    if (!cache.current || !me || owner === me) return;
    cache.current = null;
    setHasCache(false);
    setCacheUid(undefined);
    rebuild();
  };
  const cacheOwner = useRef<string>(undefined);

  // Abre na hora com a cópia da última sincronização, enquanto o servidor responde.
  useEffect(() => {
    readCache()
      .then((saved) => {
        if (!saved || isSynced.current) return;
        cache.current = saved.data;
        cacheOwner.current = saved.uid;
        setCacheUid(saved.uid);
        setHasCache(true);
        rebuild();
        dropForeignCache(saved.uid);
      })
      .catch(() => {
        // Cópia ilegível: espera o servidor.
      });
    // `rebuild` só usa refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Login anônimo: cada aparelho ganha uma conta, guardada entre aberturas do app.
  useEffect(() => {
    const { auth } = firebase();
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        uidRef.current = user.uid;
        setUid(user.uid);
        dropForeignCache(cacheOwner.current);
      } else {
        signInAnonymously(auth).catch((e) => setError(describe(e)));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => {
    if (!uid) return;
    const { db } = firebase();
    const s = sources.current;
    ready.current = { characters: false, codexes: false };
    const markReady = (kind: 'characters' | 'codexes') => {
      ready.current[kind] = true;
      rebuild();
    };
    const codexWatchers = watchers.current;
    const firstResponses = received.current;
    let unsubscribers: Unsubscribe[] = [];
    let cancelled = false;

    migrateLocalData(uid)
      .catch((e) => Alert.alert('Não foi possível enviar os dados antigos', describe(e)))
      .finally(() => {
        if (cancelled) return;
        unsubscribers = [
          onSnapshot(
            query(collection(db, 'characters'), where('ownerUid', '==', uid)),
            (snap) => {
              s.myCharacters = new Map(snap.docs.map((d) => [d.id, normalize('characters', d.id, d.data()) as Character]));
              markReady('characters');
            },
            (e) => setError(describe(e)),
          ),
          onSnapshot(
            query(collection(db, 'codexes'), where('ownerUid', '==', uid)),
            (snap) => {
              s.ownedCodexes = new Map(snap.docs.map((d) => [d.id, normalize('codexes', d.id, d.data()) as Codex]));
              markReady('codexes');
            },
            (e) => setError(describe(e)),
          ),
        ];
      });

    return () => {
      cancelled = true;
      unsubscribers.forEach((u) => u());
      codexWatchers.forEach((u) => u());
      codexWatchers.clear();
      firstResponses.clear();
    };
    // `rebuild` só usa refs; recriar as assinaturas quando a conta muda ou ao tentar de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, attempt]);

  // Cópia local para o app abrir na hora e para o widget da tela inicial (que lê com o app fechado).
  useEffect(() => {
    if (!synced || !uid) return;
    const mine = data.characters.filter((c) => c.ownerUid === uid || !c.ownerUid);
    Promise.all([
      AsyncStorage.setItem(CHARACTERS_KEY, JSON.stringify(mine)),
      AsyncStorage.setItem(CODEXES_KEY, JSON.stringify(data.codexes)),
      AsyncStorage.setItem(CACHE_CHARACTERS_KEY, JSON.stringify(data.characters)),
      AsyncStorage.setItem(CACHE_UID_KEY, uid),
    ])
      .then(refreshWidget)
      .catch(() => {
        // Sem espaço no aparelho: o app continua funcionando, só abre mais devagar.
      });
  }, [synced, uid, data]);

  const retry = useCallback(() => {
    setError(undefined);
    setAttempt((n) => n + 1);
  }, []);

  // As ações só usam refs, então podem ser criadas uma vez.
  const actions = useMemo(() => {
    /**
     * Aplica uma mudança: mostra na hora e grava numa transação. Se outro celular mudou os
     * mesmos documentos antes, a mudança é refeita sobre a versão do servidor.
     */
    const mutate = (change: (d: Data) => Data, precomputed?: Data) => {
      const owner = uidRef.current;
      if (!owner) return;
      const base = current.current;
      const next = precomputed ?? change(base);
      const changes = diffData(base, next).map((c) => ({ ...c, value: c.value && withOwner(c.value, owner) }));
      if (changes.length === 0) return;

      const keys = changes.map((c) => `${c.kind}/${c.id}`);
      changes.forEach((c, i) => pending.current.set(keys[i], { value: c.value, expires: Infinity }));
      rebuild();

      const { db } = firebase();
      runTransaction(db, async (tx) => {
        const snaps = await Promise.all(changes.map((c) => tx.get(doc(db, c.kind, c.id))));
        let fresh = base;
        let stale = false;
        snaps.forEach((snap, i) => {
          const { kind, id } = changes[i];
          const server = snap.exists() ? normalize(kind, id, snap.data()) : null;
          const known = (base[kind] as Doc[]).find((d) => d.id === id) ?? null;
          if (!sameDoc(server, known)) stale = true;
          fresh = replaceDoc(fresh, kind, id, server);
        });
        const writes: DocChange[] = stale
          ? diffData(fresh, change(fresh)).map((c) => ({ ...c, value: c.value && withOwner(c.value, owner) }))
          : changes;
        for (const w of writes) {
          const ref = doc(db, w.kind, w.id);
          if (w.value) tx.set(ref, w.value);
          else tx.delete(ref);
        }
        return writes;
      })
        .then((writes) => {
          keys.forEach((k) => pending.current.delete(k));
          // Mantém o valor gravado até o servidor confirmar, para a tela não piscar.
          for (const w of writes) pending.current.set(`${w.kind}/${w.id}`, { value: w.value, expires: clock() + 5000 });
          rebuild();
        })
        .catch((e) => {
          keys.forEach((k) => pending.current.delete(k));
          rebuild();
          Alert.alert('Não foi possível salvar', describe(e));
        });
    };

    const updateCharacter = (id: string, change: (c: Character) => Character) => mutate((d) => mapCharacter(d, id, change));
    const updateCodex = (id: string, change: (c: Codex) => Codex) => mutate((d) => mapCodex(d, id, change));
    const isMine = (x: { ownerUid?: string }) => !x.ownerUid || x.ownerUid === uidRef.current;

    return {
      updateCharacter,
      updateCodex,

      saveCharacter: (character: Character) => {
        const { characters } = current.current;
        const exists = characters.some((c) => c.id === character.id);
        if (!exists && characters.filter(isMine).length >= MAX_CHARACTERS) {
          return `Você já tem ${MAX_CHARACTERS} personagens. Apague um para criar outro.`;
        }
        mutate((d) => ({
          ...d,
          characters: d.characters.some((c) => c.id === character.id)
            ? d.characters.map((c) => (c.id === character.id ? character : c))
            : [...d.characters, character],
        }));
        return null;
      },

      deleteCharacter: (id: string) =>
        mutate((d) => ({
          characters: d.characters.filter((c) => c.id !== id),
          codexes: d.codexes.map((codex) => withoutCharacter(codex, id)),
        })),

      saveCodex: (codex: Codex) =>
        mutate((d) => ({
          ...d,
          codexes: d.codexes.some((c) => c.id === codex.id) ? d.codexes.map((c) => (c.id === codex.id ? codex : c)) : [...d.codexes, codex],
        })),

      deleteCodex: (id: string) =>
        mutate((d) => ({
          codexes: d.codexes.filter((c) => c.id !== id),
          characters: d.characters.map((c) => (c.codexId === id ? { ...c, codexId: undefined } : c)),
        })),

      joinCodex: async (characterId: string, code: string) => {
        const { db } = firebase();
        const me = uidRef.current;
        try {
          const snap = await getDocs(query(collection(db, 'codexes'), where('code', '==', code.trim().toUpperCase()), limit(1)));
          if (snap.empty || !me) return 'Nenhum Codex encontrado com esse código.';
          const found = normalize('codexes', snap.docs[0].id, snap.docs[0].data()) as Codex;
          const join = (codex: Codex): Codex =>
            codex.ownerUid === me || codex.members.includes(me) ? codex : { ...codex, members: [...codex.members, me] };
          mutate((d) => {
            const known = d.codexes.find((c) => c.id === found.id);
            const startingItems = (known ?? found).startingItems;
            // O inventário inicial é entregue uma vez por Codex: sair e voltar não duplica.
            const codex = known ?? found;
            const enter = (entering: Character): Character => {
              // Quem entra recebe a classe inicial do Codex (e as habilidades dela).
              const c =
                entering.codexId === found.id
                  ? entering
                  : applyClass({ ...entering, classId: undefined }, codex, startingClassOf(codex));
              const received = c.startingItemsFrom ?? [];
              if (received.includes(found.id)) return { ...c, codexId: found.id };
              return {
                ...c,
                codexId: found.id,
                inventory: addToInventory(c.inventory, startingItems),
                startingItemsFrom: [...received, found.id],
              };
            };
            return {
              characters: d.characters.map((c) => (c.id === characterId ? enter(c) : c)),
              codexes: known ? d.codexes.map((c) => (c.id === found.id ? join(c) : c)) : [...d.codexes, join(found)],
            };
          });
          return null;
        } catch (e) {
          return describe(e);
        }
      },

      leaveCodex: (characterId: string) =>
        mutate((d) => ({
          characters: d.characters.map((c) => (c.id === characterId ? leaveClass(d, c) : c)),
          codexes: d.codexes.map((codex) => withoutCharacter(codex, characterId)),
        })),

      removeFromCodex: (codexId: string, characterId: string) => {
        const { characters, codexes } = current.current;
        const codex = codexes.find((c) => c.id === codexId);
        const character = characters.find((c) => c.id === characterId && c.codexId === codexId);
        if (!codex || !character) return 'Personagem não está neste Codex.';
        const fighting = codex.battles.some((b) => b.status === 'ativa' && b.participants.some((p) => p.characterId === characterId));
        if (fighting) return `${character.name} está em uma batalha ativa. Encerre a batalha antes de remover.`;
        // O jogador perde o acesso ao Codex se não tiver outro personagem nele.
        const keepsMember = characters.some((c) => c.id !== characterId && c.codexId === codexId && c.ownerUid === character.ownerUid);
        mutate((d) => ({
          characters: d.characters.map((c) => (c.id === characterId ? leaveClass(d, c) : c)),
          codexes: d.codexes.map((cx) =>
            cx.id === codexId
              ? {
                  ...withoutCharacter(cx, characterId),
                  members: keepsMember ? cx.members : cx.members.filter((uid) => uid !== character.ownerUid),
                }
              : cx,
          ),
        }));
        return null;
      },

      buyItem: (characterId: string, codexId: string, shopId: string, itemId: string) => {
        const { characters, codexes } = current.current;
        const character = characters.find((c) => c.id === characterId);
        const shop = codexes.find((c) => c.id === codexId)?.shops.find((s) => s.id === shopId);
        const item = shop?.items.find((i) => i.id === itemId);
        if (!character || !shop || !item) return 'Item indisponível.';
        if (!shop.visibleTo.includes(characterId)) return 'Esta loja não está disponível para você.';
        if (character.gold < item.price) return 'Ouro insuficiente.';
        if (item.mountId) {
          if (!codexes.find((c) => c.id === codexId)?.mounts.some((m) => m.id === item.mountId)) return 'Esta montaria não existe mais.';
          if (character.mountIds.includes(item.mountId)) return 'Você já tem esta montaria.';
        }
        updateCharacter(characterId, (c) => {
          if (c.gold < item.price) throw new ActionError('Ouro insuficiente.');
          if (item.mountId) {
            if (c.mountIds.includes(item.mountId)) throw new ActionError('Você já tem esta montaria.');
            return { ...c, gold: c.gold - item.price, mountIds: [...c.mountIds, item.mountId] };
          }
          return {
            ...c,
            gold: c.gold - item.price,
            inventory: addToInventory(c.inventory, [
              { id: newId(), name: item.name, quantity: 1, description: item.description, ...(item.photoUri ? { photoUri: item.photoUri } : {}) },
            ]),
          };
        });
        return null;
      },

      saveAbility: (codexId: string, ability: CodexAbility) => {
        const updated = toCharacterAbility(ability);
        mutate((d) => {
          const previous = d.codexes.find((c) => c.id === codexId)?.abilities.find((a) => a.id === ability.id);
          return {
            codexes: mapCodex(d, codexId, (codex) => ({
              ...codex,
              abilities: codex.abilities.some((a) => a.id === ability.id)
                ? codex.abilities.map((a) => (a.id === ability.id ? ability : a))
                : [...codex.abilities, ability],
            })).codexes,
            characters: d.characters.map((c) => {
              const owns = c.abilities.some((a) => a.id === ability.id);
              const inCodex = c.codexId === codexId;
              // Habilidade de classe: todos da classe a recebem; quem só a tinha pela classe antiga perde.
              if (inCodex && ability.classId && c.classId === ability.classId) {
                return { ...c, abilities: owns ? c.abilities.map((a) => (a.id === ability.id ? updated : a)) : [...c.abilities, updated] };
              }
              if (inCodex && owns && previous?.classId && previous.classId !== ability.classId && c.classId === previous.classId) {
                return { ...c, abilities: c.abilities.filter((a) => a.id !== ability.id) };
              }
              return owns ? { ...c, abilities: c.abilities.map((a) => (a.id === ability.id ? updated : a)) } : c;
            }),
          };
        });
      },

      deleteAbility: (codexId: string, abilityId: string) =>
        mutate((d) => ({
          codexes: mapCodex(d, codexId, (codex) => ({ ...codex, abilities: codex.abilities.filter((a) => a.id !== abilityId) })).codexes,
          characters: d.characters.map((c) => ({ ...c, abilities: c.abilities.filter((a) => a.id !== abilityId) })),
        })),

      saveClass: (codexId: string, klass: CodexClass) =>
        mutate((d) =>
          mapCodex(d, codexId, (codex) => ({
            ...codex,
            classes: codex.classes.some((k) => k.id === klass.id)
              ? codex.classes.map((k) => (k.id === klass.id ? klass : k))
              : [...codex.classes, klass],
          })),
        ),

      deleteClass: (codexId: string, classId: string) =>
        mutate((d) => {
          const codex = d.codexes.find((c) => c.id === codexId);
          if (!codex) return d;
          return {
            characters: d.characters.map((c) => (c.codexId === codexId && c.classId === classId ? applyClass(c, codex, undefined) : c)),
            codexes: mapCodex(d, codexId, (cx) => ({
              ...cx,
              classes: cx.classes.filter((k) => k.id !== classId),
              abilities: cx.abilities.filter((a) => a.classId !== classId),
              startingClassId: cx.startingClassId === classId ? undefined : cx.startingClassId,
            })).codexes,
          };
        }),

      setStartingClass: (codexId: string, classId: string) =>
        mutate((d) => mapCodex(d, codexId, (codex) => ({ ...codex, startingClassId: classId }))),

      respondClassOffer: (characterId: string, codexId: string, classId: string, accept: boolean) =>
        mutate((d) => {
          const codex = d.codexes.find((c) => c.id === codexId);
          const klass = codex?.classes.find((k) => k.id === classId);
          if (!codex || !klass || !klass.offeredTo.includes(characterId)) return d;
          const next = mapCodex(d, codexId, (cx) => ({
            ...cx,
            classes: cx.classes.map((k) => (k.id === classId ? { ...k, offeredTo: k.offeredTo.filter((id) => id !== characterId) } : k)),
          }));
          return accept ? mapCharacter(next, characterId, (c) => applyClass(c, codex, classId)) : next;
        }),

      respondAbilityOffer: (characterId: string, codexId: string, abilityId: string, accept: boolean) => {
        const offered = current.current.codexes.find((c) => c.id === codexId)?.abilities.find((a) => a.id === abilityId);
        if (!offered || !offered.offeredTo.includes(characterId)) return;
        mutate((d) => {
          const ability = d.codexes.find((c) => c.id === codexId)?.abilities.find((a) => a.id === abilityId);
          if (!ability || !ability.offeredTo.includes(characterId)) return d;
          const next = mapCodex(d, codexId, (codex) => ({
            ...codex,
            abilities: codex.abilities.map((a) =>
              a.id === abilityId ? { ...a, offeredTo: a.offeredTo.filter((id) => id !== characterId) } : a,
            ),
          }));
          if (!accept) return next;
          return mapCharacter(next, characterId, (c) =>
            c.abilities.some((a) => a.id === abilityId) ? c : { ...c, abilities: [...c.abilities, toCharacterAbility(ability)] },
          );
        });
      },

      revokeAbility: (characterId: string, abilityId: string) =>
        updateCharacter(characterId, (c) => ({ ...c, abilities: c.abilities.filter((a) => a.id !== abilityId) })),

      saveMount: (codexId: string, mount: Mount, ownerIds: string[]) =>
        mutate((d) => ({
          codexes: mapCodex(d, codexId, (codex) => ({
            ...codex,
            mounts: codex.mounts.some((m) => m.id === mount.id)
              ? codex.mounts.map((m) => (m.id === mount.id ? mount : m))
              : [...codex.mounts, mount],
            // O nome na loja acompanha a montaria.
            shops: codex.shops.map((s) => ({
              ...s,
              items: s.items.map((i) => (i.mountId === mount.id ? { ...i, name: mount.name, photoUri: mount.photoUri } : i)),
            })),
          })).codexes,
          characters: d.characters.map((c) => {
            if (c.codexId !== codexId) return c;
            const owns = c.mountIds.includes(mount.id);
            const should = ownerIds.includes(c.id);
            if (owns === should) return c;
            return { ...c, mountIds: should ? [...c.mountIds, mount.id] : c.mountIds.filter((id) => id !== mount.id) };
          }),
        })),

      deleteMount: (codexId: string, mountId: string) =>
        mutate((d) => ({
          codexes: mapCodex(d, codexId, (codex) => ({
            ...codex,
            mounts: codex.mounts.filter((m) => m.id !== mountId),
            shops: codex.shops.map((s) => ({ ...s, items: s.items.filter((i) => i.mountId !== mountId) })),
          })).codexes,
          characters: d.characters.map((c) => (c.mountIds.includes(mountId) ? { ...c, mountIds: c.mountIds.filter((id) => id !== mountId) } : c)),
        })),

      act: (rule: (data: Data) => Result) => {
        const result = rule(current.current);
        if ('error' in result) return result.error;
        mutate((d) => {
          const retry = rule(d);
          if ('error' in retry) throw new ActionError(retry.error);
          return retry.data;
        }, result.data);
        return null;
      },
    };
    // Criadas uma vez: só usam refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => {
    const me = uid ?? cacheUid;
    const myCharacters = data.characters.filter((c) => !c.ownerUid || c.ownerUid === me);
    const myCodexes = data.codexes.filter((c) => !c.ownerUid || c.ownerUid === me);
    return { loaded: synced || hasCache, synced, error, retry, uid: me, ...data, myCharacters, myCodexes, ...actions };
  }, [synced, hasCache, error, retry, uid, cacheUid, data, actions]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore precisa estar dentro de <StoreProvider>');
  return store;
}
