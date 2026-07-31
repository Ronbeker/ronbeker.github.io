#!/usr/bin/env python3
"""Assemble index.html from src/ and validate every content invariant.

Usage:
  python3 tools/build.py            build + validate -> index.html
  python3 tools/build.py --check    validate only (no write)
  python3 tools/build.py --freeze   build + update tools/shipped.json (append-only manifest)

Hard-fails (exit 1) on any invariant violation. See README.md for the list.
"""
import json, re, sys, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
TITLE = 'מודלים חישוביים — מרכז הכנה למבחן'

errors, warnings = [], []
def err(msg): errors.append(msg)
def warn(msg): warnings.append(msg)

def read(p): return p.read_text(encoding='utf-8')

def jload(p):
    try:
        return json.loads(read(p))
    except json.JSONDecodeError as e:
        err(f'{p.relative_to(ROOT)}: invalid JSON — {e}')
        return None

# ---------- load sources ----------
shell = read(SRC / 'shell.html')
app_css = read(SRC / 'app.css')
content_css = read(SRC / 'content.css')
app_js = read(SRC / 'app.js')
defs_html = read(SRC / 'defs.html')
tax = jload(SRC / 'taxonomy.json') or {'subjects': [], 'qtypes': []}
langbank = jload(SRC / 'langbank.json')
if langbank is None: langbank = []

SUBJ = {s['id'] for s in tax['subjects']}
QT = {t['id'] for t in tax['qtypes']}

# ---------- summaries + quiz ----------
summaries, quiz = [], []
sum_files = sorted((SRC / 'summaries').glob('ch*.json'))
for meta_p in sum_files:
    meta = jload(meta_p)
    if meta is None: continue
    html_p = meta_p.with_suffix('.html')
    if not html_p.exists():
        err(f'{meta_p.name}: missing companion {html_p.name}'); continue
    html = read(html_p)
    sid = meta.get('sid', '')
    for field in ('sid', 'group', 'title', 'topics'):
        if not meta.get(field): err(f'{meta_p.name}: missing field "{field}"')
    h2s = re.findall(r'<h2\s+id="([^"]+)"', html)
    want = [f'{sid}-t{i}' for i in range(len(meta.get('topics', [])))]
    if h2s != want:
        err(f'{meta_p.name}: <h2 id> sequence mismatch.\n  expected: {want}\n  found:    {h2s}')
    summaries.append({'sid': sid, 'group': meta['group'], 'title': meta['title'],
                      'topics': meta['topics'], 'html': html})

quiz_files = sorted((SRC / 'quiz').glob('ch*.json'))
for qp in quiz_files:
    q = jload(qp)
    if q is None: continue
    quiz.append(q)

sids = [s['sid'] for s in summaries]
if len(set(sids)) != len(sids): err(f'duplicate sids: {sids}')
qsids = [q['sid'] for q in quiz]
if set(sids) != set(qsids):
    err(f'summaries/quiz sid sets differ: {sorted(set(sids) ^ set(qsids))}')
qBy = {q['sid']: q for q in quiz}
for s in summaries:
    q = qBy.get(s['sid'])
    if not q: continue
    if len(q.get('topics', [])) != len(s['topics']):
        err(f"quiz {s['sid']}: {len(q.get('topics', []))} topics vs summary {len(s['topics'])}")
        continue
    for i, (st, qt_) in enumerate(zip(s['topics'], q['topics'])):
        if qt_.get('t') != st:
            err(f"quiz {s['sid']} topic {i}: title mismatch\n  summary: {st}\n  quiz:    {qt_.get('t')}")
        qs = qt_.get('q', [])
        if len(qs) != 3: err(f"quiz {s['sid']}|{i}: {len(qs)} questions (need exactly 3)")
        for j, item in enumerate(qs):
            if len(item.get('c', [])) != 4: err(f"quiz {s['sid']}|{i} q{j}: needs 4 choices")
            if 'a' in item:
                err(f"quiz {s['sid']}|{i} q{j}: source must not carry 'a' — "
                    f"write the CORRECT answer as c[0]; the build rotates choices")
            if not item.get('e'): err(f"quiz {s['sid']}|{i} q{j}: empty explanation")
            if not item.get('q'): err(f"quiz {s['sid']}|{i} q{j}: empty question")
            # deterministic rotation: correct answer written first in source,
            # placed at a stable pseudo-random position in the artifact
            c = item.get('c', [])
            if len(c) == 4:
                r = zlib.crc32(f"{s['sid']}|{i}|{j}".encode()) % 4
                item['c'] = [c[(k - r) % 4] for k in range(4)]
                item['a'] = r

