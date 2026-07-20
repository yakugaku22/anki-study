/* ===== ① login.html と同じ firebaseConfig を貼ってください ===== */
const firebaseConfig = {
  apiKey: "AIzaSyDq93IcZIgKTTgKuMQOcyY9SQF-tPaNNY0",
  authDomain: "anki-study-143aa.firebaseapp.com",
  projectId: "anki-study-143aa",
  storageBucket: "anki-study-143aa.firebasestorage.app",
  messagingSenderId: "324035910852",
  appId: "1:324035910852:web:7a3819b145135f3790bd91",
  measurementId: "G-SD7QW8FPKD"
};
/* =========================================================== */

/* ---------- data ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const COLOR_MAP = { r:"red", b:"blue", g:"green", o:"orange" };

let state = { subjects: [] };
let curS = null, curC = null;
let mode = "edit";
let shown = {};
let saveTimer = null;
let currentUser = null;
let db = null;
let dataLoaded = false;
let searchQuery = "";

const getS = () => state.subjects.find(s => s.id === curS);
const getC = () => { const s = getS(); return s ? s.categories.find(c => c.id === curC) : null; };

/* テキストから記法（==隠し== と {色:文字}）を外した素のテキスト */
function toPlain(t){
  return t.replace(/==(.+?)==/g, "$1").replace(/\{[rbgo]:(.+?)\}/g, "$1");
}

/* ---------- save status ---------- */
function setSaveStatus(kind){
  const el = document.getElementById("savedTag"); if(!el) return;
  el.className = "saved " + (kind || "");
  const txt = { ok:"保存済み", saving:"保存中…", err:"保存エラー" }[kind] || "";
  el.innerHTML = '<span class="sdot"></span>' + txt;
}

/* ---------- Firestore ---------- */
function docRef(){ return db.collection("users").doc(currentUser.uid); }
async function loadFromCloud(){
  try{
    const snap = await docRef().get();
    if(snap.exists && snap.data() && Array.isArray(snap.data().subjects)){
      state = { subjects: snap.data().subjects };
    }else{ state = { subjects: [] }; }
  }catch(e){ console.warn("読み込みエラー:", e); state = { subjects: [] }; }
  curS = state.subjects[0] ? state.subjects[0].id : null;
  curC = (curS && getS().categories[0]) ? getS().categories[0].id : null;
  dataLoaded = true; render();
}
async function saveToCloud(){
  if(!dataLoaded || !currentUser || !db) return;
  setSaveStatus("saving");
  try{ await docRef().set({ subjects: state.subjects, updatedAt: Date.now() }); setSaveStatus("ok"); }
  catch(e){ console.warn("保存エラー:", e); setSaveStatus("err"); }
}
function scheduleSave(){
  setSaveStatus("saving");
  if(saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToCloud, 800);
}

/* ---------- auth ---------- */
function initFirebase(){
  if(!firebaseConfig.apiKey || firebaseConfig.apiKey === "ここに貼る"){
    console.warn("Firebase設定が未入力です。");
    document.documentElement.classList.remove("gate"); dataLoaded = true; render(); return;
  }
  try{
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    firebase.auth().onAuthStateChanged(function(user){
      if(!user){ location.replace("login.html"); return; }
      currentUser = user;
      document.documentElement.classList.remove("gate");
      renderAuth(); loadFromCloud();
    });
  }catch(e){ console.warn("初期化エラー:", e); document.documentElement.classList.remove("gate"); dataLoaded = true; render(); }
}
function logout(){ if(firebase.apps.length){ firebase.auth().signOut().then(function(){ location.replace("login.html"); }); } }
function renderAuth(){
  const a = document.getElementById("authArea"); if(!a) return; a.innerHTML = "";
  if(!currentUser) return;
  const b = document.createElement("button"); b.className = "acct"; b.title = "クリックでログアウト";
  b.onclick = function(){ if(confirm("ログアウトしますか？")) logout(); };
  if(currentUser.photoURL){
    const img = document.createElement("img"); img.className = "avatar";
    img.src = currentUser.photoURL; img.referrerPolicy = "no-referrer"; b.appendChild(img);
  }
  const sp = document.createElement("span");
  sp.textContent = currentUser.displayName ? currentUser.displayName.split(" ")[0] : "ログイン中";
  b.appendChild(sp); a.appendChild(b);
}

/* ---------- actions ---------- */
function selectSubject(id){ curS = id; const s = getS(); curC = s.categories[0] ? s.categories[0].id : null; shown = {}; render(); }
function selectCat(id){ curC = id; shown = {}; render(); }
function setMode(m){ mode = m; shown = {}; render(); }

