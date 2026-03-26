# 📦 発送マニュアル WEBアプリ

クライアント別の梱包・発送・伝票処理ルールを、画像と文章で管理・閲覧できるWEBアプリです。

## 機能
- クライアント別マニュアルの閲覧
- 分類（梱包・発送・伝票処理など）ごとのステップ表示
- 手順への画像添付（最大3枚）
- 編集者 / 閲覧者の2ロール認証

## 起動方法

```bash
# 1. パッケージをインストール
npm install

# 2. サーバー起動
npm start

# 3. ブラウザで開く
http://localhost:3000
```

## ログイン情報（初期）
| ユーザー名 | パスワード | 権限 |
|---|---|---|
| admin | admin123 | 編集者 |
| staff | staff123 | 閲覧者 |

## ファイル構成
```
├── server.js          ← API・DB
├── public/
│   ├── index.html     ← 画面の構造
│   ├── js/app.js      ← 画面の動き
│   ├── css/style.css  ← デザイン
│   └── uploads/       ← 画像保存先
└── CLAUDE.md          ← Claude向け指示書
```

## Renderデプロイ設定
| 項目 | 値 |
|---|---|
| Build Command | `npm install` |
| Start Command | `npm start` |
| Environment Variables | 不要 |
