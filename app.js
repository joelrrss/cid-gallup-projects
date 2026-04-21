

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDSPVH8rSW4qnMs3EqQs0r5nP4vgd-f0mw",
  authDomain: "cid-gallup-proyectos.firebaseapp.com",
  projectId: "cid-gallup-proyectos",
  storageBucket: "cid-gallup-proyectos.firebasestorage.app",
  messagingSenderId: "228420524143",
  appId: "1:228420524143:web:f79874a46f98784f6bd59a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const ANAME = {jp:'Jose', mg:'Miguel', jr:'Joel', br:'Bryan'};
const ANALYST_CODES = ['jp', 'mg', 'jr', 'br'];
const USER_ANALYST_MAP = {
  'joel@email.com': 'jr',
  'miguel@email.com': 'mg',
  'bryan@email.com': 'br',
  'jose@email.com': 'jp'
};
const COL_LABEL = {backlog:'Backlog', prog:'En progreso', rev:'Revisión', done:'Completado'};
const COL_OPTS = ['backlog','prog','rev','done'];
const NEED_CLS = {'Procesamiento':'n-proc','Análisis':'n-anal','Ambos':'n-amb','Diseño':'n-amb','Cliente':'n-amb','':'n-amb'};
const COLS = [
  {id:'backlog', label:'Backlog',     dot:'var(--dot-backlog)'},
  {id:'prog',    label:'En progreso', dot:'var(--dot-prog)'},
  {id:'rev',     label:'Revisión',    dot:'var(--dot-rev)'},
  {id:'done',    label:'Completado',  dot:'var(--dot-done)'},
];

let nextId = 100, curFilter = 'all', dragId = null, projects = [], showInicio = false, avFilter = 'all', showDirector = false, searchQuery = '';
let currentUser = null;
let currentUserProfile = null;

window.ANAME = ANAME;
Object.defineProperty(window, 'projects', {
  get: () => projects,
  set: value => { projects = value; }
});

const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('user-info');
const projectSearch = document.getElementById('project-search');

function setSearchVisibility(activeTab) {
  const searchWrap = document.querySelector('.topbar-search');
  if (!searchWrap) return;
  searchWrap.style.display = activeTab === 'kanban' ? 'none' : '';
}

function fmtDate(d) {
  if (!d) return '';
  const [y,m,dd] = d.split('-');
  return dd && m && y ? `${dd}/${m}/${y}` : d;
}

const PROJECT_COLLECTION = 'projects';

function projectCollectionRef() {
  return collection(db, PROJECT_COLLECTION);
}

function projectDocRef(docId) {
  return doc(db, PROJECT_COLLECTION, docId);
}

function userDocRef(uid) {
  return doc(db, 'users', uid);
}

function normalizeProject(project, docId = '') {
  return {
    id: Number(project.id),
    docId,
    client: project.client || '',
    country: project.country || '',
    title: project.title || '',
    n: project.n || '',
    col: project.col || 'backlog',
    a: project.a || 'jp',
    isnew: !!project.isnew,
    need: project.need || '',
    notes: project.notes || '',
    date: project.date || '',
    assigned: project.assigned || '',
    director: project.director || '',
    createdBy: project.createdBy || '',
    createdByName: project.createdByName || '',
    createdAt: project.createdAt || null,
    updatedBy: project.updatedBy || '',
    updatedByName: project.updatedByName || '',
    updatedAt: project.updatedAt || null
  };
}

function projectPayload(project) {
  const {docId, ...payload} = normalizeProject(project, project.docId || '');
  return payload;
}

function auditUserName() {
  if (currentUserProfile?.name) return currentUserProfile.name;
  if (currentUser?.displayName) return currentUser.displayName;
  if (currentUser?.email) return currentUser.email;
  return 'Usuario';
}

function createAuditFields() {
  return {
    createdBy: currentUser?.uid || '',
    createdByName: auditUserName(),
    createdAt: serverTimestamp(),
    updatedBy: currentUser?.uid || '',
    updatedByName: auditUserName(),
    updatedAt: serverTimestamp()
  };
}

function updateAuditFields() {
  return {
    updatedBy: currentUser?.uid || '',
    updatedByName: auditUserName(),
    updatedAt: serverTimestamp()
  };
}

function showAuthScreen() {
  authScreen.hidden = false;
  appScreen.hidden = true;
  userInfo.textContent = '';
  projects = [];
}

function showAppScreen(user) {
  authScreen.hidden = true;
  appScreen.hidden = false;
  const name = user.displayName || 'Usuario';
  const email = user.email || '';
  userInfo.textContent = email ? `${name} · ${email}` : name;
}

