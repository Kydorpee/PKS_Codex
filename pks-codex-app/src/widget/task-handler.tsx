import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandler } from 'react-native-android-widget';
import { normalizeCharacter } from '@/lib/rules';
import { CHARACTERS_KEY, CODEXES_KEY, WIDGET_CHARACTER_KEY } from '@/lib/storage-keys';
import type { Character, Codex } from '@/lib/types';
import { CharacterWidget } from './character-widget';

/** Lê os dados salvos e monta o widget. Roda também com o app fechado. */
export async function renderCharacterWidget() {
  const [charactersJson, codexesJson, selectedId] = await Promise.all([
    AsyncStorage.getItem(CHARACTERS_KEY),
    AsyncStorage.getItem(CODEXES_KEY),
    AsyncStorage.getItem(WIDGET_CHARACTER_KEY),
  ]);
  const characters = charactersJson ? (JSON.parse(charactersJson) as Character[]).map(normalizeCharacter) : [];
  const codexes = codexesJson ? (JSON.parse(codexesJson) as Codex[]) : [];
  const character = characters.find((c) => c.id === selectedId) ?? characters[0];
  const codexName = codexes.find((c) => c.id === character?.codexId)?.name;
  return <CharacterWidget character={character} codexName={codexName} />;
}

export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetAction, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED') return;
  renderWidget(await renderCharacterWidget());
};
