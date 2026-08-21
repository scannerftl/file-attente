'use strict';

const { WebSocketServer } = require('ws');

/**
 * Adaptateur WebSocket du patron Observateur (décision d'archi Partie 2.3 :
 * stratégie « push »). Chaque client WebSocket (écran mural, poste agent)
 * devient un observateur de ServiceNotification : dès qu'un appel a lieu, le
 * serveur pousse l'événement — pas de polling nécessaire.
 *
 * @param {import('http').Server} serveurHttp
 * @param {import('../metier/ServiceNotification')} notification
 */
function brancherWebSocket(serveurHttp, notification) {
  const wss = new WebSocketServer({ server: serveurHttp, path: '/ws' });

  wss.on('connection', (ws) => {
    // On enveloppe la socket dans un observateur au contrat { notifier(ev) }.
    const observateur = {
      notifier(evenement) {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(evenement));
        }
      },
    };
    const desabonner = notification.abonner(observateur);

    ws.on('close', desabonner);
    ws.on('error', desabonner);

    // Message de bienvenue (permet au client de confirmer la connexion push).
    ws.send(JSON.stringify({ type: 'bienvenue', observateurs: notification.nbObservateurs }));
  });

  return wss;
}

module.exports = { brancherWebSocket };
