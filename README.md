# rally-analysis

ピックルボールのラリー（ポイント終盤最大5打）を逆順で記録し、試合後に局面別の傾向を確認する静的 Web アプリです。GitHub Pages でそのまま公開できます。

## できること（現時点）

- 試合作成（タイトル・対戦相手・日付・形式）
- 1ポイントごとの入力
  - 結果 / 決まり方 / サーブ側 / 局面ラベル / ラリー長さ
  - 最大5ショット逆順入力
- 9ゾーン（Z1〜Z9）の選択入力
- Shot連続性（1,2,3...）のバリデーション
- 試合詳細と分析
  - 勝率、平均記録打数、勝負所勝率
  - サーブ側別成績、局面別成績、ラリー長さ別成績
  - 得点/失点時の決まり方、最終打球ゾーン
- ポイント削除
- データのローカル保存（`localStorage`）
- JSON バックアップ書き出し / 復元
- CSV 書き出し
- AI 向け JSONL / 詳細 CSV / 構造化テキスト出力
- Supabase への push / pull 同期

## 起動

```bash
npm start
```

起動後、ブラウザで `http://localhost:3000` を開いて利用できます。

## GitHub Pages で公開

1. `main` に push します
2. GitHub の `Settings > Pages` で `Build and deployment` を `GitHub Actions` にします
3. push 後に `Actions` の `Deploy GitHub Pages` が通ると公開されます

公開 URL の例:

```text
https://Mmaeeda.github.io/rally-analysis/
```

## テスト

```bash
npm test
```

## バックアップ / 同期

- `文字列出力` ページから `JSON` バックアップを書き出せます
- 同ページから `JSON` バックアップの復元ができます
- `CSV` はポイント単位のフラット形式で書き出します
- `AI JSONL` は 1 行 1 レコードで、試合サマリー行とポイント行を出力します
- `AI CSV` は 1 打球 1 行の詳細形式です
- 通常の Supabase 運用は `同期する` ボタン 1 つで、取得と保存をまとめて実行できます
- Supabase 同期は `Supabase URL`、`Anon Key`、`Sync User ID`、`Sync Secret` を入れて `push / pull` します

注意:

- Supabase では `db/schema.sql` 実行後に `db/rls.sql` も実行してください
- RLS は `x-sync-user-id` と `x-sync-secret-hash` ヘッダーで同期対象を絞る構成です
- ブラウザ直結方式なので、本格運用では将来的に Supabase Auth 連携へ寄せるのが安全です
- `db/schema.sql` は現在の 18 面コートと同期項目に合わせて更新しています

## 主要ファイル

- `app/index.html`: UI本体
- `app/app.js`: 画面ロジック・保存処理
- `app/styles.css`: スタイル
- `.github/workflows/deploy-pages.yml`: GitHub Pages デプロイ
- `server.mjs`: ローカル実行用静的サーバー
- `src/domain/analysis.js`: 集計ロジック
- `src/domain/validation.js`: 入力バリデーション
- `db/schema.sql`: 将来Supabase連携向けDB定義
- `db/rls.sql`: Supabase RLS / policy 定義
