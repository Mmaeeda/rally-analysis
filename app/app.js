import { validatePointInputDraft } from '../src/domain/validation.js';
import { buildMatchAnalysis } from '../src/domain/analysis.js';

const STORAGE_KEY = 'rally-analysis-v1';
const SYNC_CONFIG_KEY = 'rally-analysis-sync-config-v1';
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
const AI_EXPORT_VERSION = 1;

const state = {
  matches: [],
  selectedMatchId: null,
  editingPointId: null,
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
  editBanner: document.getElementById('edit-banner'),
  editBannerText: document.getElementById('edit-banner-text'),
  cancelEditButton: document.getElementById('cancel-edit-button'),
  savePointButton: document.getElementById('save-point-button'),
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
  trajectoryGallery: document.getElementById('trajectory-gallery'),
  buildExportButton: document.getElementById('build-export-button'),
  analysisExport: document.getElementById('analysis-export'),
  storageFeedback: document.getElementById('storage-feedback'),
  downloadJsonButton: document.getElementById('download-json-button'),
  downloadCsvButton: document.getElementById('download-csv-button'),
  importJsonFile: document.getElementById('import-json-file'),
  supabaseUrl: document.getElementById('supabase-url'),
  supabaseAnonKey: document.getElementById('supabase-anon-key'),
  supabaseUserId: document.getElementById('supabase-user-id'),
  saveSyncConfigButton: document.getElementById('save-sync-config-button'),
  pushSupabaseButton: document.getElementById('push-supabase-button'),
  pullSupabaseButton: document.getElementById('pull-supabase-button'),
  syncSupabaseButton: document.getElementById('sync-supabase-button'),
  supabaseSyncSecret: document.getElementById('supabase-sync-secret'),
  downloadAiJsonlButton: document.getElementById('download-ai-jsonl-button'),
  downloadAiCsvButton: document.getElementById('download-ai-csv-button'),
};

const currentPage = document.body?.dataset.page || 'unknown';

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

function loadSyncConfig() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_CONFIG_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveSyncConfig(config) {
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
}

