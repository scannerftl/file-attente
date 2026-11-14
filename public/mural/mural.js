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
    $('#guichet-courant').classList.remove('actif');
    return;
  }
  $('#num-courant').textContent = pad(ticket.numero);
  $('#guichet-courant').innerHTML =
    `<svg class="ico"><use href="/shared/icones.svg#i-fleche"/></svg>Guichet ${ticket.guichet ?? '?'}`;
  $('#guichet-courant').classList.add('actif');
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
  $('#recents-vide').classList.toggle('cachee', recents.length > 0);
  for (const t of recents) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${pad(t.numero)}</span><span class="g">Guichet <strong>${t.guichet ?? '?'}</strong></span>`;
    ul.appendChild(li);
  }
}

/** Recharge l'état complet (au démarrage et en repli polling). */
async function rechargerEtat(animer) {
  const etat = await API.get('/api/mural');
  afficherCourant(etat.courant, animer);
  // Le premier des appels récents est l'appel courant : on ne le répète pas.
  afficherRecents(etat.recents.slice(1));
}

/** Horloge de l'en-tête (heure + date du jour). */
function majHorloge() {
  const d = new Date();
  $('#heure').textContent = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  $('#date').textContent = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
majHorloge();
setInterval(majHorloge, 1000);

const badge = $('#badge');
connecterTempsReel(
  (ev) => {
    // Push : un appel a eu lieu → mise à jour instantanée + rechargement de l'historique.
    // Personnalisation modifiée en administration → mise à jour immédiate.
    if (ev.type === 'marque') Marque.charger();
    if (ev.type === 'appel') {
      afficherCourant(ev.ticket, true);
      rechargerEtat(false).catch(() => {});
    }
  },
  (etat) => {
    badge.className = 'badge-connexion ' + (etat === 'ok' ? 'ok' : 'ko');
    badge.textContent = etat === 'ok' ? 'Temps réel' : 'Reconnexion…';
  },
  () => rechargerEtat(false).catch(() => {}) // repli polling 2 s
);

rechargerEtat(false).catch((e) => console.error(e));
