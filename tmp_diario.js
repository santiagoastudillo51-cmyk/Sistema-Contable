
const PLAN_CUENTAS = <?=json_encode($cuentasDetalle, JSON_UNESCAPED_UNICODE)?>;
const NEXT_NUM = "<?=h($nextNum)?>";

// Detectar cuentas padre (las que tienen hijas) para permitir navegar,
// pero bloquear su selección (solo se contabiliza en hijas/hojas).
const PARENT_CODES = (()=>{
  const codes = PLAN_CUENTAS.map(c=>(c.codigo||'').toString().trim()).filter(Boolean);
  const parents = new Set();

  // 1) Por "tipo" (si viene del plan): Mayor/Grupo/Título => padre
  for(const c of PLAN_CUENTAS){
    const cod = (c.codigo||'').toString().trim();
    const tipo = (c.tipo||'').toString().toLowerCase();
    const nivel = Number(c.nivel||0);
    if(!cod) continue;
    if(/mayor|grupo|t[ií]tulo|principal/.test(tipo)) parents.add(cod);
    // Muchos planes usan nivel <=2 como agrupador; no forzamos, solo ayuda si el tipo está vacío
    if(!tipo && nivel && nivel <= 2) parents.add(cod);
  }

  // 2) Por jerarquía de código: si existe otra cuenta que empiece por cod + separador (., -, /)
  const seps = ['.', '-', '/', '_'];
  for(const a of codes){
    for(const sep of seps){
      const pref = a + sep;
      if(codes.some(b=>b !== a && b.startsWith(pref))){
        parents.add(a);
        break;
      }
    }
  }
  return parents;
})();

// Cuentas hoja (seleccionables)
const LEAF_CODES = (()=>{
  const set = new Set();
  for(const c of PLAN_CUENTAS){
    const cod=(c.codigo||'').toString().trim();
    if(!cod) continue;
    if(!PARENT_CODES.has(cod)) set.add(cod);
  }
  return set;
})();


function isParentCode(code){
  const cod = (code||'').toString().trim();
  if(!cod) return false;
  if(isParentCode(cod)) return true;
  const sep = detectSepFor(cod);
  return PLAN_CUENTAS.some(c=>((c.codigo||'').toString().trim().startsWith(cod + sep)));
}

let selectedNum = null;
let editing = false;
let cuentaSel = null; // {cuenta, descripcion}
let lastSide = 'debe'; // recuerda si el usuario está enviando a Debe/Haber

// Línea actual donde se aplicará la selección de cuenta
let currentLineaEl = null;

function toastOk(msg){ if(window.toast) window.toast(msg,'ok'); else alert(msg); }
function toastBad(msg){ if(window.toast) window.toast(msg,'bad'); else alert(msg); }

function openModal(id){
  const m = document.getElementById(id);
  m.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}
function closeModal(id){
  const m = document.getElementById(id);
  m.setAttribute('aria-hidden','true');
  // cerrar modal-open si no hay otro abierto
  const anyOpen = Array.from(document.querySelectorAll('.modal')).some(x=>x.getAttribute('aria-hidden')==='false');
  if(!anyOpen) document.body.classList.remove('modal-open');
}
function fmt(n){
  n = Number(n||0);
  return n.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2});
}
function parseMoney(v){
  v = (v||'').toString().replace(/,/g,'').trim();
  const n = parseFloat(v);
  return isNaN(n)?0:n;
}

function focusAmount(input){
  if(!input) return;
  // poner 0.00 por defecto y seleccionar para tipear rápido
  if((input.value||'').trim()==='') input.value = '0.00';
  input.focus();
  try{ input.select(); }catch(e){}
}


let cuentasFiltered = [];
let cuentasPage = 1;
let cuentasPageSize = 20;
let cuentasSelIndex = -1; // índice dentro de la página renderizada


function detectSepFor(code){
  const seps = ['.', '-', '/', '_'];
  if(!code) return '.';
  const cod = code.toString().trim();
  for(const s of seps){
    if(PLAN_CUENTAS.some(c=>((c.codigo||'').toString().trim().startsWith(cod + s)))) return s;
  }
  // fallback: usar el separador más común
  const counts = seps.map(s=>PLAN_CUENTAS.filter(c=>((c.codigo||'').toString().includes(s))).length);
  const maxIdx = counts.indexOf(Math.max(...counts));
  return seps[maxIdx] || '.';
}
function levelOf(code, sep){
  if(!code) return 0;
  const c = code.toString().trim();
  if(!c) return 0;
  return c.split(sep).length;
}
function parentOf(code){
  if(!code) return '';
  const sep = detectSepFor(code);
  const parts = code.toString().trim().split(sep);
  parts.pop();
  return parts.join(sep);
}

