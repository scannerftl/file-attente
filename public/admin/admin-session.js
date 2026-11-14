'use strict';

/* =====================================================================
   Session administrateur côté page :
   - toute réponse 401 de l'API (session expirée, serveur redémarré)
     renvoie vers la page de connexion ;
   - bouton « Déconnexion » ;
   - formulaire de changement du mot de passe.
   Chargé avant les autres scripts de l'administration.
   ===================================================================== */
(function () {
  const CONNEXION = '/admin/connexion.html';
  const fetchOrigine = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const r = await fetchOrigine(...args);
    const url = String(args[0] && args[0].url ? args[0].url : args[0]);
    if (r.status === 401 && url.startsWith('/api/') && !url.startsWith('/api/admin/')) {
      location.replace(CONNEXION);
    }
    return r;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);

    $('btn-deconnexion').addEventListener('click', async () => {
      await fetchOrigine('/api/admin/deconnexion', { method: 'POST' }).catch(() => {});
      location.replace(CONNEXION);
    });

    const statut = (texte, type = '') => {
      $('mdp-statut').textContent = texte;
      $('mdp-statut').className = 'perso-statut mdp-statut ' + type;
    };

    $('form-mdp').addEventListener('submit', async (e) => {
      e.preventDefault();
      const actuel = $('mdp-actuel').value;
      const nouveau = $('mdp-nouveau').value;
      if (nouveau.length < 8) return statut('Le nouveau mot de passe doit contenir au moins 8 caractères.', 'ko');
      if (nouveau !== $('mdp-confirmation').value) return statut('Les deux saisies ne correspondent pas.', 'ko');
      if (nouveau === actuel) return statut("Le nouveau mot de passe doit être différent de l'actuel.", 'ko');
      const r = await fetchOrigine('/api/admin/mot-de-passe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actuel, nouveau }),
      });
      if (r.status === 401) return location.replace(CONNEXION);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return statut(data.erreur || 'Changement impossible.', 'ko');
      e.target.reset();
      statut('Mot de passe changé. Les autres sessions ont été déconnectées.', 'ok');
    });
  });
})();
