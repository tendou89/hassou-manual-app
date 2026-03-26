# 発送マニュアル WEBアプリ — CLAUDE.md

## プロジェクト概要
発送課スタッフが、クライアント別の梱包・発送・伝票処理ルールを
画像と文章で管理・閲覧できるWEBアプリ。

## 技術スタック
- **サーバー**：Node.js + Express
- **DB**：SQLite（manual.db）
- **フロントエンド**：Bootstrap 5 + 素のJavaScript
- **画像アップロード**：multer（public/uploads/ に保存）
- **公開**：GitHub → Render（自動デプロイ）

## ファイル構成
```
hassou-manual-app/
├── server.js          ← API・データベース関連
├── package.json
├── manual.db          ← SQLiteデータ（.gitignore対象）
├── CLAUDE.md          ← このファイル
├── README.md
└── public/
    ├── index.html     ← 画面の構造
    ├── js/
    │   └── app.js     ← 画面の動き関連
    ├── css/
    │   └── style.css  ← 見た目・デザイン
    └── uploads/       ← アップロード画像（.gitignore対象）
```

## よく変更するファイル
| ファイル | 変更するとき |
|---|---|
| `public/js/app.js` | 機能追加・画面の動き変更 |
| `public/index.html` | 画面構造・ボタン追加 |
| `public/css/style.css` | デザイン調整 |
| `server.js` | API追加・DB操作変更 |

## ユーザーロール
- `admin`（編集者）：クライアント登録・マニュアル編集が可能
- `viewer`（閲覧者）：マニュアルの閲覧のみ

## 初期ユーザー
- admin / admin123（編集者）
- staff / staff123（閲覧者）

## ローカル起動手順
```
npm install
npm start
→ http://localhost:3000
```

## Renderデプロイ設定
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variables: 不要（SQLiteのためDB不要）

## DBテーブル構成
- `users`：ユーザー管理（id, username, password, role）
- `clients`：クライアント（id, name, memo, updated_by, updated_at）
- `client_tags`：クライアントのタグ（client_id, tag）
- `sections`：マニュアル分類（client_id, label, icon, sort_order）
- `steps`：手順ステップ（section_id, step_text, sort_order）
- `step_images`：ステップ画像（step_id, filename, sort_order）