// Estado de navegación dentro del selector
let cuentaCurrentParent = ''; // '' = raíz

function updateCuentaBreadcrumb(){
  const el = document.getElementById('cuentaCrumb');
  const back = document.getElementById('btnCuentaBack');
  if(!el) return;
  if(!cuentaCurrentParent){
    el.textContent = 'Raíz';
    if(back) back.disabled = true;
    return;
  }
  el.textContent = 'Ruta: ' + cuentaCurrentParent;
  if(back) back.disabled = false;
}

// Devuelve hijos directos (no todos los descendientes) del padre
function directChildrenOf(parentCode){
  const parent = (parentCode||'').toString().trim();
  const sep = detectSepFor(parent || '1');
  const norm = (s)=> (s||'').toString().trim();
  const codes = PLAN_CUENTAS.map(c=>norm(c.codigo)).filter(Boolean);

  const parentLevel = parent ? parent.split(sep).filter(Boolean).length : 0;
  const prefix = parent ? (parent + sep) : '';

  // Tomar todos los códigos bajo este prefijo (aunque falten niveles intermedios)
  const under = codes.filter(c=>{
    if(!parent) return true;
    return c === parent || c.startsWith(prefix);
  });

  // Extraer los hijos directos por partes (deriva nodos faltantes)
  const childSet = new Set();
  for(const c of under){
    const parts = c.split(sep).filter(Boolean);
    if(parts.length <= parentLevel) continue;
    const child = parts.slice(0, parentLevel + 1).join(sep);
    if(parent && child === parent) continue;
    childSet.add(child);
  }

  const items = Array.from(childSet).map(code=>{
    const real = PLAN_CUENTAS.find(x=>norm(x.codigo) === code);
    if(real) return real;
    // Nodo virtual (grupo) cuando el plan no trae cuentas padre explícitas
    return { codigo: code, nombre: '(Grupo) ' + code, tipo: 'Mayor', estado: 'Activo', _virtual: true };
  }).sort((a,b)=> norm(a.codigo).localeCompare(norm(b.codigo)));

  // Si estamos en raíz y aun así no hay nada, mostrar hojas como fallback
  if(!parent && items.length === 0){
    return PLAN_CUENTAS
      .filter(c=>!isParentCode(norm(c.codigo)))
      .sort((a,b)=> norm(a.codigo).localeCompare(norm(b.codigo)));
  }
  return items;
}

function filterCuentas(){
  const qcEl = document.getElementById('qCuentaCod');
  const qdEl = document.getElementById('qCuentaDesc');
  const qCodRaw = (qcEl?.value || '').toString().trim();
  const qCod = qCodRaw.toLowerCase();
  const qDesc = (qdEl?.value || '').toString().toLowerCase().trim();

  // Modo búsqueda por descripción: muestra SOLO HOJAS (hijas) activas
  if(qDesc){
    cuentasFiltered = PLAN_CUENTAS.filter(c=>{
      const cod=(c.codigo||'').toString().trim();
      const nom=(c.nombre||'').toString().toLowerCase();
      if(!cod) return false;
      if(!LEAF_CODES.has(cod)) return false;
      if(qCod && !cod.toLowerCase().includes(qCod)) return false;
      return nom.includes(qDesc);
    }).sort((a,b)=> (a.codigo||'').toString().localeCompare((b.codigo||'').toString()));

    cuentaSel = null;
    cuentasSelIndex = -1;
    updateCuentaSelUI();
    updateCuentaBreadcrumb();
    const totalPages = Math.max(1, Math.ceil(cuentasFiltered.length / cuentasPageSize));
    if(cuentasPage > totalPages) cuentasPage = totalPages;
    if(cuentasPage < 1) cuentasPage = 1;
    return;
  }

  // Si el usuario escribe un código exacto de PADRE, navegamos a sus hijos
  if(qCodRaw && PARENT_CODES.has(qCodRaw)){
    cuentaCurrentParent = qCodRaw;
  }

  // Vista basada en navegación (raíz o padre actual)
  let base = directChildrenOf(cuentaCurrentParent);

  // Filtro adicional por código (cuando escribe partes del código)
  if(qCod){
    base = base.filter(c=>{
      const cod=(c.codigo||'').toString().trim().toLowerCase();
      return cod.includes(qCod);
    });
  }

  cuentasFiltered = base;

  cuentaSel = null;
  cuentasSelIndex = -1;
  updateCuentaSelUI();
  updateCuentaBreadcrumb();

  const totalPages = Math.max(1, Math.ceil(cuentasFiltered.length / cuentasPageSize));
  if(cuentasPage > totalPages) cuentasPage = totalPages;
  if(cuentasPage < 1) cuentasPage = 1;
}

