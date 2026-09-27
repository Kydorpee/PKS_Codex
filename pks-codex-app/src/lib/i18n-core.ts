/**
 * Tradução do app. O texto em português é a própria chave: em português ele aparece como está;
 * em inglês, é trocado pelo dicionário (`EN`). Parâmetros vão entre chaves: `t('Vez de {name}', { name })`.
 * Módulo puro (sem React), para os testes.
 */
import { EN } from './i18n-en';

export type Language = 'pt' | 'en';

export const LANGUAGES: { key: Language; label: string }[] = [
  { key: 'pt', label: 'Português (Brasil)' },
  { key: 'en', label: 'English' },
];

export type Params = Record<string, string | number | undefined>;

export const format = (template: string, params?: Params) =>
  params ? template.replace(/\{(\w+)\}/g, (all, key: string) => (params[key] === undefined ? all : String(params[key]))) : template;

/** Traduz um texto do app (a chave em português), com os parâmetros. Os valores dos parâmetros também são traduzidos, se forem textos do sistema. */
export function translate(lang: Language, key: string, params?: Params): string {
  if (lang === 'pt') return format(key, params);
  const translated = params
    ? Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === 'string' ? translateText(lang, v) : v]))
    : undefined;
  return format(EN[key] ?? key, translated);
}

type Pattern = { regex: RegExp; names: string[]; key: string };
const GREEDY = new Set(['label', 'ability', 'item']);
let patterns: Pattern[] | undefined;

/** Modelos com parâmetros do dicionário, do mais específico (mais texto fixo) para o menos. */
function templatePatterns(): Pattern[] {
  if (patterns) return patterns;
  patterns = Object.keys(EN)
    .filter((key) => /\{\w+\}/.test(key))
    .map((key) => {
      const names: string[] = [];
      const source = key
        .split(/(\{\w+\})/)
        .map((part) => {
          const m = /^\{(\w+)\}$/.exec(part);
          if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          names.push(m[1]);
          // Nomes de habilidades e itens costumam ter "de" ("Bola de Fogo"): esses pegam o máximo.
          return GREEDY.has(m[1]) ? '(.+)' : '(.+?)';
        })
        .join('');
      return { regex: new RegExp(`^${source}$`, 's'), names, key };
    })
    .sort((a, b) => b.key.replace(/\{\w+\}/g, '').length - a.key.replace(/\{\w+\}/g, '').length);
  return patterns;
}

/**
 * Traduz um texto já montado em português (registro da batalha, mensagens de erro das regras),
 * reconhecendo o modelo que o gerou. Textos que não são do sistema (nomes) ficam como estão.
 */
export function translateText(lang: Language, text: string): string {
  if (lang === 'pt' || !text) return text;
  const exact = EN[text];
  if (exact !== undefined) return exact;
  for (const p of templatePatterns()) {
    const m = p.regex.exec(text);
    if (!m) continue;
    const params: Params = {};
    p.names.forEach((name, i) => (params[name] = m[i + 1]));
    return translate(lang, p.key, params);
  }
  return text;
}
