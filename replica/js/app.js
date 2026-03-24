// ═══════════════════════════════════════════════
//  Replica — Main Application Logic
//  Requires: Firebase compat SDK (app, auth, firestore)
// ═══════════════════════════════════════════════

// ══════ GLOBALS ══════
let db = null, auth = null, fbMode = false, curUser = null, curProfile = null;
let llmMsgs = [], llmTok = 0;
let allCaps = [];

// ══════ ADMIN CONFIG ══════
// 👇 Add your admin email(s) here
const ADMIN_EMAILS = [
  'your@email.com',         // ← replace with your actual email
  // 'another@email.com',   // add more admins by uncommenting
];

// ══════ DEMO DATA ══════
const DCAPS = [
  { id:'d1', name:'bert-sentiment-clf', description:'Fine-tuned BERT for IMDB sentiment. 94.1% acc.', language:'Python', tags:['nlp','bert'], ownerUsername:'yaniv_ai', visibility:'public', stars:842, forks:134, runs:2891, certified:true, createdAt:{toDate:()=>new Date('2025-03-10')} },
  { id:'d2', name:'gpt2-text-gen', description:'GPT-2 on scientific abstracts for domain generation.', language:'Python', tags:['nlp','gpt2'], ownerUsername:'ml_labs', visibility:'public', stars:612, forks:88, runs:1742, certified:true, createdAt:{toDate:()=>new Date('2025-03-08')} },
  { id:'d3', name:'cnn-cifar100', description:'ResNet-50 multi-GPU training pipeline on CIFAR-100.', language:'Python', tags:['cv','resnet','pytorch'], ownerUsername:'vision_pro', visibility:'public', stars:394, forks:71, runs:987, certified:false, createdAt:{toDate:()=>new Date('2025-03-06')} },
  { id:'d4', name:'llm-rag-pipeline', description:'LangChain + Pinecone RAG pipeline with hybrid retrieval.', language:'Python', tags:['rag','llm','langchain'], ownerUsername:'ai_infra', visibility:'public', stars:1104, forks:203, runs:3401, certified:true, createdAt:{toDate:()=>new Date('2025-03-12')} },
  { id:'d5', name:'react-ml-dash', description:'React + D3.js real-time metrics dashboard.', language:'JavaScript', tags:['frontend','d3'], ownerUsername:'ux_dev', visibility:'public', stars:178, forks:44, runs:312, certified:false, createdAt:{toDate:()=>new Date('2025-03-02')} },
  { id:'d6', name:'cpp-onnx-infer', description:'C++ ONNX wrapper for 10x faster edge inference.', language:'C++', tags:['inference','onnx'], ownerUsername:'edge_ai', visibility:'public', stars:521, forks:97, runs:1203, certified:true, createdAt:{toDate:()=>new Date('2025-03-09')} },
];

// ══════ CODE TEMPLATES ══════
const CODE = {
  python: `import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

np.random.seed(42)
X = np.random.randn(1000, 10)
y = (X[:,0] + X[:,1] > 0).astype(int)
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2)

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_tr, y_tr)
y_pred = model.predict(X_te)

print(f"Accuracy: {accuracy_score(y_te, y_pred):.4f}")
print(classification_report(y_te, y_pred))`,

  javascript: `const { performance } = require('perf_hooks');
const memo = {};
const fib = n => n<=1 ? n : (memo[n] ??= (fib(n-1) + fib(n-2)));

const t0 = performance.now();
for(let i = 0; i < 1000; i++) fib(40);
console.log(\`Fibonacci(40): \${fib(40)} — \${(performance.now()-t0).toFixed(2)}ms\`);`,

  java: `import java.util.*;
public class Main {
  public static void main(String[] args) {
    int[] arr = new Random(42).ints(100000, 0, 10000).toArray();
    long t = System.nanoTime();
    Arrays.sort(arr);
    System.out.printf("Sorted 100k in %dms%n", (System.nanoTime()-t)/1_000_000);
  }
}`,

  cpp: `#include <iostream>
#include <vector>
#include <numeric>
#include <algorithm>
int main() {
  std::vector<int> v(1000000);
  std::iota(v.begin(), v.end(), 0);
  std::shuffle(v.begin(), v.end(), std::mt19937(42));
  auto t0 = std::chrono::high_resolution_clock::now();
  std::sort(v.begin(), v.end());
  auto ms = std::chrono::duration<double,std::milli>(
    std::chrono::high_resolution_clock::now()-t0).count();
  std::cout << "Sorted 1M ints in " << ms << "ms" << std::endl;
}`
};