function renderCuentaRows(){
  const tb = document.querySelector('#tblCuentasPlan tbody');
  tb.innerHTML = '';
  cuentaSel = null;
  cuentasSelIndex = -1;
  updateCuentaSelUI();

  const start = (cuentasPage - 1) * cuentasPageSize;
  const pageItems = cuentasFiltered.slice(start, start + cuentasPageSize);

  pageItems.forEach((c, idx)=>{
    const cod=(c.codigo||'').toString().trim();
    const isParent = isParentCode(cod);
    const tr=document.createElement('tr');
    tr.innerHTML = `<td><b>${cod}</b></td><td>${(c.nombre||'')}</td>`;
    tr.dataset.codigo = cod;
    tr.dataset.nombre = (c.nombre||'');
    tr.dataset.idx = String(idx);
    tr.dataset.parent = isParent ? '1' : '0';

    if(isParent){
      tr.classList.add('row--parent');
      tr.title = 'Cuenta padre (no seleccionable). Doble clic para ver hijas.';
    }

    tr.addEventListener('click', ()=>{
      if(isParent){
        // solo seleccionar visualmente
        selectCuentaRow(idx);
        return;
      }
      selectCuentaRow(idx);
    });

    tr.addEventListener('dblclick', ()=>{
      if(isParent){
        // navegar hacia adentro
        cuentaCurrentParent = cod;
        const qc = document.getElementById('qCuentaCod');
        const qd = document.getElementById('qCuentaDesc');
        if(qc) qc.value = cod;
        if(qd) qd.value = '';
        cuentasPage = 1;
        buildCuentaRows();
        setTimeout(()=> document.getElementById('qCuentaCod')?.select?.(), 30);
        return;
      }
      applyCuentaToCurrentLinea({cuenta: cod, descripcion: (c.nombre||'')}, getSide());
      closeModal('modal-cuentas');
    });

    tb.appendChild(tr);
  });

  // Seleccionar primera fila por defecto (para Enter)
  if(pageItems.length){
    selectCuentaRow(0);
  }

  buildCuentaPagerUI();
}

function selectCuentaRow(idx){
  const tb = document.querySelector('#tblCuentasPlan tbody');
  const rows = Array.from(tb.querySelectorAll('tr'));
  rows.forEach(x=>x.classList.remove('row--sel'));
  const row = rows[idx];
  if(!row) return;

  row.classList.add('row--sel');
  cuentasSelIndex = idx;

  // parent no es seleccionable para aplicar, pero sí para navegar con Enter
  if(row.dataset.parent === '1'){
    cuentaSel = {cuenta: row.dataset.codigo, descripcion: row.dataset.nombre, parent:true};
  }else{
    cuentaSel = {cuenta: row.dataset.codigo, descripcion: row.dataset.nombre, parent:false};
  }

  updateCuentaSelUI();
  row.scrollIntoView({block:'nearest'});
}

function moveCuentaSelection(delta){
  const tb = document.querySelector('#tblCuentasPlan tbody');
  const rows = Array.from(tb.querySelectorAll('tr'));
  if(!rows.length) return;
  let idx = cuentasSelIndex;
  if(idx < 0) idx = 0;
  idx = Math.max(0, Math.min(rows.length-1, idx + delta));
  selectCuentaRow(idx);
}

function changeCuentaPage(delta){
  const total = cuentasFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / cuentasPageSize));
  cuentasPage = Math.max(1, Math.min(totalPages, cuentasPage + delta));
  renderCuentaRows();
}

function buildCuentaPagerUI(){
  const info = document.getElementById('cuentaPagerInfo');
  const pageLbl = document.getElementById('cuentaPagerPage');
  const prev = document.getElementById('btnCuentaPrev');
  const next = document.getElementById('btnCuentaNext');

  const total = cuentasFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / cuentasPageSize));

  if(info) info.textContent = `${total} resultado${total===1?'':'s'}`;
  if(pageLbl) pageLbl.textContent = `${cuentasPage}/${totalPages}`;
  if(prev) prev.disabled = (cuentasPage <= 1);
  if(next) next.disabled = (cuentasPage >= totalPages);
}

function buildCuentaRows(){
  filterCuentas();
  renderCuentaRows();
}

function selectCuentaRow(idx){
  const tb = document.querySelector('#tblCuentasPlan tbody');
  const rows = Array.from(tb.querySelectorAll('tr'));
  rows.forEach(x=>x.classList.remove('row--sel'));
  const row = rows[idx];
  if(!row) return;

  // No permitir seleccionar cuentas padre
  if(row.dataset.parent === '1') return;

  row.classList.add('row--sel');
  cuentasSelIndex = idx;
  cuentaSel = {cuenta: row.dataset.codigo, descripcion: row.dataset.nombre};
  updateCuentaSelUI();
  row.scrollIntoView({block:'nearest'});
}