async function sha256Hex(value) {
  const encoded = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function replaceInputUrlWithoutEdit() {
  if (currentPage !== 'input') return;
  window.history.replaceState({}, '', './input.html');
}

function selectedMatch() {
  return state.matches.find((m) => m.id === state.selectedMatchId) || null;
}

function setFeedback(message, type = '') {
  const target = el.pointFeedback || el.storageFeedback;
  if (!target) return;
  target.textContent = message;
  target.className = `feedback${type ? ` ${type}` : ''}`;
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

function courtSideFromZoneId(zoneId) {
  if (!zoneId) return undefined;
  return zoneId.startsWith('O') ? 'opponent' : 'me';
}

function snakeToCamelMatch(match) {
  return {
    id: match.id,
    title: match.title,
    opponentName: match.opponent_name || '',
    playerLabel: match.player_label || '',
    focusTheme: match.focus_theme || '',
    matchDate: match.match_date,
    matchType: match.match_type,
    points: [],
    createdAt: match.created_at,
    updatedAt: match.updated_at,
  };
}

function toSupabaseMatch(match, userId) {
  return {
    id: match.id,
    user_id: userId,
    title: match.title,
    opponent_name: match.opponentName || null,
    player_label: match.playerLabel || null,
    focus_theme: match.focusTheme || null,
    match_date: match.matchDate,
    match_type: match.matchType,
    created_at: match.createdAt,
    updated_at: match.updatedAt,
  };
}

function toSupabasePoint(point) {
  return {
    id: point.id,
    match_id: point.matchId,
    point_number: point.pointNumber,
    my_score_after: point.myScoreAfter ?? null,
    opponent_score_after: point.opponentScoreAfter ?? null,
    point_result: point.pointResult,
    finish_type: point.finishType,
    server_side: point.serverSide,
    pressure_level: point.pressureLevel,
    rally_length_category: point.rallyLengthCategory,
    memo: point.memo || null,
    created_at: point.createdAt,
    updated_at: point.updatedAt,
  };
}

function toSupabaseShot(pointId, shot) {
  return {
    id: `${pointId}-${shot.reverseOrder}`,
    point_id: pointId,
    reverse_order: shot.reverseOrder,
    hitter_side: shot.hitterSide,
    target_zone_id: shot.targetZoneId,
    note: shot.note || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function buildBackupSnapshot() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    selectedMatchId: state.selectedMatchId,
    matches: state.matches,
  };
}

function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildCsvExport() {
  const rows = [[
    'match_id',
    'match_title',
    'match_date',
    'opponent_name',
    'point_id',
    'point_number',
    'point_result',
    'finish_type',
    'server_side',
    'pressure_level',
    'rally_length_category',
    'my_score_after',
    'opponent_score_after',
    'memo',
    'shots',
  ]];

  state.matches.forEach((match) => {
    match.points.forEach((point) => {
      const shots = [...point.shots]
        .sort((a, b) => a.reverseOrder - b.reverseOrder)
        .map((shot) => `Shot${shot.reverseOrder}:${shot.hitterSide}:${shot.targetZoneId}`)
        .join(' | ');

      rows.push([
        match.id,
        match.title,
        match.matchDate,
        match.opponentName || '',
        point.id,
        point.pointNumber,
        point.pointResult,
        point.finishType,
        point.serverSide || '',
        point.pressureLevel || '',
        point.rallyLengthCategory || '',
        point.myScoreAfter ?? '',
        point.opponentScoreAfter ?? '',
        point.memo || '',
        shots,
      ]);
    });
  });

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

function buildAiCsvExport() {
  const rows = [[
    'match_id',
    'match_title',
    'match_date',
    'opponent_name',
    'point_id',
    'point_number',
    'point_result',
    'finish_type',
    'server_side',
    'pressure_level',
    'rally_length_category',
    'my_score_after',
    'opponent_score_after',
    'shot_reverse_order',
    'shot_hitter_side',
    'shot_target_zone_id',
    'shot_note',
    'memo',
  ]];

  state.matches.forEach((match) => {
    match.points.forEach((point) => {
      const shots = [...point.shots].sort((a, b) => a.reverseOrder - b.reverseOrder);
      if (!shots.length) {
        rows.push([
          match.id,
          match.title,
          match.matchDate,
          match.opponentName || '',
          point.id,
          point.pointNumber,
          point.pointResult,
          point.finishType,
          point.serverSide || '',
          point.pressureLevel || '',
          point.rallyLengthCategory || '',
          point.myScoreAfter ?? '',
          point.opponentScoreAfter ?? '',
          '',
          '',
          '',
          '',
          point.memo || '',
        ]);
        return;
      }

      shots.forEach((shot) => {
        rows.push([
          match.id,
          match.title,
          match.matchDate,
          match.opponentName || '',
          point.id,
          point.pointNumber,
          point.pointResult,
          point.finishType,
          point.serverSide || '',
          point.pressureLevel || '',
          point.rallyLengthCategory || '',
          point.myScoreAfter ?? '',
          point.opponentScoreAfter ?? '',
          shot.reverseOrder,
          shot.hitterSide,
          shot.targetZoneId,
          shot.note || '',
          point.memo || '',
        ]);
      });
    });
  });

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

function buildAiJsonlExport() {
  const lines = [];

  state.matches.forEach((match) => {
    const orderedPoints = [...match.points].sort((a, b) => a.pointNumber - b.pointNumber);
    const analysis = buildMatchAnalysis(orderedPoints);
    lines.push(JSON.stringify({
      recordType: 'match_summary',
      exportVersion: AI_EXPORT_VERSION,
      match: {
        id: match.id,
        title: match.title,
        opponentName: match.opponentName || '',
        playerLabel: match.playerLabel || '',
        focusTheme: match.focusTheme || '',
        matchDate: match.matchDate,
        matchType: match.matchType,
      },
      analysis: analysis.totals,
    }));

    orderedPoints.forEach((point) => {
      lines.push(JSON.stringify({
        recordType: 'point',
        exportVersion: AI_EXPORT_VERSION,
        match: {
          id: match.id,
          title: match.title,
          opponentName: match.opponentName || '',
          matchDate: match.matchDate,
          matchType: match.matchType,
          playerLabel: match.playerLabel || '',
          focusTheme: match.focusTheme || '',
        },
        point: {
          id: point.id,
          pointNumber: point.pointNumber,
          pointResult: point.pointResult,
          finishType: point.finishType,
          serverSide: point.serverSide || '',
          pressureLevel: point.pressureLevel || '',
          rallyLengthCategory: point.rallyLengthCategory || '',
          myScoreAfter: point.myScoreAfter ?? null,
          opponentScoreAfter: point.opponentScoreAfter ?? null,
          memo: point.memo || '',
          shots: [...point.shots]
            .sort((a, b) => a.reverseOrder - b.reverseOrder)
            .map((shot) => ({
              reverseOrder: shot.reverseOrder,
              hitterSide: shot.hitterSide,
              targetZoneId: shot.targetZoneId,
              targetZoneLabel: zoneLabel(shot.targetZoneId),
              note: shot.note || '',
            })),
        },
      }));
    });
  });

  return lines.join('\n');
}

async function readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}

function applyImportedSnapshot(snapshot) {
  state.matches = Array.isArray(snapshot.matches) ? snapshot.matches : [];
  state.selectedMatchId = snapshot.selectedMatchId || state.matches[0]?.id || null;
  saveState();
  render();
}

function cloneMatch(match) {
  return {
    ...match,
    points: Array.isArray(match.points)
      ? match.points.map((point) => ({
        ...point,
        shots: Array.isArray(point.shots) ? point.shots.map((shot) => ({ ...shot })) : [],
      }))
      : [],
  };
}

function compareIsoDate(a, b) {
  const aTime = a ? Date.parse(a) : 0;
  const bTime = b ? Date.parse(b) : 0;
  return aTime - bTime;
}

function mergePoints(localPoints = [], remotePoints = [], matchId) {
  const pointMap = new Map();

  [...localPoints, ...remotePoints].forEach((point) => {
    const existing = pointMap.get(point.id);
    const normalized = {
      ...point,
      matchId,
      shots: Array.isArray(point.shots) ? point.shots.map((shot) => ({ ...shot })) : [],
    };
    if (!existing || compareIsoDate(existing.updatedAt, normalized.updatedAt) < 0) {
      pointMap.set(normalized.id, normalized);
    }
  });

  return [...pointMap.values()].sort((a, b) => a.pointNumber - b.pointNumber);
}

function mergeMatches(localMatches = [], remoteMatches = []) {
  const merged = new Map();

  [...localMatches, ...remoteMatches].forEach((match) => {
    const existing = merged.get(match.id);
    const normalized = cloneMatch(match);
    if (!existing) {
      merged.set(normalized.id, normalized);
      return;
    }

    const latest = compareIsoDate(existing.updatedAt, normalized.updatedAt) < 0 ? normalized : existing;
    merged.set(latest.id, {
      ...latest,
      points: mergePoints(existing.points, normalized.points, latest.id),
    });
  });

  return [...merged.values()].sort((a, b) => compareIsoDate(b.matchDate, a.matchDate) || compareIsoDate(b.updatedAt, a.updatedAt));
}

function getSyncConfigFromInputs() {
  return {
    url: el.supabaseUrl?.value.trim() || '',
    anonKey: el.supabaseAnonKey?.value.trim() || '',
    userId: el.supabaseUserId?.value.trim() || '',
    syncSecret: el.supabaseSyncSecret?.value || '',
  };
}

function renderSyncConfig() {
  const config = loadSyncConfig();
  if (el.supabaseUrl) el.supabaseUrl.value = config.url || '';
  if (el.supabaseAnonKey) el.supabaseAnonKey.value = config.anonKey || '';
  if (el.supabaseUserId) el.supabaseUserId.value = config.userId || '';
  if (el.supabaseSyncSecret) el.supabaseSyncSecret.value = config.syncSecret || '';
}

function assertSyncConfig(config) {
  if (!config.url || !config.anonKey || !config.userId || !config.syncSecret) {
    throw new Error('Supabase URL / Anon Key / Sync User ID / Sync Secret をすべて入力してください');
  }
}

async function supabaseRequest(config, path, options = {}) {
  const syncSecretHash = await sha256Hex(config.syncSecret);
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      'x-sync-user-id': config.userId,
      'x-sync-secret-hash': syncSecretHash,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  if (response.status === 204) return null;
  return response.json();
}

async function pushToSupabase() {
  const config = getSyncConfigFromInputs();
  return pushStateToSupabase(config, state.matches);
}

async function pushStateToSupabase(config, matchesToPush) {
  assertSyncConfig(config);
  saveSyncConfig(config);
  const syncSecretHash = await sha256Hex(config.syncSecret);

  await supabaseRequest(config, 'users', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ id: config.userId, sync_secret_hash: syncSecretHash }]),
  });

  const matchRows = matchesToPush.map((match) => toSupabaseMatch(match, config.userId));
  if (matchRows.length) {
    await supabaseRequest(config, 'matches', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(matchRows),
    });
  }

  for (const match of matchesToPush) {
    await supabaseRequest(config, `points?match_id=eq.${match.id}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });

    if (!match.points.length) continue;

    await supabaseRequest(config, 'points', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(match.points.map((point) => toSupabasePoint(point))),
    });

    const shotRows = match.points.flatMap((point) => point.shots.map((shot) => toSupabaseShot(point.id, shot)));
    if (shotRows.length) {
      await supabaseRequest(config, 'point_shots', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(shotRows),
      });
    }
  }
}

async function fetchSupabaseMatches(config) {
  assertSyncConfig(config);
  saveSyncConfig(config);

  const matches = await supabaseRequest(
    config,
    `matches?user_id=eq.${encodeURIComponent(config.userId)}&order=match_date.desc`,
    { method: 'GET' },
  );

  if (!matches.length) {
    state.matches = [];
    state.selectedMatchId = null;
    saveState();
    render();
    return;
  }

  const matchIds = matches.map((match) => match.id);
  const points = await supabaseRequest(
    config,
    `points?match_id=in.(${matchIds.join(',')})&order=point_number.asc`,
    { method: 'GET' },
  );

  const pointIds = points.map((point) => point.id);
  const shots = pointIds.length
    ? await supabaseRequest(config, `point_shots?point_id=in.(${pointIds.join(',')})&order=reverse_order.asc`, { method: 'GET' })
    : [];

  const shotsByPointId = shots.reduce((acc, shot) => {
    acc[shot.point_id] = acc[shot.point_id] || [];
    acc[shot.point_id].push({
      reverseOrder: shot.reverse_order,
      hitterSide: shot.hitter_side,
      targetZoneId: shot.target_zone_id,
      note: shot.note || undefined,
    });
    return acc;
  }, {});

  const pointsByMatchId = points.reduce((acc, point) => {
    acc[point.match_id] = acc[point.match_id] || [];
    acc[point.match_id].push({
      id: point.id,
      matchId: point.match_id,
      pointNumber: point.point_number,
      myScoreAfter: point.my_score_after ?? undefined,
      opponentScoreAfter: point.opponent_score_after ?? undefined,
      pointResult: point.point_result,
      finishType: point.finish_type,
      serverSide: point.server_side || undefined,
      pressureLevel: point.pressure_level || undefined,
      rallyLengthCategory: point.rally_length_category || undefined,
      memo: point.memo || undefined,
      shots: shotsByPointId[point.id] || [],
      createdAt: point.created_at,
      updatedAt: point.updated_at,
    });
    return acc;
  }, {});

  return matches.map((match) => ({
    ...snakeToCamelMatch(match),
    points: pointsByMatchId[match.id] || [],
  }));
}

async function pullFromSupabase() {
  const config = getSyncConfigFromInputs();
  const remoteMatches = await fetchSupabaseMatches(config);
  state.matches = remoteMatches;
  state.selectedMatchId = state.matches[0]?.id || null;
  saveState();
  render();
}

async function syncWithSupabase() {
  const config = getSyncConfigFromInputs();
  assertSyncConfig(config);
  saveSyncConfig(config);

  const remoteMatches = await fetchSupabaseMatches(config);
  const mergedMatches = mergeMatches(state.matches, remoteMatches);
  const preferredSelectedMatchId = state.selectedMatchId
    || remoteMatches[0]?.id
    || mergedMatches[0]?.id
    || null;

  state.matches = mergedMatches;
  state.selectedMatchId = mergedMatches.some((match) => match.id === preferredSelectedMatchId)
    ? preferredSelectedMatchId
    : (mergedMatches[0]?.id || null);
  saveState();
  render();

  await pushStateToSupabase(config, mergedMatches);
  return {
    matchCount: mergedMatches.length,
    pointCount: mergedMatches.reduce((sum, match) => sum + match.points.length, 0),
  };
}

function getZoneCenter(zoneId, width, height) {
  const zone = COURT_ZONES.find((item) => item.id === zoneId);
  if (!zone) return null;
  const index = COURT_ZONES.indexOf(zone);
  const column = index % 3;
  const row = Math.floor(index / 3);
  const cellWidth = width / 3;
  const cellHeight = height / 6;
  return {
    x: (column * cellWidth) + (cellWidth / 2),
    y: (row * cellHeight) + (cellHeight / 2),
  };
}

function buildTrajectorySvg(shots, width = 210, height = 420) {
  const orderedShots = [...shots].sort((a, b) => a.reverseOrder - b.reverseOrder);
  const points = orderedShots
    .map((shot) => getZoneCenter(shot.targetZoneId, width, height))
    .filter(Boolean);

  const lines = points.slice(0, -1).map((point, index) => {
    const nextPoint = points[index + 1];
    return `<line x1="${point.x}" y1="${point.y}" x2="${nextPoint.x}" y2="${nextPoint.y}" stroke="#f8fafc" stroke-width="5" stroke-linecap="round" opacity="0.95" />`;
  }).join('');

  const ball = points[0]
    ? `<circle cx="${points[0].x}" cy="${points[0].y}" r="11" fill="#fff7ed" stroke="#c2410c" stroke-width="4" />`
    : '';

  return `
    <svg viewBox="0 0 ${width} ${height}" class="mini-court-svg" aria-hidden="true">
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="20" fill="#276749" stroke="#16324f" stroke-width="2" />
      <rect x="0" y="${height / 2 - 3}" width="${width}" height="6" fill="rgba(248,250,252,0.98)" />
      <line x1="${width / 3}" y1="0" x2="${width / 3}" y2="${height}" stroke="rgba(255,255,255,0.22)" stroke-width="2" />
      <line x1="${(width / 3) * 2}" y1="0" x2="${(width / 3) * 2}" y2="${height}" stroke="rgba(255,255,255,0.22)" stroke-width="2" />
      <line x1="0" y1="${height / 6}" x2="${width}" y2="${height / 6}" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
      <line x1="0" y1="${(height / 6) * 2}" x2="${width}" y2="${(height / 6) * 2}" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
      <line x1="0" y1="${(height / 6) * 4}" x2="${width}" y2="${(height / 6) * 4}" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
      <line x1="0" y1="${(height / 6) * 5}" x2="${width}" y2="${(height / 6) * 5}" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
      <rect x="4" y="4" width="${width - 8}" height="${height / 2 - 8}" rx="16" fill="rgba(110,231,183,0.14)" />
      <rect x="4" y="${height / 2 + 4}" width="${width - 8}" height="${height / 2 - 8}" rx="16" fill="rgba(251,191,36,0.14)" />
      ${lines}
      ${ball}
      ${points.map((point, index) => `<circle cx="${point.x}" cy="${point.y}" r="7" fill="${index === 0 ? '#c2410c' : '#16324f'}" />`).join('')}
    </svg>
  `;
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

function exitEditMode() {
  state.editingPointId = null;
}

function applyPointToForm(point) {
  if (currentPage !== 'input') {
    window.location.href = `./input.html?editPointId=${encodeURIComponent(point.id)}`;
    return;
  }

  state.editingPointId = point.id;
  state.pointComposer.shots = [...point.shots]
    .sort((a, b) => a.reverseOrder - b.reverseOrder)
    .map((shot) => ({ ...shot }));

  el.pointForm.pointNumber.value = String(point.pointNumber);
  el.pointForm.myScoreAfter.value = point.myScoreAfter ?? '';
  el.pointForm.opponentScoreAfter.value = point.opponentScoreAfter ?? '';
  el.pointForm.finishType.value = point.finishType === getAutoFinishType() ? '' : (point.finishType || '');
  el.pointForm.serverSide.value = point.serverSide || 'me';
  el.pointForm.pressureLevel.value = point.pressureLevel || 'normal';
  el.pointForm.rallyLengthCategory.value = point.rallyLengthCategory || 'medium';
  el.pointForm.memo.value = point.memo || '';

  el.editBanner.classList.remove('hidden');
  el.editBannerText.textContent = `Point ${point.pointNumber} を編集中`;
  el.savePointButton.textContent = '編集内容を保存';
  setFeedback(`Point ${point.pointNumber} を読み込みました`, 'success');
  renderShotComposer();
  replaceInputUrlWithoutEdit();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetPointFormForCreate(match) {
  if (!el.pointForm) return;
  exitEditMode();
  resetPointComposer();
  el.pointForm.reset();
  el.pointForm.pointNumber.value = String(nextPointNumber(match));
  el.pointForm.serverSide.value = 'me';
  el.pointForm.pressureLevel.value = 'normal';
  el.pointForm.rallyLengthCategory.value = 'medium';
  el.editBanner.classList.add('hidden');
  el.savePointButton.textContent = '決定して次のポイントへ';
  renderShotComposer();
  replaceInputUrlWithoutEdit();
}

function registerShot(zoneId, isMistake = false) {
  if (state.pointComposer.shots.length >= 5) {
    setFeedback('入力できるのは最大5球までです。保存するか、1つ戻してください。', 'error');
    return;
  }

  const previousShot = state.pointComposer.shots[state.pointComposer.shots.length - 1];
  if (previousShot && courtSideFromZoneId(previousShot.targetZoneId) === courtSideFromZoneId(zoneId)) {
    setFeedback('同じコート側に連続して打球は入りません。反対側コートをタップしてください。', 'error');
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
    delete button.dataset.ball;
  });

  state.pointComposer.shots.forEach((shot) => {
    const zoneButton = el.courtBoard.querySelector(`[data-zone-id="${shot.targetZoneId}"]`);
    if (!zoneButton) return;
    zoneButton.classList.add('selected');
    zoneButton.dataset.shotOrder = String(shot.reverseOrder);
    zoneButton.dataset.ball = shot.reverseOrder === 1 ? 'true' : 'false';
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
    `ai_export_version: ${AI_EXPORT_VERSION}`,
    `match_title: ${match.title}`,
    `opponent: ${match.opponentName || '-'}`,
    `match_date: ${match.matchDate}`,
    `match_type: ${match.matchType}`,
    `team_label: ${match.playerLabel || '-'}`,
    `focus_theme: ${match.focusTheme || '-'}`,
    `summary: total_points=${analysis.totals.totalPoints}, win_rate=${analysis.totals.winRate}%, pressure_win_rate=${analysis.totals.pressureWinRate}%, average_recorded_shots=${analysis.totals.averageRecordedShots}`,
    'analysis_view:',
    `server_side=${analysis.byServerSide.map((item) => `${item.key}:${item.won}/${item.total}:${item.winRate}%`).join(' ; ') || '-'}`,
    `pressure_level=${analysis.byPressureLevel.map((item) => `${item.key}:${item.won}/${item.total}:${item.winRate}%`).join(' ; ') || '-'}`,
    `rally_length=${analysis.byRallyLength.map((item) => `${item.key}:${item.won}/${item.total}:${item.winRate}%`).join(' ; ') || '-'}`,
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
  if (!el.matchList) return;
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
  if (!el.pointForm || !el.currentMatchInfo) return;
  const match = selectedMatch();
  if (!match) {
    el.currentMatchInfo.textContent = '試合を選択してください';
    el.pointForm.classList.add('hidden');
    return;
  }

  el.currentMatchInfo.textContent = `${match.title} / ${match.matchDate} / ${match.playerLabel || '自チーム未設定'} / point数: ${match.points.length}`;
  el.pointForm.classList.remove('hidden');
  if (!state.editingPointId) {
    resetPointFormForCreate(match);
  } else {
    el.editBanner.classList.remove('hidden');
    el.savePointButton.textContent = '編集内容を保存';
    renderShotComposer();
  }
}

function renderDetails() {
  if (!el.detailEmpty || !el.detailContent) return;
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
  if (el.analysisSummary) {
    el.analysisSummary.innerHTML = `
      <div class="summary-card"><span class="muted">総ポイント</span><strong>${analysis.totals.totalPoints}</strong></div>
      <div class="summary-card"><span class="muted">勝率</span><strong>${analysis.totals.winRate}%</strong></div>
      <div class="summary-card"><span class="muted">平均記録打数</span><strong>${analysis.totals.averageRecordedShots}</strong></div>
      <div class="summary-card"><span class="muted">勝負所勝率</span><strong>${analysis.totals.pressureWinRate}%</strong></div>
    `;
  }

  if (el.pointList) {
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
          <td class="action-cell">
            <button type="button" class="secondary-button compact-button" data-edit-point="${p.id}">編集</button>
            <button type="button" class="text-button compact-button" data-delete-point="${p.id}">削除</button>
          </td>
        </tr>
      `)
      .join('');

    el.pointList.querySelectorAll('[data-delete-point]').forEach((button) => {
      button.addEventListener('click', () => {
        match.points = match.points.filter((point) => point.id !== button.dataset.deletePoint);
        if (state.editingPointId === button.dataset.deletePoint) {
          state.editingPointId = null;
        }
        match.updatedAt = new Date().toISOString();
        saveState();
        render();
      });
    });

    el.pointList.querySelectorAll('[data-edit-point]').forEach((button) => {
      button.addEventListener('click', () => {
        const point = match.points.find((item) => item.id === button.dataset.editPoint);
        if (!point) return;
        applyPointToForm(point);
      });
    });
  }

  if (el.analysis) {
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
  }

  if (el.analysisExport) {
    el.analysisExport.value = buildMatchExport(match);
  }

  if (el.trajectoryGallery) {
    el.trajectoryGallery.innerHTML = ordered.length
      ? ordered.map((point) => `
        <article class="trajectory-card">
          <div class="trajectory-card-header">
            <strong>Point ${point.pointNumber}</strong>
            <span class="tag-pill">${LABELS.pointResult[point.pointResult] || point.pointResult}</span>
          </div>
          ${buildTrajectorySvg(point.shots)}
          <div class="muted">${LABELS.finishType[point.finishType] || point.finishType} / ${point.shots.length}球</div>
        </article>
      `).join('')
      : '<p class="muted">ポイントが入るとここに軌跡プレビューを表示します。</p>';
  }
}

