import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translate, translateText, type Language, type Params } from './i18n-core';
import { LANGUAGE_KEY } from './storage-keys';

export { LANGUAGES, type Language } from './i18n-core';

type I18n = {
  lang: Language;
  setLang: (lang: Language) => void;
  /** Texto do app: a chave é o texto em português. */
  t: (key: string, params?: Params) => string;
  /** Texto já montado em português (registro da batalha, erros das regras). */
  tx: (text: string) => string;
};

/** Idioma atual, para textos fora de componentes (ex.: alertas do store). */
let current: Language = 'pt';
export const tNow = (key: string, params?: Params) => translate(current, key, params);
export const txNow = (text: string) => translateText(current, text);

const I18nContext = createContext<I18n>({ lang: 'pt', setLang: () => {}, t: (k, p) => translate('pt', k, p), tx: (s) => s });

/** Idioma escolhido nas opções da tela inicial; fica salvo no aparelho. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('pt');

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((saved) => {
        if (saved === 'en' || saved === 'pt') {
          current = saved;
          setLangState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang: (next) => {
        current = next;
        setLangState(next);
        AsyncStorage.setItem(LANGUAGE_KEY, next).catch(() => {});
      },
      t: (key, params) => translate(lang, key, params),
      tx: (text) => translateText(lang, text),
    }),
    [lang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useT = () => useContext(I18nContext);
