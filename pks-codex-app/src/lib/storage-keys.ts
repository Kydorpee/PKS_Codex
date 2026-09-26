/** Chaves do AsyncStorage, compartilhadas pelo app e pelo widget da tela inicial. */
export const CHARACTERS_KEY = 'pks-codex/characters';
export const CODEXES_KEY = 'pks-codex/codexes';
/** Personagem mostrado no widget: o último cuja ficha foi aberta. */
export const WIDGET_CHARACTER_KEY = 'pks-codex/widget-character';
/** Marca que os dados antigos (salvos só no aparelho) já foram enviados ao Firebase. */
export const MIGRATED_KEY = 'pks-codex/migrated-to-firebase';
/** Cópia dos dados da última sincronização (com os colegas de Codex), para o app abrir na hora. */
export const CACHE_CHARACTERS_KEY = 'pks-codex/cache/characters';
/** Conta dona da cópia acima: se mudar, a cópia é descartada. */
export const CACHE_UID_KEY = 'pks-codex/cache/uid';