function addSubject(){
  const name = prompt("科目名を入力（勉強したい内容）"); if(!name) return;
  const c = { id: uid(), name: "分野1", notes: "" };
  const s = { id: uid(), name: name.trim(), categories: [c] };
  state.subjects.push(s); curS = s.id; curC = c.id; scheduleSave(); render();
}
function addCategory(){
  if(!getS()) return;
  const name = prompt("分野名を入力"); if(!name) return;
  const c = { id: uid(), name: name.trim(), notes: "" };
  getS().categories.push(c); curC = c.id; scheduleSave(); render();
}
function renameSubject(){
  const s = getS(); if(!s) return; const name = prompt("科目名を変更", s.name); if(!name) return;
  s.name = name.trim(); scheduleSave(); render();
}
function renameCat(){
  const c = getC(); if(!c) return; const name = prompt("分野名を変更", c.name); if(!name) return;
  c.name = name.trim(); scheduleSave(); render();
}
function deleteSubject(){
  const s = getS(); if(!s) return;
  if(!confirm("科目「" + s.name + "」を削除しますか？")) return;
  state.subjects = state.subjects.filter(x => x.id !== curS);
  curS = state.subjects[0] ? state.subjects[0].id : null;
  curC = curS ? getS().categories[0].id : null;
  scheduleSave(); render();
}
function deleteCat(){
  const s = getS(); if(!s) return;
  if(s.categories.length <= 1){ alert("最後の分野は削除できません（科目ごと消す場合は科目の🗑を使ってください）"); return; }
  const c = getC(); if(!confirm("分野「" + c.name + "」を削除しますか？")) return;
  s.categories = s.categories.filter(x => x.id !== curC);
  curC = s.categories[0].id; scheduleSave(); render();
}

/* 選択範囲を ==...== で囲む（隠し語句） */
function wrapSelection(){
  const ta = document.getElementById("editor"); if(!ta) return;
  const a = ta.selectionStart, b = ta.selectionEnd; if(a === b) return;
  const v = ta.value;
  getC().notes = v.slice(0, a) + "==" + v.slice(a, b) + "==" + v.slice(b);
  scheduleSave(); render();
  requestAnimationFrame(() => { const t = document.getElementById("editor"); t.focus(); t.setSelectionRange(a, b + 4); });
}
/* 選択範囲に色を付ける（code: r/b/g/o） */
function applyColor(code){
  const ta = document.getElementById("editor"); if(!ta) return;
  const a = ta.selectionStart, b = ta.selectionEnd; if(a === b) return;
  const v = ta.value; const sel = v.slice(a, b);
  getC().notes = v.slice(0, a) + "{" + code + ":" + sel + "}" + v.slice(b);
  scheduleSave(); render();
  requestAnimationFrame(() => { const t = document.getElementById("editor"); t.focus(); t.setSelectionRange(a + 3, b + 3); });
}
/* 選択範囲の色付けを解除 */
function clearColor(){
  const ta = document.getElementById("editor"); if(!ta) return;
  const a = ta.selectionStart, b = ta.selectionEnd; if(a === b) return;
  const v = ta.value; const sel = v.slice(a, b);
  const stripped = sel.replace(/\{[rbgo]:(.+?)\}/g, "$1");
  getC().notes = v.slice(0, a) + stripped + v.slice(b);
  scheduleSave(); render();
  requestAnimationFrame(() => { const t = document.getElementById("editor"); t.focus(); t.setSelectionRange(a, a + stripped.length); });
}

