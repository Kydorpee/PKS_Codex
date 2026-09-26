/**
 * Notificações push do PKS Codex (com o app fechado). Publique com:
 *   npx firebase-tools deploy --only functions
 */
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const { codexEvents, MONSTER_TURN } = require('./events');

initializeApp();
const db = getFirestore();

/** Mesmo id de canal criado pelo app (src/lib/push.ts). */
const CHANNEL = 'jogo';

const INVALID_TOKEN = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

async function sendTo(uid, title, body, data) {
  if (!uid) return;
  const snap = await db.collection('pushTokens').where('uid', '==', uid).get();
  const tokens = snap.docs.map((d) => d.id);
  if (tokens.length === 0) return;

  const result = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    // O FCM só aceita textos nos dados.
    data: Object.fromEntries(Object.entries(data).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])),
    android: { priority: 'high', notification: { channelId: CHANNEL, tag: data.tag } },
  });
  // Aparelhos que desinstalaram o app: remove o token.
  await Promise.all(
    result.responses.map((r, i) =>
      !r.success && INVALID_TOKEN.has(r.error?.code) ? db.collection('pushTokens').doc(tokens[i]).delete() : null,
    ),
  );
}

async function character(id) {
  const snap = await db.collection('characters').doc(id).get();
  return snap.exists ? snap.data() : undefined;
}

exports.codexNotifications = onDocumentWritten('codexes/{codexId}', async (event) => {
  const codexId = event.params.codexId;
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  const events = codexEvents(before, after);

  for (const e of events) {
    try {
      if (e.kind === 'turno' && e.actor === MONSTER_TURN) {
        await sendTo(after.ownerUid, `👹 Vez de ${e.monsterName}`, `Rodada ${e.round} · Mestre, escolha a ação do monstro.`, {
          kind: 'turno',
          codexId,
          battleId: e.battleId,
          tag: `turno-${e.battleId}`,
        });
      } else if (e.kind === 'turno') {
        const c = await character(e.actor);
        if (!c) continue;
        await sendTo(c.ownerUid, `🔔 Sua vez, ${c.name}!`, `Rodada ${e.round} contra ${e.monsterName}. Toque para agir.`, {
          kind: 'turno',
          codexId,
          battleId: e.battleId,
          characterId: e.actor,
          tag: `turno-${e.battleId}`,
        });
      } else if (e.kind === 'nivel') {
        const c = await character(e.characterId);
        const name = c?.name ?? 'Um personagem';
        const body = e.count > 1 ? `${e.count} eventos de nível para definir.` : 'Toque para definir as recompensas.';
        await sendTo(after.ownerUid, `🆙 ${name} subiu para o nível ${e.level}!`, body, {
          kind: 'nivel',
          codexId,
          eventId: e.eventId,
          tag: `nivel-${e.characterId}`,
        });
      }
    } catch (err) {
      logger.error('Falha ao enviar notificação', { codexId, event: e, err: String(err) });
    }
  }
});
