import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchAnalysis } from '../src/domain/analysis.js';

test('buildMatchAnalysis: aggregates scoreboard for pickleball review', () => {
  const analysis = buildMatchAnalysis([
    {
      pointResult: 'won',
      finishType: 'my_winner',
      serverSide: 'me',
      pressureLevel: 'normal',
      rallyLengthCategory: 'short',
      shots: [{ reverseOrder: 1, targetZoneId: 'O4' }],
    },
    {
      pointResult: 'lost',
      finishType: 'my_error',
      serverSide: 'opponent',
      pressureLevel: 'opponent_game_point',
      rallyLengthCategory: 'long',
      shots: [{ reverseOrder: 1, targetZoneId: 'M9' }],
    },
    {
      pointResult: 'won',
      finishType: 'opp_error',
      serverSide: 'me',
      pressureLevel: 'game_point',
      rallyLengthCategory: 'medium',
      shots: [{ reverseOrder: 1, targetZoneId: 'O4' }, { reverseOrder: 2, targetZoneId: 'M8' }],
    },
  ]);

  assert.equal(analysis.totals.totalPoints, 3);
  assert.equal(analysis.totals.winRate, 66.7);
  assert.equal(analysis.totals.averageRecordedShots, 1.3);
  assert.equal(analysis.totals.pressureWinRate, 50);
  assert.deepEqual(analysis.winningZones[0], ['O4', 2]);
  assert.deepEqual(analysis.losingZones[0], ['M9', 1]);
  assert.equal(analysis.byServerSide.find((item) => item.key === 'me')?.winRate, 100);
});