function moveCuentaSelection(delta){
  const tb = document.querySelector('#tblCuentasPlan tbody');
  const rows = Array.from(tb.querySelectorAll('tr'));
  if(rows.length === 0) return;

  let idx = cuentasSelIndex;
  if(idx < 0) idx = 0;
  idx = Math.max(0, Math.min(rows.length - 1, idx + delta));

  // saltar padres
  let guard = 0;
  while(guard++ < rows.length && rows[idx] && rows[idx].dataset.parent === '1'){
    idx = Math.max(0, Math.min(rows.length - 1, idx + (delta>=0?1:-1)));
  }
  selectCuentaRow(idx);
}

function changeCuentaPage(delta){
  const totalPages = Math.max(1, Math.ceil(cuentasFiltered.length / cuentasPageSize));
  cuentasPage = Math.max(1, Math.min(totalPages, cuentasPage + delta));
  renderCuentaRows();
}


function updateCuentaSelUI(){
  const lbl = document.getElementById('cuentaSelLabel');
  const btn = document.getElementById('btnCuentaAgregar');
  if(!lbl || !btn) return;
  if(cuentaSel && cuentaSel.cuenta){
    if(cuentaSel.parent){
      lbl.textContent = `📁 ${cuentaSel.cuenta} • ${cuentaSel.descripcion||''} (cuenta padre)`;
      btn.disabled = true;
    }else{
      lbl.textContent = `${cuentaSel.cuenta} • ${cuentaSel.descripcion||''}`.trim();
      btn.disabled = false;
    }
  }else{
    lbl.textContent = 'Sin selección';
    btn.disabled = true;
  }
}
function syncSideRadios(){
  document.querySelectorAll('input[name="side"]').forEach(r=>{ r.checked = (r.value === (lastSide||'debe')); });
  document.querySelectorAll('input[name="sideAdd"]').forEach(r=>{ r.checked = (r.value === (lastSide||'debe')); });
}

function getSide(){
  const top = document.querySelector('input[name="sideAdd"]:checked');
  if(top){ lastSide = top.value; syncSideRadios(); return lastSide; }
  const el = document.querySelector('input[name="side"]:checked');
  if(el){ lastSide = el.value; syncSideRadios(); return lastSide; }
  return lastSide || 'debe';
}

// recordar selección Debe/Haber en el selector de cuentas
document.querySelectorAll('input[name="side"]').forEach(r=>{
  r.addEventListener('change', ()=>{ lastSide = r.value; syncSideRadios(); });
});
document.querySelectorAll('input[name="sideAdd"]').forEach(r=>{
  r.addEventListener('change', ()=>{ lastSide = r.value; syncSideRadios(); });
});


// --- Paginación y teclado en selector de cuentas ---
(function(){
  const ps = document.getElementById('cuentaPageSize');
  if(ps){ ps.value = String(cuentasPageSize); }
  document.getElementById('btnCuentaPrev')?.addEventListener('click', ()=>changeCuentaPage(-1));
  document.getElementById('btnCuentaNext')?.addEventListener('click', ()=>changeCuentaPage(1));
  ps?.addEventListener('change', ()=>{
    cuentasPageSize = parseInt(ps.value,10) || 20;
    cuentasPage = 1;
    buildCuentaRows();
  });

  // Refiltrar al escribir
  document.getElementById('qCuentaCod')?.addEventListener('input', ()=>{ cuentasPage=1; buildCuentaRows(); });
  document.getElementById('qCuentaDesc')?.addEventListener('input', ()=>{ cuentasPage=1; buildCuentaRows(); });

  // Navegación por flechas dentro del modal
  const modal = document.getElementById('modal-cuentas');
  modal?.addEventListener('keydown', (e)=>{
    if(modal.getAttribute('aria-hidden') === 'true') return;

    if(e.key === 'ArrowDown'){
      e.preventDefault();
      moveCuentaSelection(+1);
    }else if(e.key === 'ArrowUp'){
      e.preventDefault();
      moveCuentaSelection(-1);
    }else if(e.key === 'PageDown'){
      e.preventDefault();
      changeCuentaPage(+1);
    }else if(e.key === 'PageUp'){
      e.preventDefault();
      changeCuentaPage(-1);
    }else if(e.key === 'Enter'){
      if(!cuentaSel){ moveCuentaSelection(0); }
      if(cuentaSel){
        applyCuentaToCurrentLinea(cuentaSel, getSide());
        closeModal('modal-cuentas');
      }
    }else if(e.key === 'Escape'){
      e.preventDefault();
      closeModal('modal-cuentas');
    }
  });
})();