function render() {
  renderMatchList();
  renderPointForm();
  renderDetails();
}

if (el.createMatchForm) {
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
    render();
  });
}

if (el.pointForm) {
  el.pointForm.finishType.addEventListener('change', () => {
    syncComposerHitters();
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

    if (match.points.some((p) => p.pointNumber === draft.pointNumber && p.id !== state.editingPointId)) {
      setFeedback('同一試合内でポイント番号が重複しています', 'error');
      return;
    }

    const existingPoint = state.editingPointId
      ? match.points.find((point) => point.id === state.editingPointId)
      : null;

    if (existingPoint) {
      existingPoint.pointNumber = draft.pointNumber;
      existingPoint.myScoreAfter = draft.myScoreAfter;
      existingPoint.opponentScoreAfter = draft.opponentScoreAfter;
      existingPoint.pointResult = draft.pointResult;
      existingPoint.finishType = draft.finishType;
      existingPoint.serverSide = draft.serverSide;
      existingPoint.pressureLevel = draft.pressureLevel;
      existingPoint.rallyLengthCategory = draft.rallyLengthCategory;
      existingPoint.memo = draft.memo;
      existingPoint.shots = result.normalizedShots;
      existingPoint.updatedAt = new Date().toISOString();
    } else {
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
    }
    match.updatedAt = new Date().toISOString();

    saveState();
    setFeedback(existingPoint ? 'ポイントを更新しました' : 'ポイントを保存しました', 'success');
    resetPointFormForCreate(match);
    render();
  });
}