# duplicate html ids across all summaries + defs (exam html checked after exams load)
all_ids = re.findall(r'\bid="([^"]+)"', ''.join(s['html'] for s in summaries) + defs_html)
dupes = {i for i in all_ids if all_ids.count(i) > 1}
if dupes: err(f'duplicate html ids in content: {sorted(dupes)}')

# ---------- exams ----------
SECT_RE = re.compile(r'<section\s+data-ref="([^"]*)"\s*>(.*?)</section>', re.S)
exams = []
for ep in sorted((SRC / 'exams').glob('*.json')):
    e = jload(ep)
    if e is None: continue
    eid = e.get('id', ep.stem)
    if eid != ep.stem: err(f'{ep.name}: id "{eid}" does not match filename')
    pids = []
    for qq in e.get('questions', []):
        for p in qq.get('parts', []):
            pid = p.get('pid', '')
            pids.append(pid)
            if p.get('kind') not in ('open', 'tf', 'mc'):
                err(f'{eid} {pid}: bad kind {p.get("kind")!r}')
            if p.get('kind') == 'mc' and not p.get('choices'):
                err(f'{eid} {pid}: mc without choices')
            tags = p.get('tags')
            if not tags or tags.get('subj') not in SUBJ or tags.get('qt') not in QT:
                err(f'{eid} {pid}: missing/invalid tags {tags!r}')
    if len(set(pids)) != len(pids):
        err(f'{eid}: duplicate pids {sorted({p for p in pids if pids.count(p) > 1})}')
    qnums = [str(qq.get('n')) for qq in e.get('questions', [])]
    sol_p = ep.with_name(ep.stem + '.sol.html')
    sol = []
    if sol_p.exists():
        stext = read(sol_p)
        covered = SECT_RE.sub('', stext).strip()
        if covered: err(f'{sol_p.name}: content outside <section data-ref> blocks: {covered[:80]!r}')
        for ref, html in SECT_RE.findall(stext):
            if ref == '__extra__':
                e['solutionExtra'] = html.strip(); continue
            if ref != '' and ref not in pids and ref not in qnums:
                err(f'{sol_p.name}: ref "{ref}" matches no pid/question')
            sol.append({'ref': ref, 'html': html.strip()})
        solved = {s_['ref'] for s_ in sol}
        for pid in pids:
            if pid not in solved and not (solved & set(qnums)) and '' not in solved:
                warn(f'{eid}: part {pid} has no solution section')
    else:
        warn(f'{eid}: no solution file')
    e['solution'] = sol
    exams.append(e)
eids = [e['id'] for e in exams]
if len(set(eids)) != len(eids): err(f'duplicate exam ids: {eids}')

# no id= collisions inside exam html either (svg markers etc. live once in the shell)
exam_html = ''.join(
    (q.get('intro') or '') + ''.join(p.get('prompt') or '' for p in q['parts'])
    for e in exams for q in e['questions']
) + ''.join(s_['html'] for e in exams for s_ in e['solution'])
exam_ids = re.findall(r'\bid="([^"]+)"', exam_html)
bad = [i for i in exam_ids if exam_ids.count(i) > 1 or i in all_ids or i == 'arr']
if bad: err(f'duplicate/reserved html ids in exam content: {sorted(set(bad))}')

# ---------- langbank ----------
lids = [l.get('id', '') for l in langbank]
if len(set(lids)) != len(lids): err('duplicate langbank ids')
for l in langbank:
    if not re.fullmatch(r'L\d{3}', l.get('id', '')): err(f'langbank id {l.get("id")!r} not L\\d{{3}}')
    if l.get('ans') not in ('reg', 'cfl', 'none'): err(f'langbank {l.get("id")}: bad ans {l.get("ans")!r}')
    if not l.get('html'): err(f'langbank {l.get("id")}: empty html')

