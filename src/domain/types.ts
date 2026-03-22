export type MatchType = "singles" | "doubles";

export type PointResult = "won" | "lost";

export type FinishType =
  | "my_winner"
  | "opp_winner"
  | "my_error"
  | "opp_error"
  | "other";

export type Side = "me" | "opponent";

export type ServerSide = "me" | "opponent" | "unknown";

export type ZoneId =
  | "Z1"
  | "Z2"
  | "Z3"
  | "Z4"
  | "Z5"
  | "Z6"
  | "Z7"
  | "Z8"
  | "Z9";

export interface Match {
  id: string;
  userId: string;
  title: string;
  opponentName?: string;
  matchDate: string;
  matchType: MatchType;
  myTeamName?: string;
  opponentTeamName?: string;
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Point {
  id: string;
  matchId: string;
  pointNumber: number;
  myScoreAfter?: number;
  opponentScoreAfter?: number;
  pointResult: PointResult;
  finishType: FinishType;
  serverSide?: ServerSide;
  receiverSide?: ServerSide;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PointShot {
  id: string;
  pointId: string;
  reverseOrder: number;
  hitterSide: Side;
  targetZoneId: ZoneId;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PointWithShots extends Point {
  shots: PointShot[];
}

export interface PointInputDraft {
  matchId: string;
  pointNumber: number;
  myScoreAfter?: number;
  opponentScoreAfter?: number;
  pointResult?: PointResult;
  finishType?: FinishType;
  serverSide?: ServerSide;
  receiverSide?: ServerSide;
  memo?: string;
  shots: ShotDraft[];
}

export interface ShotDraft {
  reverseOrder: 1 | 2 | 3 | 4 | 5;
  hitterSide?: Side;
  targetZoneId?: ZoneId;
  note?: string;
}
