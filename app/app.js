import { validatePointInputDraft } from '../src/domain/validation.js';
import { buildMatchAnalysis } from '../src/domain/analysis.js';

const STORAGE_KEY = 'rally-analysis-v1';
const COURT_ZONES = [
  { id: 'O1', courtSide: 'opponent', label: '1' },
  { id: 'O2', courtSide: 'opponent', label: '2' },
  { id: 'O3', courtSide: 'opponent', label: '3' },
  { id: 'O4', courtSide: 'opponent', label: '4' },
  { id: 'O5', courtSide: 'opponent', label: '5' },
  { id: 'O6', courtSide: 'opponent', label: '6' },
  { id: 'O7', courtSide: 'opponent', label: '7' },
  { id: 'O8', courtSide: 'opponent', label: '8' },
  { id: 'O9', courtSide: 'opponent', label: '9' },
  { id: 'M1', courtSide: 'me', label: '1' },
  { id: 'M2', courtSide: 'me', label: '2' },
  { id: 'M3', courtSide: 'me', label: '3' },
  { id: 'M4', courtSide: 'me', label: '4' },
  { id: 'M5', courtSide: 'me', label: '5' },
  { id: 'M6', courtSide: 'me', label: '6' },
  { id: 'M7', courtSide: 'me', label: '7' },
  { id: 'M8', courtSide: 'me', label: '8' },
  { id: 'M9', courtSide: 'me', label: '9' },
];
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
  pendingFirstTap: null,
};