/* ---------- search ---------- */
function onSearch(v){ searchQuery = v; renderSearch(); }
function clearSearch(){ searchQuery = ""; const i = document.getElementById("searchInput"); if(i) i.value = ""; renderSearch(); }
function jumpTo(sId, cId){
  clearSearch();
  curS = sId; curC = cId; shown = {}; mode = "study";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function escHtml(s){ return s.replace(/[&<>]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;" }[c])); }
function makeSnippet(text, q){
  const plain = toPlain(text);
  const low = plain.toLowerCase(), ql = q.toLowerCase();
  const i = low.indexOf(ql); if(i < 0) return null;
  const start = Math.max(0, i - 20);
  const end = Math.min(plain.length, i + q.length + 40);
  let snip = (start > 0 ? "…" : "") + plain.slice(start, end) + (end < plain.length ? "…" : "");
  const esc = escHtml(snip);
  const re = new RegExp(escHtml(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return esc.replace(re, m => "<mark>" + m + "</mark>");
}
function renderSearch(){
  const clr = document.getElementById("searchClr");
  const results = document.getElementById("results");
  const browse = document.getElementById("browse");
  const q = searchQuery.trim();
  if(!q){ clr.style.display = "none"; results.innerHTML = ""; browse.style.display = ""; return; }
  clr.style.display = ""; browse.style.display = "none"; results.innerHTML = "";
  const box = document.createElement("div"); box.className = "results";
  const ql = q.toLowerCase(); let hits = 0;
  state.subjects.forEach(sub => {
    sub.categories.forEach(cat => {
      const hay = (sub.name + "\n" + cat.name + "\n" + toPlain(cat.notes)).toLowerCase();
      if(hay.indexOf(ql) < 0) return;
      hits++;
      const item = document.createElement("div"); item.className = "ritem";
      item.onclick = () => jumpTo(sub.id, cat.id);
      const path = document.createElement("div"); path.className = "rpath";
      path.textContent = sub.name + " / " + cat.name; item.appendChild(path);
      const snipHtml = makeSnippet(cat.notes, q) || makeSnippet(sub.name + " " + cat.name, q);
      if(snipHtml){ const snip = document.createElement("div"); snip.className = "rsnip"; snip.innerHTML = snipHtml; item.appendChild(snip); }
      box.appendChild(item);
    });
  });
  if(hits === 0){ const none = document.createElement("div"); none.className = "rnone"; none.textContent = "「" + q + "」に一致する内容は見つかりませんでした。"; box.appendChild(none); }
  results.appendChild(box);
}

/* ---------- parse & render text ---------- */
/* 行を「通常/隠し」に分割 */
function parseHide(text){
  const out = []; const re = /==(.+?)==/g; let last = 0, m;
  while((m = re.exec(text)) !== null){
    if(m.index > last) out.push({ type:"norm", text:text.slice(last, m.index) });
    out.push({ type:"hide", text:m[1] });
    last = re.lastIndex;
  }
  if(last < text.length) out.push({ type:"norm", text:text.slice(last) });
  return out;
}
/* テキストを色トークンで分割 */
function parseColor(text){
  const out = []; const re = /\{([rbgo]):(.+?)\}/g; let last = 0, m;
  while((m = re.exec(text)) !== null){
    if(m.index > last) out.push({ color:null, text:text.slice(last, m.index) });
    out.push({ color:COLOR_MAP[m[1]], text:m[2] });
    last = re.lastIndex;
  }
  if(last < text.length) out.push({ color:null, text:text.slice(last) });
  return out;
}
/* 色付きテキストを parent に追加 */
function appendColored(parent, text){
  parseColor(text).forEach(seg => {
    if(seg.color){ const s = document.createElement("span"); s.className = "c-" + seg.color; s.textContent = seg.text; parent.appendChild(s); }
    else parent.appendChild(document.createTextNode(seg.text));
  });
}

/* ---------- render ---------- */
function render(){
  renderSearch();

  const s = getS();
  document.getElementById("subjName").textContent = s ? s.name : "—";
  document.getElementById("mEdit").className = mode === "edit" ? "on" : "";
  document.getElementById("mStudy").className = mode === "study" ? "on" : "";

  const st = document.getElementById("subjectTabs"); st.innerHTML = "";
  state.subjects.forEach(sub => {
    const b = document.createElement("button");
    b.className = "tab" + (sub.id === curS ? " on" : "");
    b.textContent = sub.name; b.onclick = () => selectSubject(sub.id);
    st.appendChild(b);
  });
  st.appendChild(mkIcon("＋", addSubject));
  if(s){ st.appendChild(mkIcon("✎", renameSubject)); st.appendChild(mkIcon("🗑", deleteSubject)); }

  const ct = document.getElementById("catTabs"); ct.innerHTML = "";
  const bar = document.getElementById("toolbar"); bar.innerHTML = "";
  const main = document.getElementById("main"); main.innerHTML = "";

  if(!dataLoaded){ const p = document.createElement("div"); p.className = "empty"; p.textContent = "読み込み中…"; main.appendChild(p); return; }

  if(!s){
    const blank = document.createElement("div"); blank.className = "card blank";
    const p = document.createElement("p"); p.textContent = "まだ科目がありません。勉強したい内容を追加してください。";
    const btn = mkBtn("最初の科目を追加", addSubject); btn.className = "btn primary";
    blank.appendChild(p); blank.appendChild(btn); main.appendChild(blank); return;
  }

  s.categories.forEach(cat => {
    const b = document.createElement("button");
    b.className = "tab" + (cat.id === curC ? " on" : "");
    b.textContent = cat.name; b.onclick = () => selectCat(cat.id);
    ct.appendChild(b);
  });
  ct.appendChild(mkIcon("＋", addCategory));
  ct.appendChild(mkIcon("✎", renameCat));
  ct.appendChild(mkIcon("🗑", deleteCat));

  const cat = getC();

  if(mode === "edit"){
    bar.appendChild(mkBtn("選択を隠す", wrapSelection));
    // 色パレット
    const pal = document.createElement("div"); pal.className = "palette";
    [["red","r"],["blue","b"],["green","g"],["orange","o"]].forEach(([cls, code]) => {
      const sw = document.createElement("button"); sw.className = "swatch " + cls;
      sw.title = "選択部分を" + ({red:"赤",blue:"青",green:"緑",orange:"オレンジ"}[cls]) + "にする";
      sw.onclick = () => applyColor(code); pal.appendChild(sw);
    });
    const clr = document.createElement("button"); clr.className = "swatch clear"; clr.textContent = "解除"; clr.title = "選択部分の色を解除";
    clr.onclick = clearColor; pal.appendChild(clr);
    bar.appendChild(pal);

    const grow = document.createElement("div"); grow.className = "grow"; bar.appendChild(grow);
    const tag = document.createElement("span"); tag.className = "saved ok"; tag.id = "savedTag";
    tag.innerHTML = '<span class="sdot"></span>保存済み'; bar.appendChild(tag);

    const card = document.createElement("div"); card.className = "card";
    const ta = document.createElement("textarea"); ta.className = "editor"; ta.id = "editor";
    ta.spellcheck = false; ta.value = cat ? cat.notes : "";
    ta.placeholder = "ここに覚えたい内容を入力…";
    ta.oninput = () => { if(getC()){ getC().notes = ta.value; scheduleSave(); } };
    card.appendChild(ta); main.appendChild(card);

    const hint = document.createElement("div"); hint.className = "hint";
    hint.innerHTML = '文字を選択して、<code>選択を隠す</code>で暗記の伏せ字に、色ボタンで着色できます。行頭 <code># </code> で見出し。変更は自動でクラウド保存されます。';
    main.appendChild(hint);
  } else {
    bar.appendChild(mkBtn("全部表示 / 隠す", toggleAll));
    const grow = document.createElement("div"); grow.className = "grow"; bar.appendChild(grow);

    const lines = (cat ? cat.notes : "").split("\n");
    let gi = 0;
    const doc = document.createElement("div"); doc.className = "card doc";
    lines.forEach(raw => {
      if(raw.startsWith("# ")){
        const h = document.createElement("div"); h.className = "h2"; appendColored(h, raw.slice(2)); doc.appendChild(h); return;
      }
      const line = document.createElement("div"); line.className = "line";
      const segs = parseHide(raw);
      if(segs.length === 0){ line.innerHTML = "&nbsp;"; }
      segs.forEach(seg => {
        if(seg.type === "norm"){ appendColored(line, seg.text); }
        else{
          const idx = gi++;
          const sp = document.createElement("span");
          sp.className = "mark " + (shown[idx] ? "show" : "hide");
          appendColored(sp, seg.text);
          sp.onclick = () => { shown[idx] = !shown[idx]; render(); };
          line.appendChild(sp);
        }
      });
      doc.appendChild(line);
    });
    if(gi === 0){ const e = document.createElement("div"); e.className = "empty"; e.textContent = "隠し語句がありません。編集モードで「選択を隠す」を使ってください。"; doc.appendChild(e); }
    main.appendChild(doc);

    const prog = document.createElement("div"); prog.className = "progress";
    const shownCount = Object.values(shown).filter(Boolean).length;
    prog.innerHTML = '<span class="dot"></span>表示 ' + shownCount + ' / ' + gi;
    bar.appendChild(prog);
  }
}

function toggleAll(){
  const cat = getC(); if(!cat) return;
  let total = 0; const re = /==(.+?)==/g; while(re.exec(cat.notes) !== null) total++;
  const allShown = Object.values(shown).filter(Boolean).length === total && total > 0;
  shown = {};
  if(!allShown){ for(let i=0;i<total;i++) shown[i] = true; }
  render();
}

function mkBtn(label, fn){ const b = document.createElement("button"); b.className = "btn"; b.textContent = label; b.onclick = fn; return b; }
function mkIcon(label, fn){ const b = document.createElement("button"); b.className = "iconbtn"; b.textContent = label; b.onclick = fn; return b; }

/* ---------- wire up header/search ---------- */
document.getElementById("mEdit").addEventListener("click", () => setMode("edit"));
document.getElementById("mStudy").addEventListener("click", () => setMode("study"));
document.getElementById("searchInput").addEventListener("input", (e) => onSearch(e.target.value));
document.getElementById("searchClr").addEventListener("click", clearSearch);

render();
initFirebase();