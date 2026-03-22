const EMPTY_BUCKETS = Object.freeze({});

function increment(map, key) {
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}

function ratio(won, total) {
  if (!total) return 0;
  return Math.round((won / total) * 1000) / 10;
}

function sortEntries(map) {
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function summarizeBy(points, keySelector) {
  return points.reduce((acc, point) => {
    increment(acc, keySelector(point));
    return acc;
  }, {});
}

export function buildMatchAnalysis(points = []) {
  const totalPoints = points.length;
  const wonPoints = points.filter((point) => point.pointResult === "won").length;
  const lostPoints = totalPoints - wonPoints;
  const averageRecordedShots = totalPoints
    ? Math.round(
        (points.reduce((sum, point) => sum + (point.shots?.length || 0), 0) / totalPoints) * 10,
      ) / 10
    : 0;

  const byServerSide = ["me", "opponent", "unknown"].map((serverSide) => {
    const subset = points.filter((point) => point.serverSide === serverSide);
    const won = subset.filter((point) => point.pointResult === "won").length;

    return {
      key: serverSide,
      total: subset.length,
      won,
      lost: subset.length - won,
      winRate: ratio(won, subset.length),
    };
  });

  const byPressureLevel = ["normal", "important", "game_point", "opponent_game_point"].map(
    (pressureLevel) => {
      const subset = points.filter((point) => point.pressureLevel === pressureLevel);
      const won = subset.filter((point) => point.pointResult === "won").length;

      return {
        key: pressureLevel,
        total: subset.length,
        won,
        lost: subset.length - won,
        winRate: ratio(won, subset.length),
      };
    },
  );

  const byRallyLength = ["short", "medium", "long"].map((rallyLengthCategory) => {
    const subset = points.filter((point) => point.rallyLengthCategory === rallyLengthCategory);
    const won = subset.filter((point) => point.pointResult === "won").length;

    return {
      key: rallyLengthCategory,
      total: subset.length,
      won,
      lost: subset.length - won,
      winRate: ratio(won, subset.length),
    };
  });

  const wonFinishes = sortEntries(
    summarizeBy(
      points.filter((point) => point.pointResult === "won"),
      (point) => point.finishType,
    ),
  );
  const lostFinishes = sortEntries(
    summarizeBy(
      points.filter((point) => point.pointResult === "lost"),
      (point) => point.finishType,
    ),
  );

  const winningZones = sortEntries(
    summarizeBy(
      points.filter((point) => point.pointResult === "won"),
      (point) => point.shots?.find((shot) => shot.reverseOrder === 1)?.targetZoneId,
    ),
  );
  const losingZones = sortEntries(
    summarizeBy(
      points.filter((point) => point.pointResult === "lost"),
      (point) => point.shots?.find((shot) => shot.reverseOrder === 1)?.targetZoneId,
    ),
  );

  const pressurePoints = points.filter(
    (point) => point.pressureLevel === "game_point" || point.pressureLevel === "opponent_game_point",
  );
  const pressureWon = pressurePoints.filter((point) => point.pointResult === "won").length;

  return {
    totals: {
      totalPoints,
      wonPoints,
      lostPoints,
      winRate: ratio(wonPoints, totalPoints),
      averageRecordedShots,
      pressureWinRate: ratio(pressureWon, pressurePoints.length),
    },
    byServerSide,
    byPressureLevel,
    byRallyLength,
    wonFinishes: wonFinishes.length ? wonFinishes : EMPTY_BUCKETS,
    lostFinishes: lostFinishes.length ? lostFinishes : EMPTY_BUCKETS,
    winningZones: winningZones.length ? winningZones : EMPTY_BUCKETS,
    losingZones: losingZones.length ? losingZones : EMPTY_BUCKETS,
  };
}
