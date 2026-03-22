import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePointInputDraft, normalizeShots } from '../src/domain/validation.js';

const baseDraft = {
  matchId: 'match-1',
  pointNumber: 1,
  pointResult: 'won',
  finishType: 'my_winner',
  serverSide: 'me',
  pressureLevel: 'normal',
  rallyLengthCategory: 'medium',
  shots: [
    { reverseOrder: 1, hitterSide: 'me', targetZoneId: 'Z5' },
    { reverseOrder: 2, hitterSide: 'opponent', targetZoneId: 'Z8' },
  ],
};

test('validatePointInputDraft: valid draft passes', () => {
  const result = validatePointInputDraft(baseDraft);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('validatePointInputDraft: shot continuity violation fails', () => {
  const result = validatePointInputDraft({
    ...baseDraft,
    shots: [
      { reverseOrder: 1, hitterSide: 'me', targetZoneId: 'Z5' },
      { reverseOrder: 3, hitterSide: 'opponent', targetZoneId: 'Z1' },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.includes('ショットは決まり球から連続して入力してください'), true);
});

test('validatePointInputDraft: missing tactical labels fails', () => {
  const result = validatePointInputDraft({
    ...baseDraft,
    serverSide: undefined,
    pressureLevel: undefined,
    rallyLengthCategory: undefined,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.includes('サーブ側を選択してください'), true);
  assert.equal(result.errors.includes('局面ラベルを選択してください'), true);
  assert.equal(result.errors.includes('ラリー長さを選択してください'), true);
});

test('normalizeShots: removes empty shot rows', () => {
  const shots = normalizeShots([
    { reverseOrder: 1, hitterSide: 'me', targetZoneId: 'Z2' },
    { reverseOrder: 2 },
    { reverseOrder: 3, targetZoneId: 'Z5' },
  ]);

  assert.equal(shots.length, 2);
  assert.deepEqual(shots.map((s) => s.reverseOrder), [1, 3]);
});
