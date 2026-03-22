import { validatePointInputDraft } from '/src/domain/validation.js';

const STORAGE_KEY = 'rally-analysis-v1';
const ZONES = ['Z1','Z2','Z3','Z4','Z5','Z6','Z7','Z8','Z9'];

const state = {
  matches: [],
  selectedMatchId: null,
};

const el = {
  createMatchForm: document.getElementById('create-match-form'),
  matchList: document.getElementById('match-list'),
  currentMatchInfo: document.getElementById('current-match-info'),
  pointForm: document.getElementById('point-form'),
  shotForms: document.getElementById('shot-forms'),
  pointErrors: document.getElementById('point-errors'),
  detailEmpty: document.getElementById('detail-empty'),
  detailContent: document.getElementById('detail-content'),
  pointList: document.getElementById('point-list'),
  analysis: document.getElementById('analysis'),
};

function uid() {
  return crypto.randomUUID();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    state.matches = Array.isArray(parsed.matches) ? parsed.matches : [];
    state.selectedMatchId = parsed.selectedMatchId || null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    matches: state.matches,
    selectedMatchId: state.selectedMatchId,
  }));
}

function selectedMatch() {
  return state.matches.find((m) => m.id === state.selectedMatchId) || null;
}

function createEmptyShots() {
  return [1,2,3,4,5].map((reverseOrder) => ({ reverseOrder }));
}

function collectPointDraftFromForm(form, matchId) {
  const fd = new FormData(form);
  const shots = [1,2,3,4,5].map((n) => ({
    reverseOrder: n,
    hitterSide: fd.get(`shot-${n}-hitter`) || undefined,
    targetZoneId: fd.get(`shot-${n}-zone`) || undefined,
    note: fd.get(`shot-${n}-note`) || undefined,
  }));

  return {
    matchId,
    pointNumber: Number(fd.get('pointNumber')),
    myScoreAfter: fd.get('myScoreAfter') === '' ? undefined : Number(fd.get('myScoreAfter')),
    opponentScoreAfter: fd.get('opponentScoreAfter') === '' ? undefined : Number(fd.get('opponentScoreAfter')),
    pointResult: fd.get('pointResult') || undefined,
    finishType: fd.get('finishType') || undefined,
    memo: fd.get('memo') || undefined,
    shots,
  };
}

function renderShotForms() {
  el.shotForms.innerHTML = '';

  createEmptyShots().forEach((shot) => {
    const card = document.createElement('div');
    card.className = 'shot-card stack';

    const title = shot.reverseOrder === 1 ? 'Shot 1（決まり球・必須）' : `Shot ${shot.reverseOrder}（任意）`;
    card.innerHTML = `
      <strong>${title}</strong>
      <div class="inline">
        <label><input type="radio" name="shot-${shot.reverseOrder}-hitter" value="me" /> 自分</label>
        <label><input type="radio" name="shot-${shot.reverseOrder}-hitter" value="opponent" /> 相手</label>
      </div>
      <input type="hidden" name="shot-${shot.reverseOrder}-zone" value="" />
      <div class="zone-grid" id="zone-grid-${shot.reverseOrder}"></div>
      <input name="shot-${shot.reverseOrder}-note" placeholder="ショットメモ（任意）" />
    `;

    el.shotForms.appendChild(card);

    const grid = card.querySelector(`#zone-grid-${shot.reverseOrder}`);
    const hidden = card.querySelector(`input[name='shot-${shot.reverseOrder}-zone']`);

    ZONES.forEach((zone) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'zone-btn';
      button.textContent = zone;
      button.addEventListener('click', () => {
        hidden.value = zone;
        [...grid.querySelectorAll('.zone-btn')].forEach((b) => b.classList.remove('active'));
        button.classList.add('active');
      });
      grid.appendChild(button);
    });
  });
}

function nextPointNumber(match) {
  if (!match.points.length) return 1;
  return Math.max(...match.points.map((p) => p.pointNumber)) + 1;
}

