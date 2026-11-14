'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('date-stats');
  const btnCharger = document.getElementById('btn-charger');
  const tbody = document.getElementById('stats-body');
  
  const btnPurge = document.getElementById('btn-purge');
  const delaiInput = document.getElementById('delai-abandon');
  const actionMessage = document.getElementById('action-message');

  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  dateInput.value = today;

  // Les durées renvoyées par /api/stats sont exprimées en MINUTES (fractionnaires).
  function formaterDuree(minutes) {
    if (minutes === null || minutes === undefined) return '—';
    const totalSec = Math.round(minutes * 60);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }

  // Indicateurs globaux de la journée (moyennes pondérées par le nombre de tickets).
  function majKpis(stats) {
    const total = stats.reduce((n, s) => n + (s.nbTickets || 0), 0);
    const moyenne = (cle) => {
      let somme = 0, poids = 0;
      stats.forEach(s => { if (s[cle] != null) { somme += s[cle] * s.nbTickets; poids += s.nbTickets; } });
      return poids ? somme / poids : null;
    };
    document.getElementById('kpi-tickets').textContent = total;
    document.getElementById('kpi-attente').textContent = formaterDuree(moyenne('attenteMoy'));
    document.getElementById('kpi-traitement').textContent = formaterDuree(moyenne('traitementMoy'));
    document.getElementById('kpi-services').textContent = stats.length;
  }

  async function chargerStats() {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Chargement...</td></tr>';
    try {
      const res = await fetch(`/api/stats?date=${dateInput.value}`);
      if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);
      const stats = await res.json();
      const services = await fetch('/api/services').then(r => r.json()).catch(() => []);
      const libelles = Object.fromEntries(services.map(x => [x.code, x.libelle]));
      majKpis(stats || []);

      if (!stats || stats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Aucune donnée pour cette date.</td></tr>';
        return;
      }
      
      tbody.innerHTML = '';
      stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="svc-cell">
            <span class="pastille"><svg class="ico"><use href="/shared/icones.svg#${iconeService(s.codeService)}"/></svg></span>
            <span><strong>${libelles[s.codeService] || s.codeService}</strong> <span class="item-subtitle">${s.codeService}</span></span>
          </span></td>
          <td class="num">${s.nbTickets}</td>
          <td class="num">${formaterDuree(s.attenteMoy)}</td>
          <td class="num">${formaterDuree(s.traitementMoy)}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
      majKpis([]);
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state texte-erreur">Erreur lors du chargement des statistiques.</td></tr>';
    }
  }

  async function purgerAbandons() {
    const delai = delaiInput.value;
    btnPurge.disabled = true;
    btnPurge.textContent = 'En cours...';
    actionMessage.textContent = '';
    
    try {
      const res = await fetch('/api/abandons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delaiMin: Number(delai) })
      });
      if (!res.ok) throw new Error('Erreur API');
      const data = await res.json();
      
      actionMessage.className = 'action-message ok';
      actionMessage.textContent = `Succès : ${data.nb} ticket(s) abandonné(s) purgé(s).`;
      
      // Refresh stats in case it changed today's data
      if (dateInput.value === today) {
        chargerStats();
      }
    } catch (e) {
      console.error(e);
      actionMessage.className = 'action-message ko';
      actionMessage.textContent = 'Erreur lors de la purge.';
    } finally {
      btnPurge.disabled = false;
      btnPurge.textContent = 'Lancer la purge';
      setTimeout(() => { actionMessage.textContent = ''; }, 5000);
    }
  }

  // Events
  btnCharger.addEventListener('click', chargerStats);
  btnPurge.addEventListener('click', purgerAbandons);

  // --- CRUD LOGIC ---
  const endpoints = {
    services: { url: '/api/services', id: 'code', name: 'libelle', extra: 'dureeCible', listId: 'list-services' },
    agents: { url: '/api/agents', id: 'matricule', name: 'nom', listId: 'list-agents' },
    guichets: { url: '/api/guichets', id: 'numero', name: 'etat', listId: 'list-guichets' }
  };

  async function apiCall(url, method, body) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erreur || 'Erreur API');
    return data;
  }

  // Libellés lisibles pour chaque élément du référentiel.
  function titreItem(type, item) {
    if (type === 'guichets') return `Guichet ${item.numero}`;
    return item[endpoints[type].name];
  }
  function sousTitreItem(type, item) {
    if (type === 'services') return `${item.code} · durée cible ${item.dureeCible} min`;
    if (type === 'agents') return `${item.matricule}${item.services && item.services.length ? ' · ' + item.services.join(', ') : ''}`;
    return item.etat === 'ouvert' ? 'Ouvert' : 'Fermé';
  }

  async function loadList(type) {
    const ep = endpoints[type];
    const ul = document.getElementById(ep.listId);
    ul.innerHTML = '<li>Chargement...</li>';
    try {
      const data = await apiCall(ep.url, 'GET');
      ul.innerHTML = '';
      if (!data || data.length === 0) {
        ul.innerHTML = '<li><span class="item-subtitle">Aucun élément</span></li>';
        return;
      }
      data.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
          <div class="item-info">
            <span class="item-title">${titreItem(type, item)}</span>
            <span class="item-subtitle">${sousTitreItem(type, item)}</span>
          </div>
          <div class="item-actions">
            ${type === 'agents' ? `<button class="btn-icone mdp" type="button" title="Définir le mot de passe" aria-label="Définir le mot de passe"><svg class="ico"><use href="/shared/icones.svg#i-cadenas"/></svg></button>` : ''}
            <button class="btn-icone edit" type="button" title="Modifier" aria-label="Modifier"><svg class="ico"><use href="/shared/icones.svg#i-modifier"/></svg></button>
            <button class="btn-icone danger delete" type="button" data-id="${item[ep.id]}" title="Supprimer" aria-label="Supprimer"><svg class="ico"><use href="/shared/icones.svg#i-supprimer"/></svg></button>
          </div>
        `;
        if (type === 'agents') {
          // Statut du mot de passe du poste agent.
          const statut = document.createElement('span');
          statut.className = 'etat-mdp ' + (item.motDePasse ? 'ok' : 'manquant');
          statut.textContent = item.motDePasse ? 'Mot de passe défini' : 'Pas de mot de passe : connexion impossible';
          li.querySelector('.item-info').appendChild(statut);
          li.querySelector('.mdp').addEventListener('click', () => showPasswordForm(item, li));
        }
        li.querySelector('.edit').addEventListener('click', () => showEditForm(type, item, li));
        li.querySelector('.delete').addEventListener('click', () => deleteItem(type, item[ep.id]));
        ul.appendChild(li);
      });
    } catch (e) {
      console.error(e);
      ul.innerHTML = '<li><span class="item-subtitle texte-erreur">Erreur de chargement</span></li>';
    }
  }

  // Définition / réinitialisation du mot de passe d'un agent (poste agent).
  function showPasswordForm(item, li) {
    li.innerHTML = `
      <form class="crud-form">
        <span class="item-subtitle"></span>
        <input type="password" class="mdp-nouveau" placeholder="Nouveau mot de passe (8 caractères min.)" autocomplete="new-password" minlength="8" required>
        <input type="password" class="mdp-confirmation" placeholder="Confirmation" autocomplete="new-password" minlength="8" required>
        <span class="item-subtitle erreur-form texte-erreur"></span>
        <div class="crud-form-actions">
          <button type="submit" class="btn btn-primaire btn-s">Enregistrer</button>
          <button type="button" class="btn btn-secondaire btn-s cancel">Annuler</button>
        </div>
      </form>
    `;
    li.querySelector('.item-subtitle').textContent =
      `${item.motDePasse ? 'Réinitialiser' : 'Définir'} le mot de passe de ${item.nom} (${item.matricule})`;
    li.querySelector('.mdp-nouveau').focus();
    li.querySelector('.cancel').addEventListener('click', () => loadList('agents'));
    li.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nouveau = li.querySelector('.mdp-nouveau').value;
      const erreurEl = li.querySelector('.erreur-form');
      if (nouveau.length < 8) { erreurEl.textContent = 'Au moins 8 caractères.'; return; }
      if (nouveau !== li.querySelector('.mdp-confirmation').value) { erreurEl.textContent = 'Les deux saisies ne correspondent pas.'; return; }
      try {
        await apiCall(`/api/agents/${encodeURIComponent(item.matricule)}/mot-de-passe`, 'PUT', { motDePasse: nouveau });
        loadList('agents');
      } catch (err) {
        erreurEl.textContent = err.message;
      }
    });
  }

  async function deleteItem(type, id) {
    if (!confirm('Voulez-vous vraiment supprimer cet élément ?')) return;
    try {
      await apiCall(`${endpoints[type].url}/${id}`, 'DELETE');
      loadList(type);
      if (type === 'agents' || type === 'services') loadHabilitations();
    } catch (e) {
      alert(`Impossible de supprimer :\n${e.message}`);
    }
  }

  // Édition inline : remplace la ligne <li> par un formulaire pré-rempli.
  // L'identifiant (code/matricule/numero) n'est pas modifiable (clé primaire).
  function showEditForm(type, item, li) {
    const ep = endpoints[type];
    const id = item[ep.id];

    let inputsHTML = '';
    if (type === 'services') {
      inputsHTML = `
        <input type="text" id="edit-name" value="${item.libelle}" placeholder="Libellé" required>
        <input type="number" id="edit-extra" value="${item.dureeCible}" placeholder="Durée (min)">
      `;
    } else if (type === 'agents') {
      inputsHTML = `<input type="text" id="edit-name" value="${item.nom}" placeholder="Nom complet" required>`;
    } else if (type === 'guichets') {
      inputsHTML = `
        <select id="edit-name">
          <option value="ouvert"${item.etat === 'ouvert' ? ' selected' : ''}>ouvert</option>
          <option value="ferme"${item.etat === 'ferme' ? ' selected' : ''}>ferme</option>
        </select>
      `;
    }

    li.innerHTML = `
      <form class="crud-form">
        <span class="item-subtitle">${titreItem(type, item)}</span>
        ${inputsHTML}
        <div class="crud-form-actions">
          <button type="submit" class="btn btn-primaire btn-s">Enregistrer</button>
          <button type="button" class="btn btn-secondaire btn-s cancel">Annuler</button>
        </div>
      </form>
    `;

    li.querySelector('.cancel').addEventListener('click', () => loadList(type));
    li.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-name').value;
      const extraInput = document.getElementById('edit-extra');

      const body = {};
      if (type === 'services') {
        body.libelle = name; body.dureeCible = extraInput ? Number(extraInput.value) : undefined;
      } else if (type === 'agents') {
        body.nom = name;
      } else if (type === 'guichets') {
        body.etat = name;
      }

      try {
        await apiCall(`${ep.url}/${id}`, 'PUT', body);
        loadList(type);
        if (type === 'agents' || type === 'services') loadHabilitations();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  function showAddForm(type) {
    const ep = endpoints[type];
    const ul = document.getElementById(ep.listId);
    const existing = ul.querySelector('.crud-form');
    if (existing) return; // already open
    
    const li = document.createElement('li');
    li.style.padding = '4px 0';
    
    let inputsHTML = '';
    if (type === 'services') {
      inputsHTML = `
        <input type="text" id="add-id" placeholder="Code (ex: RET)" required>
        <input type="text" id="add-name" placeholder="Libellé" required>
        <input type="number" id="add-extra" placeholder="Durée (min)" value="5">
      `;
    } else if (type === 'agents') {
      inputsHTML = `
        <input type="text" id="add-id" placeholder="Matricule (ex: A001)" required>
        <input type="text" id="add-name" placeholder="Nom complet" required>
        <input type="password" id="add-mdp" placeholder="Mot de passe du poste (8 caractères min.)" autocomplete="new-password" minlength="8">
      `;
    } else if (type === 'guichets') {
      inputsHTML = `
        <input type="number" id="add-id" placeholder="Numéro (ex: 4)" required>
        <select id="add-name">
          <option value="ouvert">ouvert</option>
          <option value="ferme">ferme</option>
        </select>
      `;
    }
    
    li.innerHTML = `
      <form class="crud-form" id="form-add-${type}">
        ${inputsHTML}
        <div class="crud-form-actions">
          <button type="submit" class="btn btn-primaire btn-s">Ajouter</button>
          <button type="button" class="btn btn-secondaire btn-s cancel">Annuler</button>
        </div>
      </form>
    `;
    ul.prepend(li);
    
    li.querySelector('.cancel').addEventListener('click', () => { li.remove(); });
    li.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('add-id').value;
      const name = document.getElementById('add-name').value;
      const extraInput = document.getElementById('add-extra');
      
      const body = {};
      if (type === 'services') {
        body.code = id; body.libelle = name; body.dureeCible = extraInput ? extraInput.value : undefined;
      } else if (type === 'agents') {
        body.matricule = id; body.nom = name;
        const mdp = document.getElementById('add-mdp').value;
        if (mdp) body.motDePasse = mdp;
      } else if (type === 'guichets') {
        body.numero = id; body.etat = name;
      }
      
      try {
        await apiCall(ep.url, 'POST', body);
        loadList(type);
        if (type === 'agents' || type === 'services') loadHabilitations();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  document.getElementById('btn-add-service').addEventListener('click', () => showAddForm('services'));
  document.getElementById('btn-add-agent').addEventListener('click', () => showAddForm('agents'));
  document.getElementById('btn-add-guichet').addEventListener('click', () => showAddForm('guichets'));

  // --- HABILITATIONS (matrice agents × services) ---
  const habilTable = document.getElementById('habil-table');

  async function loadHabilitations() {
    habilTable.innerHTML = '<tbody><tr><td class="empty-state">Chargement...</td></tr></tbody>';
    try {
      const [agents, services, paires] = await Promise.all([
        apiCall('/api/agents', 'GET'),
        apiCall('/api/services', 'GET'),
        apiCall('/api/habilitations', 'GET')
      ]);

      if (!agents.length || !services.length) {
        habilTable.innerHTML = '<tbody><tr><td class="empty-state">Ajoutez au moins un agent et un service.</td></tr></tbody>';
        return;
      }

      // Ensemble des paires existantes pour test O(1).
      const actives = new Set(paires.map(p => `${p.matricule}|${p.codeService}`));

      // En-tête : une colonne par service.
      let html = '<thead><tr><th>Agent</th>';
      services.forEach(s => { html += `<th title="${s.libelle}">${s.code}</th>`; });
      html += '</tr></thead><tbody>';

      // Une ligne par agent, une case à cocher par service.
      agents.forEach(a => {
        html += `<tr><td><strong>${a.nom}</strong> <span class="item-subtitle">${a.matricule}</span></td>`;
        services.forEach(s => {
          const coche = actives.has(`${a.matricule}|${s.code}`) ? 'checked' : '';
          html += `<td class="habil-cell"><input type="checkbox" ${coche}
            data-matricule="${a.matricule}" data-service="${s.code}"></td>`;
        });
        html += '</tr>';
      });
      html += '</tbody>';
      habilTable.innerHTML = html;

      habilTable.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => toggleHabilitation(cb));
      });
    } catch (e) {
      console.error(e);
      habilTable.innerHTML = '<tbody><tr><td class="empty-state texte-erreur">Erreur lors du chargement.</td></tr></tbody>';
    }
  }

  async function toggleHabilitation(cb) {
    const { matricule, service } = cb.dataset;
    cb.disabled = true;
    try {
      if (cb.checked) {
        await apiCall('/api/habilitations', 'POST', { matricule, codeService: service });
      } else {
        await apiCall(`/api/habilitations/${matricule}/${service}`, 'DELETE');
      }
    } catch (e) {
      cb.checked = !cb.checked; // rollback visuel
      alert(`Échec : ${e.message}`);
    } finally {
      cb.disabled = false;
    }
  }

  // Initial load
  chargerStats();
  loadList('services');
  loadList('agents');
  loadList('guichets');
  loadHabilitations();
});
