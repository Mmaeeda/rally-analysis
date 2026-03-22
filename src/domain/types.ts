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
export type PressureLevel = "normal" | "important" | "game_point" | "opponent_game_point";
export type RallyLengthCategory = "short" | "medium" | "long";

export type ZoneId =
  | "O1" | "O2" | "O3" | "O4" | "O5" | "O6" | "O7" | "O8" | "O9"
  | "M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "M7" | "M8" | "M9";

export interface Match {
  id: string;
  title: string;
  opponentName?: string;
  matchDate: string;
  matchType: MatchType;
  playerLabel?: string;
  focusTheme?: string;
  points: PointWithShots[];
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
  pressureLevel?: PressureLevel;
  rallyLengthCategory?: RallyLengthCategory;
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
  pressureLevel?: PressureLevel;
  rallyLengthCategory?: RallyLengthCategory;
  memo?: string;
  shots: ShotDraft[];
}

export interface ShotDraft {
  reverseOrder: 1 | 2 | 3 | 4 | 5;
  hitterSide?: Side;
  targetZoneId?: ZoneId;
  note?: string;
}
