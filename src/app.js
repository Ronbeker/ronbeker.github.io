/* ===================== מערכות הפעלה — מרכז הכנה למבחן ===================== */
(function () {
'use strict';

const SUMS  = JSON.parse(document.getElementById('d-summaries').textContent);
const QUIZ  = JSON.parse(document.getElementById('d-quiz').textContent);
const EXAMS = JSON.parse(document.getElementById('d-exams').textContent);
const TSVI  = document.getElementById('d-tsvi').textContent;

const KEY = 'os-prep-v1';
const byId = {}; SUMS.forEach(s => byId[s.sid] = s);
const quizBy = {}; QUIZ.forEach(q => quizBy[q.sid] = q);
const examBy = {}; EXAMS.forEach(e => examBy[e.id] = e);

/* ---------- state ---------- */
const DEF = { read:{}, understood:{}, topics:{}, exams:{}, master:false, notes:'', examDate:'', lastView:'dash', updatedAt:0, mt:{} };
let S = load();
function load(){
  try { const raw = localStorage.getItem(KEY); if(!raw) return structuredClone(DEF);
    const s = Object.assign(structuredClone(DEF), JSON.parse(raw));
    if(!s.mt || typeof s.mt !== 'object') s.mt = {};
    return s; }
  catch(e){ return structuredClone(DEF); }
}
/* ---------- חותמת זמן פר־פריט ----------
   בלי זה הסנכרון היה "המכשיר האחרון ששמר דורס את הכול", ולכן התקדמות
   נעלמה. עכשיו כל סימון נושא / קריאה / תשובה נושא חותמת זמן משלו,
   והמיזוג מכריע לכל פריט בנפרד מי החדש יותר.                          */
const akey = (eid,pid) => 'a:'+eid+'|'+pid;
function touch(){ const n = Date.now();
  for(const k of arguments) if(k) S.mt[k] = n; }
function touchExam(eid, answers){
  touch('e:'+eid);
  if(answers){ const n = Date.now(); Object.keys(answers).forEach(pid => S.mt[akey(eid,pid)] = n); }
}
let saveT;
function writeLocal(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); return true; }
  catch(e){ toast('שגיאה בשמירה מקומית — ייתכן שהאחסון מלא','e'); return false; } }
/* שמירה מקומית בלבד — להעדפות תצוגה (לשונית אחרונה וכד'). לא מזיזה את
   updatedAt ולא דוחפת לענן, כדי שמכשיר ישן שרק דפדפו בו לא ייראה
   "חדש יותר" מהענן וידרוס התקדמות אמיתית.                             */
function saveLocal(){ clearTimeout(saveT); saveT = setTimeout(writeLocal, 150); }
function save(){ S.updatedAt = Date.now(); clearTimeout(saveT);
  saveT = setTimeout(()=>{ writeLocal(); cloudPush(); }, 150); }
function saveNow(){ S.updatedAt = Date.now(); clearTimeout(saveT); writeLocal(); cloudPush(); }

