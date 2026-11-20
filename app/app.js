// Leonida Legend: an offline GTA VI trophy tracker. Loads app/data/trophies.json,
// renders the roadmap, the checklist and the cited guides, and keeps progress in
// localStorage with export/import. No network requests beyond the local data file.
const EARNED_KEY = 'gta6-trophy-earned-v1';
const PREFS_KEY = 'gta6-trophy-prefs-v1';
const DATA_URL = 'data/trophies.json';

const listEl = document.getElementById('trophyList');
const statusEl = document.getElementById('listStatus');
const emptyNoteEl = document.getElementById('emptyNote');
const onlineNoteEl = document.getElementById('onlineNote');
const searchEl = document.getElementById('search');
const gradeEl = document.getElementById('grade');
const spoilersEl = document.getElementById('spoilers');
const earnedOnlyEl = document.getElementById('earnedOnly');
const kindChipsEl = document.getElementById('kindChips');

let trophyData = null;
let earned = loadEarnedProgress();
let prefs = loadPrefs();
let viewOverride = parseViewParams();

function loadEarnedProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(EARNED_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((n) => Number.isInteger(n)) : []);
  } catch {
    return new Set();
  }
}

function saveEarnedProgress() {
  localStorage.setItem(EARNED_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
}

function loadPrefs() {
  const defaults = { kind: 'all', grade: 'all', spoilers: true, earnedOnly: false, search: '' };
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
    return { ...defaults, ...raw };
  } catch {
    return defaults;
  }
}

function savePrefs() {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// Shareable view links: ?earn=2,3,28 pre-ticks trophies for this view only,
// ?open=28 scrolls to one trophy, ?spoilers=off and ?kind=story set the view.
function parseViewParams() {
  const params = new URLSearchParams(location.search);
  const out = {};
  if (params.has('earn')) {
    out.earn = params.get('earn').split(',').map((s) => Number(s)).filter((n) => Number.isInteger(n));
  }
  if (params.has('open')) out.open = Number(params.get('open'));
  if (params.has('spoilers')) out.spoilers = params.get('spoilers') !== 'off';
  if (params.has('kind')) out.kind = params.get('kind');
  if (params.has('search')) out.search = params.get('search');
  return out;
}

async function loadTrophyData() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error('Could not load ' + DATA_URL);
  return response.json();
}

function gradeLabel(grade) {
  return grade.charAt(0).toUpperCase() + grade.slice(1);
}

function formatCount(trophy) {
  if (trophy.count == null) return '';
  if (trophy.id === 52) return 'Target: $250,000 in Marked Bills laundered';
  if (trophy.id === 53) return 'Target: $100,000 spent across all shops';
  if (trophy.count_of) return `Target: ${trophy.count} of ${trophy.count_of}`;
  return `Target: ${trophy.count}`;
}

function trophyMatchesFilters(trophy) {
  if (prefs.kind === 'missable' && !trophy.missable) return false;
  if (prefs.kind === 'online') return false;
  if (prefs.kind !== 'all' && prefs.kind !== 'missable' && !trophy.kinds.includes(prefs.kind)) return false;
  if (prefs.grade !== 'all' && trophy.grade !== prefs.grade) return false;
  if (prefs.earnedOnly && !earned.has(trophy.id)) return false;
  if (prefs.search) {
    const hay = `${trophy.name} ${trophy.description} ${trophy.guide}`.toLowerCase();
    if (!hay.includes(prefs.search.toLowerCase())) return false;
  }
  return true;
}

function isSpoilerMasked(trophy) {
  return prefs.spoilers && trophy.hidden && !earned.has(trophy.id);
}

function makeSourceLink(source) {
  const a = document.createElement('a');
  a.href = source.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = source.name;
  return a;
}