function applyCuentaToCurrentLinea(data, side){
  // limpiar selector superior (si existe)
  const topInp = document.getElementById('a_selCuenta');
  if(topInp) topInp.value = '';
  if(currentLineaEl){
    setLineaCuenta(currentLineaEl, data, side);
    currentLineaEl = null;
  }else{
    addLinea(data, side);
  }
}

function openCuentaPicker(initCod=''){
  // recordar lado
  document.querySelectorAll('input[name="side"]').forEach(r=>{ r.checked = (r.value === (lastSide||'debe')); });

  const qc = document.getElementById('qCuentaCod');
  const qd = document.getElementById('qCuentaDesc');

  const raw = (initCod||'').toString().trim();

  // Navegación inicial: si viene una hoja, abrir su padre; si viene un padre, abrirlo.
  if(raw && !isParentCode(raw)){
    cuentaCurrentParent = parentOf(raw);
    if(qc) qc.value = cuentaCurrentParent || '';
  }else if(raw && isParentCode(raw)){
    cuentaCurrentParent = raw;
    if(qc) qc.value = raw;
  }else{
    // sin contexto: raíz
    cuentaCurrentParent = '';
    if(qc) qc.value = raw;
  }

  if(qd) qd.value = '';
  cuentasPage = 1;
  buildCuentaRows();
  openModal('modal-cuentas');
  setTimeout(()=>{ qc?.focus(); qc?.select?.(); }, 60);
}

function buildLineaCard(){
  const wrap = document.getElementById('lineasContainer');
  const card = document.createElement('div');
  card.className = 'lineaCard';
  card.innerHTML = `
    <div class="lineaGrid">
      <div class="mini lineaFila">1</div>
      <div>
        <div class="inputGroup">
          <input class="input a_cuenta" placeholder="Código" inputmode="text">
          <button class="iconbtn a_pick" title="Buscar cuenta">🔎</button>
        </div>
      </div>
      <div><input class="input a_desc" placeholder="Descripción" readonly></div>
      <div><input class="input a_ref" placeholder="Referencia"></div>
      <div><input class="input a_debe" style="text-align:right" placeholder="0.00"></div>
      <div><input class="input a_haber" style="text-align:right" placeholder="0.00"></div>
      <div style="text-align:center"><button class="iconbtn a_del" title="Quitar">×</button></div>
    </div>
  `;

  const debe = card.querySelector('.a_debe');
  const haber = card.querySelector('.a_haber');
  const pick = card.querySelector('.a_pick');

  function onInput(){
    if(document.activeElement===debe && parseMoney(debe.value)>0) haber.value='';
    if(document.activeElement===haber && parseMoney(haber.value)>0) debe.value='';
    recalc();
  }
  debe.addEventListener('input', onInput);
  haber.addEventListener('input', onInput);

  pick.addEventListener('click', ()=>{
    currentLineaEl = card;
    openCuentaPicker(card.querySelector('.a_cuenta').value);
  });
  // También permitir click en el código para abrir selector
  card.querySelector('.a_cuenta').addEventListener('click', ()=>{
    currentLineaEl = card;
    openCuentaPicker(card.querySelector('.a_cuenta').value);
  });

  // Permitir escribir código y confirmar con Enter: si existe la cuenta hoja, se asigna; si no, abre el buscador.
  card.querySelector('.a_cuenta').addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter') return;
    e.preventDefault();
    const cod = (card.querySelector('.a_cuenta')?.value || '').toString().trim();
    if(!cod) return openCuentaPicker('');
    // buscar exacto dentro de hojas
    const hit = PLAN_CUENTAS.find(c=> ((c.codigo||'').toString().trim()===cod) && LEAF_CODES.has(cod));
    if(hit){
      setLineaCuenta(card, {cuenta: cod, descripcion: hit.nombre||''}, (lastSide||'debe'));
      currentLineaEl = null;
      return;
    }
    currentLineaEl = card;
    openCuentaPicker(cod);
  });

  card.querySelector('.a_del').addEventListener('click', ()=>{
    card.remove();
    renumberLineas();
    recalc();
    ensureTrailingBlank();
  });

  wrap.appendChild(card);
  renumberLineas();
  return card;
}

function renumberLineas(){
  document.querySelectorAll('#lineasContainer .lineaCard').forEach((card,i)=>{
    const f = card.querySelector('.lineaFila');
    if(f) f.textContent = String(i+1);
  });
}

