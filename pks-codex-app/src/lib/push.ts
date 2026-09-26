/**
 * Notificações push (Android, via FCM). O aparelho registra o token em `pushTokens/{token}`
 * e a Cloud Function (pasta functions/) envia o aviso quando o turno passa ou alguém sobe de nível.
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebase } from './firebase';

/** Canal do Android para turnos e eventos de nível (mesmo id usado pela Cloud Function). */
export const PUSH_CHANNEL = 'jogo';

/** Dados que a Cloud Function manda junto com a notificação. */
type PushData = { kind?: 'turno' | 'nivel'; codexId?: string; battleId?: string; characterId?: string; eventId?: string };

// Com o app aberto o aviso já aparece no banner do app: a notificação só fica na bandeja.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: false, shouldShowList: true }),
});

async function register(uid: string) {
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
    name: 'Turnos e eventos do jogo',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 120, 250],
    lightColor: '#D4AF37',
  });
  const current = await Notifications.getPermissionsAsync();
  const { granted } = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!granted) return;
  const { data: token } = await Notifications.getDevicePushTokenAsync();
  await saveToken(uid, String(token));
}

/** O token é o id do documento: o mesmo aparelho nunca aparece duas vezes. */
const saveToken = (uid: string, token: string) =>
  setDoc(doc(firebase().db, 'pushTokens', token), { uid, platform: Platform.OS, updatedAt: serverTimestamp() });

function open(data: PushData) {
  if (!data.codexId) return;
  if (data.kind === 'nivel' && data.eventId) {
    router.push({ pathname: '/codex/nivel', params: { codexId: data.codexId, eventId: data.eventId } });
  } else if (data.battleId) {
    router.push({
      pathname: '/batalha/[id]',
      params: { id: data.battleId, codexId: data.codexId, ...(data.characterId ? { characterId: data.characterId } : {}) },
    });
  }
}

/** Registra este aparelho para receber push e abre a tela certa ao tocar numa notificação. */
export function usePushNotifications(uid: string | undefined, ready: boolean) {
  useEffect(() => {
    if (!uid || Platform.OS !== 'android') return;
    // Sem google-services.json (ou no Expo Go) o token não existe: o app segue só com o aviso interno.
    register(uid).catch(() => {});
    const renewed = Notifications.addPushTokenListener(({ data }) => {
      saveToken(uid, String(data)).catch(() => {});
    });
    return () => renewed.remove();
  }, [uid]);

  useEffect(() => {
    if (!ready || Platform.OS !== 'android') return;
    // App aberto pela notificação (estava fechado).
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          open(response.notification.request.content.data as PushData);
          Notifications.clearLastNotificationResponse();
        }
      })
      .catch(() => {});
    const tapped = Notifications.addNotificationResponseReceivedListener((response) =>
      open(response.notification.request.content.data as PushData),
    );
    return () => tapped.remove();
  }, [ready]);
}
