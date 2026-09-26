/**
 * Funções puras da sincronização: descobrem quais documentos (personagens e Codex)
 * uma ação mudou, para gravar só eles no Firestore.
 */
import type { Data } from './engine';
import type { Character, Codex } from './types';

export type DocKind = 'characters' | 'codexes';
export type Doc = Character | Codex;

/** Um documento criado/alterado (value) ou apagado (null). */
export type DocChange = { kind: DocKind; id: string; value: Doc | null };

/** JSON com chaves ordenadas: o Firestore devolve os campos em outra ordem. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const sameDoc = (a: Doc | null | undefined, b: Doc | null | undefined) =>
  (a ?? null) === (b ?? null) || (!!a && !!b && stableStringify(a) === stableStringify(b));

const KINDS: DocKind[] = ['characters', 'codexes'];

/** Documentos que mudaram de `before` para `after`. */
export function diffData(before: Data, after: Data): DocChange[] {
  const changes: DocChange[] = [];
  for (const kind of KINDS) {
    const old = new Map<string, Doc>(before[kind].map((d) => [d.id, d]));
    const next = new Map<string, Doc>(after[kind].map((d) => [d.id, d]));
    for (const [id, value] of next) {
      if (!sameDoc(old.get(id), value)) changes.push({ kind, id, value });
    }
    for (const id of old.keys()) {
      if (!next.has(id)) changes.push({ kind, id, value: null });
    }
  }
  return changes;
}

/** Substitui (ou remove, com null) um documento nos dados. */
export function replaceDoc(data: Data, kind: DocKind, id: string, value: Doc | null): Data {
  const list = (data[kind] as Doc[]).filter((d) => d.id !== id);
  if (value) list.push(value);
  return { ...data, [kind]: list };
}

/** Novos documentos passam a pertencer a quem os criou. */
export const withOwner = <T extends Doc>(value: T, uid: string): T => (value.ownerUid ? value : { ...value, ownerUid: uid });