function ensureTrailingBlank(){
  const cards = Array.from(document.querySelectorAll('#lineasContainer .lineaCard'));
  if(cards.length === 0){ buildLineaCard(); return; }
  const last = cards[cards.length-1];
  const hasCuenta = (last.querySelector('.a_cuenta')?.value || '').trim() !== '';
  if(hasCuenta){
    // Evitar crear múltiples vacías
    buildLineaCard();
  }
}

function setLineaCuenta(card, data, side){
  if(!card) card = buildLineaCard();
  card.querySelector('.a_cuenta').value = data.cuenta || '';
  card.querySelector('.a_desc').value = data.descripcion || '';

  const debe = card.querySelector('.a_debe');
  const haber = card.querySelector('.a_haber');
  if(side==='debe'){ haber.value=''; focusAmount(debe); }
  else { debe.value=''; focusAmount(haber); }

  recalc();
  // Si el usuario llenó la última línea, crear otra para seguir capturando
  const cards = Array.from(document.querySelectorAll('#lineasContainer .lineaCard'));
  if(cards[cards.length-1] === card){
    ensureTrailingBlank();
  }
}

function addLinea(data={}, side='debe'){
  const card = buildLineaCard();
  setLineaCuenta(card, data, side);
}

function recalc(){
  let td=0, th=0;
  document.querySelectorAll('#lineasContainer .lineaCard').forEach(card=>{
    td += parseMoney(card.querySelector('.a_debe').value);
    th += parseMoney(card.querySelector('.a_haber').value);
  });
  document.getElementById('a_tDebe').textContent = fmt(td);
  document.getElementById('a_tHaber').textContent = fmt(th);
  const diff = td - th;
  document.getElementById('a_diff').textContent = fmt(diff);
  const ok = Math.abs(diff) < 0.005 && (td>0 || th>0);
  const st = document.getElementById('a_estado');
  st.textContent = ok ? 'CUADRA' : 'NO CUADRA';
  st.className = ok ? 'badge badge--ok' : 'badge badge--bad';
  return ok;
}

function clearAsientoForm(){
  editing = false;
  document.getElementById('asientoTitle').textContent = 'Nuevo asiento contable';
  document.getElementById('a_origen_lbl').textContent = 'MANUAL';
  document.getElementById('a_num').value = NEXT_NUM;
  document.getElementById('a_fecha').value = new Date().toISOString().slice(0,10);
  document.getElementById('a_detalle').value = '';
  document.getElementById('a_diario').value = '';
  document.getElementById('a_proyecto').value = 'Todos';
  document.getElementById('a_cc').value = 'General';
  document.getElementById('a_desc_extra').value = '';

  document.getElementById('a_anticipo_on').checked = false;
  document.getElementById('a_anticipo_tipo').value = '';
  document.getElementById('a_anticipo_ref').value = '';
  document.getElementById('a_anticipo_monto').value = '';

  toggleAnticipo(false);

  const wrap = document.getElementById('lineasContainer');
  wrap.innerHTML = '';
  buildLineaCard();
  recalc();
}

function toggleAnticipo(on){
  ['a_anticipo_tipo','a_anticipo_ref','a_anticipo_monto'].forEach(id=>{
    const el=document.getElementById(id);
    el.disabled = !on;
    if(!on) el.value='';
  });
}
document.getElementById('a_anticipo_on').addEventListener('change', (e)=>{
  toggleAnticipo(e.target.checked);
});

document.getElementById('btnAddLinea').addEventListener('click', ()=>{
  // Crear nueva sección (línea) y abrir el buscador para asignarle la cuenta.
  const card = buildLineaCard();
  currentLineaEl = card;
  openCuentaPicker();
});


// Selector superior: "Seleccione su cuenta"
(function(){
  const inp = document.getElementById('a_selCuenta');
  const btn1 = document.getElementById('btnSelCuenta');
  const btn2 = document.getElementById('btnSelAgregar');

  function openTop(){
    currentLineaEl = null; // agrega como nueva línea
    const q = (inp?.value || '').toString().trim();
    openCuentaPicker(q);
  }

  btn1?.addEventListener('click', openTop);
  btn2?.addEventListener('click', openTop);

  inp?.addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter') return;
    e.preventDefault();
    openTop();
  });

  // iniciar toggle Debe/Haber superior
  syncSideRadios();
})();


document.getElementById('qCuentaCod').addEventListener('input', ()=> buildCuentaRows());
document.getElementById('qCuentaDesc').addEventListener('input', ()=> buildCuentaRows());

