import { validatePointInputDraft } from "./validation.js";

export function toPointInsert(draft) {
  return {
    match_id: draft.matchId,
    point_number: draft.pointNumber,
    my_score_after: draft.myScoreAfter,
    opponent_score_after: draft.opponentScoreAfter,
    point_result: draft.pointResult,
    finish_type: draft.finishType,
    server_side: draft.serverSide,
    receiver_side: draft.receiverSide,
    memo: draft.memo?.trim() || null,
  };
}

export function toPointShotsInsert(pointId, shots) {
  return shots.map((shot) => ({
    point_id: pointId,
    reverse_order: shot.reverseOrder,
    hitter_side: shot.hitterSide,
    target_zone_id: shot.targetZoneId,
    note: shot.note || null,
  }));
}

export function toSavePayload(draft) {
  const result = validatePointInputDraft(draft);
  if (!result.ok) {
    return {
      ok: false,
      errors: result.errors,
    };
  }

  return {
    ok: true,
    point: toPointInsert(draft),
    shots: result.normalizedShots,
  };
}

export function toChronologicalShots(shots) {
  return [...shots].sort((a, b) => b.reverseOrder - a.reverseOrder);
}
