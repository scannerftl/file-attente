/* =====================================================================
   IHM Écran mural — logique d'écran (maquette 4.1, tableau 4.2).
   Observateur : reçoit l'événement 'appel' poussé par le serveur et met à
   jour l'affichage instantanément. Repli en polling 2 s si le WS tombe.
   ===================================================================== */
const $ = (sel) => document.querySelector(sel);

function pad(n) { return String(n).padStart(3, '0'); }

function afficherCourant(ticket, animer) {
  if (!ticket) {
    $('#num-courant').textContent = '—';
    $('#guichet-courant').textContent = "En attente d'appel";
    return;
  }
  $('#num-courant').textContent = pad(ticket.numero);
  $('#guichet-courant').textContent = '→ GUICHET ' + (ticket.guichet ?? '?');
  if (animer) {
    const el = $('#num-courant');
    el.classList.remove('flash');
    void el.offsetWidth; // force le redémarrage de l'animation
    el.classList.add('flash');
  }
}

function afficherRecents(recents) {
  const ul = $('#recents');
  ul.innerHTML = '';
  for (const t of recents) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${pad(t.numero)}</span><span class="g">G${t.guichet ?? '?'}</span>`;
    ul.appendChild(li);
  }
}

/** Recharge l'état complet (au démarrage et en repli polling). */
async function rechargerEtat(animer) {
  const etat = await API.get('/api/mural');
  afficherCourant(etat.courant, animer);
  afficherRecents(etat.recents);
}

const badge = $('#badge');
connecterTempsReel(
  (ev) => {
    // Push : un appel a eu lieu → mise à jour instantanée + rechargement de l'historique.
    if (ev.type === 'appel') {
      afficherCourant(ev.ticket, true);
      rechargerEtat(false).catch(() => {});
    }
  },
  (etat) => {
    badge.className = 'badge-connexion ' + (etat === 'ok' ? 'ok' : 'ko');
    badge.textContent = etat === 'ok' ? 'temps réel' : 'polling';
  },
  () => rechargerEtat(false).catch(() => {}) // repli polling 2 s
);

rechargerEtat(false).catch((e) => console.error(e));
