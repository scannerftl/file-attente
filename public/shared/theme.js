/* =====================================================================
   Thème clair / sombre.
   - Par défaut : suit le réglage du système (prefers-color-scheme).
   - Le bouton #btn-theme force clair ou sombre (mémorisé dans le navigateur).
   - Une page peut imposer son thème avec <html data-theme-fixe="dark">
     (cas de l'écran mural, toujours sombre pour la lisibilité dans le hall).
   Chargé dans le <head> pour éviter un flash de mauvais thème.
   ===================================================================== */
(function () {
  const racine = document.documentElement;
  const fixe = racine.getAttribute('data-theme-fixe');
  const lire = () => { try { return localStorage.getItem('theme'); } catch (_) { return null; } };
  const ecrire = (v) => { try { localStorage.setItem('theme', v); } catch (_) {} };

  if (fixe) racine.setAttribute('data-theme', fixe);
  else if (lire()) racine.setAttribute('data-theme', lire());

  const estSombre = () => {
    const t = racine.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  function majBouton(btn) {
    const sombre = estSombre();
    btn.innerHTML = `<svg class="ico" aria-hidden="true"><use href="/shared/icones.svg#${sombre ? 'i-soleil' : 'i-lune'}"/></svg>`;
    btn.title = sombre ? 'Passer en thème clair' : 'Passer en thème sombre';
    btn.setAttribute('aria-label', btn.title);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-theme');
    if (!btn) return;
    if (fixe) { btn.remove(); return; }
    majBouton(btn);
    btn.addEventListener('click', () => {
      const nouveau = estSombre() ? 'light' : 'dark';
      racine.setAttribute('data-theme', nouveau);
      ecrire(nouveau);
      majBouton(btn);
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => majBouton(btn));
  });
})();

/** Icône associée à un code de service (repli : ticket générique). */
function iconeService(code) {
  const table = { RET: 'i-billet', OUV: 'i-compte', CRE: 'i-credit' };
  return table[code] || 'i-ticket';
}