const el = {
  createMatchForm: document.getElementById('create-match-form'),
  matchList: document.getElementById('match-list'),
  currentMatchInfo: document.getElementById('current-match-info'),
  pointForm: document.getElementById('point-form'),
  courtBoard: document.getElementById('court-board'),
  courtTrail: document.getElementById('court-trail'),
  shotStepIndicator: document.getElementById('shot-step-indicator'),
  pointResultIndicator: document.getElementById('point-result-indicator'),
  finishTypeIndicator: document.getElementById('finish-type-indicator'),
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
  buildExportButton: document.getElementById('build-export-button'),
  analysisExport: document.getElementById('analysis-export'),
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

function zoneLabel(zoneId) {
  if (!zoneId) return '-';
  const side = zoneId.startsWith('O') ? '相手' : '自陣';
  return `${side}${zoneId.slice(1)}`;
}

function inferLastShotHitter(finishType, pointResult) {
  switch (finishType) {
    case 'my_winner':
      return 'me';
    case 'opp_winner':
      return 'opponent';
    case 'my_error':
      return 'me';
    case 'opp_error':
      return 'opponent';
    default:
      return pointResult === 'won' ? 'me' : 'opponent';
  }
}

function getAutoPointResult() {
  const shot1 = state.pointComposer.shots.find((shot) => shot.reverseOrder === 1);
  if (!shot1) return undefined;
  return shot1.targetZoneId.startsWith('M') ? 'lost' : 'won';
}

function getAutoFinishType() {
  const shot1 = state.pointComposer.shots.find((shot) => shot.reverseOrder === 1);
  const pointResult = getAutoPointResult();
  if (!shot1 || !pointResult) return undefined;

  if (shot1.isMistake) {
    return pointResult === 'won' ? 'opp_error' : 'my_error';
  }

  return pointResult === 'won' ? 'my_winner' : 'opp_winner';
}

function getEffectiveFinishType() {
  return el.pointForm.finishType.value || getAutoFinishType();
}

function getLastShotHitter() {
  return inferLastShotHitter(getEffectiveFinishType(), getAutoPointResult());
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
  if (state.pendingFirstTap) {
    clearTimeout(state.pendingFirstTap);
    state.pendingFirstTap = null;
  }
}

function registerShot(zoneId, isMistake = false) {
  if (state.pointComposer.shots.length >= 5) {
    setFeedback('入力できるのは最大5球までです。保存するか、1つ戻してください。', 'error');
    return;
  }

  const reverseOrder = state.pointComposer.shots.length + 1;
  const shot = {
    reverseOrder,
    hitterSide: deriveHitterForReverseOrder(reverseOrder, getLastShotHitter()),
    targetZoneId: zoneId,
    isMistake: reverseOrder === 1 ? isMistake : false,
  };

  state.pointComposer.shots.push(shot);
  setFeedback(`${reverseOrder}球目を記録しました`, 'success');
  renderShotComposer();
}

function renderShotComposer() {
  const nextShot = state.pointComposer.shots.length + 1;
  const nextHitter = deriveHitterForReverseOrder(nextShot, getLastShotHitter());
  const canAddMore = state.pointComposer.shots.length < 5;
  const pointResult = getAutoPointResult();
  const finishType = getEffectiveFinishType();

  el.shotStepIndicator.textContent = canAddMore
    ? `Shot${nextShot} を待機中 (${nextHitter === 'me' ? '自分' : '相手'})`
    : '5球入力済み';
  el.pointResultIndicator.textContent = pointResult
    ? `自動判定: ${LABELS.pointResult[pointResult]}`
    : '得失点は最初のタップで自動判定';
  el.pointResultIndicator.className = `result-badge ${pointResult || 'pending'}`;
  el.finishTypeIndicator.textContent = finishType
    ? `決まり方: ${LABELS.finishType[finishType] || finishType}`
    : '決まり方は最初のタップで自動判定';
  el.finishTypeIndicator.className = `result-badge ${finishType ? 'info' : 'pending'}`;

  el.shotPreviewEmpty.classList.toggle('hidden', state.pointComposer.shots.length > 0);
  el.shotPreviewList.innerHTML = [...state.pointComposer.shots]
    .sort((a, b) => a.reverseOrder - b.reverseOrder)
    .map((shot) => `
      <div class="shot-preview-item">
        <span class="tag-pill">Shot${shot.reverseOrder}</span>
        <span>${zoneLabel(shot.targetZoneId)}</span>
        <span class="muted">${shot.hitterSide === 'me' ? '自分' : '相手'}${shot.isMistake ? ' / ミス' : ''}</span>
      </div>
    `)
    .join('');

  el.undoShotButton.disabled = state.pointComposer.shots.length === 0;
  el.clearShotsButton.disabled = state.pointComposer.shots.length === 0;

  const zoneButtons = [...el.courtBoard.querySelectorAll('.court-zone')];
  zoneButtons.forEach((button) => {
    button.classList.remove('selected');
    delete button.dataset.shotOrder;
  });

  state.pointComposer.shots.forEach((shot) => {
    const zoneButton = el.courtBoard.querySelector(`[data-zone-id="${shot.targetZoneId}"]`);
    if (!zoneButton) return;
    zoneButton.classList.add('selected');
    zoneButton.dataset.shotOrder = String(shot.reverseOrder);
  });

  renderCourtTrail();
}

function renderCourtBoard() {
  el.courtBoard.innerHTML = '';
  el.courtBoard.appendChild(el.courtTrail);

  COURT_ZONES.forEach((zone) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `court-zone ${zone.courtSide}`;
    button.dataset.zoneId = zone.id;
    button.innerHTML = `
      <span>${zone.label}</span>
      <small>${zone.courtSide === 'opponent' ? '相手コート' : '自陣'}</small>
    `;
    button.addEventListener('click', () => {
      if (state.pointComposer.shots.length > 0) {
        registerShot(zone.id, false);
        return;
      }

      if (state.pendingFirstTap) {
        clearTimeout(state.pendingFirstTap);
      }

      state.pendingFirstTap = setTimeout(() => {
        registerShot(zone.id, false);
        state.pendingFirstTap = null;
      }, 220);
    });
    button.addEventListener('dblclick', (event) => {
      event.preventDefault();
      if (state.pointComposer.shots.length === 0) {
        if (state.pendingFirstTap) {
          clearTimeout(state.pendingFirstTap);
          state.pendingFirstTap = null;
        }
        registerShot(zone.id, true);
      }
    });
    el.courtBoard.appendChild(button);
  });

  renderShotComposer();
}

