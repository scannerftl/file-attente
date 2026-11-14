'use strict';

/* Page de connexion à l'administration. */
(function () {
  const $ = (id) => document.getElementById(id);
  const DESTINATION = '/admin/';

  async function poster(url, corps) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, statut: r.status, data };
  }

  function afficher(id) {
    for (const x of ['form-connexion', 'form-creation', 'bloc-non-configure']) $(x).classList.toggle('cachee', x !== id);
    const champ = $(id).querySelector('input');
    if (champ) champ.focus();
  }

  /** Bloque le bouton pendant l'attente imposée après trop d'essais. */
  function compteARebours(sec, form, msg) {
    const bouton = form.querySelector('button[type=submit]');
    bouton.disabled = true;
    const tic = () => {
      if (sec <= 0) { bouton.disabled = false; msg.textContent = ''; return; }
      msg.textContent = `Trop d'essais. Réessayez dans ${sec} s.`;
      sec -= 1;
      setTimeout(tic, 1000);
    };
    tic();
  }

  $('form-connexion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('msg-connexion');
    msg.textContent = '';
    const bouton = e.target.querySelector('button[type=submit]');
    bouton.disabled = true;
    const r = await poster('/api/admin/connexion', { motDePasse: $('mdp').value });
    bouton.disabled = false;
    if (r.ok) { location.replace(DESTINATION); return; }
    $('mdp').select();
    if (r.statut === 429) return compteARebours(r.data.attenteSec || 60, e.target, msg);
    msg.textContent = r.data.erreur || 'Connexion impossible';
  });

  $('form-creation').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('msg-creation');
    const nouveau = $('mdp-nouveau').value;
    if (nouveau.length < 8) { msg.textContent = 'Le mot de passe doit contenir au moins 8 caractères'; return; }
    if (nouveau !== $('mdp-confirmation').value) { msg.textContent = 'Les deux saisies ne correspondent pas'; return; }
    const r = await poster('/api/admin/initialiser', { motDePasse: nouveau });
    if (r.ok) { location.replace(DESTINATION); return; }
    msg.textContent = r.data.erreur || 'Création impossible';
  });

  fetch('/api/admin/session', { cache: 'no-store' })
    .then((r) => r.json())
    .then((s) => {
      if (s.connecte) return location.replace(DESTINATION);
      $('port').textContent = location.port || '80';
      if (s.configure) afficher('form-connexion');
      else afficher(s.local ? 'form-creation' : 'bloc-non-configure');
    })
    .catch(() => afficher('form-connexion'));
})();