if (el.undoShotButton) {
  el.undoShotButton.addEventListener('click', () => {
    state.pointComposer.shots.pop();
    setFeedback('直前の球を取り消しました', 'success');
    renderShotComposer();
  });
}

if (el.clearShotsButton) {
  el.clearShotsButton.addEventListener('click', () => {
    resetPointComposer();
    setFeedback('ショット入力をクリアしました', 'success');
    renderShotComposer();
  });
}

if (el.cancelEditButton) {
  el.cancelEditButton.addEventListener('click', () => {
    const match = selectedMatch();
    if (!match) return;
    resetPointFormForCreate(match);
    setFeedback('編集をキャンセルしました', 'success');
  });
}

if (el.buildExportButton) {
  el.buildExportButton.addEventListener('click', () => {
    const match = selectedMatch();
    if (!match || !el.analysisExport) return;
    el.analysisExport.value = buildMatchExport(match);
  });
}

if (el.downloadJsonButton) {
  el.downloadJsonButton.addEventListener('click', () => {
    triggerDownload(
      `rally-analysis-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(buildBackupSnapshot(), null, 2),
      'application/json',
    );
    setFeedback('JSON バックアップを書き出しました', 'success');
  });
}

if (el.downloadCsvButton) {
  el.downloadCsvButton.addEventListener('click', () => {
    triggerDownload(
      `rally-analysis-backup-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCsvExport(),
      'text/csv;charset=utf-8',
    );
    setFeedback('CSV を書き出しました', 'success');
  });
}

