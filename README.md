# rally-analysis

ピックルボールのラリー（ポイント終盤最大5打）を逆順で記録し、試合後に傾向分析するMVPアプリです。

## できること（現時点）

- 試合作成（タイトル・対戦相手・日付・形式）
- 1ポイントごとの入力（結果 / 決まり方 / 最大5ショット逆順）
- 9ゾーン（Z1〜Z9）の選択入力
- Shot連続性（1,2,3...）のバリデーション
- 試合詳細と簡易分析（得点時の決まり方、失点時の決まり球ゾーン）
- データのローカル保存（`localStorage`）

## 起動

```bash
npm install
npm start
```

起動後、ブラウザで `http://localhost:3000` を開いて利用できます。

## テスト

```bash
npm test
```

## 主要ファイル

- `app/index.html`: UI本体
- `app/app.js`: 画面ロジック・保存処理
- `app/styles.css`: スタイル
- `server.mjs`: ローカル実行用静的サーバー
- `src/domain/validation.js`: 入力バリデーション
- `db/schema.sql`: 将来Supabase連携向けDB定義
