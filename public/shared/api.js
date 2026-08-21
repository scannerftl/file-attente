/* =====================================================================
   Petite bibliothèque cliente partagée par les 3 IHM.
   - appels HTTP/JSON vers l'API métier
   - connexion WebSocket (push) avec REPLI automatique en polling 2 s
     (décision d'architecture Partie 2.3 / choix Partie 5.1).
   L'IHM n'appelle QUE ces fonctions ; jamais la base directement.
   ===================================================================== */
const API = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erreur || r.statusText);
    return r.json();
  },
  async post(url, corps) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps || {}),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erreur || r.statusText);
    return r.json();
  },
};

/**
 * Établit le flux temps réel.
 * @param {(ev:object)=>void} onEvenement  appelé pour chaque événement métier
 * @param {(etat:'ok'|'ko')=>void} [onEtat] callback d'état de connexion
 * @param {()=>void} [onPollFallback] appelé périodiquement quand le WS est HS
 */
function connecterTempsReel(onEvenement, onEtat, onPollFallback) {
  let ws = null;
  let pollTimer = null;

  const majEtat = (etat) => onEtat && onEtat(etat);

  const demarrerPolling = () => {
    if (pollTimer || !onPollFallback) return;
    pollTimer = setInterval(onPollFallback, 2000); // repli : polling 2 s
  };
  const arreterPolling = () => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  };

  const connecter = () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);

    ws.onopen = () => { majEtat('ok'); arreterPolling(); };
    ws.onmessage = (msg) => {
      try { onEvenement(JSON.parse(msg.data)); } catch (_) {}
    };
    ws.onclose = () => { majEtat('ko'); demarrerPolling(); setTimeout(connecter, 3000); };
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  };

  connecter();
}
