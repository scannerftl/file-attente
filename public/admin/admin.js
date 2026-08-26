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

  async function chargerStats() {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Chargement...</td></tr>';
    try {
      const res = await fetch(`/api/stats?date=${dateInput.value}`);
      if (!res.ok) throw new Error(`Erreur HTTP: ${res.status}`);
      const stats = await res.json();
      
      if (!stats || stats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Aucune donnée pour cette date.</td></tr>';
        return;
      }
      
      tbody.innerHTML = '';
      stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${s.codeService}</strong></td>
          <td>${s.nbTickets}</td>
          <td>${formaterDuree(s.attenteMoy)}</td>
          <td>${formaterDuree(s.traitementMoy)}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error(e);
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state" style="color: #ef4444;">Erreur lors du chargement des statistiques.</td></tr>';
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
      
      actionMessage.style.color = '#10b981';
      actionMessage.textContent = `Succès : ${data.nb} ticket(s) abandonné(s) purgé(s).`;
      
      // Refresh stats in case it changed today's data
      if (dateInput.value === today) {
        chargerStats();
      }
    } catch (e) {
      console.error(e);
      actionMessage.style.color = '#ef4444';
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
            <span class="item-title">${item[ep.name]}</span>
            <span class="item-subtitle">ID: ${item[ep.id]}${ep.extra ? ` | ${item[ep.extra]}` : ''}</span>
          </div>
          <div class="item-actions">
            <button class="btn-icon edit" title="Modifier">✏️</button>
            <button class="btn-icon delete" data-id="${item[ep.id]}" title="Supprimer">❌</button>
          </div>
        `;
        li.querySelector('.edit').addEventListener('click', () => showEditForm(type, item, li));
        li.querySelector('.delete').addEventListener('click', () => deleteItem(type, item[ep.id]));
        ul.appendChild(li);
      });
    } catch (e) {
      console.error(e);
      ul.innerHTML = '<li><span style="color: #ef4444;">Erreur</span></li>';
    }
  }

  async function deleteItem(type, id) {
    if (!confirm('Voulez-vous vraiment supprimer cet élément ?')) return;
    try {
      await apiCall(`${endpoints[type].url}/${id}`, 'DELETE');
      loadList(type);
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
        <span class="item-subtitle">ID: ${id}</span>
        ${inputsHTML}
        <div class="crud-form-actions">
          <button type="submit" class="btn-primary">Enregistrer</button>
          <button type="button" class="btn-danger cancel">Annuler</button>
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
    li.style.display = 'block';
    li.style.padding = '0';
    li.style.background = 'transparent';
    li.style.border = 'none';
    
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
          <button type="submit" class="btn-primary">Valider</button>
          <button type="button" class="btn-danger cancel">Annuler</button>
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
      } else if (type === 'guichets') {
        body.numero = id; body.etat = name;
      }
      
      try {
        await apiCall(ep.url, 'POST', body);
        loadList(type);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  document.getElementById('btn-add-service').addEventListener('click', () => showAddForm('services'));
  document.getElementById('btn-add-agent').addEventListener('click', () => showAddForm('agents'));
  document.getElementById('btn-add-guichet').addEventListener('click', () => showAddForm('guichets'));

  // Initial load
  chargerStats();
  loadList('services');
  loadList('agents');
  loadList('guichets');
});