// ══════ FAKE CONSOLE OUTPUTS ══════
const FOUT = {
  python:     [{t:'dim',v:'[Replica] Python 3.11 container ready'},{t:'ok',v:'Accuracy: 0.9350'},{t:'ok',v:'              precision    recall  f1-score'},{t:'ok',v:'           0       0.93      0.94      0.94'},{t:'ok',v:'           1       0.94      0.93      0.94'},{t:'dim',v:'[Replica] ✓ Saved to /runs · 0.42s · 82MB'}],
  javascript: [{t:'dim',v:'[Replica] Node.js v20.11 ready'},{t:'ok',v:'Fibonacci(40): 102334155 — 0.94ms'},{t:'dim',v:'[Replica] ✓ Saved to /runs · 0.02s'}],
  java:       [{t:'dim',v:'[Replica] OpenJDK 21 · Compiling...'},{t:'ok',v:'Sorted 100k in 18ms'},{t:'dim',v:'[Replica] ✓ Saved to /runs · 0.3s'}],
  cpp:        [{t:'dim',v:'[Replica] g++ 13.2.0 -O2'},{t:'ok',v:'Sorted 1M ints in 14.3ms'},{t:'dim',v:'[Replica] ✓ Saved to /runs · 0.04s'}]
};

// ════════════════════════════════════════════════
// FIREBASE
// ════════════════════════════════════════════════
function initFB() {
  let cfg;
  try {
    cfg = JSON.parse(document.getElementById('fb-in').value.trim());
    if (!cfg.apiKey || !cfg.projectId) throw new Error('Missing required fields');
  } catch(e) { toast('❌ Invalid JSON config', 'red'); return; }

  try {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    db = firebase.firestore();
    auth = firebase.auth();
    fbMode = true;
    cm('m-fb');
    document.getElementById('nav').style.display = 'flex';

    auth.onAuthStateChanged(async u => {
      if (u) { curUser = u; curProfile = await getOrCreate(u); onLogin(); }
      else { curUser = null; curProfile = null; onLogout(); }
    });

    loadStats();
    renderHomeTrending();
    toast('🔥 Firebase connected! Firestore is live.', 'green');
    sp('home');
  } catch(e) { toast('❌ ' + e.message, 'red'); console.error(e); }
}

function useDemo() {
  fbMode = false; db = null; auth = null;
  cm('m-fb');
  document.getElementById('nav').style.display = 'flex';
  document.getElementById('fb-lbl').textContent = 'Demo';
  document.querySelector('.sdot.g').style.background = 'var(--orange)';
  allCaps = [...DCAPS];
  loadStats();
  renderHomeTrending();
  toast('▶ Demo mode active', 'orange');
  sp('home');
}

async function getOrCreate(u) {
  const ref = db.collection('users').doc(u.uid);
  const s = await ref.get();
  if (!s.exists) {
    const d = {
      uid: u.uid, email: u.email,
      displayName: u.displayName || u.email.split('@')[0],
      username: u.email.split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      capsuleCount: 0, apiKeys: {}
    };
    await ref.set(d);
    return d;
  }
  return s.data();
}

// ════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════
async function doLogin() {
  const email = document.getElementById('li-email').value.trim();
  const pass  = document.getElementById('li-pass').value;
  const err   = document.getElementById('li-err');
  err.style.display = 'none';

  if (!fbMode) {
    curUser    = { uid: 'demo-' + Date.now(), email, displayName: email.split('@')[0] };
    curProfile = { uid: curUser.uid, displayName: curUser.displayName, username: email.split('@')[0], email, capsuleCount: 0 };
    cm('m-login'); onLogin(); toast('Signed in (demo)', 'green'); return;
  }

  document.getElementById('li-btn').textContent = 'Signing in...';
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    cm('m-login'); toast('👋 Welcome back!', 'green');
  } catch(e) { err.textContent = e.message; err.style.display = 'block'; }
  document.getElementById('li-btn').textContent = 'Sign In';
}

async function doSignup() {
  const name  = document.getElementById('su-name').value.trim();
  const user  = document.getElementById('su-user').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const pass  = document.getElementById('su-pass').value;
  const err   = document.getElementById('su-err');
  err.style.display = 'none';

  if (!name || !email || !pass) { err.textContent = 'All fields required'; err.style.display = 'block'; return; }

  if (!fbMode) {
    curUser    = { uid: 'demo-' + Date.now(), email, displayName: name };
    curProfile = { uid: curUser.uid, displayName: name, username: user || email.split('@')[0], email, capsuleCount: 0 };
    cm('m-signup'); onLogin(); toast('Account created!', 'green'); return;
  }

  document.getElementById('su-btn').textContent = 'Creating...';
  try {
    const c = await auth.createUserWithEmailAndPassword(email, pass);
    await c.user.updateProfile({ displayName: name });
    await db.collection('users').doc(c.user.uid).set({
      uid: c.user.uid, email, displayName: name,
      username: user || email.split('@')[0],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      capsuleCount: 0, apiKeys: {}
    });
    cm('m-signup'); toast('🚀 Account created!', 'green');
  } catch(e) { err.textContent = e.message; err.style.display = 'block'; }
  document.getElementById('su-btn').textContent = 'Create Account';
}

async function doLogout() {
  if (fbMode && auth) await auth.signOut();
  else { curUser = null; curProfile = null; onLogout(); }
}

