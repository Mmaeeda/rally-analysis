import { validatePointInputDraft } from '../src/domain/validation.js';
import { buildMatchAnalysis } from '../src/domain/analysis.js';

const STORAGE_KEY = 'rally-analysis-v1';
const ZONES = ['Z1','Z2','Z3','Z4','Z5','Z6','Z7','Z8','Z9'];
const LABELS = {
  pointResult: { won: '得点', lost: '失点' },
  finishType: {
    my_winner: '自分のウィナー',
    opp_winner: '相手のウィナー',
    my_error: '自分のミス',
    opp_error: '相手のミス',
    other: 'その他',
  },
  serverSide: { me: '自分側', opponent: '相手側', unknown: '不明' },
  pressureLevel: {
    normal: '通常',
    important: '大事な場面',
    game_point: 'ゲームポイント',
    opponent_game_point: '相手ゲームポイント',
  },
  rallyLengthCategory: {
    short: '短い',
    medium: '中くらい',
    long: '長い',
  },
};

const state = {
  matches: [],
  selectedMatchId: null,
  pointComposer: {
    shots: [],
  },
};

const el = {
  createMatchForm: document.getElementById('create-match-form'),
  matchList: document.getElementById('match-list'),
  currentMatchInfo: document.getElementById('current-match-info'),
  pointForm: document.getElementById('point-form'),
  courtBoard: document.getElementById('court-board'),
  shotStepIndicator: document.getElementById('shot-step-indicator'),
  shotPreviewEmpty: document.getElementById('shot-preview-empty'),
  shotPreviewList: document.getElementById('shot-preview-list'),
  undoShotButton: document.getElementById('undo-shot-button'),
  clearShotsButton: document.getElementById('clear-shots-button'),
  pointFeedback: document.getElementById('point-feedback'),
  detailEmpty: document.getElementById('detail-empty'),
  detailContent: document.getElementById('detail-content'),
  analysisSummary: document.getElementById('analysis-summary'),
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

function setFeedback(message, type = '') {
  el.pointFeedback.textContent = message;
  el.pointFeedback.className = `feedback${type ? ` ${type}` : ''}`;
}

function renderTagRows(entries, emptyLabel = 'データなし') {
  if (!Array.isArray(entries) || entries.length === 0) {
    return `<p class="muted">${emptyLabel}</p>`;
  }

  return `
    <div class="tag-list">
      ${entries
        .map(([label, value]) => `
          <div class="tag-row">
            <span class="tag-pill">${label}</span>
            <strong>${value}</strong>
          </div>
        `)
        .join('')}
    </div>
  `;
}

function renderMetricRows(items, labels) {
  return `
    <div class="metric-list">
      ${items
        .filter((item) => item.total > 0)
        .map((item) => `
          <div class="metric-row">
            <span>${labels[item.key]}</span>
            <span>${item.won}/${item.total} (${item.winRate}%)</span>
          </div>
        `)
        .join('') || '<p class="muted">データなし</p>'}
    </div>
  `;
}

function inferLastShotHitter(finishType) {
  switch (finishType) {
    case 'my_winner':
    case 'my_error':
    case 'opp_error':
      return 'me';
    case 'opp_winner':
      return 'opponent';
    default:
      return null;
  }
}

function getLastShotHitter() {
  return el.pointForm.lastShotHitter.value || 'me';
}

function deriveHitterForReverseOrder(reverseOrder, lastShotHitter) {
  if (reverseOrder % 2 === 1) return lastShotHitter;
  return lastShotHitter === 'me' ? 'opponent' : 'me';
}

function syncComposerHitters() {
  const lastShotHitter = getLastShotHitter();
  state.pointComposer.shots = state.pointComposer.shots.map((shot) => ({
    ...shot,
    hitterSide: deriveHitterForReverseOrder(shot.reverseOrder, lastShotHitter),
  }));
}

function resetPointComposer() {
  state.pointComposer.shots = [];
}

function registerShot(zoneId) {
  if (state.pointComposer.shots.length >= 5) {
    setFeedback('入力できるのは最大5球までです。保存するか、1つ戻してください。', 'error');
    return;
  }

  const reverseOrder = state.pointComposer.shots.length + 1;
  const shot = {
    reverseOrder,
    hitterSide: deriveHitterForReverseOrder(reverseOrder, getLastShotHitter()),
    targetZoneId: zoneId,
  };

  state.pointComposer.shots.push(shot);
  setFeedback(`${reverseOrder}球目を記録しました`, 'success');
  renderShotComposer();
}

function renderShotComposer() {
  const nextShot = state.pointComposer.shots.length + 1;
  const nextHitter = deriveHitterForReverseOrder(nextShot, getLastShotHitter());
  const canAddMore = state.pointComposer.shots.length < 5;

  el.shotStepIndicator.textContent = canAddMore
    ? `Shot${nextShot} を待機中 (${nextHitter === 'me' ? '自分' : '相手'})`
    : '5球入力済み';

  el.shotPreviewEmpty.classList.toggle('hidden', state.pointComposer.shots.length > 0);
  el.shotPreviewList.innerHTML = [...state.pointComposer.shots]
    .sort((a, b) => a.reverseOrder - b.reverseOrder)
    .map((shot) => `
      <div class="shot-preview-item">
        <span class="tag-pill">Shot${shot.reverseOrder}</span>
        <span>${shot.targetZoneId}</span>
        <span class="muted">${shot.hitterSide === 'me' ? '自分' : '相手'}</span>
      </div>
    `)
    .join('');

  el.undoShotButton.disabled = state.pointComposer.shots.length === 0;
  el.clearShotsButton.disabled = state.pointComposer.shots.length === 0;
}

function renderCourtBoard() {
  el.courtBoard.innerHTML = '';

  ZONES.forEach((zone, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'court-zone';
    button.dataset.zoneId = zone;
    button.innerHTML = `
      <span>${zone}</span>
      <small>${index < 3 ? '奥' : index > 5 ? '手前' : '中間'}</small>
    `;
    button.addEventListener('click', () => {
      registerShot(zone);
    });
    el.courtBoard.appendChild(button);
  });

  renderShotComposer();
}

function collectPointDraftFromForm(form, matchId) {
  const fd = new FormData(form);

  return {
    matchId,
    pointNumber: Number(fd.get('pointNumber')),
    myScoreAfter: fd.get('myScoreAfter') === '' ? undefined : Number(fd.get('myScoreAfter')),
    opponentScoreAfter: fd.get('opponentScoreAfter') === '' ? undefined : Number(fd.get('opponentScoreAfter')),
    pointResult: fd.get('pointResult') || undefined,
    finishType: fd.get('finishType') || undefined,
    serverSide: fd.get('serverSide') || undefined,
    pressureLevel: fd.get('pressureLevel') || undefined,
    rallyLengthCategory: fd.get('rallyLengthCategory') || undefined,
    lastShotHitter: fd.get('lastShotHitter') || undefined,
    memo: fd.get('memo') || undefined,
    shots: state.pointComposer.shots,
  };
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
        <span class="muted">${m.matchDate} / ${m.matchType} / ${m.opponentName || '-'}</span><br />
        <span class="muted">${m.playerLabel || '自チーム未設定'} ${m.focusTheme ? ` / テーマ: ${m.focusTheme}` : ''}</span>
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

  el.currentMatchInfo.textContent = `${match.title} / ${match.matchDate} / ${match.playerLabel || '自チーム未設定'} / point数: ${match.points.length}`;
  el.pointForm.classList.remove('hidden');
  el.pointForm.pointNumber.value = String(nextPointNumber(match));
  renderShotComposer();
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
  const analysis = buildMatchAnalysis(ordered);
  el.analysisSummary.innerHTML = `
    <div class="summary-card"><span class="muted">総ポイント</span><strong>${analysis.totals.totalPoints}</strong></div>
    <div class="summary-card"><span class="muted">勝率</span><strong>${analysis.totals.winRate}%</strong></div>
    <div class="summary-card"><span class="muted">平均記録打数</span><strong>${analysis.totals.averageRecordedShots}</strong></div>
    <div class="summary-card"><span class="muted">勝負所勝率</span><strong>${analysis.totals.pressureWinRate}%</strong></div>
  `;

  el.pointList.innerHTML = ordered
    .map((p) => `
      <tr>
        <td>${p.pointNumber}</td>
        <td>${p.myScoreAfter ?? '-'}-${p.opponentScoreAfter ?? '-'}</td>
        <td>${LABELS.serverSide[p.serverSide] || '-'}</td>
        <td>${LABELS.pressureLevel[p.pressureLevel] || '-'}</td>
        <td>${LABELS.pointResult[p.pointResult] || p.pointResult}</td>
        <td>${LABELS.finishType[p.finishType] || p.finishType}</td>
        <td>${p.shots.length}</td>
        <td><button type="button" class="text-button" data-delete-point="${p.id}">削除</button></td>
      </tr>
    `)
    .join('');

  el.analysis.innerHTML = `
    <div class="analysis-grid">
      <div class="analysis-card">
        <span class="muted">サーブ側別成績</span>
        ${renderMetricRows(analysis.byServerSide, LABELS.serverSide)}
      </div>
      <div class="analysis-card">
        <span class="muted">局面別成績</span>
        ${renderMetricRows(analysis.byPressureLevel, LABELS.pressureLevel)}
      </div>
      <div class="analysis-card">
        <span class="muted">ラリー長さ別成績</span>
        ${renderMetricRows(analysis.byRallyLength, LABELS.rallyLengthCategory)}
      </div>
      <div class="analysis-card">
        <span class="muted">得点時の決まり方</span>
        ${renderTagRows(analysis.wonFinishes, 'まだ得点データがありません')}
      </div>
      <div class="analysis-card">
        <span class="muted">失点時の決まり方</span>
        ${renderTagRows(analysis.lostFinishes, 'まだ失点データがありません')}
      </div>
      <div class="analysis-card">
        <span class="muted">得点につながった最終打球ゾーン</span>
        ${renderTagRows(analysis.winningZones, 'ゾーンデータがありません')}
      </div>
      <div class="analysis-card">
        <span class="muted">失点につながった最終打球ゾーン</span>
        ${renderTagRows(analysis.losingZones, 'ゾーンデータがありません')}
      </div>
    </div>
  `;

  el.pointList.querySelectorAll('[data-delete-point]').forEach((button) => {
    button.addEventListener('click', () => {
      match.points = match.points.filter((point) => point.id !== button.dataset.deletePoint);
      match.updatedAt = new Date().toISOString();
      saveState();
      render();
    });
  });
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
    playerLabel: String(fd.get('playerLabel') || ''),
    focusTheme: String(fd.get('focusTheme') || ''),
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
  setFeedback('');
  render();
});