function renderMatchList() {
  el.matchList.innerHTML = '';

  state.matches.forEach((m) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${m.title}</strong><br />
        <span class="muted">${m.matchDate} / ${m.matchType} / ${m.opponentName || '-'}</span>
      </div>
    `;
    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.textContent = m.id === state.selectedMatchId ? '選択中' : '選択';
    selectBtn.disabled = m.id === state.selectedMatchId;
    selectBtn.addEventListener('click', () => {
      state.selectedMatchId = m.id;
      saveState();
      render();
    });
    li.appendChild(selectBtn);
    el.matchList.appendChild(li);
  });
}

function renderPointForm() {
  const match = selectedMatch();
  if (!match) {
    el.currentMatchInfo.textContent = '試合を選択してください';
    el.pointForm.classList.add('hidden');
    return;
  }

  el.currentMatchInfo.textContent = `${match.title} / ${match.matchDate} / point数: ${match.points.length}`;
  el.pointForm.classList.remove('hidden');
  el.pointForm.pointNumber.value = String(nextPointNumber(match));
}

function renderDetails() {
  const match = selectedMatch();
  if (!match) {
    el.detailEmpty.classList.remove('hidden');
    el.detailContent.classList.add('hidden');
    return;
  }

  el.detailEmpty.classList.add('hidden');
  el.detailContent.classList.remove('hidden');

  const ordered = [...match.points].sort((a, b) => a.pointNumber - b.pointNumber);
  el.pointList.innerHTML = ordered
    .map((p) => `<tr><td>${p.pointNumber}</td><td>${p.pointResult}</td><td>${p.finishType}</td><td>${p.shots.length}</td></tr>`)
    .join('');

  const finishWon = ordered.filter((p) => p.pointResult === 'won').reduce((acc, p) => {
    acc[p.finishType] = (acc[p.finishType] || 0) + 1;
    return acc;
  }, {});

  const lostZone = ordered
    .filter((p) => p.pointResult === 'lost')
    .map((p) => p.shots.find((s) => s.reverseOrder === 1)?.targetZoneId)
    .filter(Boolean)
    .reduce((acc, z) => {
      acc[z] = (acc[z] || 0) + 1;
      return acc;
    }, {});

  el.analysis.innerHTML = `
    <p><strong>得点時の決まり方</strong>: ${JSON.stringify(finishWon)}</p>
    <p><strong>失点時の決まり球ゾーン</strong>: ${JSON.stringify(lostZone)}</p>
  `;
}

function render() {
  renderMatchList();
  renderPointForm();
  renderDetails();
}

el.createMatchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const fd = new FormData(el.createMatchForm);

  const match = {
    id: uid(),
    title: String(fd.get('title')),
    opponentName: String(fd.get('opponentName') || ''),
    matchDate: String(fd.get('matchDate')),
    matchType: String(fd.get('matchType')),
    points: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.matches.unshift(match);
  state.selectedMatchId = match.id;
  saveState();
  el.createMatchForm.reset();
  render();
});

el.pointForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const match = selectedMatch();
  if (!match) return;

  const draft = collectPointDraftFromForm(el.pointForm, match.id);
  const result = validatePointInputDraft(draft);
  if (!result.ok) {
    el.pointErrors.textContent = result.errors.join('\n');
    return;
  }

  if (match.points.some((p) => p.pointNumber === draft.pointNumber)) {
    el.pointErrors.textContent = '同一試合内でポイント番号が重複しています';
    return;
  }

  const point = {
    id: uid(),
    matchId: match.id,
    pointNumber: draft.pointNumber,
    myScoreAfter: draft.myScoreAfter,
    opponentScoreAfter: draft.opponentScoreAfter,
    pointResult: draft.pointResult,
    finishType: draft.finishType,
    memo: draft.memo,
    shots: result.normalizedShots,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  match.points.push(point);
  match.updatedAt = new Date().toISOString();

  saveState();
  el.pointErrors.textContent = 'ポイントを保存しました';
  el.pointForm.reset();
  renderShotForms();
  render();
});

loadState();
renderShotForms();
render();