function getAnalystFilteredProjects() {
  const filtered = projects.filter(matchesSearch);
  if (avFilter === 'all') return filtered;
  return filtered.filter(p => p.a === avFilter);
}

function matchesSearch(project) {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;
  const searchableText = [
    project.client,
    project.country,
    project.title,
    project.notes,
    project.director,
    ANAME[project.a] || project.a || ''
  ].join(' ').toLowerCase();
  return searchableText.includes(query);
}

function getProjectByDocId(docId) {
  return projects.find(project => project.docId === docId);
}

function parseSampleSize(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatSampleSize(value) {
  const digits = parseSampleSize(value);
  return digits ? `n = ${digits}` : '';
}

function sortProjectsByDate(list) {
  return [...list].sort((a, b) => {
    const aHasDate = !!a.date;
    const bHasDate = !!b.date;

    if (aHasDate && bHasDate) {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return (a.id || 0) - (b.id || 0);
    }

    if (aHasDate) return -1;
    if (bHasDate) return 1;

    return (a.id || 0) - (b.id || 0);
  });
}

async function ensureUserProfile(user) {
  const userRef = userDocRef(user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const profile = {
      uid: user.uid,
      name: user.displayName || 'Usuario',
      email: user.email || '',
      role: 'analista',
      createdAt: serverTimestamp()
    };
    await setDoc(userRef, profile);
    return {...profile, createdAt: null};
  }

  return userSnap.data();
}

async function handleLogin() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Error signing in with Google:', error);
    alert('No se pudo iniciar sesión con Google.');
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    alert('No se pudo cerrar sesión.');
  }
}

function refreshAllViews() {
  renderKanban();
  renderAnalysts();
  if (window.renderGantt) window.renderGantt();
  updateStats();
}

async function load() {
  if (!currentUser) return;
  const snapshot = await getDocs(projectCollectionRef());
  projects = snapshot.docs
    .map(docSnap => normalizeProject(docSnap.data(), docSnap.id))
    .sort((a, b) => a.id - b.id);
  nextId = Math.max(100, ...projects.map(p => Number(p.id) || 0)) + 1;
  refreshAllViews();
}

async function createProject(project) {
  await addDoc(projectCollectionRef(), {
    ...projectPayload(project),
    ...createAuditFields()
  });
}

async function updateProject(project) {
  if (!project.docId) throw new Error('Missing Firestore docId for project update.');
  await updateDoc(projectDocRef(project.docId), {
    ...projectPayload(project),
    ...updateAuditFields()
  });
}

async function updateProjectFields(docId, fields) {
  if (!docId) throw new Error('Missing Firestore docId for project field update.');
  await updateDoc(projectDocRef(docId), {
    ...fields,
    ...updateAuditFields()
  });
}

async function deleteProject(docId) {
  if (!docId) throw new Error('Missing Firestore docId for project delete.');
  await deleteDoc(projectDocRef(docId));
}

function save() {}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── TABS ── */
function toggleDirector() {
  showDirector = !showDirector;
  document.getElementById('toggle-director').classList.toggle('on', showDirector);
  document.querySelectorAll('.director-col').forEach(el => el.classList.toggle('col-hidden', !showDirector));
}

function setAvFilter(type, btn) {
  avFilter = type;
  document.querySelectorAll('#avf-all,#avf-jp,#avf-mg,#avf-jr,#avf-br').forEach(b => b.className = 'btn-ghost');
  btn.classList.add('active-' + (type === 'all' ? 'all' : type));
  ANALYST_CODES.forEach(code => {
    const panel = document.getElementById('panel-' + code);
    if (panel) panel.classList.toggle('panel-hidden', type !== 'all' && type !== code);
  });
  document.querySelector('.av-panels').style.gridTemplateColumns = type === 'all' ? '' : '1fr';
}

function toggleInicio() {
  showInicio = !showInicio;
  const btn = document.getElementById('toggle-inicio');
  btn.classList.toggle('on', showInicio);
  document.querySelectorAll('.inicio-col').forEach(el => el.classList.toggle('col-hidden', !showInicio));
  renderKanban();
}

function switchTab(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  btn.classList.add('active');
  setSearchVisibility(name);
  if (name === 'analistas') renderAnalysts();
  if (name === 'gantt' && window.ganttGoToday) window.ganttGoToday();
}

/* ── STATS ── */
function updateStats() {
  ANALYST_CODES.forEach(code => {
    const stat = document.getElementById('stat-' + code);
    if (stat) stat.textContent = `${ANAME[code]}: ${projects.filter(p => p.a === code).length}`;
  });
}

/* ── KANBAN ── */
function setFilter(type, btn) {
  curFilter = type;
  document.querySelectorAll('.btn-ghost').forEach(b => b.className = 'btn-ghost');
  btn.classList.add('active-'+type);
  renderKanban();
}