el.pointForm.finishType.addEventListener('change', () => {
  const inferred = inferLastShotHitter(el.pointForm.finishType.value);
  if (inferred) {
    el.pointForm.lastShotHitter.value = inferred;
  }
  syncComposerHitters();
  renderShotComposer();
});

el.pointForm.lastShotHitter.addEventListener('change', () => {
  syncComposerHitters();
  renderShotComposer();
});

el.undoShotButton.addEventListener('click', () => {
  state.pointComposer.shots.pop();
  setFeedback('直前の球を取り消しました', 'success');
  renderShotComposer();
});

el.clearShotsButton.addEventListener('click', () => {
  resetPointComposer();
  setFeedback('ショット入力をクリアしました', 'success');
  renderShotComposer();
});

el.pointForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const match = selectedMatch();
  if (!match) return;

  const draft = collectPointDraftFromForm(el.pointForm, match.id);
  const result = validatePointInputDraft(draft);
  if (!result.ok) {
    setFeedback(result.errors.join('\n'), 'error');
    return;
  }

  if (match.points.some((p) => p.pointNumber === draft.pointNumber)) {
    setFeedback('同一試合内でポイント番号が重複しています', 'error');
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
    serverSide: draft.serverSide,
    pressureLevel: draft.pressureLevel,
    rallyLengthCategory: draft.rallyLengthCategory,
    memo: draft.memo,
    shots: result.normalizedShots,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  match.points.push(point);
  match.updatedAt = new Date().toISOString();

  saveState();
  setFeedback('ポイントを保存しました', 'success');
  resetPointComposer();
  el.pointForm.reset();
  el.pointForm.lastShotHitter.value = 'me';
  el.pointForm.serverSide.value = 'me';
  el.pointForm.pressureLevel.value = 'normal';
  el.pointForm.rallyLengthCategory.value = 'medium';
  render();
});

loadState();
renderCourtBoard();
render();
