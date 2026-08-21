/* =====================================================================
   IHM Poste agent — logique d'écran (maquettes 4.1/4.2, séquence n°1).
   Le poste est configuré pour un agent (matricule) et un guichet.
   Actions : appelerSuivant(matricule, guichet) et cloturerTicket(num).
   Rafraîchit sa file à chaque événement temps réel (push), sinon polling.
   ===================================================================== */
const $ = (sel) => document.querySelector(sel);
const params = new URLSearchParams(location.search);

let matricule = params.get('matricule') || localStorage.getItem('matricule') || 'A001';
let guichet = Number(params.get('guichet') || localStorage.getItem('guichet') || 1);
let ticketEnCours = null;

async function initConfig() {
  const [agents, guichets] = await Promise.all([API.get('/api/agents'), API.get('/api/guichets')]);

  const selA = $('#sel-agent');
  selA.innerHTML = agents
    .map((a) => `<option value="${a.matricule}">${a.matricule} — ${a.nom} (${a.services.join(', ')})</option>`)
    .join('');
  selA.value = matricule;

  const selG = $('#sel-guichet');
  selG.innerHTML = guichets.map((g) => `<option value="${g.numero}">Guichet ${g.numero}</option>`).join('');
  selG.value = String(guichet);

  selA.onchange = () => { matricule = selA.value; localStorage.setItem('matricule', matricule); rafraichir(); };
  selG.onchange = () => {
    guichet = Number(selG.value);
    localStorage.setItem('guichet', String(guichet));
    majTitre(); rafraichir();
  };
  majTitre();
}

function majTitre() {
  $('#titre-guichet').textContent = 'Guichet ' + guichet;
}

async function rafraichir() {
  try {
    const [file, enCours] = await Promise.all([
      API.get('/api/file?matricule=' + encodeURIComponent(matricule)),
      API.get('/api/en-cours?guichet=' + guichet),
    ]);
    afficherFile(file);
    afficherEnCours(enCours);
  } catch (e) {
    $('#message').textContent = 'Erreur : ' + e.message;
  }
}

function afficherFile(file) {
  const ul = $('#file');
  ul.innerHTML = '';
  $('#file-vide').classList.toggle('cachee', file.length > 0);
  for (const t of file) {
    const li = document.createElement('li');
    li.innerHTML =
      `<span class="num">${String(t.numero).padStart(3, '0')}</span>` +
      `<span class="svc">${t.codeService}</span>` +
      `<span class="heure">${heureCourte(t.heurePrise)}</span>`;
    ul.appendChild(li);
  }
}

function afficherEnCours(t) {
  ticketEnCours = t;
  const div = $('#en-cours');
  const btn = $('#btn-cloturer');
  if (t) {
    div.textContent = `Ticket ${String(t.numero).padStart(3, '0')} — ${t.codeService}`;
    div.classList.remove('vide');
    btn.disabled = false;
  } else {
    div.textContent = 'Aucun ticket en cours';
    div.classList.add('vide');
    btn.disabled = true;
  }
}

async function appelerSuivant() {
  $('#message').textContent = '';
  try {
    const rep = await API.post('/api/appeler', { matricule, guichet });
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
    $('#message').textContent = 'Erreur : ' + e.message;
    $('#message').className = 'message alerte';
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
    $('#message').textContent = 'Erreur : ' + e.message;
    $('#message').className = 'message alerte';
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
  () => rafraichir(),
  (etat) => {
    badge.className = 'badge-connexion ' + (etat === 'ok' ? 'ok' : 'ko');
    badge.textContent = etat === 'ok' ? 'temps réel' : 'polling';
  },
  () => rafraichir()
);

initConfig().then(rafraichir).catch((e) => alert('Erreur : ' + e.message));