function renderKanban() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  COLS.forEach(col => {
    const inCol = sortProjectsByDate(projects.filter(p => p.col === col.id && matchesSearch(p)));
    const vis = inCol.filter(p => curFilter==='all' || p.a===curFilter);
    const el = document.createElement('div');
    el.className = `col col-${col.id}`;
    el.innerHTML = `
      <div class="col-header">
        <span class="col-dot" style="background:${col.dot}"></span>
        <span class="col-name">${col.label}</span>
        <span class="col-count">${vis.length}</span>
        <button class="col-add" title="Agregar aquí" onclick="openModal('${col.id}')">+</button>
      </div>
      <div class="col-body" id="body-${col.id}"></div>`;
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('drag-over'); });
    el.addEventListener('drop', async e => {
      e.preventDefault(); el.classList.remove('drag-over');
      if (dragId !== null) {
        const p = getProjectByDocId(dragId);
        if (p) {
          await updateProjectFields(p.docId, {col: col.id, isnew: false});
          await load();
        }
      }
    });
    board.appendChild(el);
    const body = document.getElementById('body-'+col.id);
    if (vis.length === 0) {
      body.innerHTML = `<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12h6M12 9v6"/></svg>Sin proyectos</div>`;
    }
    inCol.forEach(p => {
      const hidden = curFilter!=='all' && p.a!==curFilter;
      const card = document.createElement('div');
      card.className = 'card'+(hidden?' hidden':'')+(p.isnew?' is-new':'');
      card.draggable = true;
      card.innerHTML = `
        ${p.isnew?'<span class="card-new-badge">Nuevo</span>':''}
        <div class="card-client">${esc(p.client)}${p.country?' · '+esc(p.country):''}</div>
        <div class="card-title">${esc(p.title)}</div>
        ${p.n?`<div class="card-n">${esc(p.n)}</div>`:''}
        ${p.need?`<div><span class="need-pill ${NEED_CLS[p.need]||'n-amb'}">${esc(p.need)}</span></div>`:''}
        ${p.date?`<div class="card-date">${fmtDate(p.date)}</div>`:''}
        ${p.assigned&&showInicio?`<div class="card-assigned"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Inicio: ${fmtDate(p.assigned)}</div>`:''}
        ${p.notes?`<div class="card-notes">${esc(p.notes)}</div>`:''}
        ${(p.createdByName || p.updatedByName) ? `
        <div class="card-meta">
          ${p.createdByName ? `<div>Creado por: ${esc(p.createdByName)}</div>` : ''}
          ${p.updatedByName ? `<div>Última edición: ${esc(p.updatedByName)}</div>` : ''}
        </div>` : ''}
        <div class="card-footer" style="margin-top:8px">
          <span class="analyst-badge a-${p.a}">${ANAME[p.a]}</span>
          <div class="card-actions">
            <button class="card-btn" title="Editar" onclick='editCard(${JSON.stringify(p.docId)})'>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${currentUserProfile && currentUserProfile.role === "director" ? `
            <button class="card-btn del" title="Eliminar" onclick='delCard(${JSON.stringify(p.docId)})'>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>` : ''}
          </div>
        </div>`;
      card.addEventListener('dragstart', () => { dragId = p.docId; card.classList.add('dragging'); });
      card.addEventListener('dragend', () => { dragId = null; card.classList.remove('dragging'); });
      body.appendChild(card);
    });
  });
  updateStats();
}

