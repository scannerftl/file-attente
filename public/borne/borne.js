/* =====================================================================
   IHM Borne — logique d'écran (maquette 4.1, tableau 4.2).
   Enchaînement : Accueil → (touche service) → prendreTicket(code)
   → confirmation + impression → retour accueil après 5 s.
   La borne NE FAIT QU'afficher/imprimer : c'est le GestionnaireFile
   (via l'API) qui attribue le numéro (point de conception 3.3).
   ===================================================================== */
const $ = (sel) => document.querySelector(sel);
let servicesConnus = {};

async function chargerServices() {
  const services = await API.get('/api/services');
  servicesConnus = Object.fromEntries(services.map((s) => [s.code, s.libelle]));
  const zone = $('#services');
  zone.innerHTML = '';
  for (const s of services) {
    const b = document.createElement('button');
    b.textContent = s.libelle;
    b.onclick = () => prendreTicket(s.code);
    zone.appendChild(b);
  }
}

async function prendreTicket(code) {
  try {
    const ticket = await API.post('/api/tickets', { codeService: code });
    afficherTicket(ticket);
  } catch (e) {
    alert('Impossible de prendre un ticket : ' + e.message);
  }
}

function afficherTicket(ticket) {
  $('#ticket-num').textContent = String(ticket.numero).padStart(3, '0');
  $('#ticket-svc').textContent = servicesConnus[ticket.codeService] || ticket.codeService;
  $('#vue-accueil').classList.add('cachee');
  $('#vue-ticket').classList.remove('cachee');

  // Retour automatique à l'accueil après 5 s (contrainte maquette 4.2).
  let reste = 5;
  $('#compte').textContent = reste;
  const t = setInterval(() => {
    reste -= 1;
    $('#compte').textContent = reste;
    if (reste <= 0) {
      clearInterval(t);
      $('#vue-ticket').classList.add('cachee');
      $('#vue-accueil').classList.remove('cachee');
    }
  }, 1000);
}

// Badge de connexion temps réel (non indispensable pour la borne).
const badge = $('#badge');
connecterTempsReel(
  () => {},
  (etat) => {
    badge.className = 'badge-connexion ' + (etat === 'ok' ? 'ok' : 'ko');
    badge.textContent = etat === 'ok' ? 'en ligne' : 'hors ligne';
  }
);

chargerServices().catch((e) => alert('Erreur de chargement : ' + e.message));