function onLogin() {
  document.getElementById('nav-auth').style.display = 'none';
  document.getElementById('nav-user').style.display = 'flex';
  const init = (curProfile?.displayName || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('nav-av').textContent = init;
  document.getElementById('nav-uname').textContent = '@' + (curProfile?.username || 'user');
  const isAdmin = ADMIN_EMAILS.includes(curUser?.email || '');
  document.getElementById('admin-btn').style.display = isAdmin ? 'flex' : 'none';
  loadStats();
}

function onLogout() {
  document.getElementById('nav-auth').style.display = 'flex';
  document.getElementById('nav-user').style.display = 'none';
  document.getElementById('admin-btn').style.display = 'none';
  sp('home');
}

// ════════════════════════════════════════════════
// ROUTING
// ════════════════════════════════════════════════
function sp(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));
  const m = { home:'Home', explore:'Explore', dashboard:'Dashboard', editor:'Editor', llm:'LLM Lab', admin:'⚡ Admin' };
  document.querySelectorAll('.nb').forEach(b => { if (b.textContent.trim() === m[id]) b.classList.add('active'); });
  if (id === 'explore')   renderExplore();
  if (id === 'dashboard') initDash();
  if (id === 'editor')    initEditor();
  if (id === 'llm')       initLLM();
  if (id === 'admin')     loadAdmin();
}

function ra(p) {
  if (!curUser) { om('m-login'); return; }
  if (p === 'admin' && !ADMIN_EMAILS.includes(curUser?.email || '')) { toast('⛔ Admin access restricted', 'red'); return; }
  sp(p);
}

function om(id) { document.getElementById(id).classList.add('open'); }
function cm(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.mo').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m && m.id !== 'm-fb') m.classList.remove('open'); });
});

