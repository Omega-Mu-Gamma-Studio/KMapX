/* ═══════════════════════════════════════════════════════════════════════════
   K·MAP SIMPLIFIER — APP.JS
   Full Quine-McCluskey engine + UI controller
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const MINTERM_MAP = {
  "A'B'C'D'":0, "A'B'C'D":1,  "A'B'CD'":2,  "A'B'CD":3,
  "A'BC'D'":4,  "A'BC'D":5,   "A'BCD'":6,   "A'BCD":7,
  "AB'C'D'":8,  "AB'C'D":9,   "AB'CD'":10,  "AB'CD":11,
  "ABC'D'":12,  "ABC'D":13,   "ABCD'":14,   "ABCD":15
};

// Gray-code K-map layout: minterm → [row, col]
const KMAP_COORDS = {
   0:[0,0], 1:[0,1], 3:[0,2], 2:[0,3],
   4:[1,0], 5:[1,1], 7:[1,2], 6:[1,3],
  12:[2,0],13:[2,1],15:[2,2],14:[2,3],
   8:[3,0], 9:[3,1],11:[3,2],10:[3,3]
};

const REVERSE_COORDS = {};
for (const [m, rc] of Object.entries(KMAP_COORDS)) {
  REVERSE_COORDS[`${rc[0]},${rc[1]}`] = parseInt(m);
}

const GROUP_COLORS = [
  '#00FFB2','#FF4060','#00C8FF','#FFD060',
  '#9B70FF','#FF9040','#40FFE0','#FF60B0'
];

const CD_LABELS = ['00','01','11','10'];
const AB_LABELS = ['00','01','11','10'];

// ─── Splash Screen ────────────────────────────────────────────────────────────

const SPLASH_STEPS = [
  { pct: 15,  msg: 'Loading QM engine...' },
  { pct: 32,  msg: 'Building minterm table...' },
  { pct: 55,  msg: 'Initializing K-map layout...' },
  { pct: 74,  msg: 'Setting up prime implicant finder...' },
  { pct: 91,  msg: 'Rendering interface...' },
  { pct: 100, msg: 'Ready. Let\'s simplify.' },
];

function runSplash() {
  // Particle canvas
  const canvas = document.getElementById('splash-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles;

  function resizeCanvas() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticles() {
    particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.3,
      alpha: Math.random() * 0.6 + 0.1,
    }));
  }

  resizeCanvas();
  makeParticles();
  window.addEventListener('resize', () => { resizeCanvas(); makeParticles(); });

  let rafId;
  function drawParticles() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,255,178,${p.alpha})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    }
    // Draw connecting lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,255,178,${0.08 * (1 - dist/100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    rafId = requestAnimationFrame(drawParticles);
  }
  drawParticles();

  // Progress bar sequence
  const fill  = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');
  const enterBtn = document.getElementById('splash-enter');

  let stepIdx = 0;
  function nextStep() {
    if (stepIdx >= SPLASH_STEPS.length) {
      enterBtn.classList.add('visible');
      return;
    }
    const step = SPLASH_STEPS[stepIdx++];
    fill.style.width  = step.pct + '%';
    label.textContent = step.msg;
    const delay = stepIdx === SPLASH_STEPS.length ? 400 : 320 + Math.random() * 280;
    setTimeout(nextStep, delay);
  }
  setTimeout(nextStep, 1200);

  // Expose cleanup
  window._splashRAF = rafId;
  window._cancelSplashRAF = () => cancelAnimationFrame(rafId);
}

function enterApp() {
  window._cancelSplashRAF && window._cancelSplashRAF();
  const splash = document.getElementById('splash');
  const app    = document.getElementById('app');

  splash.classList.add('exit');
  app.classList.remove('hidden');

  // Trigger reflow then animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      app.classList.add('visible');
    });
  });

  setTimeout(() => splash.remove(), 900);
}

// ─── Boolean Expression Parser ────────────────────────────────────────────────

function parseExpression(expr) {
  expr = expr.replace(/\s+/g, '');
  const terms = expr.split('+').filter(Boolean);
  const result = [];

  for (const term of terms) {
    let A='', B='', C='', D='';
    let i = 0;
    while (i < term.length) {
      const c = term[i];
      if ('ABCD'.includes(c)) {
        const val = (i+1 < term.length && term[i+1] === "'") ? (i+=2, c+"'") : (i++, c);
        if (c==='A') A=val;
        else if (c==='B') B=val;
        else if (c==='C') C=val;
        else if (c==='D') D=val;
      } else { i++; }
    }
    const t = A+B+C+D;
    if (t) result.push(t);
  }
  return result;
}

function expandTerm(term) {
  const vars = ['A','B','C','D'];
  const present = {};
  let i = 0;
  while (i < term.length) {
    const c = term[i];
    if ('ABCD'.includes(c)) {
      if (i+1 < term.length && term[i+1] === "'") { present[c] = 0; i+=2; }
      else { present[c] = 1; i++; }
    } else { i++; }
  }
  const missing = vars.filter(v => !(v in present));
  const results = [];
  function recurse(idx, cur) {
    if (idx === missing.length) {
      const parts = vars.map(v => {
        const val = (v in cur) ? cur[v] : present[v];
        return val === 1 ? v : v+"'";
      });
      results.push(parts.join(''));
      return;
    }
    const v = missing[idx];
    recurse(idx+1, {...cur, [v]:1});
    recurse(idx+1, {...cur, [v]:0});
  }
  recurse(0, {});
  return results;
}

function toSOP(terms) {
  const expanded = [];
  for (const t of terms) {
    if (t in MINTERM_MAP) expanded.push(t);
    else expanded.push(...expandTerm(t));
  }
  return [...new Set(expanded)];
}

function getMinterms(sopTerms) {
  return [...new Set(sopTerms.filter(t => t in MINTERM_MAP).map(t => MINTERM_MAP[t]))];
}

// ─── Quine-McCluskey Engine ───────────────────────────────────────────────────

function mintermToBinary(m) {
  return [(m>>3)&1, (m>>2)&1, (m>>1)&1, m&1];
}

function findPrimeImplicants(minterms) {
  if (!minterms.length) return [];

  // Use string keys for frozenset-like sets
  let current = new Set(minterms.map(m => JSON.stringify([m])));
  const primeImplicants = new Set();

  while (true) {
    const nextGen = new Set();
    const used = new Set();
    const groups = [...current].map(s => JSON.parse(s));

    for (let i = 0; i < groups.length; i++) {
      for (let j = i+1; j < groups.length; j++) {
        const g1 = groups[i], g2 = groups[j];
        if (g1.length !== g2.length) continue;
        const s1 = [...g1].sort((a,b)=>a-b);
        const s2 = [...g2].sort((a,b)=>a-b);
        const xors = s1.map((a,k) => a ^ s2[k]);
        if (new Set(xors).size === 1 && xors[0] !== 0 && (xors[0] & (xors[0]-1)) === 0) {
          const combined = [...new Set([...g1,...g2])].sort((a,b)=>a-b);
          nextGen.add(JSON.stringify(combined));
          used.add(JSON.stringify(s1));
          used.add(JSON.stringify(s2));
        }
      }
    }

    for (const g of groups) {
      const key = JSON.stringify([...g].sort((a,b)=>a-b));
      if (!used.has(key)) primeImplicants.add(JSON.stringify(g));
    }

    if (!nextGen.size) break;
    current = nextGen;
  }

  return [...primeImplicants].map(s => JSON.parse(s));
}

function findEssentialPIs(pis, minterms) {
  if (!minterms.length) return [];
  let remaining = new Set(minterms);
  let available = pis.map(pi => new Set(pi));
  const selected = [];

  while (remaining.size > 0) {
    // Find essential PIs
    let essential = null;
    for (const m of remaining) {
      const covers = available.filter(pi => pi.has(m));
      if (covers.length === 1) { essential = covers[0]; break; }
    }
    if (essential) {
      selected.push(essential);
      available = available.filter(pi => pi !== essential);
      for (const m of essential) remaining.delete(m);
    } else {
      // Greedy: pick PI covering most remaining
      const best = available.reduce((a,b) =>
        [...b].filter(m => remaining.has(m)).length >
        [...a].filter(m => remaining.has(m)).length ? b : a
      );
      selected.push(best);
      available = available.filter(pi => pi !== best);
      for (const m of best) remaining.delete(m);
    }
  }
  return selected;
}

function groupToExpression(mintermsArr) {
  if (!mintermsArr.length) return '';
  const bins = mintermsArr.map(mintermToBinary);
  const vars = ['A','B','C','D'];
  const terms = [];
  for (let i = 0; i < 4; i++) {
    const vals = bins.map(b => b[i]);
    if (vals.every(v => v===1)) terms.push(vars[i]);
    else if (vals.every(v => v===0)) terms.push(vars[i]+"'");
  }
  return terms.join('') || '1';
}

function analyzeKMap(minterms) {
  if (!minterms.length) return [];
  const pis = findPrimeImplicants(minterms);
  const cover = findEssentialPIs(pis, minterms);
  return cover.map(piSet => {
    const mList = [...piSet].sort((a,b)=>a-b);
    return {
      minterms: mList,
      cells: mList.map(m => KMAP_COORDS[m]).filter(Boolean),
      expression: groupToExpression(mList),
      size: mList.length
    };
  });
}

function groupsToSOP(groups) {
  if (!groups.length) return '0';
  const exprs = [];
  for (const g of groups) {
    if (g.expression === '1') return '1';
    if (g.expression && !exprs.includes(g.expression)) exprs.push(g.expression);
  }
  return exprs.join(' + ') || '0';
}

// ─── K-Map Rendering ─────────────────────────────────────────────────────────

function buildKMapGrid(minterms, groups) {
  // cell → group index
  const cellGroup = {};
  groups.forEach((g, gi) => {
    g.cells.forEach(([r,c]) => { cellGroup[`${r},${c}`] = gi; });
  });

  // 4×4 value grid
  const grid = Array.from({length:4}, () => Array(4).fill(0));
  minterms.forEach(m => {
    const [r,c] = KMAP_COORDS[m];
    grid[r][c] = 1;
  });

  const wrap = document.createElement('div');
  wrap.className = 'kmap-wrapper';

  // CD axis label
  const cdLbl = document.createElement('div');
  cdLbl.className = 'kmap-axis-label';
  cdLbl.textContent = 'CD →';
  wrap.appendChild(cdLbl);

  const outer = document.createElement('div');
  outer.className = 'kmap-outer';

  // AB label
  const abLbl = document.createElement('div');
  abLbl.className = 'kmap-ab-label';
  abLbl.textContent = 'AB ↓';
  outer.appendChild(abLbl);

  const table = document.createElement('table');
  table.className = 'kmap-table';

  // Header row
  const thead = document.createElement('tr');
  const cornerTh = document.createElement('th');
  cornerTh.className = 'hdr';
  thead.appendChild(cornerTh);
  CD_LABELS.forEach(lbl => {
    const th = document.createElement('th');
    th.className = 'hdr';
    th.textContent = lbl;
    thead.appendChild(th);
  });
  table.appendChild(thead);

  // Data rows
  for (let r = 0; r < 4; r++) {
    const tr = document.createElement('tr');
    const rowHdr = document.createElement('th');
    rowHdr.className = 'hdr';
    rowHdr.textContent = AB_LABELS[r];
    tr.appendChild(rowHdr);

    for (let c = 0; c < 4; c++) {
      const val = grid[r][c];
      const m   = REVERSE_COORDS[`${r},${c}`];
      const td  = document.createElement('td');
      td.className = `kmap-cell val-${val}`;

      const gIdx = cellGroup[`${r},${c}`];
      if (gIdx !== undefined) td.classList.add(`group-${gIdx}`);

      const valSpan = document.createElement('span');
      valSpan.className = 'cell-val';
      valSpan.textContent = val;

      const idxSpan = document.createElement('span');
      idxSpan.className = 'cell-idx';
      idxSpan.textContent = m;

      td.appendChild(valSpan);
      td.appendChild(idxSpan);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  outer.appendChild(table);
  wrap.appendChild(outer);

  // Legend
  if (groups.length) {
    const legend = document.createElement('div');
    legend.className = 'kmap-legend';
    groups.forEach((g, gi) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      const dot = document.createElement('span');
      dot.className = 'legend-dot';
      dot.style.background = GROUP_COLORS[gi % GROUP_COLORS.length];
      item.appendChild(dot);
      item.appendChild(document.createTextNode(g.expression));
      legend.appendChild(item);
    });
    wrap.appendChild(legend);
  }

  return wrap;
}

// ─── Results Rendering ────────────────────────────────────────────────────────

function buildResults(minterms, simplified, original) {
  const origTerms = original.split('+').filter(s=>s.trim()).length;
  const simpTerms = simplified.split('+').filter(s=>s.trim()).length;
  const reduction = Math.max(0, origTerms - simpTerms);

  const container = document.createElement('div');

  // Stat cards
  const cards = document.createElement('div');
  cards.className = 'results-cards';
  [
    { label:'ORIGINAL TERMS',    val: origTerms,              cls:'yellow' },
    { label:'SIMPLIFIED TERMS',  val: simpTerms,              cls:'green'  },
    { label:'TERMS REDUCED',     val: reduction,              cls:'red'    },
    { label:'MINTERMS',          val: [...new Set(minterms)].length, cls:'blue' },
  ].forEach(({label,val,cls}) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `<div class="stat-label">${label}</div>
                      <div class="stat-value ${cls}">${val}</div>`;
    cards.appendChild(card);
  });
  container.appendChild(cards);

  // Expression rows
  const rows = document.createElement('div');
  rows.className = 'expr-rows';
  [
    { tag:'ORIGINAL',   val: original,                         cls:'original'   },
    { tag:'SIMPLIFIED', val: simplified,                       cls:'simplified' },
    { tag:'MINTERMS',   val: [...new Set(minterms)].sort((a,b)=>a-b).join(', '), cls:'minterms' },
  ].forEach(({tag,val,cls}) => {
    const row = document.createElement('div');
    row.className = 'expr-row';
    row.innerHTML = `<span class="expr-tag">${tag}</span>
                     <span class="expr-value ${cls}">${val}</span>
                     <button class="copy-btn" data-copy="${encodeURIComponent(val)}">COPY</button>`;
    rows.appendChild(row);
  });
  container.appendChild(rows);

  container.addEventListener('click', e => {
    if (e.target.classList.contains('copy-btn')) {
      const text = decodeURIComponent(e.target.dataset.copy);
      navigator.clipboard.writeText(text).then(() => {
        e.target.textContent = 'COPIED!';
        setTimeout(() => e.target.textContent = 'COPY', 1500);
      }).catch(() => {});
    }
  });

  return container;
}

// ─── Prime Implicants Rendering ───────────────────────────────────────────────

function buildImplicants(groups) {
  const container = document.createElement('div');
  const hdr = document.createElement('div');
  hdr.className = 'pi-header';
  hdr.textContent = `${groups.length} PRIME IMPLICANT${groups.length!==1?'S':''} SELECTED`;
  container.appendChild(hdr);

  const wrap = document.createElement('div');
  wrap.className = 'pi-table-wrap';

  const table = document.createElement('table');
  table.className = 'pi-table';
  table.innerHTML = `<thead>
    <tr>
      <th>Size</th>
      <th>Expression</th>
      <th>Minterms</th>
      <th>Cells (row,col)</th>
    </tr>
  </thead>`;

  const tbody = document.createElement('tbody');
  const SIZE_NAMES = {1:'Single',2:'Pair',4:'Quad',8:'Octet'};

  groups.forEach((g, gi) => {
    const tr = document.createElement('tr');
    const color = GROUP_COLORS[gi % GROUP_COLORS.length];
    tr.innerHTML = `
      <td><span class="size-badge">${SIZE_NAMES[g.size]||g.size}</span></td>
      <td><span class="pi-color-dot" style="background:${color}"></span><span class="pi-expr">${g.expression}</span></td>
      <td>${g.minterms.join(', ')}</td>
      <td>${g.cells.map(([r,c])=>`(${r},${c})`).join('  ')}</td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  container.appendChild(wrap);
  return container;
}

// ─── Tab Controller ───────────────────────────────────────────────────────────

function initTabs() {
  const tabs   = document.querySelectorAll('.nav-tab');
  const panels = document.querySelectorAll('.panel');
  const tabPanelMap = { kmap:'panel-kmap', results:'panel-results', implicants:'panel-implicants' };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tabPanelMap[tab.dataset.tab]).classList.add('active');
    });
  });
}

// ─── Status Bar ───────────────────────────────────────────────────────────────

function setStatus(msg, type='') {
  const bar = document.getElementById('status-bar');
  bar.textContent = msg;
  bar.className = 'header-status' + (type ? ' '+type : '');
}

// ─── Main Simplify Handler ────────────────────────────────────────────────────

function simplify() {
  const expr = document.getElementById('expr-input').value.trim();
  if (!expr) { setStatus('Enter an expression first.', 'error'); return; }

  try {
    setStatus('Processing...');

    const parsed = parseExpression(expr);
    if (!parsed.length) { setStatus('No valid terms found.', 'error'); return; }

    const sopTerms = toSOP(parsed);
    const minterms = getMinterms(sopTerms);

    if (!minterms.length) { setStatus('Could not extract minterms.', 'error'); return; }

    const groups     = analyzeKMap(minterms);
    const simplified = groupsToSOP(groups);

    // Render K-Map
    const kmapCont = document.getElementById('kmap-container');
    kmapCont.innerHTML = '';
    kmapCont.appendChild(buildKMapGrid(minterms, groups));

    // Render Results
    const resCont = document.getElementById('results-container');
    resCont.innerHTML = '';
    resCont.appendChild(buildResults(minterms, simplified, expr));

    // Render Implicants
    const piCont = document.getElementById('implicants-container');
    piCont.innerHTML = '';
    piCont.appendChild(buildImplicants(groups));

    setStatus(`${expr}  →  ${simplified}`, 'success');

    // Switch to kmap tab
    document.querySelector('[data-tab="kmap"]').click();

  } catch(e) {
    console.error(e);
    setStatus('Error: ' + e.message, 'error');
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  runSplash();
  initTabs();

  document.getElementById('btn-simplify').addEventListener('click', simplify);
  document.getElementById('expr-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') simplify();
  });

  document.querySelectorAll('.ex-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('expr-input').value = btn.dataset.expr;
      simplify();
    });
  });
});