// agregar cuenta seleccionada
document.getElementById('btnCuentaAgregar').addEventListener('click', ()=>{
  if(!cuentaSel || !cuentaSel.cuenta) return;

  if(cuentaSel.parent){
    // navegar a hijas
    cuentaCurrentParent = cuentaSel.cuenta;
    const qc = document.getElementById('qCuentaCod');
    const qd = document.getElementById('qCuentaDesc');
    if(qc) qc.value = cuentaCurrentParent;
    if(qd) qd.value = '';
    cuentasPage = 1;
    buildCuentaRows();
    return;
  }

  applyCuentaToCurrentLinea({cuenta: cuentaSel.cuenta, descripcion: cuentaSel.descripcion}, getSide());
  closeModal('modal-cuentas');
});

// Enter agrega la seleccionada (o la primera si no hay selección)
function cuentaPickerEnter(e){
  if(e.key !== 'Enter') return;
  e.preventDefault();

  // si el usuario escribió un padre exacto, navegar inmediatamente
  const qc = document.getElementById('qCuentaCod');
  const raw = (qc?.value||'').toString().trim();
  if(raw && PARENT_CODES.has(raw)){
    cuentaCurrentParent = raw;
    cuentasPage = 1;
    buildCuentaRows();
    return;
  }

  if(cuentaSel && cuentaSel.cuenta){
    document.getElementById('btnCuentaAgregar').click();
    return;
  }
  const first = document.querySelector('#tblCuentasPlan tbody tr');
  if(first){
    first.click();
    document.getElementById('btnCuentaAgregar').click();
  }
}
document.getElementById('qCuentaCod').addEventListener('keydown', cuentaPickerEnter);
document.getElementById('qCuentaDesc').addEventListener('keydown', cuentaPickerEnter);

document.querySelectorAll('[data-action="cuentas-close"]').forEach(b=>b.addEventListener('click', ()=>closeModal('modal-cuentas')));

async function openEdit(num){
  const res = await fetch('index.php?route=api/contabilidad_asiento_get&num='+encodeURIComponent(num), {credentials:'same-origin'});
  const j = await res.json();
  if(!j.ok){ toastBad(j.msg||'No se pudo cargar'); return; }
  const h = j.head;
  if((h.origen||'MANUAL') !== 'MANUAL'){
    toastBad('Este asiento proviene de '+h.origen+' y no se edita aquí.');
    return;
  }
  editing = true;
  document.getElementById('asientoTitle').textContent = 'Editar asiento '+h.num;
  document.getElementById('a_origen_lbl').textContent = h.origen||'MANUAL';
  document.getElementById('a_num').value = h.num||'';
  document.getElementById('a_fecha').value = h.fecha||'';
  document.getElementById('a_detalle').value = h.detalle||'';
  document.getElementById('a_diario').value = h.diario||'';
  document.getElementById('a_proyecto').value = h.proyecto||'Todos';
  document.getElementById('a_cc').value = h.centro_costos||'General';
  document.getElementById('a_desc_extra').value = '';

  const antic = h.anticipo || null;
  if(antic && (antic.monto || antic.ref || antic.tipo)){
    document.getElementById('a_anticipo_on').checked = true;
    toggleAnticipo(true);
    document.getElementById('a_anticipo_tipo').value = antic.tipo||'';
    document.getElementById('a_anticipo_ref').value = antic.ref||'';
    document.getElementById('a_anticipo_monto').value = antic.monto!=null ? antic.monto : '';
  }else{
    document.getElementById('a_anticipo_on').checked = false;
    toggleAnticipo(false);
  }

  const wrap = document.getElementById('lineasContainer');
  wrap.innerHTML = '';
  (j.lineas||[]).forEach(l=>{
    const card = buildLineaCard();
    card.querySelector('.a_cuenta').value = l.cuenta||'';
    card.querySelector('.a_desc').value = l.descripcion||'';
    card.querySelector('.a_ref').value = l.referencia||'';
    card.querySelector('.a_debe').value = (l.debe>0) ? fmt(l.debe) : '';
    card.querySelector('.a_haber').value = (l.haber>0) ? fmt(l.haber) : '';
  });
  renumberLineas();
  ensureTrailingBlank();
  recalc();
  openModal('modal-asiento');
}

