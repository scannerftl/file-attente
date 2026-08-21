'use strict';

const { dateDuJour } = require('../util/temps');

/**
 * Planificateur des traitements AUTOMATIQUES du MOT (Partie 1.4) :
 *   - « Marquer les abandons »   → toutes les 5 min   (RG6)
 *   - « Calculer les statistiques » → chaque nuit à minuit (Partie 1.3)
 *
 * Ce sont les deux seuls traitements sans acteur humain. Les opérations métier
 * étant asynchrones, chaque tick les enveloppe dans une fonction async.
 */
function demarrerJobs(ctx, cfg) {
  const timers = [];

  // --- Abandons : toutes les N ms ---
  const timerAbandons = setInterval(async () => {
    try {
      const nb = await ctx.gestionnaire.marquerAbandons(cfg.DELAI_ABANDON_MIN);
      if (nb > 0) console.log(`[job abandons] ${nb} ticket(s) marqué(s) abandonné(s)`);
    } catch (e) {
      console.error('[job abandons]', e.message);
    }
  }, cfg.INTERVALLE_ABANDONS_MS);
  timers.push(timerAbandons);

  // --- Statistiques : chaque nuit à minuit ---
  const planifierMinuit = () => {
    const maintenant = new Date();
    const minuit = new Date(maintenant);
    minuit.setHours(24, 0, 5, 0); // 00:00:05 le lendemain (petite marge)
    const delai = minuit.getTime() - maintenant.getTime();

    const t = setTimeout(async () => {
      try {
        // On archive la journée qui vient de se terminer.
        const hier = dateDuJour(new Date(Date.now() - 60 * 60 * 1000));
        const rapport = await ctx.statistiques.calculerRapport(hier);
        console.log(`[job stats] rapport du ${hier} archivé (${rapport.length} service(s))`);
      } catch (e) {
        console.error('[job stats]', e.message);
      }
      planifierMinuit(); // reprogramme la nuit suivante
    }, delai);
    timers.push(t);
  };
  planifierMinuit();

  // Fonction d'arrêt propre (utile aux tests / arrêt serveur).
  return () => timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
}

module.exports = { demarrerJobs };