if (el.downloadAiJsonlButton) {
  el.downloadAiJsonlButton.addEventListener('click', () => {
    triggerDownload(
      `rally-analysis-ai-${new Date().toISOString().slice(0, 10)}.jsonl`,
      buildAiJsonlExport(),
      'application/x-ndjson',
    );
    setFeedback('AI 用 JSONL を書き出しました', 'success');
  });
}

if (el.downloadAiCsvButton) {
  el.downloadAiCsvButton.addEventListener('click', () => {
    triggerDownload(
      `rally-analysis-ai-${new Date().toISOString().slice(0, 10)}.csv`,
      buildAiCsvExport(),
      'text/csv;charset=utf-8',
    );
    setFeedback('AI 用 CSV を書き出しました', 'success');
  });
}

if (el.importJsonFile) {
  el.importJsonFile.addEventListener('change', async () => {
    const file = el.importJsonFile.files?.[0];
    if (!file) return;
    try {
      const snapshot = await readJsonFile(file);
      applyImportedSnapshot(snapshot);
      setFeedback('JSON バックアップを読み込みました', 'success');
    } catch (error) {
      setFeedback(`JSON 読み込みに失敗しました: ${error.message}`, 'error');
    } finally {
      el.importJsonFile.value = '';
    }
  });
}