async function saveAsiento(){
  if(!recalc()){ toastBad('El asiento no cuadra.'); return; }

  const num = document.getElementById('a_num').value.trim();
  const payload = {
    num,
    fecha: document.getElementById('a_fecha').value,
    detalle: document.getElementById('a_detalle').value,
    origen: 'MANUAL',
    diario: document.getElementById('a_diario').value,
    proyecto: document.getElementById('a_proyecto').value,
    centro_costos: document.getElementById('a_cc').value,
    anticipo: null,
    lineas: []
  };

  if(document.getElementById('a_anticipo_on').checked){
    payload.anticipo = {
      tipo: document.getElementById('a_anticipo_tipo').value,
      ref: document.getElementById('a_anticipo_ref').value,
      monto: parseMoney(document.getElementById('a_anticipo_monto').value)
    };
  }

  document.querySelectorAll('#lineasContainer .lineaCard').forEach(card=>{
    const cuenta = card.querySelector('.a_cuenta').value;
    const descripcion = card.querySelector('.a_desc').value;
    const referencia = card.querySelector('.a_ref').value;
    const debe = parseMoney(card.querySelector('.a_debe').value);
    const haber = parseMoney(card.querySelector('.a_haber').value);
    if(!cuenta) return;
    if(debe===0 && haber===0) return;
    payload.lineas.push({cuenta, descripcion, referencia, debe, haber});
  });

  if(payload.lineas.length===0){ toastBad('Agrega al menos una línea.'); return; }

  const url = editing
    ? 'index.php?route=api/contabilidad_asiento_update'
    : 'index.php?route=api/contabilidad_asiento_save';

  const res = await fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'same-origin',
    body: JSON.stringify(payload)
  });

  let j=null;
  try { j = await res.json(); } catch(e){ j=null; }

  if(!j || !j.ok){ toastBad((j && j.msg) ? j.msg : 'No se pudo guardar.'); return; }

  toastOk(j.msg || 'Registro guardado exitosamente.');
  closeModal('modal-asiento');
  setTimeout(()=>location.reload(), 300);
}

async function delAsiento(num){
  if(!confirm('¿Eliminar el asiento '+num+' completo?')) return;
  const fd = new FormData(); fd.append('num', num);
  const res = await fetch('index.php?route=api/contabilidad_asiento_delete', {method:'POST', body:fd, credentials:'same-origin'});
  const j = await res.json();
  if(j.ok){ toastOk(j.msg||'Asiento eliminado'); location.reload(); }
  else toastBad(j.msg || 'Error al eliminar');
}

// tabla resumen seleccion
document.querySelectorAll('#tblAsientos .rowSel').forEach(tr=>{
  tr.addEventListener('click', ()=>{
    document.querySelectorAll('#tblAsientos .rowSel').forEach(x=>x.classList.remove('activeRow'));
    tr.classList.add('activeRow');
    selectedNum = tr.dataset.num;
  });
  tr.addEventListener('dblclick', ()=>{
    openEdit(tr.dataset.num);
  });
});

// acciones modal
document.querySelectorAll('[data-action="asiento-cancel"]').forEach(b=>b.addEventListener('click', ()=>closeModal('modal-asiento')));
document.querySelectorAll('[data-action="asiento-clear"]').forEach(b=>b.addEventListener('click', ()=>clearAsientoForm()));
document.querySelectorAll('[data-action="asiento-save"]').forEach(b=>b.addEventListener('click', ()=>saveAsiento()));

// click fuera cierra cuentas
document.querySelectorAll('[data-action="cuentas-close"]').forEach(b=>b.addEventListener('click', ()=>closeModal('modal-cuentas')));

// Integración con toolbar global
window.Toolbar = window.Toolbar || {};
window.Toolbar.new = ()=> {
  clearAsientoForm();
  openModal('modal-asiento');
};
window.Toolbar.edit = ()=> {
  if(!selectedNum) return toastBad('Selecciona un asiento primero.');
  openEdit(selectedNum);
};
window.Toolbar.delete = ()=> {
  if(!selectedNum) return toastBad('Selecciona un asiento primero.');
  delAsiento(selectedNum);
};
window.Toolbar.print = ()=> {
  if(selectedNum){
    return window.open('index.php?route=api/contabilidad_asiento_pdf&num='+encodeURIComponent(selectedNum),'_blank');
  }
  window.open('index.php?route=api/contabilidad_diario_export_pdf&'+<?=json_encode(http_build_query(['from'=>$from ?: $dFrom,'to'=>$to ?: $dTo,'num'=>$qNum,'cuenta'=>$qCuenta,'q'=>$qText]))?>,'_blank');
};
window.Toolbar.search = ()=> {
  window.location.href='index.php?route=contabilidad/diario/buscar&'+<?=json_encode(http_build_query(['from'=>$from ?: $dFrom,'to'=>$to ?: $dTo,'num'=>$qNum,'cuenta'=>$qCuenta,'q'=>$qText]))?>;
};
window.Toolbar.verify = ()=> {
  window.location.href='index.php?route=contabilidad/diario/verificar';
};
window.Toolbar.export = ()=> {
  window.open('index.php?route=api/contabilidad_diario_export_excel&'+<?=json_encode(http_build_query(['from'=>$from ?: $dFrom,'to'=>$to ?: $dTo,'num'=>$qNum,'cuenta'=>$qCuenta,'q'=>$qText]))?>,'_blank');
};

// abrir cuentas al iniciar para preparar
buildCuentaRows();
