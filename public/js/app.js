// ============================================================
// public/js/app.js  ― 画面の動き関連
// ============================================================

// ── 状態管理 ─────────────────────────────────────────────────
const state = {
  user: null,          // { id, username, role }
  mode: 'view',        // 'view' or 'edit'
  clients: [],
  currentClient: null,
  sections: [],
  activeSection: 0,
  editMode: false,
};

// ── ユーティリティ ─────────────────────────────────────────────
function showScreen(name) {
  ['login','top','list','detail'].forEach(s => {
    document.getElementById('screen-' + s).classList.add('d-none');
  });
  document.getElementById('screen-' + name).classList.remove('d-none');
}

function showToast(msg, type = 'bg-dark') {
  const el  = document.getElementById('app-toast');
  const txt = document.getElementById('toast-msg');
  el.className = `toast align-items-center text-white border-0 ${type}`;
  txt.textContent = msg;
  bootstrap.Toast.getOrCreateInstance(el, { delay: 2500 }).show();
}

function api(method, url, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(r => r.json());
}

function getColor(id) {
  const COLORS = ['#2C5F8A','#27734A','#8A2C5F','#B07D2A','#5F2C8A','#2C8A7D','#8A5F2C'];
  return COLORS[(id - 1) % COLORS.length];
}

// ── ログイン ────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const errEl    = document.getElementById('login-error');

  if (!username) { errEl.textContent = 'ユーザー名を入力してください'; errEl.classList.remove('d-none'); return; }
  errEl.classList.add('d-none');

  const result = await api('POST', '/api/login', { username, password });
  if (result.error) {
    errEl.textContent = result.error;
    errEl.classList.remove('d-none');
    return;
  }

  state.user = result;
  document.getElementById('nav-username').textContent = result.username;
  document.getElementById('nav-role-badge').textContent = result.role === 'admin' ? '編集者' : '閲覧者';
  document.getElementById('nav-role-badge').className = result.role === 'admin'
    ? 'badge bg-warning text-dark' : 'badge bg-light text-primary';
  document.getElementById('navbar').style.removeProperty('display');

  gotoTop();
}

function logout() {
  state.user = null;
  document.getElementById('navbar').style.setProperty('display','none','important');
  showScreen('login');
}

// ── トップ ──────────────────────────────────────────────────
function gotoTop() {
  document.getElementById('top-username').textContent = state.user.username;
  const editCard = document.getElementById('card-edit');
  if (state.user.role !== 'admin') {
    editCard.classList.add('top-card-disabled');
    editCard.onclick = () => showToast('編集権限がありません','bg-danger');
  } else {
    editCard.classList.remove('top-card-disabled');
    editCard.onclick = () => gotoList('edit');
  }
  showScreen('top');
}

// ── クライアント一覧 ────────────────────────────────────────
async function gotoList(mode) {
  state.mode = mode;
  document.getElementById('list-breadcrumb').textContent = mode === 'edit' ? 'マニュアルを編集する' : 'マニュアルを見る';
  document.getElementById('list-title').textContent      = mode === 'edit' ? 'クライアント一覧（編集）' : 'クライアント一覧';
  const btnNew = document.getElementById('btn-new-client');
  mode === 'edit' ? btnNew.classList.remove('d-none') : btnNew.classList.add('d-none');

  state.clients = await api('GET', '/api/clients');
  renderClientGrid(state.clients);
  showScreen('list');
}

function gotoListFromDetail() {
  gotoList(state.mode);
}

function filterClients() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const filtered = state.clients.filter(c =>
    c.name.toLowerCase().includes(q) || (c.tags || []).some(t => t.toLowerCase().includes(q))
  );
  renderClientGrid(filtered);
}

function renderClientGrid(list) {
  const grid = document.getElementById('client-grid');
  if (list.length === 0) {
    grid.innerHTML = '<div class="text-muted small p-3">クライアントが見つかりません</div>';
    return;
  }
  grid.innerHTML = list.map(c => `
    <div class="col-md-4 col-sm-6">
      <div class="card client-card border-0 shadow-sm h-100" onclick="gotoDetail(${c.id})">
        <div class="card-body">
          <div class="d-flex align-items-start justify-content-between mb-2">
            <div class="client-avatar" style="background:${getColor(c.id)}">${c.name.charAt(0)}</div>
            <small class="text-muted">${c.updated_at ? c.updated_at.slice(0,10) : ''}</small>
          </div>
          <h6 class="fw-bold mb-2">${c.name}</h6>
          <div class="mb-2">
            ${(c.tags||[]).map(t=>`<span class="badge bg-primary-subtle text-primary me-1">${t}</span>`).join('')}
          </div>
          <p class="small text-muted mb-1"><i class="bi bi-person me-1"></i>${c.updated_by || ''}</p>
          <p class="small text-muted mb-0 text-truncate">${c.memo || ''}</p>
        </div>
      </div>
    </div>
  `).join('');
}