function renderTrophyCard(trophy) {
  const card = document.createElement('article');
  card.className = 'trophy-card';
  card.id = `trophy-${trophy.id}`;
  if (earned.has(trophy.id)) card.classList.add('earned');
  if (trophy.missable) card.classList.add('missable-flag');

  const top = document.createElement('div');
  top.className = 'trophy-top';

  const checkWrap = document.createElement('label');
  checkWrap.className = 'trophy-check';
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.checked = earned.has(trophy.id);
  check.setAttribute('aria-label', `Mark ${trophy.name} as earned`);
  check.addEventListener('change', () => {
    if (check.checked) earned.add(trophy.id);
    else earned.delete(trophy.id);
    saveEarnedProgress();
    renderTrophyList();
    updateProgressSummary();
  });
  checkWrap.append(check);

  const main = document.createElement('div');
  main.className = 'trophy-main';

  const nameRow = document.createElement('div');
  nameRow.className = 'trophy-name-row';
  const name = document.createElement('span');
  name.className = 'trophy-name';
  name.textContent = isSpoilerMasked(trophy) ? 'Hidden story trophy' : trophy.name;
  nameRow.append(name);

  const gradeBadge = document.createElement('span');
  gradeBadge.className = `grade-badge grade-${trophy.grade}`;
  gradeBadge.textContent = gradeLabel(trophy.grade);
  nameRow.append(gradeBadge);

  if (trophy.missable) {
    const tag = document.createElement('span');
    tag.className = 'tag missable-tag';
    tag.textContent = 'Possibly missable';
    nameRow.append(tag);
  }
  if (trophy.hidden) {
    const tag = document.createElement('span');
    tag.className = 'tag hidden-tag';
    tag.textContent = 'Hidden on PlayStation';
    nameRow.append(tag);
  }
  trophy.kinds.forEach((kind) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = kind === 'platinum' ? 'Platinum' : kind.charAt(0).toUpperCase() + kind.slice(1);
    nameRow.append(tag);
  });
  main.append(nameRow);

  if (isSpoilerMasked(trophy)) {
    const mask = document.createElement('div');
    mask.className = 'spoiler-mask';
    mask.textContent = 'Its name, description and guide are hidden until you earn it — spoiler protection is on. ';
    const hint = document.createElement('span');
    hint.className = 'reveal-hint';
    hint.textContent = 'Tick the box once you have earned it to reveal the guide.';
    mask.append(hint);
    main.append(mask);
  } else {
    const desc = document.createElement('p');
    desc.className = 'trophy-desc';
    desc.textContent = trophy.description;
    main.append(desc);

    const countText = formatCount(trophy);
    if (countText) {
      const count = document.createElement('p');
      count.className = 'trophy-count';
      count.textContent = countText;
      main.append(count);
    }

    const guideWrap = document.createElement('div');
    guideWrap.className = 'trophy-guide';
    const guide = document.createElement('p');
    guide.textContent = trophy.guide;
    guideWrap.append(guide);
    main.append(guideWrap);

    const sources = document.createElement('p');
    sources.className = 'trophy-sources';
    sources.textContent = 'Sources: ';
    (trophy.src || []).forEach((key) => {
      const source = trophyData.sources[key];
      if (source) sources.append(makeSourceLink(source));
    });
    main.append(sources);
  }

  top.append(checkWrap, main);
  card.append(top);
  return card;
}

function renderTrophyList() {
  const visible = trophyData.trophies.filter(trophyMatchesFilters);
  listEl.replaceChildren();
  visible.forEach((trophy) => listEl.append(renderTrophyCard(trophy)));
  emptyNoteEl.hidden = visible.length > 0 || prefs.kind === 'online';
  onlineNoteEl.hidden = prefs.kind !== 'online';
  const shown = visible.length;
  const total = trophyData.trophies.length;
  statusEl.textContent = prefs.kind === 'online'
    ? 'Online filter: 0 of 55 trophies — GTA VI has no online trophies.'
    : `Showing ${shown} of ${total} trophies · ${earned.size} earned`;
}

function updateProgressSummary() {
  const total = trophyData.trophies.length;
  const pct = Math.round((earned.size / total) * 100);
  document.getElementById('progressCount').textContent = `${earned.size} / ${total}`;
  document.getElementById('progressLabel').textContent = earned.size === total
    ? 'trophies earned — platinum unlocked!'
    : 'trophies earned';
  const fill = document.getElementById('progressFill');
  fill.style.width = `${pct}%`;
  const bar = document.getElementById('progressBar');
  bar.setAttribute('aria-valuenow', String(earned.size));
  const counts = ['platinum', 'gold', 'silver', 'bronze'].map((grade) => {
    const inGrade = trophyData.trophies.filter((t) => t.grade === grade);
    const got = inGrade.filter((t) => earned.has(t.id)).length;
    return `${got}/${inGrade.length} ${grade}`;
  });
  document.getElementById('gradeCounts').textContent = counts.join(' · ');
}