/* ---------- helpers ---------- */
const $  = (s, r) => (r||document).querySelector(s);
const $$ = (s, r) => Array.from((r||document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n => `<span class="num">${n}</span>`;
const pct = (a,b) => b ? Math.round(a*100/b) : 0;
function htmlToText(h){
  const d = document.createElement('div'); d.innerHTML = h;
  d.querySelectorAll('pre').forEach(p => p.replaceWith(document.createTextNode('\n```\n'+p.textContent.replace(/\n+$/,'')+'\n```\n')));
  d.querySelectorAll('br').forEach(b => b.replaceWith(document.createTextNode('\n')));
  d.querySelectorAll('li').forEach(li => li.prepend(document.createTextNode('- ')));
  d.querySelectorAll('tr').forEach(tr => {
    const cells = Array.from(tr.children).map(c => c.textContent.trim());
    tr.replaceWith(document.createTextNode('| ' + cells.join(' | ') + ' |\n'));
  });
  d.querySelectorAll('p,div,h1,h2,h3,h4,ul,ol').forEach(p => p.append(document.createTextNode('\n')));
  return d.textContent.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function toast(msg, kind){
  const t = document.createElement('div'); t.className = 'toast'+(kind?' '+kind:'');
  t.textContent = msg;
  Object.assign(t.style,{position:'fixed',insetInlineStart:'50%',transform:'translateX(-50%)',bottom:'26px',
    background: kind==='e' ? '#a32626' : '#123f55', color:'#fff', padding:'11px 20px', borderRadius:'10px',
    zIndex:200, boxShadow:'0 8px 28px rgba(0,0,0,.28)', fontWeight:'650', maxWidth:'90vw'});
  document.body.appendChild(t); setTimeout(()=>{ t.style.transition='opacity .4s'; t.style.opacity='0';
    setTimeout(()=>t.remove(), 420); }, 2600);
}
function download(name, text){
  const b = new Blob([text], {type:'text/markdown;charset=utf-8'});
  const u = URL.createObjectURL(b); const a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(u); a.remove(); }, 500);
}
const tkey = (sid,i) => sid+'|'+i;

/* ---------- progress ---------- */
function stats(){
  const nS = SUMS.length;
  const read = SUMS.filter(s=>S.read[s.sid]).length;
  const und  = SUMS.filter(s=>S.understood[s.sid]).length;
  let nT=0, dT=0;
  SUMS.forEach(s=>{ s.topics.forEach((_,i)=>{ nT++; if(S.topics[tkey(s.sid,i)]?.done) dT++; }); });
  const nE = EXAMS.length, dE = EXAMS.filter(e=>S.exams[e.id]?.done).length;
  const total = read+und+dT+dE, max = nS+nS+nT+nE;
  return {nS,read,und,nT,dT,nE,dE,overall:pct(total,max)};
}
function refreshChrome(){
  const st = stats();
  $('#mini-bar i').style.width = st.overall+'%';
  $('#mini-pct').innerHTML = st.overall+'%';
  $('#tb-sum').innerHTML  = `${st.read}/${st.nS}`;
  $('#tb-top').innerHTML  = `${st.dT}/${st.nT}`;
  $('#tb-exam').innerHTML = `${st.dE}/${st.nE}`;
}

/* ===================== views ===================== */
const views = {};

/* ---------- Dashboard ---------- */
views.dash = () => {
  const st = stats();
  const weak = [];
  SUMS.forEach(s=>s.topics.forEach((t,i)=>{ const r=S.topics[tkey(s.sid,i)];
    if(r && !r.done && r.tries) weak.push({sid:s.sid,i,t,score:r.score,tries:r.tries}); }));
  const nextS = SUMS.find(s=>!S.read[s.sid]);
  const nextT = (()=>{ for(const s of SUMS) for(let i=0;i<s.topics.length;i++)
      if(!S.topics[tkey(s.sid,i)]?.done) return {s,i}; return null; })();
  const nextE = EXAMS.find(e=>!S.exams[e.id]?.done);
  let days = '', dcls='';
  if(S.examDate){ const d = Math.ceil((new Date(S.examDate+'T08:00') - new Date())/864e5);
    days = d>0 ? d : (d===0?0:d); dcls = d<0?'עבר':'ימים'; }

  return `
  <div class="grid g4" style="margin-bottom:16px">
    ${statCard('סיכומים שנקראו', st.read, st.nS)}
    ${statCard('סיכומים שהובנו', st.und, st.nS, true)}
    ${statCard('נושאים שהובנו', st.dT, st.nT, true)}
    ${statCard('מבחנים שהוכנו', st.dE, st.nE)}
  </div>

  <div class="card countdown" style="margin-bottom:18px">
    <div>
      <div class="big">${S.examDate ? (typeof days==='number'&&days>=0 ? num(days) : '—') : '—'}</div>
      <label>${S.examDate ? (typeof days==='number' && days<0 ? 'תאריך המבחן חלף' : 'ימים למבחן') : 'לא הוגדר תאריך מבחן'}</label>
    </div>
    <div class="grow" style="flex:1"></div>
    <div>
      <label style="display:block;margin-bottom:4px">תאריך המבחן</label>
      <input type="date" id="exam-date" value="${esc(S.examDate)}">
    </div>
    <div style="text-align:center">
      <div class="big">${num(st.overall)}%</div>
      <label>התקדמות כוללת</label>
    </div>
  </div>

  <h2 class="sec">מה הצעד הבא</h2>
  <div class="card next-list" style="margin-bottom:18px">
    ${nextS ? nextItem('קרא את הסיכום הבא', nextS.title, `go('summaries');openReader('${nextS.sid}')`, 'פתח סיכום')
            : nextItem('כל הסיכומים נקראו', 'אפשר לעבור לבדיקת הבנה של הנושאים', `go('topics')`, 'לנושאים')}
    ${nextT ? nextItem('בדוק הבנה בנושא הבא', nextT.s.topics[nextT.i], `go('topics');openQuiz('${nextT.s.sid}',${nextT.i})`, 'התחל בדיקה')
            : nextItem('כל הנושאים סומנו כמובנים', 'כל הכבוד — עכשיו מבחנים', `go('exams')`, 'למבחנים')}
    ${nextE ? nextItem('המבחן הבא לתרגול', nextE.label, `go('exams');openExam('${nextE.id}')`, 'פתח טופס')
            : nextItem('כל המבחנים הוכנו', 'אפשר לחזור על נושאים חלשים', `go('tools')`, 'לכלים')}
  </div>

  ${weak.length ? `<h2 class="sec">נושאים לחיזוק <span class="pill e">${num(weak.length)}</span></h2>
  <div class="card next-list" style="margin-bottom:18px">
    ${weak.slice(0,12).map(w=>`<div class="next-item">
      <span class="pill e">${num(w.score)}/3</span>
      <div class="t"><b>${esc(w.t)}</b><span>${esc(byId[w.sid].title)} · ${num(w.tries)} ניסיונות</span></div>
      <button class="btn sm ghost" onclick="go('topics');openQuiz('${w.sid}',${w.i})">נסה שוב</button>
    </div>`).join('')}
  </div>` : ''}

  <h2 class="sec">מפת החומר</h2>
  <div class="card" style="padding:16px 18px">
    ${['הרצאות','תרגולים'].map(g=>{
      const list = SUMS.filter(s=>s.group===g); if(!list.length) return '';
      return `<div style="margin-bottom:14px"><div class="small muted" style="font-weight:750;margin-bottom:7px">${g}</div>
      <div style="display:flex;flex-wrap:wrap;gap:7px">${list.map(s=>{
        const tot=s.topics.length, d=s.topics.filter((_,i)=>S.topics[tkey(s.sid,i)]?.done).length;
        const cls = d===tot ? 'g' : d ? 'w' : 'n';
        return `<button class="pill ${cls}" style="cursor:pointer;font-size:.8rem"
          onclick="go('topics');openAcc('${s.sid}')" title="${esc(s.title)}">${esc(s.sid.replace('ch','פרק ').replace('rec','תרגול '))} · ${num(d+'/'+tot)}</button>`;
      }).join('')}</div></div>`;}).join('')}
  </div>`;
};
function statCard(k, a, b, ok){
  return `<div class="card stat"><div class="k">${k}</div>
    <div class="v">${num(a)}<small> / ${num(b)}</small></div>
    <div class="bar${ok?' ok':''}"><i style="width:${pct(a,b)}%"></i></div></div>`;
}
function nextItem(kicker, title, action, btn){
  return `<div class="next-item"><div class="t"><b>${esc(title)}</b><span>${esc(kicker)}</span></div>
    <button class="btn sm" onclick="${action}">${btn}</button></div>`;
}

/* ---------- Summaries ---------- */
views.summaries = () => {
  const groups = ['הרצאות','תרגולים'];
  return groups.map(g=>{
    const list = SUMS.filter(s=>s.group===g);
    return `<h2 class="sec">${g} <span class="pill n">${num(list.length)}</span></h2>
    <div class="grid g3" style="margin-bottom:8px">${list.map(s=>{
      const r=!!S.read[s.sid], u=!!S.understood[s.sid];
      const tot=s.topics.length, d=s.topics.filter((_,i)=>S.topics[tkey(s.sid,i)]?.done).length;
      return `<div class="card sum-card">
        <h3>${esc(s.title)}</h3>
        <div class="sum-meta">
          <span class="pill n">${num(tot)} נושאים</span>
          <span class="pill ${d===tot?'g':d?'w':'n'}">${num(d+'/'+tot)} נבדקו</span>
        </div>
        <div class="sum-actions">
          <label class="chk${r?' done':''}"><input type="checkbox" ${r?'checked':''}
            onchange="setRead('${s.sid}',this.checked)"><span class="box"></span>קראתי</label>
          <label class="chk${u?' done':''}"><input type="checkbox" ${u?'checked':''}
            onchange="setUnd('${s.sid}',this.checked)"><span class="box"></span>הבנתי</label>
          <button class="btn sm" onclick="openReader('${s.sid}')">פתח סיכום</button>
        </div></div>`;}).join('')}</div>`;
  }).join('') + `
  <h2 class="sec">סיכום כולל</h2>
  <div class="card sum-card" style="max-width:520px">
    <h3>כל החומר בעמוד אחד</h3>
    <div class="sum-meta"><span class="pill n">${num(SUMS.length)} סיכומים</span>
      <span class="pill n">${num(SUMS.reduce((a,s)=>a+s.topics.length,0))} נושאים</span></div>
    <div class="sum-actions">
      <label class="chk${S.master?' done':''}"><input type="checkbox" ${S.master?'checked':''}
        onchange="setMaster(this.checked)"><span class="box"></span>קראתי (אופציונלי)</label>
      <button class="btn sm" onclick="openReader('__all__')">פתח הכל</button>
    </div></div>`;
};
window.setRead = (sid,v)=>{ S.read[sid]=v; if(!v) delete S.read[sid]; touch('r:'+sid); save(); refreshChrome(); render(); };
window.setUnd  = (sid,v)=>{ S.understood[sid]=v; if(!v) delete S.understood[sid]; touch('u:'+sid); save(); refreshChrome(); render(); };


/* ---------- ניווט הלוך-חזור בין נושא לסיכום ---------- */
let returnTo = null;
function flash(el){ if(!el) return; el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'), 1700); }

window.gotoTopicInSummary = (sid, i) => {
  returnTo = { sid, i, title: byId[sid].topics[i] };
  openReader(sid);
  setTimeout(()=>{
    const e = document.getElementById(sid+'-t'+i);
    if(e){ e.scrollIntoView(); window.scrollBy(0,-110); flash(e); }
  }, 70);
};
window.backToTopic = () => {
  const r = returnTo; returnTo = null;
  if(!r) return go('topics');
  openAccs[r.sid] = true; go('topics');
  requestAnimationFrame(()=>{
    const row = document.getElementById('tp-'+r.sid+'-'+r.i);
    if(row){ row.scrollIntoView({block:'center'}); flash(row); }
  });
};
window.quizFromReader = () => { if(returnTo) openQuiz(returnTo.sid, returnTo.i); };
window.clearReturn = () => { returnTo = null; render(); };

/* ---------- Reader ---------- */
let readerSid = null;
window.openReader = (sid) => {
  readerSid = sid; go('reader');
  requestAnimationFrame(()=>window.scrollTo(0,0));
};
views.reader = () => {
  if(readerSid === '__all__'){
    return `<div class="reader-top">
      <button class="btn ghost sm" onclick="go('summaries')">‹ חזרה לסיכומים</button>
      <div class="grow" style="flex:1"></div>
      <label class="chk${S.master?' done':''}"><input type="checkbox" ${S.master?'checked':''}
        onchange="setMaster(this.checked,1)"><span class="box"></span>קראתי את הסיכום הכולל</label>
      <button class="btn ghost sm" onclick="window.print()">הדפס</button></div>
    <div class="card toc"><b>תוכן עניינים</b><ol>${SUMS.map(s=>
      `<li><a href="#top-${s.sid}">${esc(s.title)}</a></li>`).join('')}</ol></div>
    ${SUMS.map(s=>`<div id="top-${s.sid}" class="summary-body" style="margin-bottom:20px">${s.html}</div>`).join('')}`;
  }
  const s = byId[readerSid]; if(!s) return '<div class="empty">לא נמצא</div>';
  const r=!!S.read[s.sid], u=!!S.understood[s.sid];
  const ret = !!(returnTo && returnTo.sid === s.sid);
  return `<div class="reader-top">
    ${ret ? `<button class="btn sm" onclick="backToTopic()">‹ חזרה לנושא</button>` : ''}
    <button class="btn ghost sm" onclick="go('summaries')">‹ חזרה לסיכומים</button>
    <div class="grow" style="flex:1"></div>
    <label class="chk${r?' done':''}"><input type="checkbox" ${r?'checked':''}
      onchange="setRead('${s.sid}',this.checked)"><span class="box"></span>קראתי</label>
    <label class="chk${u?' done':''}"><input type="checkbox" ${u?'checked':''}
      onchange="setUnd('${s.sid}',this.checked)"><span class="box"></span>הבנתי</label>
    <button class="btn sm ghost" onclick="go('topics');openAcc('${s.sid}')">בדוק הבנה בנושאים</button>
    <button class="btn ghost sm" onclick="window.print()">הדפס</button></div>
  <div class="card toc"><b>נושאי הפרק</b><ol>${s.topics.map((t,i)=>{
    const done = S.topics[tkey(s.sid,i)]?.done;
    return `<li><a href="#${s.sid}-t${i}">${esc(t)}</a>${done?' <span class="pill g" style="font-size:.7rem">✓</span>':''}</li>`;
  }).join('')}</ol></div>
  <div class="summary-body">${s.html}</div>
  <div style="display:flex;gap:9px;justify-content:center;margin:22px 0 0;flex-wrap:wrap">
    <button class="btn" onclick="setRead('${s.sid}',true);setUnd('${s.sid}',true);toast('סומן כנקרא ומובן');go('summaries')">
      סיימתי — סמן שקראתי והבנתי</button>
    <button class="btn ghost" onclick="go('topics');openAcc('${s.sid}')">עבור לבדיקת הנושאים</button>
  </div>
  ${ret ? `<div class="ret-bar" role="region" aria-label="חזרה לנושא">
    <span class="rt">הגעת מהנושא <b>${esc(returnTo.title)}</b></span>
    <button class="btn sm" onclick="quizFromReader()">בדוק הבנה</button>
    <button class="btn ghost sm" onclick="backToTopic()">חזרה לנושא ›</button>
    <button class="x" onclick="clearReturn()" aria-label="סגור">×</button>
  </div>` : ''}`;
};

/* ---------- Topics ---------- */
let openAccs = {};
window.openAcc = (sid) => { openAccs[sid]=true; go('topics');
  requestAnimationFrame(()=>{ const el=document.getElementById('acc-'+sid);
    if(el){ el.scrollIntoView({block:'start'}); window.scrollBy(0,-110);} }); };
views.topics = () => {
  const st = stats();
  return `<div class="card" style="padding:14px 18px;margin-bottom:16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
    <div><b>${num(st.dT)}</b> מתוך <b>${num(st.nT)}</b> נושאים סומנו כמובנים</div>
    <div class="bar" style="flex:1;min-width:160px"><i style="width:${pct(st.dT,st.nT)}%"></i></div>
    <button class="btn ghost sm" onclick="setAllAcc(false)">כווץ הכל</button>
    <button class="btn ghost sm" onclick="setAllAcc(true)">הרחב הכל</button>
  </div>
  <div class="card" style="padding:12px 16px;margin-bottom:16px;background:var(--brand-pale)">
    <span class="small">לחיצה על <b>בדוק הבנה</b> פותחת 3 שאלות על הנושא. צריך <b>3 מתוך 3</b> כדי לסמן שהבנת —
    אחרת מוצג הסבר מלא ואפשר לנסות שוב.</span></div>
  ` + SUMS.map(s=>{
    const tot=s.topics.length, d=s.topics.filter((_,i)=>S.topics[tkey(s.sid,i)]?.done).length;
    const open = openAccs[s.sid];
    return `<div class="card acc${open?' open':''}" id="acc-${s.sid}">
      <button class="acc-h" onclick="toggleAcc('${s.sid}')">
        <span class="arw">▾</span>
        <span class="ttl">${esc(s.title)}</span>
        <span class="pill ${d===tot?'g':d?'w':'n'}">${num(d+'/'+tot)}</span>
      </button>
      <div class="acc-b">${s.topics.map((t,i)=>{
        const r = S.topics[tkey(s.sid,i)]; const done = r?.done;
        return `<div class="tp${done?' done':''}" id="tp-${s.sid}-${i}">
          <span class="n">${num(i+1)}</span>
          <span class="t">${esc(t)}</span>
          ${done ? `<span class="pill g">הבנתי</span>` : r?.tries ? `<span class="pill e">${num(r.score)}/3</span>` : ''}
          <span class="acts">
            <button class="btn sm ghost" onclick="gotoTopicInSummary('${s.sid}',${i})">לסיכום</button>
            <button class="btn sm ${done?'ghost':''}" onclick="openQuiz('${s.sid}',${i})">${done?'תרגל שוב':'בדוק הבנה'}</button>
          </span></div>`;}).join('')}</div></div>`;
  }).join('');
};

/* ---------- Quiz engine ---------- */
let QZ = null;
window.openQuiz = (sid, i) => {
  const qt = quizBy[sid]?.topics[i]; if(!qt) return toast('אין שאלות לנושא הזה','e');
  QZ = { sid, i, title: byId[sid].topics[i], qs: qt.q.map(q=>({...q})), picked:[], checked:false };
  renderQuiz();
  $('#ov').hidden = false; document.body.style.overflow='hidden';
};
function renderQuiz(){
  const L = ['א','ב','ג','ד','ה','ו'];
  const body = QZ.qs.map((q,qi)=>{
    const p = QZ.picked[qi];
    return `<div class="q">
      <div class="qt"><b class="qn">${qi+1}.</b>${q.q}</div>
      ${q.c.map((c,ci)=>{
        let cls='';
        if(QZ.checked){ if(ci===q.a) cls=' correct'; else if(ci===p) cls=' wrong'; }
        return `<label class="opt${cls}">
          <input type="radio" name="q${qi}" ${p===ci?'checked':''} ${QZ.checked?'disabled':''}
            onchange="QZpick(${qi},${ci})">
          <span class="ol">${L[ci]}.</span><span>${c}</span></label>`;}).join('')}
      ${QZ.checked ? `<div class="expl ${p===q.a?'good':'bad'}">
        <b>${p===q.a?'נכון.':'לא נכון — התשובה הנכונה היא '+L[q.a]+'.'}</b> ${q.e}</div>` : ''}
    </div>`;}).join('');
  const score = QZ.checked ? QZ.qs.filter((q,qi)=>QZ.picked[qi]===q.a).length : 0;
  const pass = score===QZ.qs.length;
  $('#ov').innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <div class="modal-h">
      <h3>בדיקת הבנה — ${esc(QZ.title)}</h3>
      <button class="x" onclick="closeQuiz()" aria-label="סגור">×</button>
    </div>
    <div class="modal-b">
      <div class="small muted" style="margin-bottom:12px">${esc(byId[QZ.sid].title)}</div>
      ${body}
    </div>
    <div class="modal-f">
      ${QZ.checked
        ? `<span class="score ${pass?'':'muted'}">ציון: ${num(score+'/'+QZ.qs.length)}</span>
           ${pass ? `<span class="pill g">מצוין — הנושא סומן כמובן</span>`
                  : `<span class="pill w">צריך 3/3 כדי לסמן שהבנת</span>
                     <button class="btn" onclick="retryQuiz()">נסה שוב</button>
                     <button class="btn ghost sm" onclick="forceDone()">סמן כהבנתי בכל זאת</button>`}
           <div style="flex:1"></div>
           <button class="btn ghost" onclick="closeQuiz()">סגור</button>
           ${pass ? `<button class="btn" onclick="nextTopic()">לנושא הבא ›</button>` : ''}`
        : `<button class="btn" onclick="checkQuiz()">בדוק תשובות</button>
           <div style="flex:1"></div>
           <span class="small muted">${num(QZ.picked.filter(x=>x!=null).length+'/'+QZ.qs.length)} נענו</span>
           <button class="btn ghost" onclick="closeQuiz()">ביטול</button>`}
    </div></div>`;
}
window.QZpick = (qi,ci)=>{ QZ.picked[qi]=ci; const n=QZ.picked.filter(x=>x!=null).length;
  const el=$('.modal-f .small.muted'); if(el) el.innerHTML=num(n+'/'+QZ.qs.length)+' נענו'; };
window.checkQuiz = ()=>{
  if(QZ.picked.filter(x=>x!=null).length < QZ.qs.length) return toast('ענה על כל השאלות','e');
  QZ.checked = true;
  const score = QZ.qs.filter((q,qi)=>QZ.picked[qi]===q.a).length;
  const k = tkey(QZ.sid,QZ.i); const prev = S.topics[k] || {tries:0};
  S.topics[k] = { done: score===QZ.qs.length || !!prev.done, score, tries:(prev.tries||0)+1, ts: Date.now() };
  touch('t:'+k); saveNow(); refreshChrome(); renderQuiz();
};
window.retryQuiz = ()=>{ QZ.picked=[]; QZ.checked=false; renderQuiz(); };
window.forceDone = ()=>{ const k=tkey(QZ.sid,QZ.i); S.topics[k]={...(S.topics[k]||{}),done:true};
  touch('t:'+k); saveNow(); refreshChrome(); toast('הנושא סומן כמובן'); closeQuiz(); };
window.closeQuiz = ()=>{ $('#ov').hidden=true; $('#ov').innerHTML=''; document.body.style.overflow='';
  QZ=null; render(); };
window.nextTopic = ()=>{
  const s = byId[QZ.sid]; let sid=QZ.sid, i=QZ.i+1;
  if(i>=s.topics.length){ const k=SUMS.findIndex(x=>x.sid===sid);
    if(k+1<SUMS.length){ sid=SUMS[k+1].sid; i=0; } else { return closeQuiz(); } }
  closeQuiz(); openAccs[sid]=true; openQuiz(sid,i);
};

/* ---------- Exams ---------- */
views.exams = () => {
  const ai = EXAMS.filter(e=>e.moed==='AI'), past = EXAMS.filter(e=>e.moed!=='AI')
    .sort((a,b)=> b.year-a.year || (a.moed<b.moed?-1:1));
  const card = e => {
    const r = S.exams[e.id]||{};
    const parts = e.questions.reduce((a,q)=>a+q.parts.length,0);
    const filled = r.answers ? Object.values(r.answers).filter(v=>String(v||'').trim()).length : 0;
    return `<div class="card ex-card${e.moed==='AI'?' ai':''}">
      <h3>${esc(e.label)}</h3>
      <div class="ex-row">
        <span class="pill n">${num(e.questions.length)} שאלות</span>
        <span class="pill n">${num(parts)} סעיפים</span>
        ${e.meta.totalPoints?`<span class="pill n">${num(e.meta.totalPoints)} נק'</span>`:''}
        <span class="pill ${e.lang==='he'?'':'w'}">${e.lang==='he'?'עברית':'אנגלית'}</span>
        ${e.combined?`<span class="pill w" title="${esc(e.meta.note||'')}">פתרון משולב</span>`:''}
      </div>
      <div class="ex-row">
        ${r.done?`<span class="pill g">הוגש</span>`: filled?`<span class="pill w">טיוטה · ${num(filled+'/'+parts)}</span>`:''}
      </div>
      <div class="sum-actions">
        <label class="chk${r.done?' done':''}"><input type="checkbox" ${r.done?'checked':''}
          onchange="markExam('${e.id}',this.checked)"><span class="box"></span>הכנתי</label>
        <button class="btn sm" onclick="openExam('${e.id}')">${filled||r.done?'המשך':'פתח טופס'}</button>
      </div></div>`;};
  return `<h2 class="sec">מבחן תרגול AI</h2>
    <div class="grid g3" style="margin-bottom:6px">${ai.map(card).join('')}</div>
    <h2 class="sec">מבחני עבר <span class="pill n">${num(past.length)}</span></h2>
    <div class="grid g3">${past.map(card).join('')}</div>`;
};
window.markExam = (id,v)=>{ S.exams[id]=Object.assign({},S.exams[id],{done:v}); if(!v) delete S.exams[id].done;
  touch('e:'+id); save(); refreshChrome(); render(); };

let EX=null, timerH=null;
window.openExam = (id)=>{
  const e = examBy[id]; if(!e) return;
  const r = S.exams[id]||{};
  EX = { e, answers: Object.assign({}, r.answers), elapsed: r.elapsed||0, running:false, showSol: !!r.done };
  go('exam'); requestAnimationFrame(()=>window.scrollTo(0,0));
};
function fmtT(ms){ const s=Math.floor(ms/1000); const h=Math.floor(s/3600), m=Math.floor(s%3600/60), q=s%60;
  return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(q).padStart(2,'0'); }
views.exam = () => {
  if(!EX) return '<div class="empty">בחר מבחן</div>';
  const e = EX.e, ltr = e.lang==='en';
  const solFor = ref => (e.solution.find(s=>s.ref===ref)||{}).html;
  const parts = e.questions.reduce((a,q)=>a+q.parts.length,0);
  return `<div class="card exam-head">
    <button class="btn ghost sm" onclick="leaveExam()">‹ חזרה</button>
    <h2>${esc(e.label)}</h2>
    <span class="timer" id="tmr">${fmtT(EX.elapsed)}</span>
    <button class="btn ghost sm" id="tbtn" onclick="toggleTimer()">${EX.running?'עצור':'הפעל שעון'}</button>
  </div>
  ${e.meta.note?`<div class="card" style="padding:12px 16px;margin-bottom:14px;background:var(--warn-bg);border-color:var(--warn-line)">
     <b>שים לב:</b> ${esc(e.meta.note)}</div>`:''}
  <div class="card" style="padding:12px 16px;margin-bottom:16px">
    <span class="small muted">${e.meta.date?`תאריך: <span class="num">${esc(e.meta.date)}</span> · `:''}${e.meta.duration?`משך: ${esc(e.meta.duration)} · `:''}${num(e.questions.length)} שאלות · ${num(parts)} סעיפים${e.meta.totalPoints?` · ${num(e.meta.totalPoints)} נקודות`:''}</span>
  </div>
  ${e.questions.map(q=>`<div class="card eq" data-anch="q:${esc(q.n)}">
    <div class="eq-h"><h3 ${ltr?'dir="ltr"':''}>${esc(q.heading)}</h3>
      ${q.points?`<span class="pill">${num(q.points)} נק'</span>`:''}</div>
    <div class="eq-b ${ltr?'ltr':''}">
      ${q.intro?`<div class="qbody">${q.intro}</div>`:''}
      ${q.parts.map(p=>`<div class="part" data-anch="p:${esc(p.pid)}">
        ${p.label?`<span class="part-lbl">${esc(p.label)}</span>`:''}
        <div class="qbody">${p.prompt||''}</div>
        ${ansField(p)}
        ${EX.showSol && solFor(p.pid) ? `<div class="solbox" data-anch="s:${esc(p.pid)}"><h4>הפתרון הרשמי</h4><div class="qbody">${solFor(p.pid)}</div></div>`:''}
      </div>`).join('')}
      ${EX.showSol && solFor(q.n) ? `<div class="solbox" data-anch="sq:${esc(q.n)}"><h4>הפתרון הרשמי — שאלה ${esc(q.n)}</h4><div class="qbody">${solFor(q.n)}</div></div>`:''}
    </div></div>`).join('')}
  ${EX.showSol && e.solutionExtra ? `<div class="card" style="padding:16px 18px;margin-bottom:16px">
      <h3 style="margin-top:0">הערות בדיקה ומחוון</h3><div class="qbody ${ltr?'ltr':''}">${e.solutionExtra}</div></div>`:''}
  ${EX.showSol && e.solution.some(s=>s.ref==='') ? `<div class="card" style="padding:16px 18px;margin-bottom:16px">
      <h3 style="margin-top:0">הפתרון הרשמי המלא</h3><div class="qbody ${ltr?'ltr':''}">${e.solution.filter(s=>s.ref==='').map(s=>s.html).join('')}</div></div>`:''}
  <div class="sticky-sub">
    <button class="btn ok" onclick="submitExam()">הגש ושמור קובץ להגשה</button>
    <button class="btn ghost sm" onclick="saveDraft(true)">שמור טיוטה</button>
    <div style="flex:1"></div>
    ${EX.showSol ? `<button class="btn ghost sm" onclick="hideSol()">הסתר פתרונות</button>`
                 : `<button class="btn ghost sm" onclick="revealSol()">הצג פתרון</button>`}
  </div>`;
};
function ansField(p){
  const v = EX.answers[p.pid]||'';
  if(p.kind==='tf'){
    return `<div class="tf">
      ${['True','False'].map(o=>`<label class="chk${v===o?' done':''}">
        <input type="radio" name="a-${p.pid}" ${v===o?'checked':''} onchange="setAns('${p.pid}','${o}')">
        <span class="box"></span>${o==='True'?'נכון <span class="en">(True)</span>':'לא נכון <span class="en">(False)</span>'}\u200f</label>`).join('')}
      ${v?`<button class="btn ghost sm" onclick="setAns('${p.pid}','')">נקה</button>`:''}
    </div>
    <textarea class="ans" rows="3" dir="auto" placeholder="נימוק (אם נדרש)"
      oninput="setAns('${p.pid}-why',this.value)">${esc(EX.answers[p.pid+'-why']||'')}</textarea>`;
  }
  if(p.kind==='mc' && p.choices?.length){
    const L=['A','B','C','D','E','F'];
    return `<div>${p.choices.map((c,ci)=>`<label class="opt${v===L[ci]?' correct':''}">
      <input type="radio" name="a-${p.pid}" ${v===L[ci]?'checked':''} onchange="setAns('${p.pid}','${L[ci]}')">
      <span class="ol">${L[ci]}.</span><span>${c}</span></label>`).join('')}</div>
    <textarea class="ans" rows="3" dir="auto" placeholder="נימוק (אם נדרש)"
      oninput="setAns('${p.pid}-why',this.value)">${esc(EX.answers[p.pid+'-why']||'')}</textarea>`;
  }
  return `<textarea class="ans" rows="${p.rows||6}" dir="auto" placeholder="התשובה שלך…"
    oninput="setAns('${p.pid}',this.value)">${esc(v)}</textarea>`;
}
window.setAns = (pid,v)=>{ EX.answers[pid]=v; touch(akey(EX.e.id,pid)); saveDraft(false);
  // בחירת True/False או תשובה אמריקאית מרנדרת מחדש — גם כאן לא לזוז מהמקום
  if(document.querySelector(`input[name="a-${pid}"]`)) renderKeep(); };
let draftT;
window.saveDraft = (loud)=>{ clearTimeout(draftT); draftT=setTimeout(()=>{
    if(!EX) return;
    S.exams[EX.e.id]=Object.assign({}, S.exams[EX.e.id], {answers:EX.answers, elapsed:EX.elapsed});
    touch('e:'+EX.e.id);
    saveNow(); if(loud) toast('הטיוטה נשמרה'); }, loud?0:400); };
window.toggleTimer = ()=>{
  EX.running=!EX.running;
  if(EX.running){ let last=Date.now(); timerH=setInterval(()=>{ const n=Date.now(); EX.elapsed+=n-last; last=n;
      const t=document.getElementById('tmr'); if(t) t.textContent=fmtT(EX.elapsed); },1000); }
  else { clearInterval(timerH); timerH=null; saveDraft(false); }
  const b=document.getElementById('tbtn'); if(b) b.textContent=EX.running?'עצור':'הפעל שעון';
};
window.leaveExam = ()=>{ clearInterval(timerH); timerH=null; saveDraft(true); EX=null; go('exams'); };

/* ---------- שמירת מקום בגלילה סביב render() ----------
   הצגה/הסתרה של הפתרונות מוסיפה או מורידה תוכן גם *מעל* נקודת הצפייה,
   ולכן אותו scrollY מצביע פתאום על מקום אחר — מכאן ה"קפיצה" הקטנה למעלה
   או למטה. לכן זוכרים את האלמנט שנמצא כרגע בראש החלון ואת המרחק המדויק
   שלו מראש החלון, ומחזירים אותו לאותו מרחק אחרי הרינדור.
   שומרים שרשרת עוגנים (תיבת פתרון → סעיף → שאלה) כי בהסתרה תיבת הפתרון
   עצמה נעלמת, ואז נעגנים לסעיף שמכיל אותה.                              */
function cssq(s){ return String(s).replace(/["\\]/g, '\\$&'); }
function grabAnchor(){
  const bar = document.querySelector('header, .topbar');
  const ref = bar ? Math.round(bar.getBoundingClientRect().bottom) + 4 : 8;
  /* צריך את העוגן ה*ספציפי* ביותר שחוצה את קו ראש התוכן — לא את כרטיס
     השאלה העוטף. עיגון לשאלה כולה לא מפצה על תיבות פתרון שנעלמו בתוכה,
     ואז הדף עדיין זז.                                                  */
  let hit = null;
  for(const el of $$('#app [data-anch]')){
    const r = el.getBoundingClientRect();
    if(r.bottom <= ref) continue;              // כבר גלל מעל החלון
    if(r.top <= ref) hit = el;                 // התחיל לפני הקו — עמוק יותר, ממשיכים
    else { if(!hit) hit = el; break; }         // הראשון שמתחיל מתחת לקו
  }
  if(!hit) return null;
  const chain = [];
  for(let el = hit; el; el = el.parentElement){
    const k = el.dataset && el.dataset.anch;
    if(k) chain.push({ key:k, top: el.getBoundingClientRect().top });
  }
  return chain.length ? chain : null;
}
function applyAnchor(chain){
  if(!chain) return;
  for(const a of chain){
    const el = document.querySelector('#app [data-anch="' + cssq(a.key) + '"]');
    if(!el) continue;
    const d = el.getBoundingClientRect().top - a.top;
    if(Math.abs(d) > 0.5) window.scrollBy(0, d);
    return;
  }
}
/* רינדור שמשאיר את העין באותו מקום.
   בסוף המבחן הדף מתקצר כשמסתירים פתרונות, ואז הגלילה נחסמת בתחתית ולא
   ניתן להחזיר את העוגן למקומו. לכן זוכרים את היעד המקורי: אם המשתמש לא
   גלל בעצמו מאז, הלחיצה הבאה תשתמש בו ולא במצב החסום — כך שכיבוי והדלקה
   חוזרים בדיוק לאותה נקודה גם בסוף הדף.                                */
let keepMemo = null;
function renderKeep(){
  const a = (keepMemo && Math.abs(window.scrollY - keepMemo.at) < 1) ? keepMemo.chain : grabAnchor();
  render();
  applyAnchor(a);                                  // הפריסה כבר מעודכנת
  keepMemo = a ? { chain:a, at: window.scrollY } : null;
  requestAnimationFrame(()=>{                      // ושוב, אם משהו זז מאוחר
    applyAnchor(a);
    if(keepMemo) keepMemo.at = window.scrollY;
  });
}
window.renderKeep = renderKeep;
window.__grabAnchor = grabAnchor;   /* לבדיקות */

window.revealSol = ()=>{
  if(!confirm('להציג את הפתרון הרשמי לפני ההגשה?')) return;
  EX.showSol=true; renderKeep();
};
window.submitExam = ()=>{
  const e=EX.e; clearInterval(timerH); timerH=null; EX.running=false;
  const now=new Date();
  const stamp = now.toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'});
  const L=[];
  L.push(`# הגשת מבחן לבדיקה — ${e.label}`);
  L.push('');
  L.push(`**קורס:** מערכות הפעלה · **מבחן:** ${e.label} · **הוגש:** ${stamp} · **זמן עבודה:** ${fmtT(EX.elapsed)}`);
  if(e.meta.date) L.push(`**תאריך המבחן המקורי:** ${e.meta.date}`);
  if(e.meta.note) L.push(`**הערה:** ${e.meta.note}`);
  L.push('');
  L.push('> **בקשה לבודק:** להלן מבחן שפתרתי. לכל סעיף מופיעים: נוסח השאלה, התשובה שלי, והפתרון הרשמי.');
  L.push('> אנא בדוק כל סעיף, תן ניקוד והסבר קצר מה היה חסר או שגוי, ובסוף סכם ציון כולל,');
  L.push('> רשימת נושאים לחיזוק, וטעויות חוזרות שכדאי שאשים לב אליהן.');
  L.push('');
  L.push('---');
  const solFor = ref => (e.solution.find(s=>s.ref===ref)||{}).html;
  e.questions.forEach(q=>{
    L.push(''); L.push(`## ${q.heading}${q.points?`  (${q.points} נקודות)`:''}`);
    if(q.intro) { L.push(''); L.push('### נתוני השאלה'); L.push(''); L.push(htmlToText(q.intro)); }
    q.parts.forEach(p=>{
      L.push(''); L.push(`### ${p.label?'סעיף '+p.label:'שאלה '+q.n}  \`[${p.pid}]\``);
      L.push('');
      L.push('**השאלה:**'); L.push('');
      L.push(htmlToText(p.prompt||''));
      if(p.kind==='mc' && p.choices?.length){
        L.push(''); p.choices.forEach((c,ci)=>L.push(`${'ABCDEF'[ci]}. ${htmlToText(c)}`));
      }
      L.push(''); L.push('**התשובה שלי:**'); L.push('');
      const a = String(EX.answers[p.pid]||'').trim();
      const why = String(EX.answers[p.pid+'-why']||'').trim();
      L.push(a ? (p.kind==='tf'||p.kind==='mc' ? '`'+a+'`' : a) : '_(לא עניתי)_');
      if(why){ L.push(''); L.push('נימוק: '+why); }
      const sol = solFor(p.pid);
      if(sol){ L.push(''); L.push('**הפתרון הרשמי:**'); L.push(''); L.push(htmlToText(sol)); }
      L.push('');
    });
    const qs = solFor(q.n);
    if(qs){ L.push(''); L.push(`**הפתרון הרשמי — ${q.heading}:**`); L.push(''); L.push(htmlToText(qs)); }
    L.push(''); L.push('---');
  });
  const generic = e.solution.filter(s=>s.ref==='');
  if(generic.length){ L.push(''); L.push('## הפתרון הרשמי המלא'); L.push('');
    generic.forEach(s=>L.push(htmlToText(s.html))); }
  if(e.solutionExtra){ L.push(''); L.push('## הערות בדיקה ומחוון'); L.push(''); L.push(htmlToText(e.solutionExtra)); }
  L.push(''); L.push('---');
  L.push('');
  L.push('## מה אני צריך ממך');
  L.push('');
  L.push('1. ניקוד לכל סעיף מתוך הניקוד המלא שלו, עם נימוק קצר.');
  L.push('2. ציון סופי מתוך 100.');
  L.push('3. שלוש עד חמש נקודות לחיזוק, לפי הנושאים שבהם טעיתי.');
  L.push('4. אם התשובה שלי נכונה אך הפתרון הרשמי מנוסח אחרת — ציין זאת במפורש.');
  const fname = `הגשה-${e.id}-${now.toISOString().slice(0,10)}.md`;
  download(fname, L.join('\n'));
  S.exams[e.id] = Object.assign({}, S.exams[e.id],
    {done:true, answers:EX.answers, elapsed:EX.elapsed, submittedAt:now.toISOString()});
  touchExam(e.id, EX.answers);
  saveNow(); EX.showSol=true; refreshChrome(); render();
  toast('הקובץ ירד — שלח לי אותו כאן לבדיקה');
};

/* ---------- Tools ---------- */
views.tools = () => {
  const all=[]; SUMS.forEach(s=>s.topics.forEach((t,i)=>{ const q=quizBy[s.sid]?.topics[i];
    if(q) q.q.forEach(x=>all.push({...x, sid:s.sid, ti:i, topic:t})); }));
  return `
  <h2 class="sec">מבחן אקראי מבנק השאלות</h2>
  <div class="card" style="padding:16px 18px;margin-bottom:18px">
    <p style="margin-top:0">בנק של <b>${num(all.length)}</b> שאלות אמריקאיות מכל החומר. בחר כמה שאלות למבחן מהיר.</p>
    <div class="ex-row">
      ${[10,20,30,50].map(n=>`<button class="btn ghost sm" onclick="randomExam(${n})">${num(n)} שאלות</button>`).join('')}
      <button class="btn sm" onclick="randomExam(15,true)">15 שאלות מהנושאים החלשים שלי</button>
    </div>
  </div>

  <h2 class="sec">שאלות שהמרצה סימן כטובות למבחן</h2>
  <div class="card" style="padding:16px 18px;margin-bottom:18px">
    <p style="margin-top:0" class="muted small">מתוך תמלולי ההרצאות — כולל טענות נכון/לא־נכון שחלקן הופיעו במבחן לדוגמה.</p>
    <button class="btn" onclick="openReader('__tsvi__')">פתח</button>
  </div>

  <h2 class="sec">יומן טעויות ותובנות</h2>
  <div class="card" style="padding:16px 18px;margin-bottom:18px">
    <textarea class="notes" dir="auto" placeholder="מה שכחתי, מה בלבלתי, נוסחאות שאני שוכח…"
      oninput="setNotes(this.value)">${esc(S.notes)}</textarea>
  </div>


  <h2 class="sec">סנכרון בין מכשירים <span id="sync-sec"></span></h2>
  <div class="card" style="padding:16px 18px;margin-bottom:18px">
    ${(()=>{ const c=cloudCfg(); const on=!!(c.bin&&c.key); return `
    <p style="margin-top:0" class="small muted">
      ההתקדמות נשמרת תמיד במכשיר הזה. אם תחבר <span class="en">JSONBin</span> היא תסתנכרן גם בין מחשב לטלפון.
      המפתח נשמר רק בדפדפן הזה — הוא <b>לא</b> נכנס לקובץ שמתפרסם ב־<span class="en">GitHub Pages</span>.
    </p>
    <div style="display:grid;gap:10px;max-width:620px">
      <label class="small"><b>Bin ID</b>
        <input id="cf-bin" dir="ltr" value="${esc(c.bin||'')}" placeholder="6a68b0e0da38895dfe9b8684"
          style="width:100%;padding:8px 11px;border:1px solid var(--line);border-radius:9px;font:inherit"></label>
      <label class="small"><b>Access Key</b> (לא Master Key)
        <input id="cf-key" dir="ltr" type="password" value="${esc(c.key||'')}" placeholder="$2a$10$..."
          style="width:100%;padding:8px 11px;border:1px solid var(--line);border-radius:9px;font:inherit"></label>
      <label class="chk${c.skipAnswers?' done':''}" style="align-self:start">
        <input type="checkbox" ${c.skipAnswers?'checked':''} id="cf-lean"><span class="box"></span>
        אל תסנכרן תשובות מבחנים (מקטין את הקובץ)</label>
    </div>
    <div class="ex-row" style="margin-top:12px">
      <button class="btn sm" onclick="saveCloudCfg()">שמור והתחבר</button>
      <button class="btn ghost sm" ${on?'':'disabled'} onclick="cloudPull(true)">משוך מהענן</button>
      <button class="btn ghost sm" ${on?'':'disabled'} onclick="cloudPush(true)">דחוף לענן</button>
      <button class="btn ghost sm" ${on?'':'disabled'} onclick="deviceLink()">צור קישור למכשיר נוסף</button>
      ${on?`<button class="btn ghost sm" style="color:var(--err);border-color:var(--err-line)" onclick="clearCloudCfg()">נתק</button>`:''}
    </div>
    <div class="small muted" style="margin-top:10px">
      מצב: <b id="sync2">${on?'מחובר':'לא מחובר'}</b>${syncS.msg?` — ${esc(syncS.msg)}`:''}
      ${syncS.size?` · גודל: <span class="num">${Math.round(syncS.size/1024)}KB</span>`:''}
    </div>`; })()}
  </div>

  <h2 class="sec">גיבוי התקדמות</h2>
  <div class="card" style="padding:16px 18px;margin-bottom:18px">
    <p style="margin-top:0" class="small muted">ההתקדמות נשמרת בדפדפן הזה בלבד. מומלץ לייצא גיבוי מדי פעם.</p>
    <div class="ex-row">
      <button class="btn ghost sm" onclick="exportProgress()">ייצא קובץ התקדמות</button>
      <label class="btn ghost sm" style="cursor:pointer">ייבא קובץ
        <input type="file" accept="application/json" style="display:none" onchange="importProgress(this)"></label>
      ${hasBackup()?`<button class="btn ghost sm" onclick="restoreBackup()">שחזר גיבוי אחרון</button>`:''}
      <button class="btn ghost sm" style="color:var(--err);border-color:var(--err-line)"
        onclick="resetAll()">אפס הכל</button>
    </div>
  </div>`;
};
window.KEYX = KEY;
window.exportProgress = ()=>{
  const b=new Blob([JSON.stringify(S,null,1)],{type:'application/json'});
  const u=URL.createObjectURL(b), a=document.createElement('a');
  a.href=u; a.download='os-prep-progress-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(u);a.remove();},400);
};
window.importProgress = (inp)=>{
  const f=inp.files[0]; if(!f) return; const r=new FileReader();
  r.onload=()=>{ try{ adoptState(JSON.parse(r.result)); cloudPush(true);
      refreshChrome(); render(); toast('ההתקדמות יובאה'); }catch(e){ toast('קובץ לא תקין','e'); } };
  r.readAsText(f);
};
window.randomExam = (n, weakOnly)=>{
  let pool=[]; SUMS.forEach(s=>s.topics.forEach((t,i)=>{
    const rec=S.topics[tkey(s.sid,i)];
    if(weakOnly && rec?.done) return;
    const q=quizBy[s.sid]?.topics[i]; if(q) q.q.forEach(x=>pool.push({...x, topic:t, sid:s.sid, ti:i}));
  }));
  if(!pool.length) return toast('אין שאלות מתאימות','e');
  for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  QZ={ sid:null, i:null, title:`מבחן אקראי — ${Math.min(n,pool.length)} שאלות`, qs:pool.slice(0,n),
       picked:[], checked:false, random:true };
  renderRandom(); $('#ov').hidden=false; document.body.style.overflow='hidden';
};
function renderRandom(){
  const L=['א','ב','ג','ד'];
  const body=QZ.qs.map((q,qi)=>{
    const p=QZ.picked[qi];
    return `<div class="q">
      <div class="qt"><b class="qn">${qi+1}.</b>${q.q}</div>
      <div class="small muted" style="margin:-6px 0 8px">${esc(q.topic)}</div>
      ${q.c.map((c,ci)=>{ let cls='';
        if(QZ.checked){ if(ci===q.a) cls=' correct'; else if(ci===p) cls=' wrong'; }
        return `<label class="opt${cls}"><input type="radio" name="r${qi}" ${p===ci?'checked':''}
          ${QZ.checked?'disabled':''} onchange="QZpick(${qi},${ci})">
          <span class="ol">${L[ci]}.</span><span>${c}</span></label>`;}).join('')}
      ${QZ.checked?`<div class="expl ${p===q.a?'good':'bad'}"><b>${p===q.a?'נכון.':'לא נכון — התשובה הנכונה: '+L[q.a]+'.'}</b> ${q.e}</div>`:''}
    </div>`;}).join('');
  const sc = QZ.checked ? QZ.qs.filter((q,qi)=>QZ.picked[qi]===q.a).length : 0;
  $('#ov').innerHTML=`<div class="modal" role="dialog" aria-modal="true">
    <div class="modal-h"><h3>${esc(QZ.title)}</h3><button class="x" onclick="closeQuiz()">×</button></div>
    <div class="modal-b">${body}</div>
    <div class="modal-f">${QZ.checked
      ? `<span class="score">ציון: ${num(sc+'/'+QZ.qs.length)} (${num(pct(sc,QZ.qs.length))}%)</span>
         <div style="flex:1"></div><button class="btn ghost" onclick="closeQuiz()">סגור</button>`
      : `<button class="btn" onclick="checkRandom()">בדוק</button><div style="flex:1"></div>
         <span class="small muted">${num(QZ.picked.filter(x=>x!=null).length+'/'+QZ.qs.length)} נענו</span>
         <button class="btn ghost" onclick="closeQuiz()">ביטול</button>`}</div></div>`;
}
window.renderRandomX = ()=>renderRandom();

/* ---------- Search ---------- */
let searchIdx=null;
function buildIdx(){
  if(searchIdx) return searchIdx;
  searchIdx=[];
  SUMS.forEach(s=>{
    const d=document.createElement('div'); d.innerHTML=s.html;
    const nodes=Array.from(d.querySelectorAll('h2'));
    nodes.forEach((h,i)=>{
      let txt='', n=h.nextElementSibling;
      while(n && n.tagName!=='H2'){ txt+=' '+n.textContent; n=n.nextElementSibling; }
      searchIdx.push({sid:s.sid, ti:i, title:h.textContent.trim(), sum:s.title, text:txt.replace(/\s+/g,' ').slice(0,4000)});
    });
  });
  return searchIdx;
}
function doSearch(q){
  q=q.trim(); const box=$('#sres');
  if(q.length<2){ box.hidden=true; return; }
  const idx=buildIdx(); const rx=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
  const hits=[];
  for(const it of idx){
    if(rx.test(it.title)) hits.push({...it, score:3, ctx:it.text.slice(0,110)});
    else { const m=it.text.match(rx); if(m) hits.push({...it, score:1,
      ctx:'…'+it.text.slice(Math.max(0,m.index-60), m.index+90)+'…'}); }
    if(hits.length>60) break;
  }
  hits.sort((a,b)=>b.score-a.score);
  box.innerHTML = hits.length ? hits.slice(0,25).map(h=>`
    <div class="res" onclick="gotoHit('${h.sid}',${h.ti})">
      <b>${h.title.replace(rx,m=>'<mark>'+m+'</mark>')}</b>
      <div class="ctx">${esc(h.sum)} — ${esc(h.ctx).replace(rx,m=>'<mark>'+m+'</mark>')}</div>
    </div>`).join('') : '<div class="empty">לא נמצאו תוצאות</div>';
  box.hidden=false;
}
window.gotoHit=(sid,ti)=>{ $('#sres').hidden=true; $('#q').value='';
  openReader(sid); setTimeout(()=>{ const e=document.getElementById(sid+'-t'+ti);
    if(e){ e.scrollIntoView(); window.scrollBy(0,-110);} },80); };

/* ---------- reader special pages ---------- */
const origReader = views.reader;
views.reader = () => {
  if(readerSid==='__tsvi__'){
    return `<div class="reader-top"><button class="btn ghost sm" onclick="go('tools')">‹ חזרה לכלים</button>
      <div style="flex:1"></div><button class="btn ghost sm" onclick="window.print()">הדפס</button></div>
      <div class="summary-body">${TSVI}</div>`;
  }
  return origReader();
};

/* ---------- router ---------- */
const TABS=[['dash','דשבורד'],['summaries','סיכומים'],['topics','נושאי הקורס'],['exams','מבחנים'],['tools','כלים']];
let view = S.lastView && views[S.lastView] ? S.lastView : 'dash';
/* מעבר בין לשוניות הוא העדפת תצוגה מקומית בלבד — הוא לא "התקדמות".
   קודם הוא קרא ל-save() ולכן עצם הדפדוף במכשיר ישן הפך אותו ל"חדש
   ביותר" ודרס בענן התקדמות אמיתית ממכשיר אחר.                       */
window.go = (v)=>{ view=v; if(['dash','summaries','topics','exams','tools'].includes(v)){ S.lastView=v; saveLocal(); }
  render(); window.scrollTo(0,0); };
function render(){
  $$('#tabs .tab').forEach(b=>b.setAttribute('aria-selected', String(b.dataset.v===view)));
  $('#app').innerHTML = (views[view]||views.dash)();
  refreshChrome();
  const dt=$('#exam-date'); if(dt) dt.onchange=e=>{ S.examDate=e.target.value; touch('examDate'); save(); render(); };
  if(window.__fabUpdate) requestAnimationFrame(window.__fabUpdate);
}
window.render = render;


/* ===================== סנכרון ענן (JSONBin) ===================== */
/* אין סוד קשיח בקובץ. ההגדרות נשמרות ב-localStorage של כל מכשיר בנפרד,
   או מוזרקות פעם אחת דרך פרמטרים ב-URL.                                */
const CKEY = 'os-prep-cloud';
const CLOUD_BAKED = { bin:'', key:'' };   // אפשר למלא כאן Access Key אם מעדיפים נוחות
let   syncS = { st:'off', msg:'', at:0, size:0 };
let   pulledOk = false;   // אין דחיפה לענן לפני משיכה מוצלחת — מונע דריסה של מצב חדש יותר

function cloudCfg(){
  try { return Object.assign({}, CLOUD_BAKED, JSON.parse(localStorage.getItem(CKEY)||'{}')); }
  catch(e){ return Object.assign({}, CLOUD_BAKED); }
}
function setCloudCfg(c){
  const cur = cloudCfg();
  localStorage.setItem(CKEY, JSON.stringify(Object.assign(cur, c)));
}
window.cloudOn = () => { const c = cloudCfg(); return !!(c.bin && c.key); };

function payload(){
  const c = cloudCfg();
  const out = structuredClone(S);
  delete out.lastView;                       // העדפת תצוגה מקומית — לא מסתנכרנת
  if(c.skipAnswers){
    Object.keys(out.exams||{}).forEach(k=>{ delete out.exams[k].answers; });
    Object.keys(out.mt||{}).forEach(k=>{ if(k.charAt(0)==='a') delete out.mt[k]; });
  }
  return out;
}
function setSync(st, msg){
  syncS.st = st; syncS.msg = msg||'';
  if(st==='ok') syncS.at = Date.now();
  const el = document.getElementById('sync');
  if(!el) return;
  const map = { off:['לא מחובר','n'], busy:['מסנכרן…','w'], ok:['מסונכרן','g'], err:['שגיאת סנכרון','e'] };
  const [label, cls] = map[st] || map.off;
  el.className = 'pill ' + cls;
  el.title = msg || (st==='ok' && syncS.at ? 'עודכן ' + new Date(syncS.at).toLocaleTimeString('he-IL') : 'לחץ להגדרות סנכרון');
  el.textContent = label;
}
function httpMsg(code, body){
  const m = { 401:'מפתח לא תקין (401)', 403:'למפתח אין הרשאה לפעולה הזו (403)',
              404:'לא נמצא Bin עם המזהה הזה (404)', 429:'חריגה ממכסת הבקשות של JSONBin (429)',
              422:'הנתונים נדחו על ידי השרת (422)' };
  return m[code] || ('HTTP ' + code + (body ? ' — ' + String(body).slice(0,120) : ''));
}
async function jbFetch(url, opts){
  const c = cloudCfg();
  const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign(
    { 'X-Master-Key': c.key, 'X-Access-Key': c.key }, (opts||{}).headers||{}) }));
  if(!r.ok){ let t=''; try{ t = await r.text(); }catch(e){} throw new Error(httpMsg(r.status, t)); }
  return r;
}


function progCount(x){
  if(!x || typeof x!=='object') return 0;
  return Object.keys(x.read||{}).length + Object.keys(x.understood||{}).length +
         Object.keys(x.topics||{}).length + Object.keys(x.exams||{}).length;
}
/* כל מפתחות ה"התקדמות" של רשומה, בפורמט של mt */
function allKeys(rec){
  const out = [];
  Object.keys(rec.read||{}).forEach(k=>out.push('r:'+k));
  Object.keys(rec.understood||{}).forEach(k=>out.push('u:'+k));
  Object.keys(rec.topics||{}).forEach(k=>out.push('t:'+k));
  Object.keys(rec.exams||{}).forEach(id=>{ out.push('e:'+id);
    Object.keys((rec.exams[id]||{}).answers||{}).forEach(pid=>out.push(akey(id,pid))); });
  ['master','notes','examDate'].forEach(k=>out.push(k));
  return out;
}

/* ===================== מנוע המיזוג =====================
   הבעיה הישנה: משיכה מהענן החליפה את כל המצב המקומי, ודחיפה שלחה את כל
   המצב המקומי. כל מכשיר דרס לגמרי את השני — ומכאן "האחוזים חוזרים אחורה"
   ו"מילאתי את אותה תשובה שלוש פעמים".
   הפתרון: מיזוג לכל פריט בנפרד. לכל מפתח בוחרים את הצד עם חותמת הזמן
   החדשה יותר; מפתח שנמחק נחשב "ערך" בפני עצמו, כך שגם ביטול סימון שורד.
   לרשומות ישנות בלי mt נופלים אחורה ל-updatedAt של הרשומה כולה.        */
function keyTs(rec, k, present){
  const t = (rec.mt||{})[k];
  if(typeof t === 'number') return t;
  return present ? (rec.updatedAt || 1) : 0;
}
function mergeMap(prefix, a, b, recA, recB, mt){
  const A = a||{}, B = b||{}, out = {};
  for(const k of new Set(Object.keys(A).concat(Object.keys(B)))){
    const hasA = Object.prototype.hasOwnProperty.call(A, k),
          hasB = Object.prototype.hasOwnProperty.call(B, k);
    const tA = keyTs(recA, prefix+k, hasA), tB = keyTs(recB, prefix+k, hasB);
    const mine = tA >= tB;
    if(mine ? hasA : hasB) out[k] = mine ? A[k] : B[k];
    const t = Math.max(tA, tB); if(t) mt[prefix+k] = t;
  }
  return out;
}
function mergeScalar(k, a, b, recA, recB, mt, def){
  const tA = keyTs(recA, k, a !== undefined && a !== def),
        tB = keyTs(recB, k, b !== undefined && b !== def);
  const t = Math.max(tA, tB); if(t) mt[k] = t;
  return tA >= tB ? a : b;
}
function mergeExams(recA, recB, mt){
  const A = recA.exams||{}, B = recB.exams||{}, out = {};
  for(const id of new Set(Object.keys(A).concat(Object.keys(B)))){
    const ea = A[id], eb = B[id];
    const tA = keyTs(recA, 'e:'+id, !!ea), tB = keyTs(recB, 'e:'+id, !!eb);
    if(!ea && !eb) continue;
    // done / submittedAt נקבעים לפי הצד החדש יותר; elapsed הוא זמן עבודה — לוקחים את המרבי
    const win = (tA >= tB ? ea : eb) || ea || eb;
    const rec = Object.assign({}, win);
    rec.elapsed = Math.max((ea&&ea.elapsed)||0, (eb&&eb.elapsed)||0);
    const t = Math.max(tA, tB); if(t) mt['e:'+id] = t;
    // תשובות: מיזוג פר־סעיף. תשובה שכתבת במכשיר אחד לא נמחקת בגלל
    // שהמכשיר השני עוד לא ראה אותה (וגם לא בגלל מצב "בלי תשובות").
    const ansA = (ea&&ea.answers)||{}, ansB = (eb&&eb.answers)||{};
    const ans = {};
    for(const pid of new Set(Object.keys(ansA).concat(Object.keys(ansB)))){
      const k = akey(id, pid);
      const hasA = Object.prototype.hasOwnProperty.call(ansA, pid),
            hasB = Object.prototype.hasOwnProperty.call(ansB, pid);
      const pA = keyTs(recA, k, hasA), pB = keyTs(recB, k, hasB);
      let v;
      if(pA === pB) v = String(ansA[pid]||'').length >= String(ansB[pid]||'').length ? ansA[pid] : ansB[pid];
      else v = pA > pB ? (hasA ? ansA[pid] : undefined) : (hasB ? ansB[pid] : undefined);
      if(v !== undefined) ans[pid] = v;
      const tp = Math.max(pA, pB); if(tp) mt[k] = tp;
    }
    if(Object.keys(ans).length || (win && win.answers)) rec.answers = ans;
    out[id] = rec;
  }
  return out;
}
/* recA = מקומי, recB = ענן. מחזיר מצב ממוזג חדש. */
function mergeStates(recA, recB){
  const mt = {};
  const out = structuredClone(DEF);
  out.read       = mergeMap('r:', recA.read,       recB.read,       recA, recB, mt);
  out.understood = mergeMap('u:', recA.understood, recB.understood, recA, recB, mt);
  out.topics     = mergeMap('t:', recA.topics,     recB.topics,     recA, recB, mt);
  out.exams      = mergeExams(recA, recB, mt);
  out.master   = !!mergeScalar('master',   !!recA.master, !!recB.master, recA, recB, mt, false);
  out.notes    = mergeScalar('notes',    recA.notes||'',    recB.notes||'',    recA, recB, mt, '') || '';
  out.examDate = mergeScalar('examDate', recA.examDate||'', recB.examDate||'', recA, recB, mt, '') || '';
  out.lastView = recA.lastView || 'dash';                 // תמיד מקומי
  out.mt = mt;
  out.updatedAt = Math.max(recA.updatedAt||0, recB.updatedAt||0);
  return out;
}
/* האם המצב הממוזג שונה ממה שיושב בענן — כלומר צריך לדחוף בחזרה.
   stable stringify כדי שסדר מפתחות לא ייחשב לשינוי ויבזבז מכסת בקשות. */
function stable(v){
  if(Array.isArray(v)) return '['+v.map(stable).join(',')+']';
  if(v && typeof v==='object') return '{'+Object.keys(v).sort()
    .map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
  return JSON.stringify(v===undefined ? null : v);
}
function differs(merged, cloud){
  const lean = !!cloudCfg().skipAnswers;
  const norm = x => {
    const e = {};
    Object.keys(x.exams||{}).forEach(id=>{
      const r = Object.assign({}, x.exams[id]);
      if(lean) delete r.answers;
      if(r.answers) Object.keys(r.answers).forEach(p=>{ if(!String(r.answers[p]||'').trim()) delete r.answers[p]; });
      e[id] = r;
    });
    return stable({ r:x.read||{}, u:x.understood||{}, t:x.topics||{}, e,
                    m:!!x.master, n:x.notes||'', d:x.examDate||'' });
  };
  return norm(merged) !== norm(cloud);
}
function stashBackup(){
  try{ localStorage.setItem(KEY+'-bak', JSON.stringify({ at:Date.now(), state:S })); }catch(e){}
}
window.hasBackup = () => !!localStorage.getItem(KEY+'-bak');
window.restoreBackup = () => {
  const raw = localStorage.getItem(KEY+'-bak'); if(!raw) return toast('אין גיבוי','e');
  const b = JSON.parse(raw);
  if(!confirm('לשחזר את הגיבוי מ־' + new Date(b.at).toLocaleString('he-IL') +
              ' (' + progCount(b.state) + ' סימונים)? המצב הנוכחי יוחלף.')) return;
  adoptState(b.state); refreshChrome(); render(); cloudPush(true); toast('הגיבוי שוחזר');
};

/* אימוץ מצב שלם מבחוץ (גיבוי / ייבוא קובץ): מחליף את המצב המקומי, וחותם
   חותמת זמן חדשה על כל מפתח — כולל מצבות למה שנעלם — כדי שהאימוץ ינצח
   במיזוג הבא ולא "ייבלע" מול הענן.                                      */
function adoptState(raw){
  const dead = allKeys(S), n = Date.now();
  const next = Object.assign(structuredClone(DEF), raw);
  next.mt = {};
  dead.forEach(k => next.mt[k] = n);
  allKeys(next).forEach(k => next.mt[k] = n);
  next.updatedAt = n;
  S = next; writeLocal();
}

let pulling = false;
/* משיכה = מיזוג, אף פעם לא החלפה. force משמש רק לכפתור "משוך מהענן"
   ואז הענן מנצח בתיקו, אבל עדיין בלי לאבד פריטים שקיימים רק מקומית. */
async function cloudPull(force){
  const c = cloudCfg();
  if(!c.bin || !c.key){ setSync('off'); return false; }
  if(pulling) return false;
  pulling = true; setSync('busy','טוען מהענן…');
  try{
    const r = await jbFetch(`https://api.jsonbin.io/v3/b/${encodeURIComponent(c.bin)}/latest`,
                            { headers:{ 'X-Bin-Meta':'false' }, cache:'no-store' });
    let rec = await r.json();
    if(rec && rec.record && !rec.topics) rec = rec.record;   // אם X-Bin-Meta לא כובד
    const looksReal = rec && typeof rec==='object' &&
      ('topics' in rec || 'read' in rec || 'exams' in rec || 'understood' in rec);
    pulledOk = true;
    if(!looksReal){
      setSync('ok','ה-Bin ריק — השמירה הבאה תמלא אותו');
      await cloudPush(true);
      return true;
    }
    if(force) rec.updatedAt = Math.max(rec.updatedAt||0, (S.updatedAt||0) + 1);
    const before = progCount(S);
    const merged = mergeStates(S, rec);
    const changedLocally = differs(merged, S);
    if(changedLocally && before > 0) stashBackup();
    /* טיוטה פתוחה: מה שמוקלד כרגע במסך הוא הטרי ביותר — הוא מנצח את הענן */
    if(EX && merged.exams[EX.e.id]){
      merged.exams[EX.e.id].answers = Object.assign({}, merged.exams[EX.e.id].answers, EX.answers);
      EX.answers = Object.assign({}, merged.exams[EX.e.id].answers);
    }
    S = merged; writeLocal();
    if(changedLocally){
      refreshChrome();
      // לא מרעננים את המסך תוך כדי הקלדה — זה היה מוחק את מה שנכתב באותו רגע
      const a = document.activeElement;
      const typing = a && (a.tagName==='TEXTAREA' || a.tagName==='INPUT');
      if(!typing) render();
    }
    setSync('ok');
    if(differs(merged, rec)) await cloudPush(true);   // הענן החסיר משהו — משלימים לו
    if(changedLocally && progCount(S) !== before) toast('ההתקדמות סונכרנה');
    return true;
  }catch(e){ setSync('err', e.message); return false; }
  finally{ pulling = false; }
}

let pushT, pushing = false, pushQueued = false;
function cloudPush(now){
  const c = cloudCfg();
  if(!c.bin || !c.key){ setSync('off'); return Promise.resolve(false); }
  /* אם המשיכה הראשונה נכשלה (חוסר רשת, מכסת JSONBin) — פעם קודם הדחיפה
     הושתקה לתמיד והכל נשאר תקוע מקומית. עכשיו מנסים למשוך שוב ואז לדחוף. */
  if(!pulledOk && now !== true){
    if(pushQueued) return Promise.resolve(false);
    pushQueued = true;
    return cloudPull(false).finally(()=>{ pushQueued = false; })
      .then(ok => ok ? cloudPush(true) : false);
  }
  clearTimeout(pushT);
  const run = async () => {
    if(pushing){ pushT = setTimeout(run, 800); return false; }
    pushing = true; setSync('busy','שומר לענן…');
    try{
      const body = JSON.stringify(payload());
      syncS.size = body.length;
      await jbFetch(`https://api.jsonbin.io/v3/b/${encodeURIComponent(c.bin)}`, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json', 'X-Bin-Versioning':'false' },
        body });
      setSync('ok');
      if(body.length > 90000) toast('שים לב: קובץ הסנכרון גדול (' +
        Math.round(body.length/1024) + 'KB). כדאי לכבות סנכרון תשובות מבחנים.','e');
      return true;
    }catch(e){ setSync('err', e.message); return false; }
    finally{ pushing = false; }
  };
  if(now) return run();
  pushT = setTimeout(run, 1500);
  return Promise.resolve(true);
}
window.cloudPull = cloudPull;
window.cloudPush = (n)=>{ if(n===true) pulledOk = true; return cloudPush(n); };

window.saveCloudCfg = () => {
  const bin = document.getElementById('cf-bin').value.trim();
  const key = document.getElementById('cf-key').value.trim();
  const skipAnswers = document.getElementById('cf-lean').checked;
  if(!bin || !key) return toast('צריך גם Bin ID וגם מפתח','e');
  setCloudCfg({ bin, key, skipAnswers });
  toast('ההגדרות נשמרו — בודק חיבור…');
  cloudPull(false).then(ok => { if(ok) render(); });
  render();
};
window.clearCloudCfg = () => {
  if(!confirm('לנתק את המכשיר הזה מהענן? ההתקדמות המקומית תישאר.')) return;
  localStorage.removeItem(CKEY); setSync('off'); render();
};
window.deviceLink = () => {
  const c = cloudCfg();
  if(!c.bin || !c.key) return toast('קודם הגדר חיבור','e');
  const url = location.origin + location.pathname +
    '?bin=' + encodeURIComponent(c.bin) + '&key=' + encodeURIComponent(c.key);
  navigator.clipboard?.writeText(url).then(
    ()=>toast('הקישור הועתק — פתח אותו במכשיר השני פעם אחת'),
    ()=>prompt('העתק את הקישור:', url));
};

/* ---------- global bridge (inline handlers run in global scope) ---------- */
window.toggleAcc = sid => { openAccs[sid] = !openAccs[sid]; render(); };
window.setAllAcc = on => { openAccs = {}; if(on) SUMS.forEach(s=>openAccs[s.sid]=true); render(); };
window.setMaster = (v, quiet) => { S.master = v; touch('master'); save(); refreshChrome(); if(!quiet) render(); };
window.setNotes  = v => { S.notes = v; touch('notes'); save(); };
window.checkRandom = () => { if(QZ.picked.filter(x=>x!=null).length < QZ.qs.length) return toast('ענה על כל השאלות','e');
  QZ.checked = true; renderRandom(); };
window.hideSol = () => { EX.showSol = false; renderKeep(); };
/* איפוס חייב להשאיר "מצבות" — חותמות זמן חדשות למפתחות שנמחקו — אחרת
   המיזוג הבא היה מחזיר מהענן את כל מה שנמחק.                            */
window.resetAll = () => {
  if(!confirm('לאפס את כל ההתקדמות? פעולה זו אינה הפיכה.')) return;
  stashBackup();
  const dead = allKeys(S), n = Date.now();
  S = structuredClone(DEF);
  dead.forEach(k => S.mt[k] = n);
  S.updatedAt = n; writeLocal();
  const done = () => location.reload();
  if(cloudOn()) cloudPush(true).then(done, done); else done();
};
window.toast = toast;


/* ---------- כפתור צף: חזרה לתוכן העניינים + מד התקדמות קריאה ---------- */
(function fab(){
  const el = document.createElement('button');
  el.id = 'fab'; el.className = 'fab'; el.type = 'button';
  el.setAttribute('aria-label', 'חזרה לראש העמוד ולתוכן העניינים');
  el.title = 'חזרה לתוכן העניינים';
  el.innerHTML = '<span class="ring" aria-hidden="true"></span><span class="ar" aria-hidden="true"></span>';
  el.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const t = document.querySelector('.toc');
    if(t) setTimeout(()=>t.focus?.(), 400);
  });
  document.body.appendChild(el);
  let raf = 0;
  const upd = () => {
    raf = 0;
    const y = window.scrollY || document.documentElement.scrollTop;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    el.style.setProperty('--p', h > 0 ? Math.min(100, Math.round(y * 100 / h)) : 0);
    el.classList.toggle('on', y > 400);
    const bar = document.querySelector('.ret-bar') || document.querySelector('.sticky-sub');
    el.style.bottom = bar ? (Math.round(bar.getBoundingClientRect().height) + 30) + 'px' : '';
  };
  addEventListener('scroll', () => { if(!raf) raf = requestAnimationFrame(upd); }, { passive:true });
  addEventListener('resize', upd, { passive:true });
  window.__fabUpdate = upd; upd();
  if(window.ResizeObserver){ new ResizeObserver(upd).observe(document.body); }
})();

/* ---------- boot ---------- */
$('#tabs').innerHTML = TABS.map(([v,l])=>{
  const badge = v==='summaries'?'<span class="badge" id="tb-sum"></span>'
              : v==='topics'?'<span class="badge" id="tb-top"></span>'
              : v==='exams'?'<span class="badge" id="tb-exam"></span>':'';
  return `<button class="tab" data-v="${v}" onclick="go('${v}')" aria-selected="false">${l}${badge}</button>`;}).join('');
$('#q').addEventListener('input', e=>doSearch(e.target.value));
$('#q').addEventListener('keydown', e=>{ if(e.key==='Escape'){ e.target.value=''; $('#sres').hidden=true; e.target.blur(); }});
document.addEventListener('click', e=>{ if(!e.target.closest('.search')) $('#sres').hidden=true; });
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && !$('#ov').hidden) closeQuiz();
  if(e.key==='/' && document.activeElement.tagName!=='INPUT' && document.activeElement.tagName!=='TEXTAREA'){
    e.preventDefault(); $('#q').focus(); }
});
(function bootCloud(){
  const u = new URLSearchParams(location.search);
  if(u.get('bin') && u.get('key')){
    setCloudCfg({ bin:u.get('bin').trim(), key:u.get('key').trim() });
    history.replaceState(null, '', location.pathname);
    toast('המכשיר חובר לענן');
  }
  setSync(cloudOn() ? 'busy' : 'off');
  if(cloudOn()) cloudPull(false);
  window.addEventListener('online', ()=>{ if(cloudOn()) cloudPull(false); });

  /* קודם משכנו רק פעם אחת בעליית הדף. לשונית שנשארה פתוחה כל היום המשיכה
     לדחוף תמונת מצב ישנה ובכך "החזירה אחורה" את מה שנעשה במכשיר השני.
     עכשיו מסנכרנים שוב בכל חזרה ללשונית, וגם כל כמה דקות ברקע.          */
  let lastSync = 0;
  const resync = (minGap) => {
    if(!cloudOn() || document.hidden) return;
    const n = Date.now();
    if(n - lastSync < minGap) return;
    lastSync = n; cloudPull(false);
  };
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) resync(15000); });
  window.addEventListener('focus', ()=>resync(15000));
  setInterval(()=>resync(120000), 60000);
})();

window.addEventListener('beforeunload', ()=>{
  if(EX){ S.exams[EX.e.id]=Object.assign({},S.exams[EX.e.id],{answers:EX.answers, elapsed:EX.elapsed});
          touch('e:'+EX.e.id); S.updatedAt = Date.now(); }
  writeLocal();   // בלי לחדש חותמת זמן סתם — אחרת סגירת דף תיראה כשינוי
});
render();
})();

