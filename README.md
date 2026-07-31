# ronbeker.github.io — מרכז הכנה למבחן

Static, single-file exam-prep sites served by GitHub Pages.

- **`/` (root)** — the active site: **מודלים חישוביים (Computational Models)**.
- **`/os/`** — archived, fully functional: **מערכות הפעלה (Operating Systems)**. Never edit `os/index.html` (its one back-link anchor is the only change ever made). Its progress lives in `localStorage['os-prep-v1']` + its own JSONBin bin and must stay untouched.

## Build workflow

`index.html` at the root is a **generated artifact** — do not edit it by hand. Sources live in `src/`; assemble with:

```bash
python3 tools/build.py
```

The build inlines `src/shell.html` + `app.css` + `content.css` + `app.js` + `defs.html`, and emits four single-line JSON data blobs from `src/summaries/`, `src/quiz/`, `src/exams/`, `src/langbank.json`. It **hard-fails** on any invariant violation. Commit both the changed sources and the regenerated `index.html`.

## Invariants (enforced by tools/build.py)

1. `summaries/chNN.json` `topics[i]` ↔ `<h2 id="{sid}-t{i}">` in `chNN.html` — same count, sequential ids.
2. `quiz/chNN.json` matches its summary positionally: same sid, same topic count, **exactly 3 MCQs per topic**, 4 choices each, `a ∈ 0..3`.
3. Exam `pid`s unique per exam; every part carries `tags:{subj,qt}` drawn from `src/taxonomy.json`; every `solution` section's `data-ref` matches a pid, a question `n`, or is empty.
4. **Frozen content is append-only** (`tools/shipped.json`, updated via `python3 tools/build.py --freeze`): shipped topic lists may only grow at the end; shipped exam pids may never be renamed or removed — they key saved answers (`a:{eid}|{pid}`), bank marks (`b:`), and topic progress (`t:{sid}|{i}`) in users' localStorage/JSONBin state.

## State & sync

New site namespaces: `localStorage['cm-prep-v1']` (state) / `cm-prep-v1-bak` (backup) / `cm-prep-cloud` (JSONBin config). Cloud sync is optional per-item-merge over JSONBin; credentials are never committed — they're entered in the Tools tab or injected once via `?bin=…&key=…`.

## Deploy

```bash
python3 tools/build.py && git add -A && git commit && git push
```

GitHub Pages serves `main` verbatim (`.nojekyll` present).