// ── 新規クライアント ────────────────────────────────────────
function openModal(id) { bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).show(); }
function closeModal(id){ bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).hide();  }

async function addClient() {
  const name = document.getElementById('new-client-name').value.trim();
  if (!name) { showToast('クライアント名を入力してください','bg-danger'); return; }
  const memo = document.getElementById('new-client-memo').value.trim();
  const tags = document.getElementById('new-client-tags').value.trim();

  const result = await api('POST', '/api/clients', { name, memo, tags, username: state.user.username });
  if (result.error) { showToast(result.error, 'bg-danger'); return; }

  closeModal('modal-new-client');
  ['new-client-name','new-client-memo','new-client-tags'].forEach(id => document.getElementById(id).value = '');
  showToast(`「${name}」を登録しました`, 'bg-success');
  state.clients = await api('GET', '/api/clients');
  renderClientGrid(state.clients);
}

// ── 詳細画面 ────────────────────────────────────────────────
async function gotoDetail(clientId) {
  state.currentClient = state.clients.find(c => c.id === clientId);
  state.sections      = await api('GET', `/api/clients/${clientId}/sections`);
  state.activeSection = 0;
  state.editMode      = false;
  renderDetail();
  showScreen('detail');
}

function renderDetail() {
  const c   = state.currentClient;
  const sec = state.sections[state.activeSection];

  document.getElementById('detail-nav-list').textContent   = state.mode === 'edit' ? 'クライアント一覧（編集）' : 'クライアント一覧';
  document.getElementById('detail-nav-client').textContent = c.name;

  // 編集ツールバー
  const toolbar = document.getElementById('edit-toolbar');
  state.editMode ? toolbar.classList.remove('d-none') : toolbar.classList.add('d-none');

  // サイドバー
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = state.sections.map((s, i) => `
    <a href="#" class="list-group-item list-group-item-action small py-2 px-3 ${i === state.activeSection ? 'active' : ''}"
       onclick="setSection(${i}); return false;">
      ${s.icon || '📄'} ${s.label}
    </a>
  `).join('');

  const addBtn = document.getElementById('sidebar-add-btn');
  state.editMode ? addBtn.classList.remove('d-none') : addBtn.classList.add('d-none');

  // メイン
  const main = document.getElementById('detail-main');

  // ヘッダーカード
  const headerHtml = `
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body d-flex align-items-center gap-3">
        <div class="client-avatar-lg" style="background:${getColor(c.id)}">${c.name.charAt(0)}</div>
        <div class="flex-grow-1">
          <h5 class="fw-bold mb-1">${c.name}</h5>
          <div class="mb-1">
            ${(c.tags||[]).map(t=>`<span class="badge bg-primary-subtle text-primary me-1">${t}</span>`).join('')}
          </div>
          <small class="text-muted">
            最終更新：${c.updated_at ? c.updated_at.slice(0,10) : ''}　更新者：${c.updated_by || ''}　${c.memo || ''}
          </small>
        </div>
        ${state.mode === 'edit' && !state.editMode ? `
          <button class="btn btn-outline-warning btn-sm" onclick="startEdit()">
            <i class="bi bi-pencil me-1"></i>編集する
          </button>` : ''}
      </div>
    </div>
  `;

  if (!sec) {
    main.innerHTML = headerHtml + `<div class="text-muted small p-3">分類を追加してください</div>`;
    return;
  }

  main.innerHTML = headerHtml + (state.editMode ? renderSectionEdit(sec) : renderSectionView(sec));
}