function renderCourtTrail() {
  const orderedShots = [...state.pointComposer.shots].sort((a, b) => a.reverseOrder - b.reverseOrder);
  if (orderedShots.length < 2) {
    el.courtTrail.innerHTML = '';
    return;
  }

  const boardRect = el.courtBoard.getBoundingClientRect();
  const points = orderedShots.map((shot) => {
    const zoneButton = el.courtBoard.querySelector(`[data-zone-id="${shot.targetZoneId}"]`);
    if (!zoneButton) return null;
    const rect = zoneButton.getBoundingClientRect();
    return {
      x: rect.left - boardRect.left + (rect.width / 2),
      y: rect.top - boardRect.top + (rect.height / 2),
    };
  }).filter(Boolean);

  el.courtTrail.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);
  el.courtTrail.innerHTML = points
    .slice(0, -1)
    .map((point, index) => {
      const nextPoint = points[index + 1];
      return `
        <line
          x1="${point.x}"
          y1="${point.y}"
          x2="${nextPoint.x}"
          y2="${nextPoint.y}"
          stroke="#f8fafc"
          stroke-width="5"
          stroke-linecap="round"
          opacity="0.9"
        />
      `;
    })
    .join('');
}

function buildMatchExport(match) {
  const ordered = [...match.points].sort((a, b) => a.pointNumber - b.pointNumber);
  const analysis = buildMatchAnalysis(ordered);

  const pointLines = ordered.map((point) => {
    const shots = [...point.shots]
      .sort((a, b) => a.reverseOrder - b.reverseOrder)
      .map((shot) => `Shot${shot.reverseOrder}:${shot.hitterSide === 'me' ? '自分' : '相手'}:${zoneLabel(shot.targetZoneId)}`)
      .join(' | ');

    return [
      `Point ${point.pointNumber}`,
      `score=${point.myScoreAfter ?? '-'}-${point.opponentScoreAfter ?? '-'}`,
      `result=${point.pointResult}`,
      `finish=${point.finishType}`,
      `server=${point.serverSide}`,
      `pressure=${point.pressureLevel}`,
      `length=${point.rallyLengthCategory}`,
      `shots=[${shots}]`,
      `memo=${point.memo || '-'}`,
    ].join(', ');
  });

  return [
    `match_title: ${match.title}`,
    `opponent: ${match.opponentName || '-'}`,
    `match_date: ${match.matchDate}`,
    `match_type: ${match.matchType}`,
    `team_label: ${match.playerLabel || '-'}`,
    `focus_theme: ${match.focusTheme || '-'}`,
    `summary: total_points=${analysis.totals.totalPoints}, win_rate=${analysis.totals.winRate}%, pressure_win_rate=${analysis.totals.pressureWinRate}%`,
    'points:',
    ...pointLines,
  ].join('\n');
}

function collectPointDraftFromForm(form, matchId) {
  const fd = new FormData(form);

  return {
    matchId,
    pointNumber: Number(fd.get('pointNumber')),
    myScoreAfter: fd.get('myScoreAfter') === '' ? undefined : Number(fd.get('myScoreAfter')),
    opponentScoreAfter: fd.get('opponentScoreAfter') === '' ? undefined : Number(fd.get('opponentScoreAfter')),
    pointResult: getAutoPointResult(),
    finishType: getEffectiveFinishType(),
    serverSide: fd.get('serverSide') || undefined,
    pressureLevel: fd.get('pressureLevel') || undefined,
    rallyLengthCategory: fd.get('rallyLengthCategory') || undefined,
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
  el.analysisExport.value = buildMatchExport(match);

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

el.buildExportButton.addEventListener('click', () => {
  const match = selectedMatch();
  if (!match) return;
  el.analysisExport.value = buildMatchExport(match);
  setFeedback('AI連携用テキストを更新しました', 'success');
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
  el.pointForm.serverSide.value = 'me';
  el.pointForm.pressureLevel.value = 'normal';
  el.pointForm.rallyLengthCategory.value = 'medium';
  render();
});

loadState();
renderCourtBoard();
render();
