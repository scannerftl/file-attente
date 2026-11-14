'use strict';

/* =====================================================================
   Administration — Personnalisation client.
   Édite la configuration de marque (nom, slogan, logo, couleurs, messages
   publicitaires et leurs zones), puis la publie : PUT /api/marque.
   Les écrans ouverts (borne, mural, postes) se mettent à jour aussitôt.
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const ZONES = [
    ['haut', 'Bandeau haut'],
    ['lateral', 'Panneau latéral'],
    ['bas', 'Bandeau bas'],
    ['ticket', 'Ticket'],
    ['veille', 'Écran de veille'],
  ];
  const ECRANS = [['borne', 'Borne'], ['mural', 'Écran mural']];
  const HEX = /^#[0-9a-fA-F]{6}$/;

  let etat = null;          // configuration en cours d'édition
  let modifie = false;

  /* ---------- Utilitaires ---------- */
  function statut(texte, type = '') {
    const el = $('perso-statut');
    el.textContent = texte;
    el.className = 'perso-statut ' + type;
  }
  function marquerModifie() {
    modifie = true;
    statut('Modifications non publiées.', 'attente');
    majApercu();
  }
  async function api(url, method = 'GET', body) {
    const r = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.erreur || `Erreur ${r.status}`);
    return data;
  }

  const estVideo = (src) => /\.(mp4|webm)$/i.test(src || '');

  /**
   * Réduit une image matricielle (sauf GIF animé et SVG, gardés tels quels)
   * pour alléger l'envoi. Renvoie un Blob ou le fichier d'origine.
   */
  function reduireImage(fichier, tailleMax) {
    if (!/^image\/(png|jpeg|webp)$/.test(fichier.type)) return Promise.resolve(fichier);
    return new Promise((resolve) => {
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); resolve(fichier); };
      img.onload = () => {
        URL.revokeObjectURL(url);
        const k = Math.min(1, tailleMax / Math.max(img.width, img.height));
        if (k === 1 && fichier.size < 800 * 1024) return resolve(fichier);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => resolve(b && b.size < fichier.size ? b : fichier), 'image/webp', 0.85);
      };
      img.src = url;
    });
  }

  /**
   * Envoie un média (image, GIF animé, vidéo) au serveur.
   * @returns {Promise<string>} chemin /medias/… à enregistrer dans la configuration
   */
  async function televerser(fichier, tailleMax = 1920) {
    if (fichier.size > 50 * 1024 * 1024) throw new Error('Fichier trop lourd (50 Mo maximum)');
    statut(`Envoi de « ${fichier.name} »…`, 'attente');
    const corps = await reduireImage(fichier, tailleMax);
    const r = await fetch('/api/medias', {
      method: 'POST',
      headers: { 'Content-Type': corps.type || fichier.type },
      body: corps,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.erreur || `Erreur ${r.status}`);
    return data.url;
  }

  /** Aperçu d'un média (vidéo muette en boucle, ou image). */
  function apercuMedia(src) {
    let el;
    if (estVideo(src)) {
      el = document.createElement('video');
      el.muted = true; el.loop = true; el.autoplay = true; el.playsInline = true;
      el.setAttribute('muted', '');
    } else {
      el = document.createElement('img');
      el.alt = '';
    }
    el.src = src;
    return el;
  }

  /* ---------- Identité & couleurs ---------- */
  function rendreLogo() {
    const el = $('perso-logo-apercu');
    el.innerHTML = '';
    if (etat.logo) {
      const img = document.createElement('img');
      img.src = etat.logo; img.alt = 'Logo';
      el.appendChild(img);
    } else {
      el.textContent = 'Aucun logo — initiales affichées';
      el.classList.add('vide');
      return;
    }
    el.classList.remove('vide');
  }

  function rendreFormulaire() {
    $('perso-nom').value = etat.nom || '';
    $('perso-slogan').value = etat.slogan || '';
    $('perso-c1').value = $('perso-c1-hex').value = etat.couleurs.principale;
    $('perso-c2').value = $('perso-c2-hex').value = etat.couleurs.secondaire;
    $('perso-rotation').value = etat.rotationSec;
    const anim = etat.animation || (etat.animation = { transition: 'fondu', vitesseDefilement: 'normale' });
    $('perso-transition').value = anim.transition || 'fondu';
    $('perso-vitesse').value = anim.vitesseDefilement || 'normale';
    $('perso-veille').value = etat.veilleSec || 0;
    rendreLogo();
    rendreMessages();
    majApercu();
  }

  function majApercu() {
    const a = $('perso-apercu');
    const p = etat.couleurs.principale, s = etat.couleurs.secondaire;
    if (!HEX.test(p) || !HEX.test(s)) return;
    const sur = (c) => Marque.texteSur(c);
    a.querySelector('.apercu-barre').style.cssText = `background:${p};color:${sur(p)}`;
    a.querySelector('.apercu-bas').style.cssText = `background:${s};color:${sur(s)}`;
    // Même règle que l'écran mural : couleur de l'appel = la plus visible sur fond sombre.
    const fond = melanger(p, '#070A10', 0.16);
    const appel = [s, p, '#FFFFFF'].find((x) => Marque.contraste(x, fond) >= 3);
    a.querySelector('.apercu-corps').style.background = fond;
    a.querySelector('.apercu-guichet').style.cssText = `background:${appel};color:${sur(appel)}`;
    a.querySelector('.apercu-nom').textContent = etat.nom || 'Nom du client';
    const logo = a.querySelector('.apercu-logo');
    logo.innerHTML = '';
    if (etat.logo) {
      const img = document.createElement('img'); img.src = etat.logo; logo.appendChild(img);
      logo.style.cssText = 'background:#fff';
    } else {
      logo.textContent = (etat.nom || '?').trim().split(/\s+/)[0].slice(0, 4).toUpperCase();
      logo.style.cssText = `background:${sur(p)};color:${p}`;
    }
  }
  function melanger(a, b, t) {
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const x = rgb(a), y = rgb(b);
    return '#' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
  }

  function lierCouleur(idCouleur, idHex, cle) {
    $(idCouleur).addEventListener('input', (e) => {
      etat.couleurs[cle] = e.target.value.toUpperCase();
      $(idHex).value = etat.couleurs[cle];
      marquerModifie();
    });
    $(idHex).addEventListener('input', (e) => {
      const v = e.target.value.trim();
      e.target.classList.toggle('invalide', !HEX.test(v));
      if (HEX.test(v)) {
        etat.couleurs[cle] = v.toUpperCase();
        $(idCouleur).value = v;
        marquerModifie();
      }
    });
  }
  lierCouleur('perso-c1', 'perso-c1-hex', 'principale');
  lierCouleur('perso-c2', 'perso-c2-hex', 'secondaire');
  $('perso-nom').addEventListener('input', (e) => { etat.nom = e.target.value; marquerModifie(); });
  $('perso-slogan').addEventListener('input', (e) => { etat.slogan = e.target.value; marquerModifie(); });
  $('perso-rotation').addEventListener('input', (e) => { etat.rotationSec = Number(e.target.value); marquerModifie(); });
  $('perso-transition').addEventListener('change', (e) => { etat.animation.transition = e.target.value; marquerModifie(); });
  $('perso-vitesse').addEventListener('change', (e) => { etat.animation.vitesseDefilement = e.target.value; marquerModifie(); });
  $('perso-veille').addEventListener('input', (e) => { etat.veilleSec = Number(e.target.value); marquerModifie(); });

  $('perso-logo-fichier').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      etat.logo = await televerser(f, 600);
      rendreLogo();
      marquerModifie();
    } catch (err) { statut(err.message, 'ko'); }
  });
  $('perso-logo-retirer').addEventListener('click', () => { etat.logo = ''; rendreLogo(); marquerModifie(); });

  /* ---------- Messages ---------- */
  function cases(nom, options, coches, onChange) {
    const g = document.createElement('div');
    g.className = 'cases';
    for (const [val, lib] of options) {
      const l = document.createElement('label');
      const c = document.createElement('input');
      c.type = 'checkbox'; c.value = val; c.checked = coches.includes(val);
      c.addEventListener('change', () => {
        onChange([...g.querySelectorAll('input:checked')].map((x) => x.value));
      });
      l.append(c, ' ' + lib);
      g.appendChild(l);
    }
    const titre = document.createElement('span');
    titre.className = 'cases-titre';
    titre.textContent = nom;
    const bloc = document.createElement('div');
    bloc.append(titre, g);
    return bloc;
  }

  function rendreMessages() {
    const zone = $('perso-messages');
    zone.innerHTML = '';
    if (!etat.messages.length) {
      zone.innerHTML = '<p class="empty-state">Aucun message. Cliquez sur « Ajouter un message ».</p>';
      return;
    }
    etat.messages.forEach((m, i) => {
      const carte = document.createElement('div');
      carte.className = 'msg-carte' + (m.actif ? '' : ' inactif');

      // Visuel
      const visuel = document.createElement('div');
      visuel.className = 'msg-visuel';
      if (m.image && !m.media) { m.media = m.image; }   // ancien format
      delete m.image;
      if (m.media) {
        visuel.appendChild(apercuMedia(m.media));
        if (estVideo(m.media)) {
          const tag = document.createElement('em'); tag.className = 'tag-media'; tag.textContent = 'Vidéo';
          visuel.appendChild(tag);
        } else if (/\.gif$|^data:image\/gif/.test(m.media)) {
          const tag = document.createElement('em'); tag.className = 'tag-media'; tag.textContent = 'GIF animé';
          visuel.appendChild(tag);
        }
      } else {
        visuel.innerHTML = '<span>Sans visuel</span>';
      }
      const choisir = document.createElement('label');
      choisir.className = 'btn btn-secondaire btn-s';
      choisir.textContent = m.media ? 'Changer' : 'Image / vidéo';
      const fichier = document.createElement('input');
      fichier.type = 'file';
      fichier.accept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,video/mp4,video/webm';
      fichier.hidden = true;
      fichier.addEventListener('change', async () => {
        const f = fichier.files[0];
        if (!f) return;
        try {
          m.media = await televerser(f);
          rendreMessages(); marquerModifie();
        } catch (err) { statut(err.message, 'ko'); }
      });
      choisir.appendChild(fichier);
      visuel.appendChild(choisir);
      if (m.media) {
        const retirer = document.createElement('button');
        retirer.type = 'button'; retirer.className = 'btn btn-secondaire btn-s'; retirer.textContent = 'Retirer';
        retirer.addEventListener('click', () => { m.media = ''; rendreMessages(); marquerModifie(); });
        visuel.appendChild(retirer);
      }

      // Contenu
      const contenu = document.createElement('div');
      contenu.className = 'msg-contenu';
      const titre = document.createElement('input');
      titre.className = 'champ'; titre.placeholder = 'Titre (ex. Offre du moment)'; titre.maxLength = 80; titre.value = m.titre;
      titre.addEventListener('input', () => { m.titre = titre.value; marquerModifie(); });
      const texte = document.createElement('textarea');
      texte.className = 'champ'; texte.placeholder = 'Texte du message'; texte.maxLength = 300; texte.rows = 2; texte.value = m.texte;
      texte.addEventListener('input', () => { m.texte = texte.value; marquerModifie(); });
      const options = document.createElement('div');
      options.className = 'msg-options';
      options.append(
        cases('Zones', ZONES, m.zones, (v) => { m.zones = v; marquerModifie(); }),
        cases('Écrans', ECRANS, m.ecrans, (v) => { m.ecrans = v; marquerModifie(); }),
      );
      const duree = document.createElement('label');
      duree.className = 'msg-duree';
      const champDuree = document.createElement('input');
      champDuree.type = 'number'; champDuree.min = 0; champDuree.max = 300; champDuree.className = 'champ';
      champDuree.value = m.dureeSec || 0;
      champDuree.addEventListener('input', () => { m.dureeSec = Number(champDuree.value) || 0; marquerModifie(); });
      duree.append('Durée ', champDuree, ' s ');
      const aideDuree = document.createElement('span');
      aideDuree.className = 'aide';
      aideDuree.textContent = '(0 = durée par défaut ; vidéo lue en entier)';
      duree.appendChild(aideDuree);
      options.appendChild(duree);
      contenu.append(titre, texte, options);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'msg-actions';
      const actif = document.createElement('label');
      actif.className = 'interrupteur';
      const ca = document.createElement('input');
      ca.type = 'checkbox'; ca.checked = m.actif;
      ca.addEventListener('change', () => { m.actif = ca.checked; carte.classList.toggle('inactif', !m.actif); marquerModifie(); });
      actif.append(ca, ' Actif');
      const bouton = (icone, titreBtn, fn, desactive) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn-icone'; b.title = titreBtn; b.setAttribute('aria-label', titreBtn);
        b.disabled = !!desactive;
        b.innerHTML = `<svg class="ico"><use href="/shared/icones.svg#${icone}"/></svg>`;
        b.addEventListener('click', fn);
        return b;
      };
      const deplacer = (d) => () => {
        const j = i + d;
        [etat.messages[i], etat.messages[j]] = [etat.messages[j], etat.messages[i]];
        rendreMessages(); marquerModifie();
      };
      const monter = bouton('i-chevron', 'Monter', deplacer(-1), i === 0);
      monter.classList.add('rot-haut');
      const descendre = bouton('i-chevron', 'Descendre', deplacer(1), i === etat.messages.length - 1);
      descendre.classList.add('rot-bas');
      const suppr = bouton('i-supprimer', 'Supprimer', () => {
        if (!confirm('Supprimer ce message ?')) return;
        etat.messages.splice(i, 1); rendreMessages(); marquerModifie();
      });
      suppr.classList.add('danger');
      actions.append(actif, monter, descendre, suppr);

      carte.append(visuel, contenu, actions);
      zone.appendChild(carte);
    });
  }

  $('perso-ajouter').addEventListener('click', () => {
    etat.messages.push({ id: '', titre: '', texte: '', media: '', dureeSec: 0, zones: ['haut'], ecrans: ['borne', 'mural'], actif: true });
    rendreMessages();
    marquerModifie();
    const cartes = $('perso-messages').querySelectorAll('.msg-carte');
    cartes[cartes.length - 1].querySelector('input.champ').focus();
  });

  /* ---------- Chargement / publication ---------- */
  async function charger() {
    try {
      etat = await api('/api/marque');
      modifie = false;
      rendreFormulaire();
      statut('');
    } catch (e) { statut('Chargement impossible : ' + e.message, 'ko'); }
  }

  async function chargerModeles() {
    const sel = $('perso-modele');
    try {
      const modeles = await api('/api/marque/modeles');
      sel.innerHTML = '';
      for (const m of modeles) {
        const o = document.createElement('option');
        o.value = m.id; o.textContent = 'Modèle : ' + m.nom;
        sel.appendChild(o);
      }
    } catch (_) { sel.closest('.perso-modele').classList.add('cachee'); }
  }

  $('perso-charger-modele').addEventListener('click', async () => {
    if (modifie && !confirm('Remplacer le formulaire par ce modèle ? Les modifications non publiées seront perdues.')) return;
    try {
      etat = await api('/api/marque/modeles/' + encodeURIComponent($('perso-modele').value));
      rendreFormulaire();
      marquerModifie();
      statut('Modèle chargé dans le formulaire : vérifiez puis cliquez sur « Enregistrer et publier ».', 'attente');
    } catch (e) { statut(e.message, 'ko'); }
  });

  $('perso-enregistrer').addEventListener('click', async () => {
    const btn = $('perso-enregistrer');
    btn.disabled = true;
    statut('Publication…');
    try {
      etat = await api('/api/marque', 'PUT', etat);
      modifie = false;
      rendreFormulaire();
      Marque.rendre(etat); // applique aussi les couleurs à cette page
      statut('Publié : la borne et l\'écran mural affichent la nouvelle personnalisation.', 'ok');
    } catch (e) {
      statut('Non publié : ' + e.message, 'ko');
    } finally { btn.disabled = false; }
  });

  $('perso-annuler').addEventListener('click', () => {
    if (modifie && !confirm('Abandonner les modifications non publiées ?')) return;
    charger();
  });

  $('perso-reinit').addEventListener('click', async () => {
    if (!confirm('Revenir au modèle par défaut ? La personnalisation actuelle sera supprimée.')) return;
    try {
      etat = await api('/api/marque', 'DELETE');
      modifie = false;
      rendreFormulaire();
      Marque.rendre(etat);
      statut('Personnalisation réinitialisée.', 'ok');
    } catch (e) { statut(e.message, 'ko'); }
  });

  window.addEventListener('beforeunload', (e) => { if (modifie) { e.preventDefault(); e.returnValue = ''; } });

  chargerModeles();
  charger();
});
