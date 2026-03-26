// ============================================================
// server.js  ― API・データベース関連
// ============================================================
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── 静的ファイル ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ── アップロード設定 ──────────────────────────────────────
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ok = allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase());
    ok ? cb(null, true) : cb(new Error('画像ファイルのみアップロード可能です'));
  }
});

// ── DB 初期化 ─────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'manual.db');
const db = new sqlite3.Database(DB_PATH, err => {
  if (err) { console.error('DB接続エラー:', err); process.exit(1); }
  console.log('DB接続OK:', DB_PATH);
});

db.serialize(() => {
  // ユーザーテーブル（ロール管理）
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT NOT NULL UNIQUE,
    password  TEXT NOT NULL,
    role      TEXT NOT NULL DEFAULT 'viewer',  -- 'admin' or 'viewer'
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // クライアントテーブル
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    memo        TEXT DEFAULT '',
    updated_by  TEXT DEFAULT '',
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // クライアントタグ
  db.run(`CREATE TABLE IF NOT EXISTS client_tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id  INTEGER NOT NULL,
    tag        TEXT NOT NULL,
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
  )`);

  // マニュアル分類（セクション）
  db.run(`CREATE TABLE IF NOT EXISTS sections (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id  INTEGER NOT NULL,
    label      TEXT NOT NULL,
    icon       TEXT DEFAULT '📄',
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
  )`);

  // ステップ
  db.run(`CREATE TABLE IF NOT EXISTS steps (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL,
    step_text  TEXT NOT NULL DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(section_id) REFERENCES sections(id) ON DELETE CASCADE
  )`);

  // ステップ画像
  db.run(`CREATE TABLE IF NOT EXISTS step_images (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    step_id    INTEGER NOT NULL,
    filename   TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(step_id) REFERENCES steps(id) ON DELETE CASCADE
  )`);

  // 初期データ（初回のみ）
  db.get(`SELECT COUNT(*) as cnt FROM users`, (err, row) => {
    if (!err && row.cnt === 0) {
      db.run(`INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin')`);
      db.run(`INSERT INTO users (username, password, role) VALUES ('staff', 'staff123', 'viewer')`);
      console.log('初期ユーザー作成: admin / staff');
    }
  });

  db.get(`SELECT COUNT(*) as cnt FROM clients`, (err, row) => {
    if (!err && row.cnt === 0) {
      db.run(`INSERT INTO clients (name, memo, updated_by) VALUES ('山田商事', 'ギフト専門・毎月定期便あり', 'admin')`, function() {
        const cid = this.lastID;
        db.run(`INSERT INTO client_tags (client_id, tag) VALUES (?, '梱包')`,[cid]);
        db.run(`INSERT INTO client_tags (client_id, tag) VALUES (?, '発送')`,[cid]);
        db.run(`INSERT INTO client_tags (client_id, tag) VALUES (?, '伝票処理')`,[cid]);
        db.run(`INSERT INTO sections (client_id, label, icon, sort_order) VALUES (?,?,?,?)`, [cid,'梱包','📦',0], function() {
          const sid = this.lastID;
          db.run(`INSERT INTO steps (section_id, step_text, sort_order) VALUES (?,?,?)`, [sid,'専用ギフトボックスを用意する。サイズはS・M・Lの3種類。',0]);
          db.run(`INSERT INTO steps (section_id, step_text, sort_order) VALUES (?,?,?)`, [sid,'商品をエアキャップで包み、ボックスに入れる。',1]);
          db.run(`INSERT INTO steps (section_id, step_text, sort_order) VALUES (?,?,?)`, [sid,'ボックスにリボンをかける。春：ピンク、秋冬：紺。',2]);
        });
        db.run(`INSERT INTO sections (client_id, label, icon, sort_order) VALUES (?,?,?,?)`, [cid,'発送','🚚',1], function() {
          const sid = this.lastID;
          db.run(`INSERT INTO steps (section_id, step_text, sort_order) VALUES (?,?,?)`, [sid,'佐川急便にて発送。着払い不可・元払いのみ。',0]);
          db.run(`INSERT INTO steps (section_id, step_text, sort_order) VALUES (?,?,?)`, [sid,'配送希望日がある場合は伝票の希望日欄に記入。午前指定不可。',1]);
        });
        db.run(`INSERT INTO sections (client_id, label, icon, sort_order) VALUES (?,?,?,?)`, [cid,'伝票処理','📋',2], function() {
          const sid = this.lastID;
          db.run(`INSERT INTO steps (section_id, step_text, sort_order) VALUES (?,?,?)`, [sid,'伝票は必ず「山田商事御中」で作成。差出人は自社名のみ。',0]);
          db.run(`INSERT INTO steps (section_id, step_text, sort_order) VALUES (?,?,?)`, [sid,'納品書は同梱必須。金額記載なし（税込・税別いずれも不可）。',1]);
        });
      });

      db.run(`INSERT INTO clients (name, memo, updated_by) VALUES ('鈴木フーズ', '食品・冷蔵便あり', 'admin')`, function() {
        const cid = this.lastID;
        db.run(`INSERT INTO client_tags (client_id, tag) VALUES (?, '梱包')`,[cid]);
        db.run(`INSERT INTO client_tags (client_id, tag) VALUES (?, '冷蔵対応')`,[cid]);
        db.run(`INSERT INTO sections (client_id, label, icon, sort_order) VALUES (?,?,?,?)`, [cid,'梱包','📦',0], function() {
          const sid = this.lastID;
          db.run(`INSERT INTO steps (section_id, step_text, sort_order) VALUES (?,?,?)`, [sid,'食品用の白い箱を使用。一般ダンボール禁止。',0]);
          db.run(`INSERT INTO steps (section_id, step_text, sort_order) VALUES (?,?,?)`, [sid,'保冷剤を必ず同梱。夏季（6〜9月）は2個入れること。',1]);
        });
        db.run(`INSERT INTO sections (client_id, label, icon, sort_order) VALUES (?,?,?,?)`, [cid,'発送','🚚',1], function() {
          const sid = this.lastID;
          db.run(`INSERT INTO steps (section_id, step_text, sort_order) VALUES (?,?,?)`, [sid,'クール便（ヤマト運輸）にて発送。冷蔵・冷凍の指定を確認。',0]);
        });
      });
    }
  });
});

