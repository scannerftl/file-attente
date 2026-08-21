'use strict';

/**
 * Helpers de temps partagés par la couche métier.
 * Les horodatages sont stockés en ISO 8601 ; les durées se calculent en minutes.
 */

/** @param {Date} d */
function versISO(d) {
  return d.toISOString();
}

/**
 * Jour civil local au format 'YYYY-MM-DD' (sert de date_ticket, RG5).
 * @param {Date} d
 */
function dateDuJour(d) {
  const an = d.getFullYear();
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${an}-${mois}-${jour}`;
}

/**
 * Écart en minutes (réel) entre deux horodatages ISO.
 * @returns {number|null} null si l'un des deux est absent
 */
function minutesEntre(isoDebut, isoFin) {
  if (!isoDebut || !isoFin) return null;
  const ms = new Date(isoFin).getTime() - new Date(isoDebut).getTime();
  return ms / 60000;
}

/** Heure lisible 'HH:MM' pour les IHM. */
function heureCourte(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

module.exports = { versISO, dateDuJour, minutesEntre, heureCourte };
