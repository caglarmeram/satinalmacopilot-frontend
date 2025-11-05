(function(){
  const els = {
    apiBase: document.getElementById('apiBase'),
    adminToken: document.getElementById('adminToken'),
    list: document.getElementById('list'),
    status: document.getElementById('status'),
    btnLoad: document.getElementById('btnLoad'),
    btnAdd: document.getElementById('btnAdd'),
    editor: document.getElementById('editor'),
    f_name: document.getElementById('f_name'),
    f_title: document.getElementById('f_title'),
    f_content: document.getElementById('f_content'),
    f_rating: document.getElementById('f_rating'),
    f_active: document.getElementById('f_active'),
    f_order: document.getElementById('f_order'),
    btnSave: document.getElementById('btnSave'),
    btnCancel: document.getElementById('btnCancel'),
    btnDelete: document.getElementById('btnDelete'),
    editStatus: document.getElementById('editStatus'),
  };

  let items = [];        // {id, author_name, ...}
  let currentId = null;  // edit edilen id
  let draggingId = null; // drag state

  // Persist küçük ayarlar
  const LS_KEY = 'admin_testimonials_cfg_v1';
  const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  if (saved.apiBase) els.apiBase.value = saved.apiBase;
  if (saved.adminToken) els.adminToken.value = saved.adminToken;

  function storeCfg(){
    localStorage.setItem(LS_KEY, JSON.stringify({
      apiBase: els.apiBase.value.trim(),
      adminToken: els.adminToken.value.trim()
    }));
  }

  async function api(path, opts={}){
    const base = els.apiBase.value.trim().replace(/\/+$/,'');
    const token = els.adminToken.value.trim();
    const headers = Object.assign({
      'Content-Type':'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }, opts.headers || {});
    const res = await fetch(`${base}/api/admin${path}`, Object.assign({headers}, opts));
    if (!res.ok) {
      const t = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} – ${t || res.statusText}`);
    }
    return res.json();
  }

  function setStatus(s, ok=true){
    els.status.textContent = s;
    els.status.style.background = ok ? '#052e16' : '#3f1d1d';
    els.status.style.color = ok ? '#86efac' : '#fecaca';
  }

  // ------- List draw -------
  function render(){
    els.list.innerHTML = '';
    const frag = document.createDocumentFragment();

    items.sort((a,b)=> (a.display_order ?? 0) - (b.display_order ?? 0));

    for (const it of items){
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('draggable','true');
      card.dataset.id = it.id;

      card.addEventListener('dragstart', e => { draggingId = it.id; card.classList.add('drag'); });
      card.addEventListener('dragend',   e => { draggingId = null;   card.classList.remove('drag'); });

      card.addEventListener('dragover', e => {
        e.preventDefault();
        const overId = it.id;
        if (!draggingId || draggingId === overId) return;
        // reorder in-memory
        const from = items.findIndex(x=>x.id===draggingId);
        const to   = items.findIndex(x=>x.id===overId);
        if (from<0 || to<0) return;
        const [m] = items.splice(from,1);
        items.splice(to,0,m);
        // re-index display_order (0..n)
        items.forEach((x,idx)=> x.display_order = idx);
        render();
      });

      const head = document.createElement('div');
      head.className = 'row-between';
      head.innerHTML = `
        <div class="inline">
          <span class="pill">#${it.display_order ?? 0}</span>
          <strong style="margin-left:6px">${escape(it.author_name || '')}</strong>
        </div>
        <div class="inline">
          <span class="pill">${'⭐'.repeat(Number(it.rating||5))}</span>
          <span class="pill" style="${it.is_active ? 'border-color:#14532d;color:#86efac' : 'border-color:#3f1d1d;color:#fecaca'}">${it.is_active ? 'Aktif' : 'Pasif'}</span>
        </div>
      `;
      const meta = document.createElement('div');
      meta.className = 'muted';
      meta.textContent = `— ${it.author_title || ''}`;

      const content = document.createElement('div');
      content.style.whiteSpace = 'pre-wrap';
      content.textContent = `"${it.content || ''}"`;

      const actions = document.createElement('div');
      actions.className = 'row-between';
      const left = document.createElement('div');
      left.className = 'inline';
      left.innerHTML = `<span class="pill drag">⇅ sürükle</span>`;
      const right = document.createElement('div');
      right.className = 'inline';
      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn';
      btnEdit.textContent = 'Düzenle';
      btnEdit.onclick = ()=> openEditor(it.id);
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-danger';
      btnDel.textContent = 'Sil';
      btnDel.onclick = ()=> del(it.id);
      right.append(btnEdit, btnDel);
      actions.append(left,right);

      card.append(head, meta, content, actions);
      frag.append(card);
    }
    els.list.append(frag);
  }

  function escape(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  // ------- CRUD -------
  async function load(){
    storeCfg();
    setStatus('Yükleniyor…');
    try{
      const out = await api('/testimonials');
      items = (out.testimonials || []).slice();
      render();
      setStatus(`Yüklendi: ${items.length} kayıt`);
    }catch(e){
      setStatus(`Hata: ${e.message}`, false);
    }
  }

  function openEditor(id){
    const it = items.find(x=>x.id===id) || { rating:5, is_active:true, display_order: (items.length||0) };
    currentId = it.id || null;
    els.f_name.value = it.author_name || '';
    els.f_title.value = it.author_title || '';
    els.f_content.value = it.content || '';
    els.f_rating.value = String(it.rating || 5);
    els.f_active.value = it.is_active ? 'true' : 'false';
    els.f_order.value = String(it.display_order ?? 0);
    els.editStatus.textContent = currentId ? `ID: ${currentId}` : 'Yeni kayıt';
    els.editor.classList.remove('hidden');
  }

  function closeEditor(){ currentId = null; els.editor.classList.add('hidden'); }

  async function save(){
    storeCfg();
    const payload = {
      author_name: els.f_name.value.trim(),
      author_title: els.f_title.value.trim(),
      content: els.f_content.value.trim(),
      rating: Number(els.f_rating.value || 5),
      is_active: els.f_active.value === 'true',
      display_order: Number(els.f_order.value || 0)
    };
    if (!payload.author_name || !payload.author_title || !payload.content){
      els.editStatus.textContent = 'Lütfen zorunlu alanları doldurun.';
      return;
    }
    try{
      let out;
      if (currentId){
        out = await api(`/testimonials/${currentId}`, { method:'PUT', body: JSON.stringify(payload) });
        // listede güncelle
        const idx = items.findIndex(x=>x.id===currentId);
        if (idx>=0) items[idx] = out.testimonial;
      }else{
        out = await api('/testimonials', { method:'POST', body: JSON.stringify(payload) });
        items.push(out.testimonial);
      }
      render();
      setStatus('Kaydedildi.');
      closeEditor();
    }catch(e){
      els.editStatus.textContent = 'Hata: ' + e.message;
      setStatus('Hata oluştu', false);
    }
  }

  async function del(id){
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try{
      await api(`/testimonials/${id}`, { method:'DELETE' });
      items = items.filter(x=>x.id!==id);
      render();
      setStatus('Silindi.');
      if (currentId === id) closeEditor();
    }catch(e){
      setStatus('Silme hatası: ' + e.message, false);
    }
  }

  // Sıra toplu kaydet
  async function saveOrder(){
    // items zaten display_order ile sıralı; bunu toplu gönderelim
    const payload = items.map((x,idx)=> ({ id: x.id, display_order: idx }));
    try{
      await api('/testimonials/reorder', { method:'PUT', body: JSON.stringify(payload) });
      setStatus('Sıra kaydedildi.');
      // tekrar yükleyip normalize edelim
      await load();
    }catch(e){
      setStatus('Sıra kaydetme hatası: ' + e.message, false);
    }
  }

  // ------- Events -------
  els.btnLoad.onclick = load;
  els.btnAdd.onclick = ()=> openEditor(null);
  els.btnSave.onclick = save;
  els.btnCancel.onclick = closeEditor;
  els.btnDelete.onclick = ()=> currentId && del(currentId);

  // Ctrl+S => sırayı kaydet (liste odak)
  window.addEventListener('keydown', (e)=>{
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='s'){
      e.preventDefault();
      // eğer editör açıksa kayıt formunu kaydet, değilse sıralamayı kaydet
      if (!els.editor.classList.contains('hidden')) save();
      else saveOrder();
    }
  });

  // ilk yükleme (token/baz ayarlıysa)
  if (els.adminToken.value.trim()) load();
})();