// ============================================================
// API
// ============================================================

// ── ログイン ────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT id, username, role FROM users WHERE username=? AND password=?`, [username, password], (err, row) => {
    if (err)  return res.status(500).json({ error: 'DBエラー' });
    if (!row) return res.status(401).json({ error: 'ユーザー名またはパスワードが違います' });
    res.json({ id: row.id, username: row.username, role: row.role });
  });
});

// ── クライアント一覧 ────────────────────────────────────────
app.get('/api/clients', (req, res) => {
  db.all(`SELECT * FROM clients ORDER BY updated_at DESC`, [], (err, clients) => {
    if (err) return res.status(500).json({ error: err.message });
    if (clients.length === 0) return res.json([]);

    let done = 0;
    clients.forEach(c => {
      db.all(`SELECT tag FROM client_tags WHERE client_id=?`, [c.id], (e, tags) => {
        c.tags = tags ? tags.map(t => t.tag) : [];
        if (++done === clients.length) res.json(clients);
      });
    });
  });
});

// ── クライアント登録 ────────────────────────────────────────
app.post('/api/clients', (req, res) => {
  const { name, memo, tags, username } = req.body;
  if (!name) return res.status(400).json({ error: 'クライアント名は必須です' });

  db.run(`INSERT INTO clients (name, memo, updated_by) VALUES (?,?,?)`, [name, memo||'', username||''], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const cid = this.lastID;
    const tagArr = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t=>t.trim()).filter(Boolean) : []);
    let tagDone = 0;
    if (tagArr.length === 0) {
      // デフォルトセクション追加
      db.run(`INSERT INTO sections (client_id, label, icon, sort_order) VALUES (?,?,?,?)`, [cid,'梱包','📦',0]);
      db.run(`INSERT INTO sections (client_id, label, icon, sort_order) VALUES (?,?,?,?)`, [cid,'発送','🚚',1]);
      return res.json({ id: cid, name, memo, tags: [] });
    }
    tagArr.forEach(tag => {
      db.run(`INSERT INTO client_tags (client_id, tag) VALUES (?,?)`, [cid, tag], () => {
        if (++tagDone === tagArr.length) {
          db.run(`INSERT INTO sections (client_id, label, icon, sort_order) VALUES (?,?,?,?)`, [cid,'梱包','📦',0]);
          db.run(`INSERT INTO sections (client_id, label, icon, sort_order) VALUES (?,?,?,?)`, [cid,'発送','🚚',1]);
          res.json({ id: cid, name, memo, tags: tagArr });
        }
      });
    });
  });
});

