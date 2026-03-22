import type {
  FinishType,
  MatchType,
  PointInputDraft,
  PointResult,
  ServerSide,
  Side,
  ZoneId,
} from "../domain/types";

export interface CreateMatchRequest {
  title: string;
  opponentName?: string;
  matchDate: string;
  matchType: MatchType;
  location?: string;
}

export interface SavePointRequest {
  matchId: string;
  pointNumber: number;
  myScoreAfter?: number;
  opponentScoreAfter?: number;
  pointResult: PointResult;
  finishType: FinishType;
  serverSide?: ServerSide;
  receiverSide?: ServerSide;
  memo?: string;
  shots: {
    reverseOrder: 1 | 2 | 3 | 4 | 5;
    hitterSide: Side;
    targetZoneId: ZoneId;
    note?: string;
  }[];
}

export interface SavePointResponse {
  pointId: string;
}

export function toDraftFromRequest(req: SavePointRequest): PointInputDraft {
  return {
    ...req,
    shots: req.shots,
  };
}