if (el.saveSyncConfigButton) {
  el.saveSyncConfigButton.addEventListener('click', () => {
    saveSyncConfig(getSyncConfigFromInputs());
    setFeedback('Supabase 同期設定を保存しました', 'success');
  });
}

if (el.syncSupabaseButton) {
  el.syncSupabaseButton.addEventListener('click', async () => {
    try {
      const result = await syncWithSupabase();
      setFeedback(`Supabase と同期しました (${result.matchCount}試合 / ${result.pointCount}ポイント)`, 'success');
    } catch (error) {
      setFeedback(`Supabase 同期に失敗しました: ${error.message}`, 'error');
    }
  });
}

if (el.pushSupabaseButton) {
  el.pushSupabaseButton.addEventListener('click', async () => {
    try {
      await pushToSupabase();
      setFeedback('ローカルデータを Supabase に送信しました', 'success');
    } catch (error) {
      setFeedback(`Supabase 送信に失敗しました: ${error.message}`, 'error');
    }
  });
}

if (el.pullSupabaseButton) {
  el.pullSupabaseButton.addEventListener('click', async () => {
    try {
      await pullFromSupabase();
      setFeedback('Supabase からデータを読み込みました', 'success');
    } catch (error) {
      setFeedback(`Supabase 読み込みに失敗しました: ${error.message}`, 'error');
    }
  });
}

loadState();
renderSyncConfig();
if (el.courtBoard) {
  renderCourtBoard();
}

if (currentPage === 'input') {
  const editPointId = new URLSearchParams(window.location.search).get('editPointId');
  if (editPointId) {
    const match = selectedMatch();
    const point = match?.points.find((item) => item.id === editPointId);
    if (point) {
      applyPointToForm(point);
    }
  }
}
render();