/* ── MODAL ── */
let colPreset = 'backlog';
function openModal(colId) {
  colPreset = colId || 'backlog';
  const analystFromUser = USER_ANALYST_MAP[(currentUser?.email || '').toLowerCase()] || 'jp';
  document.getElementById('modal-title').textContent = 'Nuevo proyecto';
  document.getElementById('edit-id').value = '';
  ['f-client','f-country','f-title','f-n','f-notes','f-date','f-assigned','f-director'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-analyst').value = analystFromUser;
  document.getElementById('f-col').value = colPreset;
  document.getElementById('f-need').value = '';
  document.getElementById('modal-bg').classList.add('open');
  setTimeout(() => document.getElementById('f-client').focus(), 50);
}
function editCard(docId) {
  const p = getProjectByDocId(docId); if (!p) return;
  document.getElementById('modal-title').textContent = 'Editar proyecto';
  document.getElementById('edit-id').value = docId;
  document.getElementById('f-client').value = p.client;
  document.getElementById('f-country').value = p.country||'';
  document.getElementById('f-title').value = p.title;
  document.getElementById('f-n').value = parseSampleSize(p.n);
  document.getElementById('f-analyst').value = p.a;
  document.getElementById('f-col').value = p.col;
  document.getElementById('f-need').value = p.need||'';
  document.getElementById('f-notes').value = p.notes||'';
  document.getElementById('f-date').value = p.date||'';
  document.getElementById('f-assigned').value = p.assigned||'';
  document.getElementById('f-director').value = p.director||'';
  document.getElementById('modal-bg').classList.add('open');
  setTimeout(() => document.getElementById('f-client').focus(), 50);
}
function closeModal() { document.getElementById('modal-bg').classList.remove('open'); }
function closeBg(e) { if (e.target===document.getElementById('modal-bg')) closeModal(); }
async function saveCard() {
  const docId   = document.getElementById('edit-id').value;
  const client  = document.getElementById('f-client').value.trim();
  const country = document.getElementById('f-country').value.trim();
  const title   = document.getElementById('f-title').value.trim();
  const n       = formatSampleSize(document.getElementById('f-n').value);
  const analyst = document.getElementById('f-analyst').value;
  const col     = document.getElementById('f-col').value;
  const need    = document.getElementById('f-need').value;
  const notes   = document.getElementById('f-notes').value.trim();
  const date    = document.getElementById('f-date').value;
  const assigned= document.getElementById('f-assigned').value;
  const director= document.getElementById('f-director') ? document.getElementById('f-director').value.trim() : '';
  if (!client||!title) { document.getElementById('f-title').focus(); return; }
  if (docId) {
    const p = getProjectByDocId(docId);
    if (p) {
      await updateProject({...p, client,country,title,n,a:analyst,col,need,notes,date,assigned,director});
    }
  } else {
    await createProject({id:nextId++,client,country,title,n,col,a:analyst,isnew:false,need,notes,date,assigned,director});
  }
  await load();
  closeModal();
  refreshAllViews();
}
async function delCard(docId) {
  if (!confirm('¿Eliminar este proyecto?')) return;
  if (!currentUserProfile || currentUserProfile.role !== "director") {
    alert("No tienes permiso para borrar proyectos.");
    return;
  }
  const p = getProjectByDocId(docId);
  if (!p) return;
  await deleteProject(p.docId);
  await load();
  refreshAllViews();
}

/* ── ANALYST TABLE ── */
function renderAnalysts() {
  ANALYST_CODES.forEach(a => {
    const list = sortProjectsByDate(projects.filter(p => p.a===a && matchesSearch(p)));
    const tbody = document.getElementById('tbody-'+a);
    if (!tbody) return;
    document.getElementById('cnt-'+a).textContent = list.length;
    document.getElementById('sub-'+a).textContent = list.length===1?'1 proyecto asignado':`${list.length} proyectos asignados`;
    document.getElementById('empty-'+a).style.display = list.length===0?'block':'none';
    tbody.innerHTML = '';
    list.forEach((p,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><div class="ci ci-c num">${i+1}</div></td>
        <td><div class="ci"><span class="editable" contenteditable="true" data-f="client" data-docid="${p.docId}" onblur="ce(this)">${esc(p.client)}</span></div></td>
        <td><div class="ci"><span class="editable" contenteditable="true" data-f="title" data-docid="${p.docId}" onblur="ce(this)">${esc(p.title)}</span></div></td>
        <td class="director-col col-hidden"><div class="ci"><span class="editable" contenteditable="true" data-f="director" data-docid="${p.docId}" onblur="ce(this)">${esc(p.director||'')}</span></div></td>
        <td><div class="ci"><span class="editable" contenteditable="true" data-f="country" data-docid="${p.docId}" onblur="ce(this)">${esc(p.country||'')}</span></div></td>
        <td class="sel-cell">
          <select onchange='cse(${JSON.stringify(p.docId)},"col",this.value)'>
            ${COL_OPTS.map(s=>`<option value="${s}"${p.col===s?' selected':''}>${COL_LABEL[s]}</option>`).join('')}
          </select>
        </td>
        <td class="sel-cell">
          <select onchange='cse(${JSON.stringify(p.docId)},"need",this.value)'>
            <option value=""${!p.need?' selected':''}>— Sin definir —</option>
            <option value="Procesamiento"${p.need==='Procesamiento'?' selected':''}>Procesamiento</option>
            <option value="Análisis"${p.need==='Análisis'?' selected':''}>Análisis</option>
            <option value="Ambos"${p.need==='Ambos'?' selected':''}>Ambos</option>
            <option value="Diseño"${p.need==='Diseño'?' selected':''}>Diseño</option>
            <option value="Cliente"${p.need==='Cliente'?' selected':''}>Cliente</option>
          </select>
        </td>
        <td class="notes-cell"><div class="ci"><span class="editable" contenteditable="true" data-f="notes" data-docid="${p.docId}" onblur="ce(this)">${esc(p.notes||'')}</span></div></td>
        <td class="date-cell inicio-col">
          <div class="date-inline">
            <input type="date" value="${p.assigned||''}" title="Fecha de inicio" onchange='cse(${JSON.stringify(p.docId)},"assigned",this.value)'>
            ${p.assigned ? `<button type="button" class="date-clear-btn" title="Quitar fecha de inicio" onclick='clearDateField(this, ${JSON.stringify(p.docId)}, "assigned")'>×</button>` : ''}
          </div>
        </td>
        <td class="date-cell">
          <div class="date-inline">
            <input type="date" value="${p.date||''}" title="Final" onchange='cse(${JSON.stringify(p.docId)},"date",this.value)'>
            ${p.date ? `<button type="button" class="date-clear-btn" title="Quitar fecha final" onclick='clearDateField(this, ${JSON.stringify(p.docId)}, "date")'>×</button>` : ''}
          </div>
        </td>
        <td><div class="ci">${esc(p.createdByName || '')}</div></td>
        <td><div class="ci">${esc(p.updatedByName || '')}</div></td>
        <td><div class="row-acts">
          <button class="row-btn" title="Editar en modal" onclick='editCard(${JSON.stringify(p.docId)})'>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          ${currentUserProfile && currentUserProfile.role === "director" ? `
          <button class="row-btn del" title="Eliminar" onclick='delCard(${JSON.stringify(p.docId)})'>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>` : ''}
        </div></td>`;
      tbody.appendChild(tr);
    });
  });
  renderConsolidatedAnalystTable();
  updateStats();
}

function consolidatedAnalystRows() {
  return sortProjectsByDate(getAnalystFilteredProjects()).map((p, index) => ({
    row: index + 1,
    id: p.id,
    client: p.client || '',
    country: p.country || '',
    title: p.title || '',
    n: p.n || '',
    col: COL_LABEL[p.col] || p.col || '',
    responsible: ANAME[p.a] || p.a || '',
    need: p.need || '',
    notes: p.notes || '',
    assigned: p.assigned || '',
    date: p.date || '',
    director: p.director || '',
    createdByName: p.createdByName || '',
    updatedByName: p.updatedByName || ''
  }));
}

function renderConsolidatedAnalystTable() {
  const body = document.getElementById('av-sheet-body');
  const empty = document.getElementById('av-sheet-empty');
  const subtitle = document.getElementById('av-sheet-subtitle');
  if (!body || !empty || !subtitle) return;

  const rows = consolidatedAnalystRows();
  const scopeLabel = avFilter === 'all' ? 'Todos los proyectos visibles en la vista actual.' : `Proyectos filtrados para ${ANAME[avFilter] || avFilter}.`;
  subtitle.textContent = scopeLabel;
  body.innerHTML = '';

  if (!rows.length) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${row.row}</td>
      <td class="mono">${esc(row.id)}</td>
      <td>${esc(row.client)}</td>
      <td>${esc(row.country)}</td>
      <td>${esc(row.title)}</td>
      <td class="mono">${esc(row.n)}</td>
      <td>${esc(row.col)}</td>
      <td>${esc(row.responsible)}</td>
      <td>${esc(row.need)}</td>
      <td class="notes">${esc(row.notes)}</td>
      <td class="mono">${esc(fmtDate(row.assigned))}</td>
      <td class="mono">${esc(fmtDate(row.date))}</td>
      <td>${esc(row.director)}</td>`;
      tr.innerHTML += `
      <td>${esc(row.createdByName)}</td>
      <td>${esc(row.updatedByName)}</td>`;
      body.appendChild(tr);
  });
}

async function ce(el) {
  const p = getProjectByDocId(el.dataset.docid);
  if (p) {
    await updateProjectFields(p.docId, {[el.dataset.f]: el.innerText.trim()});
    await load();
  }
}
async function cse(docId, field, val) {
  const p = getProjectByDocId(docId);
  if (p) {
    await updateProjectFields(p.docId, {[field]: val});
    await load();
  }
}
async function clearDateField(btn, docId, field) {
  const wrap = btn.closest('.date-inline');
  const input = wrap ? wrap.querySelector('input[type="date"]') : null;
  if (input) input.value = '';
  await cse(docId, field, '');
}
async function addRow(analyst) {
  const p = {id:nextId++,client:'',country:'',title:'Nuevo proyecto',n:'',col:'backlog',a:analyst,isnew:false,need:'',notes:'',date:'',assigned:'',director:''};
  await createProject(p);
  await load();
  refreshAllViews();
  setTimeout(() => {
    const rows = document.querySelectorAll(`#tbody-${analyst} tr`);
    const last = rows[rows.length-1];
    if (last) { const ed = last.querySelector('.editable'); if(ed){ed.focus();const r=document.createRange();r.selectNodeContents(ed);const s=window.getSelection();s.removeAllRanges();s.addRange(r);} }
  }, 60);
}

/* ── EXCEL EXPORT ── */
function downloadXlsx(analyst) {
  const list = projects.filter(p => p.a === analyst);
  const name = ANAME[analyst];
  const today = new Date().toLocaleDateString('es-CR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const wb = XLSX.utils.book_new();
  const titleRow  = [`Proyectos asignados — ${name}`,'','','','','','','','','','',''];
  const dateRow   = [`Generado: ${today}`,'','','','','','','','','','',''];
  const blankRow  = ['','','','','','','','','','','',''];
  const headerRow = ['#','Cliente','Proyecto','Director-a','País','Estado','Necesidad','Notas','Inicio','Final','Creado por','Última edición'];
  const dataRows  = list.map((p,i) => [
    i+1, p.client||'', p.title||'', p.director||'', p.country||'',
    COL_LABEL[p.col]||p.col, p.need||'', p.notes||'', fmtDate(p.assigned), fmtDate(p.date), p.createdByName||'', p.updatedByName||'',
  ]);
  const wsData = [titleRow, dateRow, blankRow, headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{wch:5},{wch:24},{wch:38},{wch:18},{wch:16},{wch:16},{wch:14},{wch:28},{wch:14},{wch:14},{wch:16},{wch:18}];
  ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:11}},{s:{r:1,c:0},e:{r:1,c:11}}];
  XLSX.utils.book_append_sheet(wb, ws, name.substring(0,31));
  XLSX.writeFile(wb, `proyectos_${analyst}_${new Date().toISOString().slice(0,10)}.xlsx`);
  const btn = document.getElementById('dl-'+analyst);
  btn.classList.add('dl-flash');
  setTimeout(() => btn.classList.remove('dl-flash'), 500);
}

function exportConsolidatedXlsx() {
  const rows = consolidatedAnalystRows();
  if (!rows.length) {
    alert('No hay proyectos para exportar en este filtro.');
    return;
  }

  const filterLabel = avFilter === 'all' ? 'todos' : avFilter;
  const title = avFilter === 'all'
    ? 'Tabla consolidada — Todos los proyectos'
    : `Tabla consolidada — ${ANAME[avFilter] || avFilter}`;
  const today = new Date().toLocaleDateString('es-CR',{day:'2-digit',month:'2-digit',year:'numeric'});
  const wb = XLSX.utils.book_new();
  const wsData = [
    [title,'','','','','','','','','','','','','','',''],
    [`Generado: ${today}`,'','','','','','','','','','','','','','',''],
    ['','','','','','','','','','','','','','','',''],
    ['#','ID','Cliente','País','Proyecto','Muestra (n)','Estado','Responsable','Necesidad','Notas','Inicio','Final','Director-a','Creado por','Última edición'],
    ...rows.map(row => [
      row.row,
      row.id,
      row.client,
      row.country,
      row.title,
      row.n,
      row.col,
      row.responsible,
      row.need,
      row.notes,
      fmtDate(row.assigned),
      fmtDate(row.date),
      row.director,
      row.createdByName,
      row.updatedByName
    ])
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{wch:5},{wch:8},{wch:22},{wch:16},{wch:34},{wch:14},{wch:16},{wch:16},{wch:14},{wch:28},{wch:14},{wch:14},{wch:18},{wch:16},{wch:18}];
  ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:14}},{s:{r:1,c:0},e:{r:1,c:14}}];
  XLSX.utils.book_append_sheet(wb, ws, 'Consolidado');
  XLSX.writeFile(wb, `proyectos_consolidado_${filterLabel}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });

function exportHTML() {
  console.warn('exportHTML() está deshabilitada en la versión con Firestore.');
}

window.switchTab = switchTab;
window.setFilter = setFilter;
window.setAvFilter = setAvFilter;
window.toggleDirector = toggleDirector;
window.toggleInicio = toggleInicio;
window.openModal = openModal;
window.editCard = editCard;
window.closeModal = closeModal;
window.closeBg = closeBg;
window.saveCard = saveCard;
window.delCard = delCard;
window.addRow = addRow;
window.downloadXlsx = downloadXlsx;
window.exportConsolidatedXlsx = exportConsolidatedXlsx;
window.exportHTML = exportHTML;
window.ce = ce;
window.cse = cse;
window.clearDateField = clearDateField;
window.load = load;





/* ════ GANTT ENGINE ════ */
const DAY_W = 30;

let ganttFilter = 'all';
let ganttViewStart = null;
let ganttInited = false;

function gDate(s){ if(!s) return null; const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function gAddDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function gDiff(a,b){ return Math.round((b-a)/864e5); }
function gFmt(d){ return d.toLocaleDateString('es-CR',{day:'2-digit',month:'short'}); }

function ganttProjects(){
  return (window.projects || []).filter(p => p.assigned && p.date && gDate(p.assigned) && gDate(p.date));
}

function computeGanttRange(items){
  const dates = items.flatMap(p=>[gDate(p.assigned),gDate(p.date)]);
  const minD = new Date(Math.min(...dates));
  const maxD = new Date(Math.max(...dates));
  return { start: gAddDays(minD,-4), end: gAddDays(maxD,6) };
}

function setGanttFilter(type,btn){
  ganttFilter = type;
  document.querySelectorAll('#gf-all,#gf-jp,#gf-mg,#gf-jr,#gf-br,#gf-done,#gf-open').forEach(b=>b.className='btn-ghost');
  btn.classList.add('active-'+(type==='all' || type==='done' || type==='open' ? 'all' : type));
  renderGantt();
}

function ganttScroll(dir){
  ganttViewStart = gAddDays(ganttViewStart, dir*7);
  renderGantt();
}

function ganttGoToday(){
  const all = ganttProjects();
  if(!all.length) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const {start,end} = computeGanttRange(all);
  // center today in view with 4-day left padding
  ganttViewStart = gAddDays(today,-4);
  if(ganttViewStart < start) ganttViewStart = start;
  renderGantt();
}

function renderGantt(){
  const allItems = ganttProjects();
  const noData = document.getElementById('gantt-no-data');
  const body   = document.getElementById('gantt-body');

  if(!allItems.length){
    noData.style.display='block'; body.style.display='none'; return;
  }
  noData.style.display='none'; body.style.display='flex';

  // filter
  const items = allItems.filter(p=>{
    if(ganttFilter==='jp')   return p.a==='jp';
    if(ganttFilter==='mg')   return p.a==='mg';
    if(ganttFilter==='jr')   return p.a==='jr';
    if(ganttFilter==='br')   return p.a==='br';
    if(ganttFilter==='done') return p.col==='done';
    if(ganttFilter==='open') return p.col!=='done';
    return true;
  });

  const {start: dataStart, end: dataEnd} = computeGanttRange(allItems);
  if(!ganttViewStart) ganttViewStart = gAddDays(new Date(),-4);
  // clamp
  if(ganttViewStart < dataStart) ganttViewStart = new Date(dataStart);
  const viewDays = gDiff(ganttViewStart, dataEnd) + 1;
  const totalWidth = viewDays * DAY_W;

  const today = new Date(); today.setHours(0,0,0,0);
  const todayIdx = gDiff(ganttViewStart, today);
  const todayX = (todayIdx >= 0 && todayIdx < viewDays) ? todayIdx * DAY_W + DAY_W/2 : -1;

  // update label
  document.getElementById('gantt-range-lbl').textContent =
    gFmt(ganttViewStart) + ' — ' + gFmt(gAddDays(ganttViewStart, viewDays-1));

  const gl = document.getElementById('gantt-left');
  const gr = document.getElementById('gantt-right');
  gl.innerHTML=''; gr.innerHTML='';
  gr.style.width = totalWidth + 'px';

  // ── Left sticky header ──
  const hl = document.createElement('div');
  hl.className='g-hdr-l'; hl.textContent='Proyecto';
  gl.appendChild(hl);

  // ── Right header ──
  const hr = document.createElement('div');
  hr.className='g-hdr-r'; hr.style.width=totalWidth+'px';

  // month band
  const mb = document.createElement('div');
  mb.className='g-month-band'; mb.style.width=totalWidth+'px';
  let curMo='', segDays=0;
  const segs=[];
  for(let i=0;i<viewDays;i++){
    const d=gAddDays(ganttViewStart,i);
    const mo=d.toLocaleDateString('es-CR',{month:'short',year:'2-digit'});
    if(mo!==curMo){if(curMo)segs.push({label:curMo,days:segDays});curMo=mo;segDays=0;}
    segDays++;
  }
  if(curMo)segs.push({label:curMo,days:segDays});
  segs.forEach(s=>{
    const el=document.createElement('div');
    el.className='g-month-seg';
    el.style.width=(s.days*DAY_W)+'px';
    el.textContent=s.label.toUpperCase();
    mb.appendChild(el);
  });

  // days band
  const db = document.createElement('div');
  db.className='g-days-band'; db.style.width=totalWidth+'px';
  for(let i=0;i<viewDays;i++){
    const d=gAddDays(ganttViewStart,i);
    const dow=d.getDay();
    const isWknd=dow===0||dow===6;
    const isToday=gDiff(d,today)===0;
    const cell=document.createElement('div');
    cell.className='g-day'+(isWknd?' wknd':'')+(isToday?' today':'');
    cell.style.width=DAY_W+'px';
    cell.innerHTML=`<span class="dn">${d.getDate()}</span><span class="dd">${['D','L','M','X','J','V','S'][dow]}</span>`;
    db.appendChild(cell);
  }

  hr.appendChild(mb); hr.appendChild(db);
  gr.appendChild(hr);

  // ── Rows ──
  (items.length ? items : [{_empty:true}]).forEach(p=>{
    if(p._empty){
      const row=document.createElement('div');
      row.className='g-row';
      row.innerHTML=`<div class="g-label"><span style="font-size:11px;color:var(--hint);font-style:italic">Sin proyectos para este filtro</span></div><div class="g-cells" style="width:${totalWidth}px"></div>`;
      const ll=document.createElement('div'); ll.className='g-hdr-l'; ll.style.height='38px';
      gl.appendChild(row); gr.appendChild(row.querySelector('.g-cells').cloneNode(true)); return;
    }

    const isDone = p.col==='done';

    // left label
    const ll=document.createElement('div');
    ll.className='g-row'+(isDone?' dim':'');
    ll.innerHTML=`<div class="g-label">
      <span class="gl-t" title="${p.title}">${p.title}</span>
      <span class="gl-m">${p.client}${p.country?' · '+p.country:''} · ${window.ANAME[p.a]}</span>
    </div>`;
    gl.appendChild(ll);

    // right cells
    const rr=document.createElement('div');
    rr.className='g-row'+(isDone?' dim':'');
    rr.style.cssText=`height:38px;width:${totalWidth}px;position:relative;display:block;border-bottom:1px solid var(--border)`;

    // column shading
    for(let i=0;i<viewDays;i++){
      const d=gAddDays(ganttViewStart,i);
      const dow=d.getDay();
      const isWknd=dow===0||dow===6;
      const isToday=gDiff(d,today)===0;
      if(isWknd||isToday){
        const c=document.createElement('div');
        c.className='g-cell'+(isWknd?' wknd':'')+(isToday?' today-c':'');
        c.style.cssText=`left:${i*DAY_W}px;width:${DAY_W}px;`;
        rr.appendChild(c);
      }
    }

    // bar
    const s=gDate(p.assigned), e=gDate(p.date);
    const barL=gDiff(ganttViewStart,s);
    const barW=Math.max(1,gDiff(s,e)+1);
    if(barL<viewDays && barL+barW>0){
      const cL=Math.max(0,barL);
      const cW=Math.min(barW,viewDays-cL);
      const bar=document.createElement('div');
      bar.className='g-bar'+(isDone?' done':' '+p.a);
      bar.style.cssText=`left:${cL*DAY_W+3}px;width:${cW*DAY_W-6}px`;
      // tooltip
      bar.title=`${p.title}\n${gFmt(s)} → ${gFmt(e)}`;
      rr.appendChild(bar);
    } else {
      // no-date indicator
      const nd=document.createElement('div');
      nd.className='g-no-date';
      nd.style.cssText=`position:absolute;left:4px;top:0;height:100%`;
      nd.textContent='fuera de rango';
      rr.appendChild(nd);
    }

    // today line
    if(todayX>0){
      const tl=document.createElement('div');
      tl.className='g-today-line';
      tl.style.left=todayX+'px';
      rr.appendChild(tl);
    }

    gr.appendChild(rr);
  });

  // sync scroll
  const wrap=document.getElementById('gantt-right-wrap');
  gl.style.overflowY='hidden';
  wrap.onscroll=()=>{ gl.scrollTop=wrap.scrollTop; };
}

window.renderGantt = renderGantt;
window.setGanttFilter = setGanttFilter;
window.ganttScroll = ganttScroll;
window.ganttGoToday = ganttGoToday;

loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
projectSearch.addEventListener('input', e => {
  searchQuery = e.target.value || '';
  renderKanban();
  renderAnalysts();
});

onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (user) {
    const profile = await ensureUserProfile(user);
    currentUserProfile = profile;
    const roleLabel = profile.role.charAt(0).toUpperCase() + profile.role.slice(1);
    showAppScreen(user);
    setSearchVisibility('kanban');
    userInfo.textContent = `${profile.name || user.displayName || 'Usuario'} (${profile.email || user.email || ''}) - ${roleLabel}`;
    try {
      await load();
    } catch (error) {
      console.error('Error loading projects from Firestore:', error);
      alert('No se pudieron cargar los proyectos.');
    }
    return;
  }

  showAuthScreen();
});
