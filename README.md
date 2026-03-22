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

## 主要ファイル

- `app/index.html`: UI本体
- `app/app.js`: 画面ロジック・保存処理
- `app/styles.css`: スタイル
- `.github/workflows/deploy-pages.yml`: GitHub Pages デプロイ
- `server.mjs`: ローカル実行用静的サーバー
- `src/domain/analysis.js`: 集計ロジック
- `src/domain/validation.js`: 入力バリデーション
- `db/schema.sql`: 将来Supabase連携向けDB定義