// ── クライアント削除 ────────────────────────────────────────
app.delete('/api/clients/:id', (req, res) => {
  db.run(`DELETE FROM clients WHERE id=?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// ── セクション一覧（クライアント別） ────────────────────────
app.get('/api/clients/:id/sections', (req, res) => {
  db.all(`SELECT * FROM sections WHERE client_id=? ORDER BY sort_order`, [req.params.id], (err, sections) => {
    if (err) return res.status(500).json({ error: err.message });
    if (sections.length === 0) return res.json([]);

    let done = 0;
    sections.forEach(sec => {
      db.all(`SELECT * FROM steps WHERE section_id=? ORDER BY sort_order`, [sec.id], (e, steps) => {
        if (!steps || steps.length === 0) {
          sec.steps = [];
          if (++done === sections.length) res.json(sections);
          return;
        }
        let stepDone = 0;
        steps.forEach(step => {
          db.all(`SELECT * FROM step_images WHERE step_id=? ORDER BY sort_order`, [step.id], (e2, imgs) => {
            step.images = imgs || [];
            if (++stepDone === steps.length) {
              sec.steps = steps;
              if (++done === sections.length) res.json(sections);
            }
          });
        });
      });
    });
  });
});

// ── セクション追加 ──────────────────────────────────────────
app.post('/api/clients/:id/sections', (req, res) => {
  const { label, icon } = req.body;
  db.get(`SELECT MAX(sort_order) as m FROM sections WHERE client_id=?`, [req.params.id], (err, row) => {
    const order = (row && row.m !== null) ? row.m + 1 : 0;
    db.run(`INSERT INTO sections (client_id, label, icon, sort_order) VALUES (?,?,?,?)`,
      [req.params.id, label||'新しい分類', icon||'📄', order], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ id: this.lastID, label, icon, sort_order: order, steps: [] });
    });
  });
});

// ── セクション更新 ──────────────────────────────────────────
app.put('/api/sections/:id', (req, res) => {
  const { label, icon } = req.body;
  db.run(`UPDATE sections SET label=?, icon=? WHERE id=?`, [label, icon||'📄', req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: this.changes });
  });
});

// ── セクション削除 ──────────────────────────────────────────
app.delete('/api/sections/:id', (req, res) => {
  db.run(`DELETE FROM sections WHERE id=?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// ── ステップ追加 ────────────────────────────────────────────
app.post('/api/sections/:id/steps', (req, res) => {
  const { step_text } = req.body;
  db.get(`SELECT MAX(sort_order) as m FROM steps WHERE section_id=?`, [req.params.id], (err, row) => {
    const order = (row && row.m !== null) ? row.m + 1 : 0;
    db.run(`INSERT INTO steps (section_id, step_text, sort_order) VALUES (?,?,?)`,
      [req.params.id, step_text||'', order], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ id: this.lastID, step_text, sort_order: order, images: [] });
    });
  });
});

// ── ステップ更新 ────────────────────────────────────────────
app.put('/api/steps/:id', (req, res) => {
  const { step_text } = req.body;
  db.run(`UPDATE steps SET step_text=? WHERE id=?`, [step_text, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: this.changes });
  });
});

// ── ステップ削除 ────────────────────────────────────────────
app.delete('/api/steps/:id', (req, res) => {
  // 画像ファイルも削除
  db.all(`SELECT filename FROM step_images WHERE step_id=?`, [req.params.id], (err, imgs) => {
    if (imgs) {
      imgs.forEach(img => {
        const fp = path.join(uploadDir, img.filename);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      });
    }
    db.run(`DELETE FROM steps WHERE id=?`, [req.params.id], function(e) {
      if (e) return res.status(500).json({ error: e.message });
      res.json({ deleted: this.changes });
    });
  });
});

// ── 画像アップロード ────────────────────────────────────────
app.post('/api/steps/:id/images', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '画像ファイルを選択してください' });
  db.get(`SELECT MAX(sort_order) as m FROM step_images WHERE step_id=?`, [req.params.id], (err, row) => {
    const order = (row && row.m !== null) ? row.m + 1 : 0;
    db.run(`INSERT INTO step_images (step_id, filename, sort_order) VALUES (?,?,?)`,
      [req.params.id, req.file.filename, order], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ id: this.lastID, filename: req.file.filename, url: '/uploads/' + req.file.filename });
    });
  });
});

// ── 画像削除 ────────────────────────────────────────────────
app.delete('/api/images/:id', (req, res) => {
  db.get(`SELECT filename FROM step_images WHERE id=?`, [req.params.id], (err, row) => {
    if (row) {
      const fp = path.join(uploadDir, row.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    db.run(`DELETE FROM step_images WHERE id=?`, [req.params.id], function(e) {
      if (e) return res.status(500).json({ error: e.message });
      res.json({ deleted: this.changes });
    });
  });
});

// ── クライアント保存（一括：セクション・ステップまとめて更新） ──
app.put('/api/clients/:id', (req, res) => {
  const { name, memo, tags, username } = req.body;
  db.run(`UPDATE clients SET name=?, memo=?, updated_by=?, updated_at=datetime('now','localtime') WHERE id=?`,
    [name, memo||'', username||'', req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (!tags) return res.json({ updated: this.changes });
    db.run(`DELETE FROM client_tags WHERE client_id=?`, [req.params.id], () => {
      const tagArr = Array.isArray(tags) ? tags : tags.split(',').map(t=>t.trim()).filter(Boolean);
      let done = 0;
      if (tagArr.length === 0) return res.json({ updated: 1 });
      tagArr.forEach(tag => {
        db.run(`INSERT INTO client_tags (client_id, tag) VALUES (?,?)`, [req.params.id, tag], () => {
          if (++done === tagArr.length) res.json({ updated: 1 });
        });
      });
    });
  });
});

// ── 起動 ────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`サーバー起動: http://localhost:${PORT}`));