// ── セクション表示 ──────────────────────────────────────────
function renderSectionView(sec) {
  const steps = (sec.steps || []).map((st, i) => `
    <div class="step-item mb-4">
      <!-- ステップ番号 + テキスト -->
      <div class="d-flex gap-3 align-items-start mb-3">
        <div class="step-num flex-shrink-0">${i + 1}</div>
        <p class="mb-0 pt-1">${st.step_text || ''}</p>
      </div>
      <!-- 画像エリア（常に表示） -->
      <div class="step-image-area ms-5">
        ${(st.images||[]).length > 0 ? `
          <div class="row g-3">
            ${st.images.map(img => `
              <div class="col-12 col-md-4">
                <div class="step-image-card" onclick="previewImage('/uploads/${img.filename}')">
                  <img src="/uploads/${img.filename}" alt="手順画像">
                  <div class="step-image-overlay"><i class="bi bi-zoom-in"></i></div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="step-image-empty">
            <i class="bi bi-image text-muted"></i>
            <span class="text-muted small ms-2">画像なし</span>
          </div>
        `}
      </div>
    </div>
  `).join('') || '<p class="text-muted small">ステップがありません</p>';

  return `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-light d-flex align-items-center justify-content-between py-2">
        <span class="fw-bold">${sec.icon || '📄'} ${sec.label}</span>
        <small class="text-muted">${(sec.steps||[]).length} ステップ</small>
      </div>
      <div class="card-body">${steps}</div>
    </div>
  `;
}

// ── セクション編集 ──────────────────────────────────────────
function renderSectionEdit(sec) {
  const steps = (sec.steps || []).map((st, i) => `
    <div class="step-edit-item border rounded p-3 mb-3 bg-light" id="step-edit-${st.id}">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <span class="badge bg-primary">ステップ ${i + 1}</span>
        <button class="btn btn-outline-danger btn-sm" onclick="deleteStep(${st.id})">
          <i class="bi bi-trash"></i>
        </button>
      </div>
      <!-- 説明文 -->
      <div class="mb-3">
        <label class="form-label small fw-semibold">説明文</label>
        <textarea class="form-control form-control-sm" id="step-text-${st.id}" rows="3">${st.step_text || ''}</textarea>
      </div>
      <!-- 画像エリア（大きく） -->
      <div>
        <label class="form-label small fw-semibold">画像（最大3枚）</label>
        <div class="row g-2 mb-2">
          ${(st.images||[]).map(img => `
            <div class="col-12 col-md-4">
              <div class="step-image-edit-card">
                <img src="/uploads/${img.filename}" onclick="previewImage('/uploads/${img.filename}')">
                <button class="step-image-delete-btn" onclick="deleteImage(${img.id}, ${st.id})">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
          `).join('')}
          ${(st.images||[]).length < 3 ? `
            <div class="col-12 col-md-4">
              <label class="img-upload-area-lg">
                <input type="file" accept="image/*" class="d-none" onchange="uploadImage(this, ${st.id})">
                <i class="bi bi-camera-fill fs-3 text-muted"></i>
                <span class="small text-muted mt-1">画像を追加</span>
              </label>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('') || '';

  return `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-warning-subtle py-2 d-flex align-items-center gap-2">
        <input type="text" class="form-control form-control-sm fw-bold" id="sec-label-${sec.id}"
               value="${sec.label}" style="max-width:180px;">
        <input type="text" class="form-control form-control-sm" id="sec-icon-${sec.id}"
               value="${sec.icon || '📄'}" style="max-width:60px;" placeholder="絵文字">
        <button class="btn btn-outline-danger btn-sm ms-auto" onclick="deleteSection(${sec.id})">
          <i class="bi bi-trash me-1"></i>この分類を削除
        </button>
      </div>
      <div class="card-body">
        <div id="steps-container-${sec.id}">${steps}</div>
        <button class="btn btn-outline-primary btn-sm w-100 mt-2" onclick="addStep(${sec.id})">
          <i class="bi bi-plus-lg me-1"></i>ステップを追加
        </button>
      </div>
    </div>
  `;
}

// ── 編集操作 ────────────────────────────────────────────────
function setSection(i) {
  if (state.editMode) autoSaveSteps();
  state.activeSection = i;
  renderDetail();
}

function startEdit() {
  state.editMode = true;
  renderDetail();
}

function cancelEdit() {
  state.editMode = false;
  renderDetail();
}

// ステップテキストを自動保存（セクション切り替え時）
async function autoSaveSteps() {
  const sec = state.sections[state.activeSection];
  if (!sec) return;
  for (const st of (sec.steps || [])) {
    const el = document.getElementById('step-text-' + st.id);
    if (el && el.value !== st.step_text) {
      await api('PUT', `/api/steps/${st.id}`, { step_text: el.value });
      st.step_text = el.value;
    }
  }
  const labelEl = document.getElementById('sec-label-' + sec.id);
  const iconEl  = document.getElementById('sec-icon-'  + sec.id);
  if (labelEl) {
    await api('PUT', `/api/sections/${sec.id}`, { label: labelEl.value, icon: iconEl ? iconEl.value : sec.icon });
    sec.label = labelEl.value;
    if (iconEl) sec.icon = iconEl.value;
  }
}

// クライアント情報を保存してモードを終了
async function saveClientMeta() {
  await autoSaveSteps();
  // updated_at を更新
  await api('PUT', `/api/clients/${state.currentClient.id}`, {
    name: state.currentClient.name,
    memo: state.currentClient.memo,
    tags: state.currentClient.tags,
    username: state.user.username,
  });
  // 再取得
  state.clients = await api('GET', '/api/clients');
  state.currentClient = state.clients.find(c => c.id === state.currentClient.id);
  state.sections = await api('GET', `/api/clients/${state.currentClient.id}/sections`);
  state.editMode = false;
  renderDetail();
  showToast('保存しました', 'bg-success');
}

// ── ステップ操作 ────────────────────────────────────────────
async function addStep(sectionId) {
  await autoSaveSteps();
  const result = await api('POST', `/api/sections/${sectionId}/steps`, { step_text: '' });
  if (result.error) { showToast(result.error, 'bg-danger'); return; }
  const sec = state.sections.find(s => s.id === sectionId);
  if (sec) { sec.steps = sec.steps || []; sec.steps.push({ ...result, images: [] }); }
  renderDetail();
}

async function deleteStep(stepId) {
  if (!confirm('このステップを削除しますか？')) return;
  const result = await api('DELETE', `/api/steps/${stepId}`);
  if (result.error) { showToast(result.error, 'bg-danger'); return; }
  state.sections.forEach(sec => {
    sec.steps = (sec.steps || []).filter(s => s.id !== stepId);
  });
  renderDetail();
}

// ── セクション操作 ──────────────────────────────────────────
async function addSection() {
  await autoSaveSteps();
  const result = await api('POST', `/api/clients/${state.currentClient.id}/sections`, { label: '新しい分類', icon: '📄' });
  if (result.error) { showToast(result.error, 'bg-danger'); return; }
  state.sections.push(result);
  state.activeSection = state.sections.length - 1;
  renderDetail();
}

async function deleteSection(sectionId) {
  if (!confirm('この分類（ステップ・画像含む）をすべて削除しますか？')) return;
  const result = await api('DELETE', `/api/sections/${sectionId}`);
  if (result.error) { showToast(result.error, 'bg-danger'); return; }
  state.sections = state.sections.filter(s => s.id !== sectionId);
  state.activeSection = Math.max(0, state.activeSection - 1);
  renderDetail();
  showToast('分類を削除しました', 'bg-secondary');
}

// ── 画像操作 ────────────────────────────────────────────────
async function uploadImage(input, stepId) {
  if (!input.files[0]) return;
  const form = new FormData();
  form.append('image', input.files[0]);
  const res = await fetch(`/api/steps/${stepId}/images`, { method: 'POST', body: form });
  const result = await res.json();
  if (result.error) { showToast(result.error, 'bg-danger'); return; }

  // stateに追加
  state.sections.forEach(sec => {
    (sec.steps || []).forEach(st => {
      if (st.id === stepId) { st.images = st.images || []; st.images.push(result); }
    });
  });
  renderDetail();
  showToast('画像を追加しました', 'bg-success');
}

async function deleteImage(imageId, stepId) {
  if (!confirm('この画像を削除しますか？')) return;
  const result = await api('DELETE', `/api/images/${imageId}`);
  if (result.error) { showToast(result.error, 'bg-danger'); return; }
  state.sections.forEach(sec => {
    (sec.steps || []).forEach(st => {
      if (st.id === stepId) st.images = (st.images || []).filter(img => img.id !== imageId);
    });
  });
  renderDetail();
  showToast('画像を削除しました', 'bg-secondary');
}

function previewImage(url) {
  document.getElementById('preview-img').src = url;
  openModal('modal-img-preview');
}
