import {
  FINISH_TYPES,
  POINT_RESULTS,
  SHOT_ORDER_MAX,
  SHOT_ORDER_MIN,
  SIDES,
  ZONE_IDS,
} from "./constants.js";

const errorMessages = {
  pointResult: "ポイント結果を選択してください",
  finishType: "決まり方を選択してください",
  shot1Missing: "決まり球を入力してください",
  hitterSide: "打った側を選択してください",
  zone: "コート位置を選択してください",
  contiguous: "ショットは決まり球から連続して入力してください",
};

function isOneOf(value, allowed) {
  return typeof value === "string" && allowed.includes(value);
}

function isShotFilled(shot) {
  return shot && (shot.hitterSide !== undefined || shot.targetZoneId !== undefined || shot.note);
}

export function normalizeShots(shots) {
  if (!Array.isArray(shots)) return [];

  return shots
    .filter(isShotFilled)
    .sort((a, b) => a.reverseOrder - b.reverseOrder)
    .map((shot) => ({
      reverseOrder: shot.reverseOrder,
      hitterSide: shot.hitterSide,
      targetZoneId: shot.targetZoneId,
      note: shot.note?.trim() || undefined,
    }));
}

export function validatePointInputDraft(draft) {
  const errors = [];

  if (!isOneOf(draft?.pointResult, POINT_RESULTS)) {
    errors.push(errorMessages.pointResult);
  }

  if (!isOneOf(draft?.finishType, FINISH_TYPES)) {
    errors.push(errorMessages.finishType);
  }

  const normalizedShots = normalizeShots(draft?.shots);

  const shot1 = normalizedShots.find((shot) => shot.reverseOrder === 1);
  if (!shot1) {
    errors.push(errorMessages.shot1Missing);
  }

  for (const shot of normalizedShots) {
    if (
      typeof shot.reverseOrder !== "number" ||
      shot.reverseOrder < SHOT_ORDER_MIN ||
      shot.reverseOrder > SHOT_ORDER_MAX
    ) {
      errors.push(`reverseOrderは${SHOT_ORDER_MIN}〜${SHOT_ORDER_MAX}の範囲で入力してください`);
      continue;
    }

    if (!isOneOf(shot.hitterSide, SIDES)) {
      errors.push(`${shot.reverseOrder}打目: ${errorMessages.hitterSide}`);
    }

    if (!isOneOf(shot.targetZoneId, ZONE_IDS)) {
      errors.push(`${shot.reverseOrder}打目: ${errorMessages.zone}`);
    }
  }

  // contiguous rule: only [1], [1,2], [1,2,3] ... are valid.
  for (let i = 0; i < normalizedShots.length; i += 1) {
    const expected = i + 1;
    if (normalizedShots[i].reverseOrder !== expected) {
      errors.push(errorMessages.contiguous);
      break;
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    normalizedShots,
  };
}
