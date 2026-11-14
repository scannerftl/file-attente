/* =====================================================================
   IHM Poste agent — logique d'écran (maquettes 4.1/4.2, séquence n°1).
   L'agent se connecte (matricule + mot de passe personnel) et choisit son
   guichet. Les actions se font au nom de l'agent connecté (vérifié par le
   serveur) : appelerSuivant(guichet) et cloturerTicket(num).
   Rafraîchit sa file à chaque événement temps réel (push), sinon polling.
   ===================================================================== */
const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);

let agent = null;          // { matricule, nom, services } une fois connecté
let guichet = Number(params.get('guichet') || lireLocal('guichet') || 1);
let ticketEnCours = null;
let libelles = {};

function lireLocal(cle) { try { return localStorage.getItem(cle); } catch (_) { return null; } }
function ecrireLocal(cle, v) { try { localStorage.setItem(cle, v); } catch (_) {} }

/* ---------- Connexion ---------- */

function afficherConnexion(message) {
  agent = null;
  $('#vue-connexion').classList.remove('cachee');
  $('#vue-poste').classList.add('cachee');
  $('#poste-config').classList.add('cachee');
  $('#titre-guichet').textContent = 'connexion';
  $('#cx-msg').textContent = message || '';
  $('#cx-mdp').value = '';
  const m = lireLocal('matricule');
  if (m && !$('#cx-matricule').value) $('#cx-matricule').value = m;
  ($('#cx-matricule').value ? $('#cx-mdp') : $('#cx-matricule')).focus();
}

function afficherPoste() {
  $('#vue-connexion').classList.add('cachee');
  $('#vue-poste').classList.remove('cachee');
  $('#poste-config').classList.remove('cachee');
  $('#agent-nom').textContent = agent.nom;
  $('#agent-matricule').textContent = agent.matricule;
  $('#sel-guichet').value = String(guichet);
  majTitre();
  rafraichir();
}

/** Réagit à une erreur d'API : session expirée → retour à la connexion. */
function gererErreur(e) {
  if (e && e.statut === 401) { afficherConnexion('Session expirée, reconnectez-vous.'); return true; }
  $('#message').textContent = 'Erreur : ' + e.message;
  $('#message').className = 'message alerte';
  return false;
}

/** Bloque le bouton pendant l'attente imposée après trop d'essais. */
function compteARebours(sec) {
  const bouton = $('#form-connexion button[type=submit]');
  bouton.disabled = true;
  const tic = () => {
    if (sec <= 0) { bouton.disabled = false; $('#cx-msg').textContent = ''; return; }
    $('#cx-msg').textContent = `Trop d'essais. Réessayez dans ${sec} s.`;
    sec -= 1;
    setTimeout(tic, 1000);
  };
  tic();
}

$('#form-connexion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const matricule = $('#cx-matricule').value.trim();
  const motDePasse = $('#cx-mdp').value;
  if (!matricule || !motDePasse) { $('#cx-msg').textContent = 'Saisissez votre matricule et votre mot de passe.'; return; }
  const bouton = e.target.querySelector('button[type=submit]');
  bouton.disabled = true;
  try {
    const rep = await API.post('/api/agent/connexion', { matricule, motDePasse });
    agent = rep.agent;
    guichet = Number($('#cx-guichet').value) || guichet;
    ecrireLocal('matricule', agent.matricule);
    ecrireLocal('guichet', String(guichet));
    bouton.disabled = false;
    afficherPoste();
  } catch (err) {
    bouton.disabled = false;
    $('#cx-mdp').select();
    if (err.statut === 429) return compteARebours(Number((err.message.match(/(\d+) s/) || [])[1]) || 60);
    $('#cx-msg').textContent = err.message;
  }
});

$('#btn-deconnexion').onclick = async () => {
  await API.post('/api/agent/deconnexion', {}).catch(() => {});
  afficherConnexion('Poste fermé.');
};

/* ---------- Changement du mot de passe ---------- */

const dlg = $('#dlg-mdp');
$('#btn-mdp').onclick = () => {
  $('#form-mdp').reset();
  $('#mdp-msg').textContent = '';
  dlg.showModal();
};
$('#mdp-annuler').onclick = () => dlg.close();
$('#form-mdp').addEventListener('submit', async (e) => {
  e.preventDefault();
  const actuel = $('#mdp-actuel').value, nouveau = $('#mdp-nouveau').value;
  const msg = $('#mdp-msg');
  if (nouveau.length < 8) { msg.textContent = 'Au moins 8 caractères.'; return; }
  if (nouveau !== $('#mdp-confirmation').value) { msg.textContent = 'Les deux saisies ne correspondent pas.'; return; }
  try {
    await API.post('/api/agent/mot-de-passe', { actuel, nouveau });
    dlg.close();
    $('#message').textContent = 'Mot de passe changé.';
    $('#message').className = 'message';
  } catch (err) {
    if (err.statut === 401) { dlg.close(); return gererErreur(err); }
    msg.textContent = err.message;
  }
});

