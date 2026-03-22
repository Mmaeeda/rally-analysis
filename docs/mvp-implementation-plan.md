# Pickleball Rally Analysis MVP 実装計画

## 実装済みスコープ

- Supabase向けのDBスキーマを追加（enum + 制約 + index + updated_atトリガー）。
- ポイント入力ドラフトのバリデーションロジックを実装。
- `reverseOrder` 連続性（1,2,3...）のチェックを実装。
- ブラウザで利用可能なMVP UIを実装（試合作成、ポイント入力、試合詳細、簡易分析）。
- localStorage永続化を実装（個人利用MVPとして即利用可能）。

## 入力時の重要ルール

1. `pointResult` 必須
2. `finishType` 必須
3. Shot1（`reverseOrder=1`）必須
4. 各ショットの `hitterSide` / `targetZoneId` は必須
5. ショットは 1 から連続している必要がある（例: 1,3 は不可）

## 次の実装候補（オンライン運用向け）

1. Next.js Route Handler
   - `POST /api/matches`
   - `POST /api/points`
   - `PUT /api/points/:pointId`
2. Supabase接続
   - Auth連携
   - RLSポリシー
   - オフライン同期
3. 分析の可視化強化
   - ヒートマップ表示
   - 直前2打/3打の流れ分析

## 参考: 9ゾーン定義

```
Z1 | Z2 | Z3
Z4 | Z5 | Z6
Z7 | Z8 | Z9
```