# ---------- freeze manifest (append-only guarantees) ----------
shipped_p = ROOT / 'tools' / 'shipped.json'
shipped = json.loads(read(shipped_p)) if shipped_p.exists() else {'summaries': {}, 'exams': {}, 'langbank': []}
for sid, frozen in shipped.get('summaries', {}).items():
    cur = next((s['topics'] for s in summaries if s['sid'] == sid), None)
    if cur is None: err(f'frozen summary {sid} was removed')
    elif cur[:len(frozen)] != frozen: err(f'frozen summary {sid}: shipped topics changed (append-only!)')
for eid, frozen in shipped.get('exams', {}).items():
    cur = next((e for e in exams if e['id'] == eid), None)
    if cur is None: err(f'frozen exam {eid} was removed')
    else:
        cur_pids = [p['pid'] for q in cur['questions'] for p in q['parts']]
        missing = [p for p in frozen if p not in cur_pids]
        if missing: err(f'frozen exam {eid}: pids removed/renamed: {missing}')
for lid in shipped.get('langbank', []):
    if lid not in lids: err(f'frozen langbank id {lid} was removed')

# ---------- misc guards ----------
if '</script' in defs_html.lower(): err('defs.html contains </script>')
if '/*@@TAX@@*/ null' not in app_js: err('app.js: missing "/*@@TAX@@*/ null" marker')
for marker in ('@@TITLE@@', '@@APP_CSS@@', '@@CONTENT_CSS@@', '@@DATA_SUMMARIES@@',
               '@@DATA_QUIZ@@', '@@DATA_EXAMS@@', '@@DATA_LANGBANK@@', '@@DEFS_HTML@@', '@@APP_JS@@'):
    if marker not in shell: err(f'shell.html: missing marker {marker}')

# ---------- report / bail ----------
for w in warnings: print(f'  warn: {w}')
if errors:
    print(f'\nBUILD FAILED — {len(errors)} error(s):')
    for e_ in errors: print(f'  ERROR: {e_}')
    sys.exit(1)

def blob(data):
    return json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('/', '\\/')

if '--check' in sys.argv:
    print(f'check OK: {len(summaries)} chapters, {sum(len(s["topics"]) for s in summaries)} topics, '
          f'{len(exams)} exams, {len(langbank)} languages')
    sys.exit(0)

js = app_js.replace('/*@@TAX@@*/ null', json.dumps(tax, ensure_ascii=False, separators=(',', ':')), 1)
out = (shell
       .replace('@@TITLE@@', TITLE)
       .replace('@@APP_CSS@@', app_css)
       .replace('@@CONTENT_CSS@@', content_css)
       .replace('@@DATA_SUMMARIES@@', blob(summaries))
       .replace('@@DATA_QUIZ@@', blob(quiz))
       .replace('@@DATA_EXAMS@@', blob(exams))
       .replace('@@DATA_LANGBANK@@', blob(langbank))
       .replace('@@DEFS_HTML@@', defs_html)
       .replace('@@APP_JS@@', js))
out = out.replace('<!DOCTYPE html>',
                  '<!DOCTYPE html>\n<!-- GENERATED by tools/build.py — DO NOT EDIT; edit src/ and rebuild -->', 1)
(ROOT / 'index.html').write_text(out, encoding='utf-8')

nT = sum(len(s['topics']) for s in summaries)
nP = sum(len(q['parts']) for e in exams for q in e['questions'])
nTagged = sum(1 for e in exams for q in e['questions'] for p in q['parts'] if p.get('tags'))
denom = 2 * len(summaries) + nT + len(exams) + nTagged + len(langbank)
print(f'built index.html ({len(out.encode("utf-8"))//1024} KB)')
print(f'  chapters: {len(summaries)} · topics: {nT} · quiz questions: {nT * 3}')
print(f'  exams: {len(exams)} · parts: {nP} (tagged: {nTagged}) · languages: {len(langbank)}')
print(f'  progress denominator: {denom}')

if '--freeze' in sys.argv:
    shipped = {
        'summaries': {s['sid']: s['topics'] for s in summaries},
        'exams': {e['id']: [p['pid'] for q in e['questions'] for p in q['parts']] for e in exams},
        'langbank': lids,
    }
    shipped_p.write_text(json.dumps(shipped, ensure_ascii=False, indent=1), encoding='utf-8')
    print('froze tools/shipped.json')
