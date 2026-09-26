/**
 * Ponto de entrada seguro do widget. A biblioteca nativa só é carregada quando o módulo
 * existe: no Expo Go e no iOS estas funções simplesmente não fazem nada.
 */
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

export const WIDGET_NAME = 'PksCharacter';

export function widgetSupported(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    return TurboModuleRegistry.get('AndroidWidget') != null || NativeModules.AndroidWidget != null;
  } catch {
    return false;
  }
}

/** Registra quem desenha o widget quando o Android pede (adicionado, atualizado, redimensionado). */
export function registerWidget() {
  if (!widgetSupported()) return;
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}

let pending: ReturnType<typeof setTimeout> | undefined;

/** Redesenha os widgets na tela inicial. Agrupa chamadas seguidas. */
export function refreshWidget() {
  if (!widgetSupported()) return;
  clearTimeout(pending);
  pending = setTimeout(() => {
    const { requestWidgetUpdate } = require('react-native-android-widget');
    const { renderCharacterWidget } = require('./task-handler');
    requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => renderCharacterWidget() }).catch(() => {
      // Sem widget na tela inicial ou falha momentânea: o próximo salvamento tenta de novo.
    });
  }, 500);
}
