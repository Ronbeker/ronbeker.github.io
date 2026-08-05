/* ===================== מודלים חישוביים — מרכז הכנה למבחן ===================== */
(function () {
'use strict';

const SUMS  = JSON.parse(document.getElementById('d-summaries').textContent);
const QUIZ  = JSON.parse(document.getElementById('d-quiz').textContent);
const EXAMS = JSON.parse(document.getElementById('d-exams').textContent);
const LANGB = JSON.parse(document.getElementById('d-langbank').textContent);
const DEFS  = document.getElementById('d-defs').textContent;
const TAX   = /*@@TAX@@*/ null;

const KEY = 'cm-prep-v1';
const byId = {}; SUMS.forEach(s => byId[s.sid] = s);
const quizBy = {}; QUIZ.forEach(q => quizBy[q.sid] = q);
const examBy = {}; EXAMS.forEach(e => examBy[e.id] = e);

/* מאגר השאלות: כל סעיף מתויג, מכל המבחנים, בסדר הופעה קבוע */
const BANK = [];
EXAMS.forEach(e => e.questions.forEach(q => q.parts.forEach(p => {
  if(p.tags && p.tags.subj) BANK.push({ e, q, p, key: e.id + '|' + p.pid });
})));
const subjHe = id => (TAX.subjects.find(s => s.id === id) || {}).he || id;
const qtHe   = id => (TAX.qtypes.find(t => t.id === id) || {}).he || id;

/* ---------- state ---------- */
const DEF = { read:{}, understood:{}, topics:{}, tread:{}, exams:{}, bank:{}, lang:{}, cp:{}, master:false, notes:'', examDate:'', lastView:'dash', updatedAt:0, mt:{} };
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
    background: kind==='e' ? '#a32626' : '#3b2a75', color:'#fff', padding:'11px 20px', borderRadius:'10px',
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

/* הסימון על נושא פירושו "הגעתי לפה", לא "סיימתי אותו". לכן ההתקדמות היא מה
   שנמצא *מאחורי* הנושא המסומן הרחוק ביותר: הגעת לנושא 3 ⇒ עברת 2. סימון הפרק
   כולו כנקרא הוא הדבר היחיד שסוגר 100%, אחרת אי אפשר היה להגיע לשם.        */
function furthestMark(sid){
  const s = byId[sid]; if(!s) return -1;
  let f = -1;
  s.topics.forEach((_,i)=>{ if(S.tread[tkey(sid,i)]) f = i; });
  return f;
}
function readPos(sid){
  const s = byId[sid]; if(!s) return 0;
  if(S.read[sid]) return s.topics.length;
  return Math.max(0, furthestMark(sid));
}

/* ---------- progress ---------- */
function stats(){
  const nS = SUMS.length;
  const read = SUMS.filter(s=>S.read[s.sid]).length;
  const und  = SUMS.filter(s=>S.understood[s.sid]).length;
  let nT=0, dT=0, dR=0;
  SUMS.forEach(s=>{ dR += readPos(s.sid);
    s.topics.forEach((_,i)=>{ nT++;
      if(S.topics[tkey(s.sid,i)]?.done) dT++; }); });
  const nE = EXAMS.length, dE = EXAMS.filter(e=>S.exams[e.id]?.done).length;
  const nB = BANK.length,  dB = BANK.filter(b=>S.bank[b.key]?.done).length;
  const nL = LANGB.length, dL = LANGB.filter(l=>S.lang[l.id]?.ok).length;
  /* סימוני "הגעתי לפה" לא נספרים במד הכללי בכוונה: קריאה כבר מיוצגת
     ע"י שתי הסימונים של הפרק, וספירה נוספת של 134 נושאים הייתה מנפחת את האחוז
     מקריאה בלבד — על חשבון בחנים, מבחנים ותרגול. dR מוחזר לתצוגה בלבד.        */
  const total = read+und+dT+dE+dB+dL, max = nS+nS+nT+nE+nB+nL;
  return {nS,read,und,nT,dT,dR,nE,dE,nB,dB,nL,dL,overall:pct(total,max)};
}
function refreshChrome(){
  const st = stats();
  $('#mini-bar i').style.width = st.overall+'%';
  $('#mini-pct').innerHTML = st.overall+'%';
  $('#tb-sum').innerHTML  = `${st.read}/${st.nS}`;
  $('#tb-top').innerHTML  = `${st.dT}/${st.nT}`;
  $('#tb-exam').innerHTML = `${st.dE}/${st.nE}`;
  const tb = $('#tb-bank'); if(tb) tb.innerHTML = `${st.dB}/${st.nB}`;
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
  const nextB = BANK.find(b=>!S.bank[b.key]?.done);
  /* הצ'קפוינט שנגעו בו לאחרונה — "המשך מהמקום שעצרת" */
  const lastCp = Object.keys(S.cp||{})
    .filter(sid=>byId[sid] && S.cp[sid] && S.cp[sid].p > 1)
    .sort((a,b)=>(S.mt['p:'+b]||0)-(S.mt['p:'+a]||0))
    .map(sid=>({sid, cp:S.cp[sid]}))[0];
  let days = '', dcls='';
  if(S.examDate){ const d = Math.ceil((new Date(S.examDate+'T08:00') - new Date())/864e5);
    days = d>0 ? d : (d===0?0:d); dcls = d<0?'עבר':'ימים'; }

  return `
  <div class="grid g3" style="margin-bottom:16px">
    ${statCard('פרקים שנקראו', st.read, st.nS)}
    ${statCard('פרקים שהובנו', st.und, st.nS, true)}
    ${statCard('נושאים מאחוריך', st.dR, st.nT)}
    ${statCard('נושאים שהובנו', st.dT, st.nT, true)}
    ${statCard('מבחנים שהוכנו', st.dE, st.nE)}
    ${statCard('שאלות מהמאגר שתורגלו', st.dB, st.nB, true)}
    ${statCard('שפות שסווגו נכון', st.dL, st.nL)}
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
      <div style="margin-top:8px"><button class="btn ghost sm" onclick="openReader('__defs__')">דף נוסחאות והגדרות</button></div>
    </div>
    <div style="text-align:center">
      <div class="big">${num(st.overall)}%</div>
      <label>התקדמות כוללת</label>
    </div>
  </div>

  <h2 class="sec">מה הצעד הבא</h2>
  <div class="card next-list" style="margin-bottom:18px">
    ${lastCp ? nextItem(`עצרת בנושא ${(lastCp.cp.t??0)+1} מתוך ${byId[lastCp.sid].topics.length}`,
                        'המשך מהמקום שעצרת — ' + byId[lastCp.sid].title,
                        `openReader('${lastCp.sid}')`, 'המשך קריאה') : ''}
    ${nextS ? nextItem('קרא את הסיכום הבא', nextS.title, `go('summaries');openReader('${nextS.sid}')`, 'פתח סיכום')
            : nextItem('כל הסיכומים נקראו', 'אפשר לעבור לבדיקת הבנה של הנושאים', `go('topics')`, 'לנושאים')}
    ${nextT ? nextItem('בדוק הבנה בנושא הבא', nextT.s.topics[nextT.i], `go('topics');openQuiz('${nextT.s.sid}',${nextT.i})`, 'התחל בדיקה')
            : nextItem('כל הנושאים סומנו כמובנים', 'כל הכבוד — עכשיו מבחנים', `go('exams')`, 'למבחנים')}
    ${nextE ? nextItem('המבחן הבא לתרגול', nextE.label, `go('exams');openExam('${nextE.id}')`, 'פתח טופס')
            : nextItem('כל המבחנים הוכנו', 'אפשר לחזור על נושאים חלשים', `go('tools')`, 'לכלים')}
    ${nextB ? nextItem('תרגל שאלה מהמאגר', subjHe(nextB.p.tags.subj)+' · '+qtHe(nextB.p.tags.qt)+' — '+nextB.e.label, `go('bank')`, 'למאגר')
            : st.nB ? nextItem('כל שאלות המאגר תורגלו', 'כל הכבוד — שווה סבב ערבוב לחזרה', `go('bank')`, 'למאגר') : ''}
    ${st.nL && st.dL < st.nL ? nextItem('דריל סיווג שפות', `סיווגת נכון ${st.dL} מתוך ${st.nL} שפות`, `startDrill()`, 'התחל דריל')
            : st.nL ? nextItem('כל השפות סווגו נכון', 'שווה סבב רענון מהיר', `startDrill()`, 'סבב נוסף') : ''}
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
    ${[...new Set(SUMS.map(s=>s.group))].map(g=>{
      const list = SUMS.filter(s=>s.group===g); if(!list.length) return '';
      return `<div style="margin-bottom:14px"><div class="small muted" style="font-weight:750;margin-bottom:7px">${g}</div>
      <div style="display:flex;flex-wrap:wrap;gap:7px">${list.map(s=>{
        const tot=s.topics.length, d=s.topics.filter((_,i)=>S.topics[tkey(s.sid,i)]?.done).length;
        const cls = d===tot ? 'g' : d ? 'w' : 'n';
        return `<button class="pill ${cls}" style="cursor:pointer;font-size:.8rem"
          onclick="go('topics');openAcc('${s.sid}')" title="${esc(s.title)}">${esc(s.sid.replace('ch','פרק '))} · ${num(d+'/'+tot)}</button>`;
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
  const groups = [...new Set(SUMS.map(s=>s.group))];
  return groups.map(g=>{
    const list = SUMS.filter(s=>s.group===g);
    return `<h2 class="sec">${g} <span class="pill n">${num(list.length)}</span></h2>
    <div class="grid g3" style="margin-bottom:8px">${list.map(s=>{
      const r=!!S.read[s.sid], u=!!S.understood[s.sid];
      const tot=s.topics.length, d=s.topics.filter((_,i)=>S.topics[tkey(s.sid,i)]?.done).length;
      const rd = readPos(s.sid);
      const cp = S.cp[s.sid];
      return `<div class="card sum-card">
        <h3>${esc(s.title)}</h3>
        <div class="sum-meta">
          <span class="pill n">${num(tot)} נושאים</span>
          <span class="pill ${rd===tot?'g':rd?'w':'n'}" title="נושאים שכבר מאחוריך">${num(rd+'/'+tot)} מאחוריך</span>
          <span class="pill ${d===tot?'g':d?'w':'n'}">${num(d+'/'+tot)} נבדקו</span>
        </div>
        <div class="bar" style="margin:2px 0 8px"><i style="width:${pct(rd,tot)}%"></i></div>
        ${cp ? `<button class="cp-hint" onclick="openReader('${s.sid}')" title="המשך מהמקום שעצרת">
          ${cp.pin?'📌':'↩︎'} המשך מנושא ${num((cp.t??0)+1+'/'+tot)}</button>` : ''}
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
/* סימון הפרק כנקרא גורר את כל נושאיו — ובביטול גם מתבטל אצלם, אחרת נשאר מצב
   סותר: "0/11 מאחוריך" לצד פרק מסומן (או ההפך), ומד ההתקדמות מספר סיפור לא נכון. */
window.setRead = (sid,v)=>{
  S.read[sid]=v; if(!v) delete S.read[sid]; touch('r:'+sid);
  const s = byId[sid]; let n = 0;
  if(s) s.topics.forEach((_,i)=>{
    const k = tkey(sid,i);
    if(v ? !S.tread[k] : !!S.tread[k]){
      if(v) S.tread[k] = true; else delete S.tread[k];
      touch('k:'+k); n++;
    }
  });
  save(); refreshChrome(); render();
  if(n) toast(v ? `סומנו ${n} נושאים` : `הוסר הסימון מ-${n} נושאים`);
};
window.setUnd  = (sid,v)=>{ S.understood[sid]=v; if(!v) delete S.understood[sid]; touch('u:'+sid); save(); refreshChrome(); render(); };


/* ---------- ניווט הלוך-חזור בין נושא לסיכום ---------- */
let returnTo = null;
function flash(el){ if(!el) return; el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'), 1700); }

window.gotoTopicInSummary = (sid, i) => {
  returnTo = { sid, i, title: byId[sid].topics[i] };
  openReader(sid, true);
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
/* skipJump=true כשמגיעים ליעד ספציפי (נושא מהאקורדיון / תוצאת חיפוש) —
   אז לא קופצים לצ'קפוינט ולא דורסים את המקום שאליו התכוונו.            */
window.openReader = (sid, skipJump) => {
  flushCheckpoint();
  readerSid = sid; go('reader');          // go() כבר מגליל לראש העמוד
  if(!skipJump) autoJumpCheckpoint(sid);
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
  const tot = s.topics.length;
  const rd  = readPos(s.sid);
  const cp  = S.cp[s.sid];
  return `<div class="reader-top">
    ${ret ? `<button class="btn sm" onclick="backToTopic()">‹ חזרה לנושא</button>` : ''}
    <button class="btn ghost sm" onclick="go('summaries')">‹ חזרה לסיכומים</button>
    <div class="grow" style="flex:1"></div>
    <label class="chk${r?' done':''}" id="rd-chk"><input type="checkbox" ${r?'checked':''}
      onchange="setRead('${s.sid}',this.checked)"><span class="box"></span>קראתי</label>
    <label class="chk${u?' done':''}"><input type="checkbox" ${u?'checked':''}
      onchange="setUnd('${s.sid}',this.checked)"><span class="box"></span>הבנתי</label>
    <button class="btn sm ghost" onclick="go('topics');openAcc('${s.sid}')">בדוק הבנה בנושאים</button>
    <button class="btn ghost sm" onclick="window.print()">הדפס</button></div>
  <div class="rd-bar" role="region" aria-label="התקדמות וצ׳קפוינט">
    <span class="rd-lbl"><b id="rd-count">${num(rd+'/'+tot)}</b><span class="rd-word"> נושאים מאחוריך</span>
      · <b class="num" id="rd-pct">${pct(rd,tot)}%</b></span>
    <span class="bar${rd===tot?' ok':''}"><i style="width:${pct(rd,tot)}%"></i></span>
    <button class="btn ghost sm" onclick="pinCheckpoint()" title="שמור כאן צ׳קפוינט קבוע">📌 סמן צ׳קפוינט</button>
    ${cp ? `<button class="btn sm" onclick="jumpCheckpoint()" title="קפוץ למקום שעזבת">${cp.pin?'📌':'↩︎'} נושא ${num((cp.t??0)+1)}</button>
      <button class="x" onclick="clearCheckpoint()" aria-label="נקה צ׳קפוינט" title="נקה צ׳קפוינט">×</button>` : ''}
  </div>
  <div class="card toc"><b>נושאי הפרק</b><ol>${s.topics.map((t,i)=>{
    const done = S.topics[tkey(s.sid,i)]?.done, was = S.tread[tkey(s.sid,i)];
    return `<li id="toc-${s.sid}-${i}"${was?' class="rd"':''}><a href="#${s.sid}-t${i}">${esc(t)}</a>
      <span class="toc-m">${was?'<span class="pill n" style="font-size:.68rem">הגעת</span>':''}${done?' <span class="pill g" style="font-size:.7rem">✓</span>':''}</span></li>`;
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

/* ---------- צ'קפוינט קריאה + סימון נושאים שנקראו ----------
   האתר זוכר לבד באיזה אחוז מהפרק עצרת, ומחזיר אותך לשם בפתיחה הבאה.
   כפתור "סמן צ׳קפוינט" מקבע מקום מסוים (ואז המעקב האוטומטי לא דורס אותו). */
function topbarH(){ const b = document.querySelector('.topbar');
  return b ? Math.round(b.getBoundingClientRect().height) : 96; }
function syncTbh(){ document.documentElement.style.setProperty('--tbh', topbarH()+'px'); }
function readerChapter(){ return (view==='reader' && byId[readerSid]) ? byId[readerSid] : null; }
function readerMetrics(){
  const b = document.querySelector('#app .summary-body'); if(!b) return null;
  const rect = b.getBoundingClientRect();
  const top  = window.scrollY + rect.top;
  const line = window.scrollY + topbarH() + 8;
  const viewH = Math.max(140, window.innerHeight - topbarH() - 24);
  const denom = Math.max(1, rect.height - viewH);
  const p = Math.max(0, Math.min(100, Math.round((line - top) * 100 / denom)));
  return { top, denom, p };
}
function currentTopicIdx(){
  const s = readerChapter(); if(!s) return null;
  const line = window.scrollY + topbarH() + 12;
  let idx = null;
  for(let i=0;i<s.topics.length;i++){
    const h = document.getElementById(s.sid+'-t'+i); if(!h) continue;
    if(window.scrollY + h.getBoundingClientRect().top <= line) idx = i; else break;
  }
  return idx;
}
function scrollToPct(p, smooth){
  const m = readerMetrics(); if(!m) return;
  const y = Math.max(0, Math.round(m.top + m.denom * (p/100) - topbarH() - 8));
  window.scrollTo({ top:y, behavior: smooth ? 'smooth' : 'auto' });
}
/* אחוז הגלילה של כותרת נושא — ההפוך של scrollToPct. מחזיר null כשהפרק לא מוצג
   כרגע (למשל סימון וי מתוך לשונית הנושאים), ואז חוזרים לפי הכותרת עצמה.      */
function headingPct(sid, i){
  if(readerSid !== sid) return null;
  const h = document.getElementById(sid+'-t'+i), m = readerMetrics();
  if(!h || !m) return null;
  const y = window.scrollY + h.getBoundingClientRect().top - topbarH() - 10;
  return Math.max(0, Math.min(100, Math.round((y + topbarH() + 8 - m.top) * 100 / m.denom)));
}
function scrollToCheckpoint(sid, cp, smooth){
  if(cp.p != null){ scrollToPct(cp.p, smooth); return; }
  const h = document.getElementById(sid+'-t'+cp.t);
  if(h) window.scrollTo({ top: Math.max(0, Math.round(window.scrollY + h.getBoundingClientRect().top - topbarH() - 10)),
                          behavior: smooth ? 'smooth' : 'auto' });
}
/* "הגעתי לפה" על נושא = שם אתה נמצא, ולכן הסימנייה נעצרת על אותו נושא עצמו
   ולא על הבא — לחזור לנושא הבא היה מדלג על מה שעוד לא קראת. אף פעם לא אחורה:
   סימון מאוחר של נושא ישן לא אמור לזרוק אותך לתחילת הפרק.                     */
function advanceBookmark(sid, i){
  const s = byId[sid]; if(!s) return;
  const cur = S.cp[sid];
  if(cur && cur.pin) return;                       // צ'קפוינט שנעוץ ידנית מנצח
  if(cur && cur.t != null && cur.t > i) return;    // כבר מתקדם יותר
  S.cp[sid] = { p: headingPct(sid, i), t: i, pin:false };
  touch('p:'+sid);
}
/* האחוז בסרגל הוא כמה נושאים כבר מאחוריך — מדד של מה שעשית, לא של איפה העין
   שלך נמצאת. מיקום הגלילה עדיין נמדד (cp.p), אבל רק כדי להחזיר אותך לנקודה
   המדויקת שעזבת; הוא לא מוצג כאחוז התקדמות.                                  */
let cpDirty = false, cpTimer = 0;
function trackCheckpoint(){
  const s = readerChapter(); if(!s) return;
  const m = readerMetrics(); if(!m) return;
  const cur = S.cp[s.sid];
  if(cur && cur.pin) return;                       // צ'קפוינט מקובע — לא נוגעים
  if(m.p <= 1 || m.p >= 98){                       // בהתחלה או בסוף אין לאן לחזור
    if(cur){ delete S.cp[s.sid]; touch('p:'+s.sid); cpDirty = true; saveLocal(); }
    return;
  }
  if(cur && cur.p != null && Math.abs(cur.p - m.p) < 1) return;
  S.cp[s.sid] = { p:m.p, t:currentTopicIdx(), pin:false };
  touch('p:'+s.sid); cpDirty = true; saveLocal();
}
function flushCheckpoint(){ if(cpDirty){ cpDirty = false; save(); } }
function autoJumpCheckpoint(sid){
  const cp = S.cp[sid]; if(!cp) return;
  if(cp.p != null && (cp.p <= 1 || cp.p >= 99)) return;   // בקצוות אין לאן להחזיר
  setTimeout(()=>{
    if(view!=='reader' || readerSid!==sid) return;
    scrollToCheckpoint(sid, cp, false);   /* שחזור מיידי — לא גלילה מונפשת על פני חצי פרק */
    toast(`חזרנו לצ׳קפוינט — נושא ${(cp.t??0)+1} מתוך ${byId[sid].topics.length}`);
  }, 60);
}
window.pinCheckpoint = () => {
  const s = readerChapter(); if(!s) return;
  const m = readerMetrics(); if(!m) return;
  const t = currentTopicIdx();
  S.cp[s.sid] = { p:m.p, t, pin:true };
  touch('p:'+s.sid); cpDirty = false; save();
  toast(`צ׳קפוינט נשמר — נושא ${(t??0)+1} מתוך ${s.topics.length}`);
  renderKeepScroll();
};
window.jumpCheckpoint = () => { const s = readerChapter(); const cp = s && S.cp[s.sid];
  if(cp) scrollToCheckpoint(s.sid, cp, true); };
window.clearCheckpoint = () => {
  const s = readerChapter(); if(!s || !S.cp[s.sid]) return;
  delete S.cp[s.sid]; touch('p:'+s.sid); cpDirty = false; save();
  renderKeepScroll();
};
/* רינדור מחדש בלי לאבד את מקום הקריאה (הכותרות לא זזות בקורא) */
function renderKeepScroll(){ const y = window.scrollY; render(); window.scrollTo(0, y); }

window.setTopicRead = (sid, i, v) => {
  const k = tkey(sid,i);
  if(v) S.tread[k] = true; else delete S.tread[k];
  touch('k:'+k);
  const s = byId[sid];
  if(v){
    advanceBookmark(sid, i);
    if(s && s.topics.every((_,j)=>S.tread[tkey(sid,j)]) && !S.read[sid]){
      S.read[sid] = true; touch('r:'+sid);        // הגעת לכל הנושאים ⇒ הפרק נקרא
    }
  }
  save(); refreshChrome();
  /* רינדור מלא ולא עדכון נקודתי: הסרגל מכיל גם את כפתור הסימנייה, וזה בדיוק
     מה שנשאר תקוע קודם — נבנה פעם אחת בפתיחת הפרק ולא התעדכן לעולם.          */
  if(view==='topics') render(); else renderKeepScroll();
};
/* כפתורי "הגעתי לפה" מוזרקים לכותרות הנושאים אחרי הרינדור — התוכן עצמו לא נגוע */
function decorateReader(){
  const s = readerChapter(); if(!s) return;
  s.topics.forEach((t,i)=>{
    const h = document.getElementById(s.sid+'-t'+i); if(!h || h.querySelector('.tmark')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tmark'; b.dataset.k = s.sid+'|'+i;
    b.onclick = () => window.setTopicRead(s.sid, i, !S.tread[tkey(s.sid,i)]);
    h.appendChild(b);
  });
  updateReaderChrome();
}
function updateReaderChrome(){
  const s = readerChapter(); if(!s) return;
  s.topics.forEach((t,i)=>{
    const on = !!S.tread[tkey(s.sid,i)];
    const b = document.querySelector(`.tmark[data-k="${s.sid}|${i}"]`);
    if(b){ b.classList.toggle('on', on);
      b.textContent = on ? '✓ הגעתי לפה' : '＋ הגעתי לפה';
      b.title = on ? 'בטל סימון' : 'סמן שהגעת לנושא הזה'; }
    const li = document.getElementById('toc-'+s.sid+'-'+i);
    if(li){ li.classList.toggle('rd', on);
      const m = li.querySelector('.toc-m');
      if(m){ const done = S.topics[tkey(s.sid,i)]?.done;
        m.innerHTML = (on?'<span class="pill n" style="font-size:.68rem">הגעת</span>':'') +
                      (done?' <span class="pill g" style="font-size:.7rem">✓</span>':''); } }
  });
  const tot = s.topics.length, rd = readPos(s.sid);
  const c = document.getElementById('rd-count'); if(c) c.innerHTML = num(rd+'/'+tot);
  const p = document.getElementById('rd-pct');   if(p) p.textContent = pct(rd,tot)+'%';
  const bar = document.querySelector('.rd-bar .bar');
  if(bar){ bar.classList.toggle('ok', rd===tot); bar.querySelector('i').style.width = pct(rd,tot)+'%'; }
  const chk = document.getElementById('rd-chk');
  if(chk){ const on = !!S.read[s.sid];
    chk.classList.toggle('done', on); chk.querySelector('input').checked = on; }
}
/* setTimeout ולא requestAnimationFrame: rAF מוקפא כשהלשונית מוסתרת,
   ואז דווקא המקום האחרון שקראנו בו — לפני שעברנו אפליקציה — לא היה נשמר. */
addEventListener('scroll', ()=>{ if(cpTimer) return;
  cpTimer = setTimeout(()=>{ cpTimer = 0; trackCheckpoint(); }, 150); }, {passive:true});
addEventListener('resize', syncTbh, {passive:true});
window.__cp = { track:trackCheckpoint, metrics:readerMetrics };   /* לבדיקות */

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
    const rdc=readPos(s.sid);
    const open = openAccs[s.sid];
    return `<div class="card acc${open?' open':''}" id="acc-${s.sid}">
      <button class="acc-h" onclick="toggleAcc('${s.sid}')">
        <span class="arw">▾</span>
        <span class="ttl">${esc(s.title)}</span>
        <span class="pill ${rdc===tot?'g':rdc?'w':'n'}" title="נושאים שכבר מאחוריך">${num(rdc+'/'+tot)} מאחוריך</span>
        <span class="pill ${d===tot?'g':d?'w':'n'}" title="נושאים שהובנו">${num(d+'/'+tot)}</span>
      </button>
      <div class="acc-b">${s.topics.map((t,i)=>{
        const r = S.topics[tkey(s.sid,i)]; const done = r?.done;
        const was = !!S.tread[tkey(s.sid,i)];
        return `<div class="tp${done?' done':''}" id="tp-${s.sid}-${i}">
          <span class="n">${num(i+1)}</span>
          <span class="t">${esc(t)}</span>
          ${done ? `<span class="pill g">הבנתי</span>` : r?.tries ? `<span class="pill e">${num(r.score)}/3</span>` : ''}
          <span class="acts">
            <button class="tmark${was?' on':''}" onclick="setTopicRead('${s.sid}',${i},${!was})"
              title="${was?'בטל סימון':'סמן שהגעת לנושא הזה'}">${was?'✓ הגעתי לפה':'＋ הגעתי לפה'}</button>
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
    <button class="btn ghost sm" onclick="openDefsModal()" title="דף ההגדרות שמצורף למבחן">דף נוסחאות</button>
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
window.__merge = (a,b)=>mergeStates(a,b);   /* לבדיקות */
window.__stats = ()=>stats();               /* לבדיקות */

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
  L.push(`**קורס:** מודלים חישוביים · **מבחן:** ${e.label} · **הוגש:** ${stamp} · **זמן עבודה:** ${fmtT(EX.elapsed)}`);
  if(e.meta.date) L.push(`**תאריך המבחן המקורי:** ${e.meta.date}`);
  if(e.meta.note) L.push(`**הערה:** ${e.meta.note}`);
  L.push('');
  L.push('> **בקשה לבודק:** להלן מבחן שפתרתי. לכל סעיף מופיעים: נוסח השאלה, התשובה שלי, והפתרון הרשמי.');
  L.push('> אנא בדוק כל סעיף, תן ניקוד והסבר קצר מה היה חסר או שגוי, ובסוף סכם ציון כולל,');
  L.push('> רשימת נושאים לחיזוק, וטעויות חוזרות שכדאי שאשים לב אליהן.');
  L.push('> בהוכחות — בדוק במיוחד: מבנה לוגי וסדר כמתים; בלמות ניפוח — שהחלוקה נבחרה על ידי היריב');
  L.push('> ושכל המקרים כוסו; ברדוקציות — שכיוון הרדוקציה נכון ושההעתקה מוכחת לשני הכיוונים;');
  L.push('> בבניות (DFA/NFA/CFG/PDA/TM) — שההגדרה פורמלית ומלאה ושיש נימוק נכונות.');
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

  <h2 class="sec">דף נוסחאות והגדרות</h2>
  <div class="card" style="padding:16px 18px;margin-bottom:18px">
    <p style="margin-top:0" class="muted small">הנוסח שמצורף רשמית לטופס המבחן — כל ההגדרות, ההמרות והאלגוריתמים במקום אחד. זמין גם מתוך כל מבחן.</p>
    <button class="btn" onclick="openReader('__defs__')">פתח</button>
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

  <h2 class="sec">ארכיון</h2>
  <div class="card" style="padding:16px 18px;margin-bottom:18px">
    <p style="margin-top:0" class="muted small">אתר ההכנה הקודם — מערכות הפעלה — שמור במלואו, כולל ההתקדמות שלך.</p>
    <a class="btn ghost sm" href="os/" style="display:inline-block;text-decoration:none">מערכות הפעלה — ארכיון ›</a>
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
  a.href=u; a.download='cm-prep-progress-'+new Date().toISOString().slice(0,10)+'.json';
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

/* ---------- מאגר שאלות לפי נושא (bank) ---------- */
let bankF = { subj:{}, qt:{}, hideDone:false };
const bankOpen = new Set();
function bankPool(){
  const sOn = TAX.subjects.some(s=>bankF.subj[s.id]);
  const tOn = TAX.qtypes.some(t=>bankF.qt[t.id]);
  return BANK.filter(b=>{
    if(sOn && !bankF.subj[b.p.tags.subj]) return false;
    if(tOn && !bankF.qt[b.p.tags.qt]) return false;
    if(bankF.hideDone && S.bank[b.key]?.done) return false;
    return true;
  });
}
function bankSolHtml(b){
  const hit = b.e.solution.find(s=>s.ref===b.p.pid) || b.e.solution.find(s=>s.ref===b.q.n);
  return hit ? hit.html : '';
}
function bankCard(b){
  const {e,q,p} = b;
  const done = !!S.bank[b.key]?.done;
  const open = bankOpen.has(b.key);
  const sol = bankSolHtml(b);
  const ltr = e.lang==='en';
  return `<div class="card bq-card" data-anch="b:${esc(b.key)}">
    <div class="bq-head">
      <span class="exlbl">${esc(e.label)}</span>
      <span class="pill n">${esc(subjHe(p.tags.subj))}</span>
      <span class="pill w">${esc(qtHe(p.tags.qt))}</span>
      ${done?'<span class="pill g">תורגל ✓</span>':''}
    </div>
    <div class="small muted" style="margin-bottom:6px">${esc(q.heading)}${p.label?` · סעיף ${esc(p.label)}`:''}</div>
    ${q.intro?`<details class="bq-ctx"${open?' open':''}><summary>נתוני השאלה המלאים</summary><div class="qbody ${ltr?'ltr':''}">${q.intro}</div></details>`:''}
    <div class="qbody ${ltr?'ltr':''}">${p.prompt||''}</div>
    ${p.kind==='mc'&&p.choices?.length?`<div class="qbody ${ltr?'ltr':''}">${p.choices.map((c,ci)=>`<div><b>${'ABCDEF'[ci]}.</b> ${c}</div>`).join('')}</div>`:''}
    ${open&&sol?`<div class="solbox" data-anch="bs:${esc(b.key)}"><h4>הפתרון הרשמי</h4><div class="qbody ${ltr?'ltr':''}">${sol}</div></div>`:''}
    <div class="ex-row" style="margin-top:10px;align-items:center">
      ${sol?`<button class="btn ghost sm" onclick="bankSol('${b.key}')">${open?'הסתר פתרון':'הצג פתרון'}</button>`:''}
      <label class="chk${done?' done':''}"><input type="checkbox" ${done?'checked':''}
        onchange="markBank('${b.key}',this.checked)"><span class="box"></span>תרגלתי — סמן</label>
      <div style="flex:1"></div>
      <button class="btn ghost sm" onclick="openExam('${e.id}')">פתח במבחן המלא</button>
    </div>
  </div>`;
}
views.bank = () => {
  const st = stats();
  if(!BANK.length) return `<div class="empty">המאגר יתמלא כשהמבחנים המתויגים ייכנסו לאתר</div>`;
  const pool = bankPool();
  const cells = TAX.subjects.map(sub=>{
    const all = BANK.filter(b=>b.p.tags.subj===sub.id);
    if(!all.length) return '';
    const d = all.filter(b=>S.bank[b.key]?.done).length;
    const on = !!bankF.subj[sub.id];
    return `<div class="subj-cell${on?' on':''}" onclick="bankTog('subj','${sub.id}')" role="button" tabindex="0">
      <div class="sk"><span>${esc(sub.he)}</span><span class="num">${d}/${all.length}</span></div>
      <div class="bar${d===all.length&&all.length?' ok':''}"><i style="width:${pct(d,all.length)}%"></i></div></div>`;
  }).join('');
  const qtChips = TAX.qtypes.map(t=>{
    const n = BANK.filter(b=>b.p.tags.qt===t.id).length;
    if(!n) return '';
    return `<button class="fchip${bankF.qt[t.id]?' on':''}" onclick="bankTog('qt','${t.id}')">${esc(t.he)}<span class="cnt">${num(n)}</span></button>`;
  }).join('');
  return `
  <div class="card" style="padding:14px 18px;margin-bottom:14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
    <div><b>${num(st.dB)}</b> מתוך <b>${num(st.nB)}</b> שאלות מהמאגר תורגלו</div>
    <div class="bar" style="flex:1;min-width:160px"><i style="width:${pct(st.dB,st.nB)}%"></i></div>
    <button class="btn sm" onclick="startShuffle()">🔀 תרגול בערבוב לפי הסינון</button>
    <button class="btn sm ghost" onclick="startDrill()">⚡ דריל סיווג שפות</button>
  </div>
  <h2 class="sec">התקדמות לפי נושא <span class="small muted" style="font-weight:400">(לחיצה מסננת)</span></h2>
  <div class="subj-grid">${cells}</div>
  <div class="fchips">${qtChips}
    <button class="fchip${bankF.hideDone?' on':''}" onclick="bankHideDone()">הסתר שתורגלו</button>
    ${(TAX.subjects.some(s=>bankF.subj[s.id])||TAX.qtypes.some(t=>bankF.qt[t.id])||bankF.hideDone)?
      `<button class="fchip" onclick="bankClear()">נקה סינון ✕</button>`:''}
  </div>
  <div class="small muted" style="margin-bottom:10px">${num(pool.length)} שאלות בסינון הנוכחי</div>
  ${pool.length ? pool.map(bankCard).join('') : '<div class="empty">אין שאלות בסינון הנוכחי</div>'}`;
};
window.bankTog = (kind,id)=>{ bankF[kind][id]=!bankF[kind][id]; render(); };
window.bankHideDone = ()=>{ bankF.hideDone=!bankF.hideDone; render(); };
window.bankClear = ()=>{ bankF={subj:{},qt:{},hideDone:false}; render(); };
window.bankSol = key=>{ bankOpen.has(key)?bankOpen.delete(key):bankOpen.add(key); renderKeep(); };
window.markBank = (key,v)=>{
  const prev = S.bank[key]||{};
  if(v) S.bank[key]={done:true, tries:prev.tries||0};
  else delete S.bank[key];
  touch('b:'+key); save(); refreshChrome(); renderKeep();
};

/* ---------- מצב ערבוב (shuffle) — כרטיסיות על המאגר המסונן ---------- */
let SH = null;
window.startShuffle = ()=>{
  const pool = bankPool();
  if(!pool.length) return toast('אין שאלות בסינון הנוכחי','e');
  const arr = pool.slice();
  for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  SH = { list:arr, idx:0, revealed:false, marks:[] };
  go('shuffle');
};
views.shuffle = ()=>{
  if(!SH) return '<div class="empty">אין סבב תרגול פעיל — התחל מהמאגר</div>';
  if(SH.idx >= SH.list.length){
    const got = SH.marks.filter(m=>m.ok).length;
    const bySubj = {};
    SH.marks.forEach(m=>{ const s=m.b.p.tags.subj; (bySubj[s]=bySubj[s]||{n:0,ok:0}).n++; if(m.ok) bySubj[s].ok++; });
    return `<div class="shuf-wrap"><div class="card" style="padding:20px 22px">
      <h2 style="margin-top:0">סיום סבב — ידעת ${num(got)} מתוך ${num(SH.marks.length)}</h2>
      ${Object.keys(bySubj).map(s=>`<div class="next-item">
        <span class="pill ${bySubj[s].ok===bySubj[s].n?'g':bySubj[s].ok?'w':'e'}">${num(bySubj[s].ok+'/'+bySubj[s].n)}</span>
        <div class="t"><b>${esc(subjHe(s))}</b></div></div>`).join('')}
      <div class="shuf-acts">
        <button class="btn" onclick="startShuffle()">סבב חדש</button>
        <button class="btn ghost" onclick="go('bank')">חזרה למאגר</button>
      </div></div></div>`;
  }
  const b = SH.list[SH.idx], {e,q,p} = b;
  const sol = bankSolHtml(b), ltr = e.lang==='en';
  return `<div class="shuf-wrap">
    <div class="shuf-prog">
      <button class="btn ghost sm" onclick="go('bank')">‹ יציאה</button>
      <span class="pill n">${num((SH.idx+1)+'/'+SH.list.length)}</span>
      <div class="bar" style="flex:1;min-width:120px"><i style="width:${pct(SH.idx,SH.list.length)}%"></i></div>
      <span class="pill g">${num(SH.marks.filter(m=>m.ok).length)} ידעתי</span>
    </div>
    <div class="card bq-card">
      <div class="bq-head">
        <span class="exlbl">${esc(e.label)}</span>
        <span class="pill n">${esc(subjHe(p.tags.subj))}</span>
        <span class="pill w">${esc(qtHe(p.tags.qt))}</span>
      </div>
      <div class="small muted" style="margin-bottom:6px">${esc(q.heading)}${p.label?` · סעיף ${esc(p.label)}`:''}</div>
      ${q.intro?`<details class="bq-ctx" open><summary>נתוני השאלה המלאים</summary><div class="qbody ${ltr?'ltr':''}">${q.intro}</div></details>`:''}
      <div class="qbody ${ltr?'ltr':''}">${p.prompt||''}</div>
      ${p.kind==='mc'&&p.choices?.length?`<div class="qbody ${ltr?'ltr':''}">${p.choices.map((c,ci)=>`<div><b>${'ABCDEF'[ci]}.</b> ${c}</div>`).join('')}</div>`:''}
      ${SH.revealed?(sol?`<div class="solbox"><h4>הפתרון הרשמי</h4><div class="qbody ${ltr?'ltr':''}">${sol}</div></div>`:'<div class="empty">אין פתרון רשמי לסעיף זה</div>'):''}
    </div>
    <div class="shuf-acts">
      ${SH.revealed
        ? `<button class="btn ok" onclick="shuffleMark(true)">ידעתי ✓</button>
           <button class="btn" style="background:var(--err)" onclick="shuffleMark(false)">עוד לא ✗</button>`
        : `<button class="btn" onclick="shuffleReveal()">חשוב/י — ואז הצג פתרון</button>
           <button class="btn ghost sm" onclick="shuffleSkip()">דלג</button>`}
    </div>
  </div>`;
};
window.shuffleReveal = ()=>{ SH.revealed=true; render(); };
window.shuffleSkip = ()=>{ SH.idx++; SH.revealed=false; render(); window.scrollTo(0,0); };
window.shuffleMark = ok=>{
  const b = SH.list[SH.idx];
  const prev = S.bank[b.key]||{};
  S.bank[b.key] = { done: !!ok, tries: (prev.tries||0)+1 };
  touch('b:'+b.key); save(); refreshChrome();
  SH.marks.push({b, ok:!!ok});
  SH.idx++; SH.revealed=false; render(); window.scrollTo(0,0);
};

/* ---------- דריל סיווג שפות (drill) ---------- */
let DR = null;
const drillHe = { reg:'רגולרית', cfl:'חסרת הקשר (לא רגולרית)', none:'אף לא אחת' };
window.startDrill = ()=>{
  if(!LANGB.length) return toast('מאגר השפות עדיין ריק','e');
  const fresh=[], done=[];
  LANGB.forEach(l=>{ (S.lang[l.id]?.ok ? done : fresh).push(l); });
  const sh = a=>{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  DR = { list: sh(fresh).concat(sh(done)), idx:0, streak:0, best:0, answered:false, picked:null, lastOk:false, sessionOk:0, timer:null };
  go('drill');
};
window.drillPick = ans=>{
  if(!DR || DR.answered) return;
  const l = DR.list[DR.idx], ok = ans===l.ans;
  DR.answered=true; DR.picked=ans; DR.lastOk=ok;
  DR.streak = ok ? DR.streak+1 : 0;
  DR.best = Math.max(DR.best, DR.streak);
  if(ok) DR.sessionOk++;
  const prev = S.lang[l.id]||{};
  S.lang[l.id] = { ok: !!prev.ok || ok, tries:(prev.tries||0)+1 };
  touch('c:'+l.id); save(); refreshChrome(); render();
  if(ok) DR.timer = setTimeout(()=>{ if(DR && DR.answered && view==='drill') drillNext(); }, 1300);
};
window.drillNext = ()=>{
  if(!DR) return; clearTimeout(DR.timer);
  DR.answered=false; DR.picked=null; DR.idx++;
  render();
};
views.drill = ()=>{
  if(!DR) return '<div class="empty">אין דריל פעיל</div>';
  const st = stats();
  if(DR.idx >= DR.list.length){
    return `<div class="drill-wrap"><div class="card" style="padding:20px 22px;text-align:center">
      <h2 style="margin-top:0">סיום סבב הדריל</h2>
      <p>ענית נכון על <b>${num(DR.sessionOk)}</b> מתוך <b>${num(DR.list.length)}</b> · רצף שיא בסבב: <b>${num(DR.best)}</b></p>
      <p class="small muted">בסך הכול סיווגת נכון אי־פעם ${num(st.dL)} מתוך ${num(st.nL)} שפות.</p>
      <div class="shuf-acts">
        <button class="btn" onclick="startDrill()">סבב נוסף</button>
        <button class="btn ghost" onclick="go('bank')">חזרה למאגר</button>
      </div></div></div>`;
  }
  const l = DR.list[DR.idx];
  const opts = [['reg','רגולרית'],['cfl','חסרת הקשר (לא רגולרית)'],['none','אף לא אחת']];
  return `<div class="drill-wrap">
    <div class="shuf-prog">
      <button class="btn ghost sm" onclick="go('bank')">‹ יציאה</button>
      <span class="pill n">${num((DR.idx+1)+'/'+DR.list.length)}</span>
      <span class="pill ${st.dL===st.nL?'g':'n'}" title="סווגו נכון אי־פעם">${num(st.dL+'/'+st.nL)} ✓</span>
      <div style="flex:1"></div>
      <span class="streak" title="רצף נוכחי">🔥 <span class="num">${DR.streak}</span></span>
    </div>
    <div class="card" style="padding:12px 16px;margin-bottom:4px" class="small">
      <span class="small muted">מהו הסיווג <b>החזק ביותר</b> שנכון לשפה? (רגולרית ⊂ חסרת הקשר)</span></div>
    <div class="drill-lang">${l.html}</div>
    <div class="drill-btns">${opts.map(([id,he])=>{
      let cls='';
      if(DR.answered){ cls = id===l.ans ? ' hit' : (id===DR.picked ? ' miss' : ' dim'); }
      return `<button class="dbtn${cls}" ${DR.answered?'disabled':''} onclick="drillPick('${id}')">${he}</button>`;
    }).join('')}</div>
    <div class="drill-fb">
      ${DR.answered
        ? (DR.lastOk
            ? `<span style="color:var(--ok)">נכון ✓</span>&nbsp; <span class="src">מקור: <span class="en">${esc(l.src||'')}</span></span>`
            : `<span style="color:var(--err)">לא נכון —</span> התשובה: <b>${drillHe[l.ans]}</b>&nbsp; <span class="src">מקור: <span class="en">${esc(l.src||'')}</span></span>`)
        : ''}
      ${DR.answered && l.note ? `<div class="small muted" style="font-weight:400;margin-top:4px">${l.note}</div>` : ''}
    </div>
    ${DR.answered ? `<div class="shuf-acts"><button class="btn${DR.lastOk?' ghost':''}" onclick="drillNext()">הבא ›</button></div>` : ''}
  </div>`;
};

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
  openReader(sid, true); setTimeout(()=>{ const e=document.getElementById(sid+'-t'+ti);
    if(e){ e.scrollIntoView(); window.scrollBy(0,-110);} },80); };

/* ---------- reader special pages ---------- */
const origReader = views.reader;
views.reader = () => {
  if(readerSid==='__defs__'){
    return `<div class="reader-top"><button class="btn ghost sm" onclick="go(S.lastView||'dash')">‹ חזרה</button>
      <div style="flex:1"></div><button class="btn ghost sm" onclick="window.print()">הדפס</button></div>
      <div class="summary-body">${DEFS}</div>`;
  }
  return origReader();
};
/* דף הנוסחאות כחלון צף — מתוך מבחן, בלי לאבד את המקום */
window.openDefsModal = ()=>{
  $('#ov').innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <div class="modal-h"><h3>דף נוסחאות והגדרות</h3><button class="x" onclick="closeQuiz()" aria-label="סגור">×</button></div>
    <div class="modal-b"><div class="summary-body">${DEFS}</div></div></div>`;
  $('#ov').hidden = false; document.body.style.overflow='hidden';
};

/* ---------- router ---------- */
const TABS=[['dash','דשבורד'],['summaries','סיכומים'],['topics','נושאי הקורס'],['exams','מבחנים'],['bank','מאגר'],['tools','כלים']];
let view = S.lastView && views[S.lastView] ? S.lastView : 'dash';
/* מעבר בין לשוניות הוא העדפת תצוגה מקומית בלבד — הוא לא "התקדמות".
   קודם הוא קרא ל-save() ולכן עצם הדפדוף במכשיר ישן הפך אותו ל"חדש
   ביותר" ודרס בענן התקדמות אמיתית ממכשיר אחר.                       */
window.go = (v)=>{ if(view==='reader' && v!=='reader') flushCheckpoint();
  view=v; if(['dash','summaries','topics','exams','bank','tools'].includes(v)){ S.lastView=v; saveLocal(); }
  render(); window.scrollTo(0,0); };
function render(){
  $$('#tabs .tab').forEach(b=>b.setAttribute('aria-selected', String(b.dataset.v===view)));
  $('#app').innerHTML = (views[view]||views.dash)();
  refreshChrome();
  if(view==='reader'){ syncTbh(); decorateReader(); }
  const dt=$('#exam-date'); if(dt) dt.onchange=e=>{ S.examDate=e.target.value; touch('examDate'); save(); render(); };
  if(window.__fabUpdate) requestAnimationFrame(window.__fabUpdate);
}
window.render = render;


/* ===================== סנכרון ענן (JSONBin) ===================== */
/* אין סוד קשיח בקובץ. ההגדרות נשמרות ב-localStorage של כל מכשיר בנפרד,
   או מוזרקות פעם אחת דרך פרמטרים ב-URL.                                */
const CKEY = 'cm-prep-cloud';
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
         Object.keys(x.topics||{}).length + Object.keys(x.tread||{}).length +
         Object.keys(x.exams||{}).length +
         Object.keys(x.bank||{}).length + Object.keys(x.lang||{}).length;
}
/* כל מפתחות ה"התקדמות" של רשומה, בפורמט של mt */
function allKeys(rec){
  const out = [];
  Object.keys(rec.read||{}).forEach(k=>out.push('r:'+k));
  Object.keys(rec.understood||{}).forEach(k=>out.push('u:'+k));
  Object.keys(rec.topics||{}).forEach(k=>out.push('t:'+k));
  Object.keys(rec.exams||{}).forEach(id=>{ out.push('e:'+id);
    Object.keys((rec.exams[id]||{}).answers||{}).forEach(pid=>out.push(akey(id,pid))); });
  Object.keys(rec.tread||{}).forEach(k=>out.push('k:'+k));
  Object.keys(rec.bank||{}).forEach(k=>out.push('b:'+k));
  Object.keys(rec.lang||{}).forEach(k=>out.push('c:'+k));
  Object.keys(rec.cp||{}).forEach(k=>out.push('p:'+k));
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
  out.tread      = mergeMap('k:', recA.tread,      recB.tread,      recA, recB, mt);
  out.cp         = mergeMap('p:', recA.cp,         recB.cp,         recA, recB, mt);
  out.bank       = mergeMap('b:', recA.bank,       recB.bank,       recA, recB, mt);
  out.lang       = mergeMap('c:', recA.lang,       recB.lang,       recA, recB, mt);
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
                    b:x.bank||{}, l:x.lang||{}, k:x.tread||{}, p:x.cp||{},
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
              : v==='exams'?'<span class="badge" id="tb-exam"></span>'
              : v==='bank'?'<span class="badge" id="tb-bank"></span>':'';
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
  if(cpDirty){ cpDirty = false; S.updatedAt = Date.now(); }   // המקום שעצרנו בו נשמר גם בסגירת הדף
  writeLocal();   // בלי לחדש חותמת זמן סתם — אחרת סגירת דף תיראה כשינוי
});
/* עזיבת הלשונית (במיוחד בנייד) — לדחוף את הצ'קפוינט לענן */
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) flushCheckpoint(); });
syncTbh();
render();
})();