function renderRoadmapCounts() {
  [1, 2, 3].forEach((stage) => {
    const inStage = trophyData.trophies.filter((t) => t.stage === stage);
    const got = inStage.filter((t) => earned.has(t.id)).length;
    const el = document.getElementById(`step${stage}Trophies`);
    if (el) {
      const strong = document.createElement('strong');
      strong.textContent = `${got}/${inStage.length} trophies in this step earned`;
      el.replaceChildren(strong, document.createTextNode(` — ${inStage.map((t) => t.name).join(', ')}`));
    }
  });
}

function renderSourceList() {
  const list = document.getElementById('sourceList');
  Object.values(trophyData.sources).forEach((source) => {
    const li = document.createElement('li');
    li.append(makeSourceLink(source));
    list.append(li);
  });
}

function applyPrefsToControls() {
  searchEl.value = prefs.search;
  gradeEl.value = prefs.grade;
  spoilersEl.checked = prefs.spoilers;
  earnedOnlyEl.checked = prefs.earnedOnly;
  kindChipsEl.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.kind === prefs.kind);
  });
}

function exportProgressFile() {
  const payload = {
    app: 'Leonida Legend — GTA VI Trophy Guide & Tracker',
    version: 1,
    exported_at: new Date().toISOString(),
    earned: [...earned].sort((a, b) => a - b),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gta6-trophy-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importProgressFile(file) {
  if (!file) return;
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    statusEl.textContent = 'Import failed: that file is not valid JSON.';
    return;
  }
  const ids = Array.isArray(parsed) ? parsed : parsed.earned;
  if (!Array.isArray(ids)) {
    statusEl.textContent = 'Import failed: no earned trophy list found in that file.';
    return;
  }
  const valid = new Set(trophyData.trophies.map((t) => t.id));
  const imported = ids.filter((n) => Number.isInteger(n) && valid.has(n));
  earned = new Set(imported);
  saveEarnedProgress();
  renderTrophyList();
  renderRoadmapCounts();
  updateProgressSummary();
  statusEl.textContent = `Imported ${imported.length} earned trophies from ${file.name}.`;
}

function resetProgress() {
  if (!earned.size) return;
  earned = new Set();
  saveEarnedProgress();
  renderTrophyList();
  renderRoadmapCounts();
  updateProgressSummary();
}

function bindControls() {
  searchEl.addEventListener('input', () => {
    prefs.search = searchEl.value;
    savePrefs();
    renderTrophyList();
  });
  gradeEl.addEventListener('change', () => {
    prefs.grade = gradeEl.value;
    savePrefs();
    renderTrophyList();
  });
  spoilersEl.addEventListener('change', () => {
    prefs.spoilers = spoilersEl.checked;
    savePrefs();
    renderTrophyList();
  });
  earnedOnlyEl.addEventListener('change', () => {
    prefs.earnedOnly = earnedOnlyEl.checked;
    savePrefs();
    renderTrophyList();
  });
  kindChipsEl.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    prefs.kind = chip.dataset.kind;
    savePrefs();
    applyPrefsToControls();
    renderTrophyList();
  });
  document.getElementById('export').addEventListener('click', exportProgressFile);
  document.getElementById('import').addEventListener('change', (event) => {
    importProgressFile(event.target.files[0]);
    event.target.value = '';
  });
  document.getElementById('reset').addEventListener('click', resetProgress);
}

async function initTracker() {
  trophyData = await loadTrophyData();
  if (viewOverride.earn) earned = new Set(viewOverride.earn);
  if (viewOverride.spoilers !== undefined) prefs.spoilers = viewOverride.spoilers;
  if (viewOverride.kind) prefs.kind = viewOverride.kind;
  if (viewOverride.search !== undefined) prefs.search = viewOverride.search;
  applyPrefsToControls();
  bindControls();
  renderSourceList();
  renderRoadmapCounts();
  renderTrophyList();
  updateProgressSummary();
  if (viewOverride.open) {
    const target = document.getElementById(`trophy-${viewOverride.open}`);
    if (target) target.scrollIntoView({ block: 'center' });
  }
}

initTracker().catch((error) => {
  statusEl.textContent = 'Could not load the trophy list. ' + error.message;
});