/* ---------- Poste ---------- */

async function initReferentiel() {
  const [guichets, services] = await Promise.all([API.get('/api/guichets'), API.get('/api/services')]);
  libelles = Object.fromEntries(services.map((s) => [s.code, s.libelle]));
  const options = guichets.map((g) => `<option value="${g.numero}">Guichet ${g.numero}</option>`).join('');
  $('#sel-guichet').innerHTML = options;
  $('#cx-guichet').innerHTML = options;
  if (!guichets.some((g) => g.numero === guichet) && guichets.length) guichet = guichets[0].numero;
  $('#cx-guichet').value = String(guichet);
  $('#sel-guichet').onchange = () => {
    guichet = Number($('#sel-guichet').value);
    ecrireLocal('guichet', String(guichet));
    majTitre(); rafraichir();
  };
}

function majTitre() {
  $('#titre-guichet').textContent = 'Guichet ' + guichet;
  $('#nom-agent').textContent = agent ? (agent.services || []).map((c) => libelles[c] || c).join(' · ') : '';
}

async function rafraichir() {
  if (!agent) return;
  try {
    const [file, enCours] = await Promise.all([
      API.get('/api/file'),
      API.get('/api/en-cours?guichet=' + guichet),
    ]);
    afficherFile(file);
    afficherEnCours(enCours);
  } catch (e) {
    gererErreur(e);
  }
}

function afficherFile(file) {
  const ul = $('#file');
  ul.innerHTML = '';
  $('#file-vide').classList.toggle('cachee', file.length > 0);
  $('#file-compte').textContent = file.length;
  for (const t of file) {
    const li = document.createElement('li');
    li.innerHTML =
      `<span class="pastille"><svg class="ico"><use href="/shared/icones.svg#${iconeService(t.codeService)}"/></svg></span>` +
      `<span class="num">${String(t.numero).padStart(3, '0')}</span>` +
      `<span class="svc"></span>` +
      `<span class="heure"><svg class="ico ico-s"><use href="/shared/icones.svg#i-horloge"/></svg>${heureCourte(t.heurePrise)}</span>`;
    li.querySelector('.svc').textContent = libelles[t.codeService] || t.codeService;
    ul.appendChild(li);
  }
}

function afficherEnCours(t) {
  ticketEnCours = t;
  const div = $('#en-cours');
  const btn = $('#btn-cloturer');
  if (t) {
    div.querySelector('.en-cours-num').textContent = String(t.numero).padStart(3, '0');
    div.querySelector('.en-cours-svc').textContent = libelles[t.codeService] || t.codeService;
    div.classList.remove('vide');
    btn.disabled = false;
  } else {
    div.querySelector('.en-cours-num').textContent = '—';
    div.querySelector('.en-cours-svc').textContent = 'Aucun ticket en cours';
    div.classList.add('vide');
    btn.disabled = true;
  }
}

async function appelerSuivant() {
  $('#message').textContent = '';
  try {
    const rep = await API.post('/api/appeler', { guichet });
    if (!rep.ticket) {
      // Fragment « alt » de la séquence n°1 (T4/T5).
      $('#message').textContent = rep.message || 'Aucun ticket en attente';
      $('#message').className = 'message alerte';
    } else {
      $('#message').textContent = `Ticket ${String(rep.ticket.numero).padStart(3, '0')} appelé.`;
      $('#message').className = 'message';
    }
    await rafraichir();
  } catch (e) {
    gererErreur(e);
  }
}

async function cloturer() {
  if (!ticketEnCours) return;
  try {
    await API.post('/api/cloturer', { num: ticketEnCours.numero });
    $('#message').textContent = `Ticket ${String(ticketEnCours.numero).padStart(3, '0')} clôturé.`;
    $('#message').className = 'message';
    await rafraichir();
  } catch (e) {
    gererErreur(e);
  }
}

/** Heure 'HH:MM' à partir d'un ISO (miroir de util/temps côté serveur). */
function heureCourte(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

$('#btn-appeler').onclick = appelerSuivant;
$('#btn-cloturer').onclick = cloturer;

// Temps réel : toute évolution de la file rafraîchit l'écran (push),
// avec repli en polling 2 s si le WebSocket tombe.
const badge = $('#badge');
connecterTempsReel(
  (ev) => { if (ev.type === 'marque') Marque.charger(); else rafraichir(); },
  (etat) => {
    badge.className = 'badge-connexion ' + (etat === 'ok' ? 'ok' : 'ko');
    badge.textContent = etat === 'ok' ? 'Temps réel' : 'Reconnexion…';
  },
  () => rafraichir()
);

// Démarrage : session déjà ouverte sur ce poste ? sinon écran de connexion.
initReferentiel()
  .then(() => API.get('/api/agent/session'))
  .then((s) => {
    if (s.connecte) { agent = s.agent; afficherPoste(); } else afficherConnexion();
  })
  .catch((e) => { afficherConnexion(); $('#cx-msg').textContent = 'Serveur injoignable : ' + e.message; });