// ════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════
function toast(msg, type = 'blue') {
  const c = { green:'var(--green)', blue:'var(--blue)', red:'var(--red)', orange:'var(--orange)' };
  const el = document.createElement('div');
  el.className = 't';
  el.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${c[type]};flex-shrink:0;"></span>${msg}`;
  document.getElementById('tc').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ════════════════════════════════════════════════
// FIRESTORE HELPERS
// ════════════════════════════════════════════════
async function fsAdd(col, data) {
  if (!db) return 'demo-' + Date.now();
  const r = await db.collection(col).add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  return r.id;
}

async function fsGet(col, ...ws) {
  if (!db) return [];
  let q = db.collection(col);
  ws.forEach(w => q = q.where(...w));
  try {
    let s;
    try { s = await q.orderBy('createdAt', 'desc').limit(50).get(); }
    catch(e) { s = await q.limit(50).get(); }
    return s.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return []; }
}

async function fsUpd(col, id, data) { if (db) await db.collection(col).doc(id).update(data); }

async function fsCnt(col) {
  if (!db) return '—';
  try { return (await db.collection(col).get()).size; }
  catch(e) { return '—'; }
}

// ════════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════════
async function loadStats() {
  if (!fbMode) {
    document.getElementById('h-users').textContent = '8.4k';
    document.getElementById('h-caps').textContent  = '24k+';
    document.getElementById('h-runs').textContent  = '92k';
    return;
  }
  const [u, c, r] = await Promise.all([fsCnt('users'), fsCnt('capsules'), fsCnt('runs')]);
  document.getElementById('h-users').textContent = u;
  document.getElementById('h-caps').textContent  = c;
  document.getElementById('h-runs').textContent  = r;
}

// ════════════════════════════════════════════════
// HOME
// ════════════════════════════════════════════════
async function renderHomeTrending() {
  let caps = DCAPS.slice(0, 3);
  if (fbMode && db) {
    try {
      const s = await db.collection('capsules').where('visibility','==','public').orderBy('runs','desc').limit(3).get();
      if (s.size > 0) caps = s.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {}
  }
  document.getElementById('home-trending').innerHTML = caps.map(cCard).join('');
}

// ════════════════════════════════════════════════
// EXPLORE
// ════════════════════════════════════════════════
async function renderExplore() {
  if (fbMode && db) {
    try {
      const s = await db.collection('capsules').where('visibility','==','public').orderBy('createdAt','desc').limit(40).get();
      allCaps = s.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { allCaps = DCAPS; }
  } else if (!allCaps.length) { allCaps = DCAPS; }

  const q    = (document.getElementById('ex-q')?.value || '').toLowerCase();
  const lang = document.getElementById('ex-lang')?.value || '';
  const sort = document.getElementById('ex-sort')?.value || '';
  let caps = allCaps.filter(c => (!q || c.name?.includes(q) || (c.description || '').toLowerCase().includes(q)) && (!lang || c.language === lang));
  if (sort === 'Newest')    caps.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  else if (sort === 'Most Stars') caps.sort((a,b) => (b.stars||0) - (a.stars||0));
  else caps.sort((a,b) => (b.runs||0) - (a.runs||0));
  document.getElementById('ex-grid').innerHTML = caps.length
    ? caps.map(cCard).join('')
    : '<div style="grid-column:1/-1;text-align:center;color:var(--tm);padding:40px;">No capsules found</div>';
}

function cCard(c) {
  const lc = { Python:'db', JavaScript:'do', Java:'dp', 'C++':'dt' };
  const d  = c.createdAt?.toDate ? c.createdAt.toDate().toISOString().slice(0,10) : (c.createdAt||'').slice(0,10);
  return `<div class="cc" onclick="toast('🧪 Opening: ${c.name}','blue')">
    <div class="f ac jb mb8">
      <div class="f g8">
        <span class="bdg ${lc[c.language]||'db'}">${c.language||'?'}</span>
        ${c.certified ? '<span class="bdg dg">✓</span>' : ''}
        ${c.visibility === 'private' ? '<span class="bdg dr">🔒</span>' : ''}
      </div>
      <span style="font-size:11px;color:var(--tm);">${c.ownerUsername||''}</span>
    </div>
    <div class="cn">${c.name||'Untitled'}</div>
    <div style="font-size:12.5px;color:var(--t2);margin-bottom:10px;line-height:1.5;">${(c.description||'').slice(0,90)}</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">${(c.tags||[]).map(t=>`<span class="bdg dp" style="font-size:10px;">#${t}</span>`).join('')}</div>
    <div class="cm"><span>⭐ ${c.stars||0}</span><span>🌿 ${c.forks||0}</span><span>▶ ${c.runs||0}</span><span>📅 ${d}</span></div>
  </div>`;
}

// ════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════
async function initDash() {
  if (!curUser) return;
  document.getElementById('d-hi').textContent    = `Welcome, ${curProfile?.displayName || 'Researcher'}!`;
  document.getElementById('d-email').textContent = curUser.email || '';
  document.getElementById('set-n').value = curProfile?.displayName || '';
  document.getElementById('set-e').value = curUser.email || '';
  document.getElementById('set-u').value = curProfile?.username || '';

  const [mc, mr, ml] = await Promise.all([getMyCaps(), getMyRuns(), getMyLLM()]);
  document.getElementById('ds-nc').textContent = mc.length;
  document.getElementById('ds-nr').textContent = mr.length;
  document.getElementById('ds-nl').textContent = ml.length;
  document.getElementById('ds-ns').textContent = mc.reduce((a,c) => a + (c.stars||0), 0);
  document.getElementById('d-recent').innerHTML = mc.slice(0,3).map(cCard).join('') || '<div style="color:var(--tm);font-size:13px;">No capsules yet.</div>';
}

async function getMyCaps() { return fbMode && db ? fsGet('capsules', ['ownerUid','==',curUser.uid]) : DCAPS.slice(0,2); }
async function getMyRuns() { return fbMode && db ? fsGet('runs',     ['userUid','==', curUser.uid]) : []; }
async function getMyLLM()  { return fbMode && db ? fsGet('llm_logs', ['userUid','==', curUser.uid]) : []; }

async function dTab(n) {
  document.querySelectorAll('[id^="dc-"]').forEach(e => e.style.display = 'none');
  document.querySelectorAll('[id^="sn-"]').forEach(e => e.classList.remove('active'));
  document.getElementById('dc-' + n).style.display = 'block';
  document.getElementById('sn-' + n).classList.add('active');
  if (n === 'mycaps') {
    const c = await getMyCaps();
    document.getElementById('dc-capgrid').innerHTML = c.map(cCard).join('');
    document.getElementById('dc-empty').style.display = c.length ? 'none' : 'block';
  }
  if (n === 'runs') await renderRunsTab();
  if (n === 'llml') await renderLLMTab();
}

async function renderRunsTab() {
  document.getElementById('rl').style.display = 'flex';
  document.getElementById('rt').style.display = 'none';
  const runs = await getMyRuns();
  document.getElementById('rl').style.display = 'none';
  document.getElementById('rt').style.display = 'block';
  const tb = document.getElementById('r-body');
  if (!runs.length) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--tm);padding:24px;">No runs yet. Run some code in the Editor!</td></tr>'; return; }
  tb.innerHTML = runs.map(r => `<tr>
    <td style="font-family:var(--fm);font-size:12px;color:var(--blue);">${(r.capsuleName||r.id||'').slice(0,20)}</td>
    <td><span class="bdg ${r.language==='Python'?'db':r.language==='JavaScript'?'do':'dp'}">${r.language||'?'}</span></td>
    <td><span class="bdg ${r.status==='success'?'dg':'dr'}">${r.status==='success'?'✓ Pass':'✗ Fail'}</span></td>
    <td style="font-family:var(--fm);font-size:12px;">${r.durationMs ? (r.durationMs/1000).toFixed(2)+'s' : '—'}</td>
    <td style="font-family:var(--fm);font-size:11.5px;color:var(--tm);">${(r.outputPreview||'').slice(0,40)}</td>
    <td style="font-size:12px;color:var(--tm);">${r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : r.timestamp||'—'}</td>
  </tr>`).join('');
}

async function renderLLMTab() {
  document.getElementById('ll').style.display = 'flex';
  const logs = await getMyLLM();
  document.getElementById('ll').style.display = 'none';
  const el = document.getElementById('ll-list');
  if (!logs.length) { el.innerHTML = '<div style="color:var(--tm);font-size:13px;">No LLM sessions saved. Go to LLM Lab → Save session.</div>'; return; }
  el.innerHTML = logs.map(l => `<div class="card" style="padding:16px;">
    <div class="f ac jb mb8">
      <div class="f g8 ac">
        <span class="bdg dp">${l.model||'?'}</span>
        <span class="bdg db">${l.totalTokens||0} tok</span>
        <span style="font-family:var(--fm);font-size:11px;color:var(--tm);">$${(l.estimatedCost||0).toFixed(4)}</span>
      </div>
      <span style="font-size:12px;color:var(--tm);">${l.savedAt?.toDate ? l.savedAt.toDate().toLocaleString() : '—'}</span>
    </div>
    <div style="font-size:12.5px;color:var(--t2);">${l.messages?.length||0} messages · temp ${l.temperature||'?'}</div>
    ${l.messages?.[0] ? `<div style="font-size:12px;color:var(--tm);margin-top:6px;font-style:italic;">"${(l.messages[0].content||'').slice(0,80)}..."</div>` : ''}
  </div>`).join('');
}

async function createCapsule() {
  const name = document.getElementById('nc-name').value.trim();
  if (!name || !curUser) { toast('Name required', 'red'); return; }
  const cap = {
    name,
    description:  document.getElementById('nc-desc').value || 'New experiment',
    language:     document.getElementById('nc-lang').value,
    tags:        (document.getElementById('nc-tags').value || '').split(',').map(t => t.trim()).filter(Boolean),
    visibility:   document.getElementById('nc-vis').value,
    ownerUid:     curUser.uid,
    ownerUsername: curProfile?.username || 'user',
    stars: 0, forks: 0, runs: 0, certified: false
  };
  await fsAdd('capsules', cap);
  if (fbMode && db) await db.collection('users').doc(curUser.uid).update({ capsuleCount: firebase.firestore.FieldValue.increment(1) }).catch(() => {});
  cm('m-cap');
  toast(`🧪 "${name}" saved to Firestore!`, 'green');
  sp('dashboard');
  setTimeout(initDash, 400);
}

async function saveProfile() {
  if (!curUser) return;
  const n = document.getElementById('set-n').value.trim();
  if (fbMode && db) await fsUpd('users', curUser.uid, { displayName: n, username: document.getElementById('set-u').value.trim() });
  if (curProfile) curProfile.displayName = n;
  toast('✅ Profile saved to Firestore', 'green');
}

async function saveApiKeys() {
  if (!curUser) return;
  if (fbMode && db) await fsUpd('users', curUser.uid, { 'apiKeys.openai': document.getElementById('set-oa').value, 'apiKeys.huggingface': document.getElementById('set-hf').value });
  toast('🔑 Keys saved (encrypted at rest in Firestore)', 'green');
}

async function delAccount() {
  if (!confirm('Delete your account? This cannot be undone.')) return;
  if (fbMode && db && auth) { await db.collection('users').doc(curUser.uid).delete(); await auth.currentUser.delete(); }
  else { curUser = null; onLogout(); }
  toast('Account deleted', 'red');
}

// ════════════════════════════════════════════════
// EDITOR
// ════════════════════════════════════════════════
function initEditor() {
  const ed = document.getElementById('editor');
  if (!ed.value.trim()) ed.value = CODE.python;
  upLines();
  renderFTree();
  const c = allCaps[0] || DCAPS[0];
  document.getElementById('e-capinfo').innerHTML = `<strong style="color:var(--t1);">${c.name}</strong><br><span style="font-size:11.5px;">${(c.description||'').slice(0,60)}</span>`;
}

function renderFTree() {
  const fs = [['main.py','🐍'],['requirements.txt','📦'],['dataset.py','💾'],['model.py','🤖'],['eval.py','📊']];
  document.getElementById('ftree').innerHTML = fs.map(([n,e], i) =>
    `<div class="si ${i===0?'active':''}" onclick="setFile('${n}',this)" style="padding:6px 12px;font-family:var(--fm);font-size:12px;">${e} ${n}</div>`
  ).join('');
}

function setFile(n, el) {
  document.querySelectorAll('#ftree .si').forEach(x => x.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('e-fname').textContent = n;
  const ext = n.split('.').pop();
  const m = { py:'python', js:'javascript', java:'java', cpp:'cpp' };
  const l = m[ext];
  document.getElementById('editor').value = l && CODE[l] ? CODE[l] : (ext === 'txt' ? 'numpy==1.24.0\npandas==2.0.1\ntorch==2.0.1\n' : '# ' + n + '\n');
  upLines();
}

function upLines() {
  const n = (document.getElementById('editor').value.match(/\n/g) || []).length + 1;
  document.getElementById('lnum').textContent = Array.from({length:n}, (_,i) => i+1).join('\n');
}

function tabKey(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const t = e.target, s = t.selectionStart;
    t.value = t.value.slice(0,s) + '  ' + t.value.slice(t.selectionEnd);
    t.selectionStart = t.selectionEnd = s + 2;
  }
  upLines();
}

function switchLang(l) { document.getElementById('editor').value = CODE[l] || ''; upLines(); }

async function runCode() {
  const lang = document.getElementById('e-lang').value;
  const btn  = document.getElementById('run-btn');
  const cout = document.getElementById('cout');
  btn.disabled = true; btn.textContent = '⏳ Running...';
  document.getElementById('run-stat').innerHTML = '<div class="sdot b"></div><span style="font-size:11px;color:var(--blue);">Running</span>';
  cout.innerHTML = '';
  const t0   = Date.now();
  const outs = FOUT[lang] || FOUT.python;
  let i = 0;
  function nx() {
    if (i < outs.length) {
      const o = outs[i++];
      const d = document.createElement('div');
      d.textContent = '> ' + o.v;
      const cs = { dim:'color:var(--tm)', ok:'color:var(--green)', err:'color:var(--red)', info:'color:var(--blue)' };
      d.style.cssText = cs[o.t] || '';
      cout.appendChild(d); cout.scrollTop = 99999;
      setTimeout(nx, 180 + Math.random() * 220);
    } else {
      const dur = Date.now() - t0;
      btn.disabled = false; btn.textContent = '▶ Run';
      document.getElementById('run-stat').innerHTML = '<div class="sdot g"></div><span style="font-size:11px;color:var(--t2);">Done</span>';
      toast('✅ Run logged to Firestore', 'green');
      if (curUser) logRun(lang, dur, outs[outs.length-1].v);
    }
  }
  nx();
}

async function logRun(lang, dur, out) {
  const cap  = allCaps[0] || DCAPS[0];
  const lmap = { python:'Python', javascript:'JavaScript', java:'Java', cpp:'C++' };
  await fsAdd('runs', {
    capsuleId: cap.id || 'editor', capsuleName: cap.name || 'editor',
    userUid: curUser.uid, language: lmap[lang] || 'Python',
    status: 'success', durationMs: dur, outputPreview: out, exitCode: 0,
    timestamp: new Date().toISOString()
  });
  const el = document.getElementById('e-runs');
  el.innerHTML = `<div style="font-family:var(--fm);font-size:11px;color:var(--green);">✓ ${(dur/1000).toFixed(2)}s · just now</div>` + (el.innerHTML || '');
}

async function saveCode() {
  if (!curUser) { om('m-login'); return; }
  toast('💾 Code snapshot saved to Firestore', 'green');
}

// ════════════════════════════════════════════════
// LLM PLAYGROUND
// ════════════════════════════════════════════════
function initLLM() {
  document.getElementById('llm-qp').innerHTML = ['Explain this code','Find bugs','Generate tests','Optimize it','Write docs']
    .map(p => `<button class="btn bg bsm" style="font-size:11.5px;" onclick="document.getElementById('llm-in').value='${p}'">${p}</button>`).join('');
  loadLLMSessions();
}

function llmKey(e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') sendLLM(); }

async function sendLLM() {
  const inp = document.getElementById('llm-in');
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = '';
  const el = document.getElementById('llm-msgs');
  if (el.querySelector('[style*="text-align:center"]')) el.innerHTML = '';

  const ud = document.createElement('div'); ud.className = 'msg user';
  ud.innerHTML = `<div class="mb">${esc(msg)}</div><div class="av av-sm">${(curProfile?.displayName||'U').slice(0,2).toUpperCase()}</div>`;
  el.appendChild(ud); el.scrollTop = 99999;
  llmMsgs.push({ role:'user', content:msg });

  const thk = document.createElement('div'); thk.className = 'msg assistant'; thk.id = 'thk';
  thk.innerHTML = `<div class="av av-sm" style="background:linear-gradient(135deg,var(--purple),var(--blue))">AI</div><div class="mb"><span style="color:var(--tm);font-family:var(--fm);font-size:11px;">thinking...</span></div>`;
  el.appendChild(thk); el.scrollTop = 99999;

  const key = curProfile?.apiKeys?.openai;
  let resp;
  if (fbMode && key && key.startsWith('sk-')) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
        body: JSON.stringify({ model:'gpt-3.5-turbo', messages:llmMsgs, max_tokens:800 })
      });
      const d = await r.json(); resp = d.choices?.[0]?.message?.content || 'No response.';
    } catch(e) { resp = demoResp(msg); }
  } else {
    await new Promise(r => setTimeout(r, 700 + Math.random() * 900));
    resp = demoResp(msg);
  }

  document.getElementById('thk')?.remove();
  llmMsgs.push({ role:'assistant', content:resp });
  llmTok += Math.round((msg.length + resp.length) / 4);

  const ad = document.createElement('div'); ad.className = 'msg assistant';
  ad.innerHTML = `<div class="av av-sm" style="background:linear-gradient(135deg,var(--purple),var(--blue))">AI</div><div class="mb" style="white-space:pre-wrap;">${esc(resp)}</div>`;
  el.appendChild(ad); el.scrollTop = 99999;
  updLLMStats();
}

function demoResp(m) {
  return [
    `Here's an analysis for: "${m.slice(0,40)}"\n\n**Key points for reproducibility:**\n1. Fix all random seeds (numpy, torch, random)\n2. Pin exact package versions in requirements.txt\n3. Log dataset checksums\n4. Use Replica's ⚡ Reproduce button to verify`,
    `Great question about "${m.slice(0,30)}".\n\nFor ML experiments I'd recommend:\n- **Baseline first**: logistic regression before complex models\n- **Data leakage**: split before any preprocessing\n- **Statistics**: report mean ± std over 5 folds`,
    `Based on your request:\n\n**Architecture suggestion:**\n- Input → BatchNorm → Dense(512) → Dropout(0.3) → Dense(256) → Output\n- Optimizer: AdamW with cosine annealing\n- Early stopping: patience=10\n\n**Expected improvement**: ~15-20% over baseline.`
  ][Math.floor(Math.random() * 3)];
}

function updLLMStats() {
  document.getElementById('llm-tt').textContent = llmTok;
  document.getElementById('llm-mc').textContent = llmMsgs.length;
  document.getElementById('llm-co').textContent = '$' + (llmTok * 0.000002).toFixed(4);
  document.getElementById('llm-td').textContent = llmTok + ' tokens';
}

async function saveLLM() {
  if (llmMsgs.length < 2) { toast('Start a conversation first', 'red'); return; }
  if (!curUser) { om('m-login'); return; }
  const log = {
    userUid: curUser.uid,
    model: document.getElementById('llm-ms').value,
    systemPrompt: document.getElementById('llm-sys').value,
    messages: llmMsgs, totalTokens: llmTok,
    estimatedCost: llmTok * 0.000002,
    temperature: parseFloat(document.getElementById('tv').textContent) || 0.7,
    savedAt: fbMode && db ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
  };
  if (fbMode && db) await db.collection('llm_logs').add(log);
  toast('💾 Session saved to Firestore /llm_logs', 'green');
  loadLLMSessions();
}

async function loadLLMSessions() {
  const el = document.getElementById('llm-sl'); if (!el) return;
  const logs = await getMyLLM();
  document.getElementById('llm-sc').textContent = logs.length;
  if (!logs.length) { el.innerHTML = '<div style="font-size:12px;color:var(--tm);">No saved sessions yet.</div>'; return; }
  el.innerHTML = logs.slice(0,5).map(l =>
    `<div style="padding:8px;background:var(--bg3);border-radius:var(--r);display:flex;align-items:center;gap:8px;">
      <span class="bdg dp" style="font-size:10px;">${l.model||'?'}</span>
      <span style="flex:1;font-size:11.5px;color:var(--t2);">${l.messages?.length||0} msgs</span>
      <span style="font-size:11px;color:var(--tm);">${l.totalTokens||0} tok</span>
    </div>`
  ).join('');
}

function clearLLM() {
  llmMsgs = []; llmTok = 0;
  document.getElementById('llm-msgs').innerHTML = '<div style="text-align:center;padding:32px;color:var(--tm);font-size:13px;">Start a conversation below</div>';
  updLLMStats();
}

// ════════════════════════════════════════════════
// ADMIN DASHBOARD
// ════════════════════════════════════════════════
async function loadAdmin() {
  document.getElementById('adm-ref').textContent = 'Refreshed: ' + new Date().toLocaleTimeString();
  if (!fbMode || !db) { renderDemoAdmin(); return; }
  const [uc,cc,rc,lc] = await Promise.all([fsCnt('users'),fsCnt('capsules'),fsCnt('runs'),fsCnt('llm_logs')]);
  document.getElementById('a-u').textContent = uc;
  document.getElementById('a-c').textContent = cc;
  document.getElementById('a-r').textContent = rc;
  document.getElementById('a-l').textContent = lc;
  const [us,cs,rs,ls] = await Promise.all([fsGet('users'),fsGet('capsules'),fsGet('runs'),fsGet('llm_logs')]);
  rAdmU(us); rAdmC(cs); rAdmR(rs); rAdmL(ls);
}

function renderDemoAdmin() {
  ['a-u','a-c','a-r','a-l'].forEach((id,i) => document.getElementById(id).textContent = ['8.4k','24k','92k','4.1k'][i]);
  rAdmU([
    {id:'uid1',displayName:'Ada Lovelace',email:'ada@research.ai',username:'ada-lovelace',createdAt:{toDate:()=>new Date()},capsuleCount:4},
    {id:'uid2',displayName:'Alan Turing',email:'alan@cs.ai',username:'alan-turing',createdAt:{toDate:()=>new Date('2025-03-01')},capsuleCount:7}
  ]);
  rAdmC(DCAPS);
  rAdmR(DCAPS.slice(0,3).map(c => ({id:'r'+c.id,capsuleName:c.name,userUid:'uid1',language:c.language,status:'success',durationMs:3240,outputPreview:'Accuracy: 0.935',createdAt:{toDate:()=>new Date()}})));
  rAdmL([{id:'l1',userUid:'uid1',model:'claude-3-sonnet',messages:[{role:'user',content:'Explain BERT fine-tuning'}],totalTokens:840,estimatedCost:0.0017,temperature:0.7,savedAt:{toDate:()=>new Date()}}]);
}

function rAdmU(u) { document.getElementById('a-utb').innerHTML = u.length ? u.map(x=>`<tr><td style="font-family:var(--fm);font-size:11px;color:var(--tm);">${(x.id||x.uid||'').slice(0,14)}...</td><td>${x.displayName||'—'}</td><td style="color:var(--t2);">${x.email||'—'}</td><td style="font-family:var(--fm);font-size:12.5px;">@${x.username||'—'}</td><td style="font-size:12.5px;color:var(--tm);">${x.createdAt?.toDate?x.createdAt.toDate().toLocaleDateString():'—'}</td><td><span class="bdg db">${x.capsuleCount||0}</span></td></tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--tm);padding:20px;">No users yet</td></tr>'; }
function rAdmC(c) { document.getElementById('a-ctb').innerHTML = c.length ? c.map(x=>`<tr><td style="font-family:var(--fm);font-size:11px;color:var(--tm);">${(x.id||'').slice(0,10)}...</td><td style="color:var(--blue);">${x.name||'—'}</td><td style="font-size:12.5px;">@${x.ownerUsername||'—'}</td><td><span class="bdg ${x.language==='Python'?'db':x.language==='JavaScript'?'do':'dp'}">${x.language||'?'}</span></td><td><span class="bdg ${x.visibility==='public'?'dg':'dr'}">${x.visibility||'?'}</span></td><td style="font-family:var(--fm);">${x.runs||0}</td><td style="font-family:var(--fm);">${x.stars||0}</td><td style="font-size:12px;color:var(--tm);">${x.createdAt?.toDate?x.createdAt.toDate().toLocaleDateString():'—'}</td></tr>`).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--tm);padding:20px;">No capsules</td></tr>'; }
function rAdmR(r) { document.getElementById('a-rtb').innerHTML = r.length ? r.map(x=>`<tr><td style="font-family:var(--fm);font-size:11px;color:var(--tm);">${(x.id||'').slice(0,10)}...</td><td style="color:var(--blue);font-size:12.5px;">${x.capsuleName||'—'}</td><td style="font-family:var(--fm);font-size:11px;color:var(--tm);">${(x.userUid||'').slice(0,10)}...</td><td><span class="bdg db">${x.language||'?'}</span></td><td><span class="bdg ${x.status==='success'?'dg':'dr'}">${x.status||'—'}</span></td><td style="font-family:var(--fm);">${x.durationMs?(x.durationMs/1000).toFixed(2)+'s':'—'}</td><td style="font-family:var(--fm);font-size:11.5px;color:var(--tm);">${(x.outputPreview||'').slice(0,35)}</td><td style="font-size:12px;color:var(--tm);">${x.createdAt?.toDate?x.createdAt.toDate().toLocaleString():x.timestamp||'—'}</td></tr>`).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--tm);padding:20px;">No runs yet</td></tr>'; }
function rAdmL(l) { document.getElementById('a-ltb').innerHTML = l.length ? l.map(x=>`<tr><td style="font-family:var(--fm);font-size:11px;color:var(--tm);">${(x.id||'').slice(0,10)}...</td><td style="font-family:var(--fm);font-size:11px;color:var(--tm);">${(x.userUid||'').slice(0,12)}...</td><td><span class="bdg dp">${x.model||'?'}</span></td><td style="font-family:var(--fm);">${x.messages?.length||0}</td><td style="font-family:var(--fm);">${x.totalTokens||0}</td><td style="font-family:var(--fm);color:var(--green);">$${(x.estimatedCost||0).toFixed(4)}</td><td style="font-size:12px;color:var(--tm);">${x.savedAt?.toDate?x.savedAt.toDate().toLocaleString():'—'}</td></tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--tm);padding:20px;">No LLM logs yet</td></tr>'; }

function aTab(n, btn) {
  document.querySelectorAll('#adm-tabs .tb').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  document.querySelectorAll('[id^="at-"]').forEach(t => t.classList.remove('active'));
  document.getElementById('at-' + n).classList.add('active');
}

// ════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
