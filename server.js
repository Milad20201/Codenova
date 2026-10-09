require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'public', 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.warn('WARNING: Set SESSION_SECRET to a random value of at least 32 characters in .env');
}
if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.includes('ChangeThis')) {
  console.warn('WARNING: Set a strong ADMIN_PASSWORD in .env before deploying publicly.');
}

const db = new Database(path.join(DATA_DIR, 'codenova.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '✦', sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS team (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL);
`);
const seedSettings = {
  brandName: 'CodeNova',
  tagline: 'ایده شما، تخصص ما، محصول مشترک ماست!',
  heroDescription: 'ما یک تیم خلاق و متخصص در طراحی، برنامه‌نویسی و توسعه محصولات دیجیتال هستیم. ایده‌تان را به محصولی کاربردی تبدیل می‌کنیم.',
  aboutTitle: 'ایده‌های بزرگ، با همکاری خوب ساخته می‌شوند.',
  aboutDescription: 'از شناخت نیاز تا طراحی، توسعه و انتشار، در تمام مسیر کنار شما هستیم.',
  contactEmail: 'hello@example.com',
  contactPhone: '',
  telegram: '',
  instagram: '',
  github: '',
  primaryColor: '#7957ff'
};
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)');
for (const [k,v] of Object.entries(seedSettings)) insertSetting.run(k, v);
const countServices = db.prepare('SELECT COUNT(*) n FROM services').get().n;
if (!countServices) {
  const stmt = db.prepare('INSERT INTO services(title,description,icon,sort_order) VALUES (?,?,?,?)');
  [
    ['طراحی و توسعه وب‌سایت','سایت شرکتی، فروشگاهی، شخصی و سامانه‌های اختصاصی.','⌘',1],
    ['طراحی UI/UX','طراحی رابط کاربری و تجربه کاربری، از وایرفریم تا نمونه اولیه.','◈',2],
    ['ساخت بازی','توسعه بازی‌های دوبعدی و سه‌بعدی برای وب و موبایل.','🎮',3],
    ['توسعه اپلیکیشن','اپلیکیشن‌های موبایل و ابزارهای اختصاصی کسب‌وکار.','▯',4],
    ['هوش مصنوعی و اتوماسیون','چت‌بات، ابزارهای هوشمند و خودکارسازی فرایندها.','✦',5],
    ['مشاوره و اجرای ایده','بررسی ایده، نمونه اولیه و برنامه‌ریزی محصول.','↗',6]
  ].forEach(x=>stmt.run(...x));
}
const countProjects = db.prepare('SELECT COUNT(*) n FROM projects').get().n;
if (!countProjects) {
  const stmt = db.prepare('INSERT INTO projects(title,description,category,image,url,sort_order) VALUES (?,?,?,?,?,?)');
  [
    ['بازی ورزشی','نمونه‌ای از طراحی تجربه بازی و رابط کاربری.','بازی‌سازی','','',1],
    ['داشبورد مدیریتی','داشبورد با نمایش اطلاعات و نمودارها.','طراحی وب','','',2],
    ['اپلیکیشن موبایل','رابط کاربری مدرن و ساده برای موبایل.','اپلیکیشن','','',3]
  ].forEach(x=>stmt.run(...x));
}
const countTeam = db.prepare('SELECT COUNT(*) n FROM team').get().n;
if (!countTeam) {
  const stmt = db.prepare('INSERT INTO team(name,role,bio,image,sort_order) VALUES (?,?,?,?,?)');
  [
    ['عضو اول','توسعه‌دهنده وب','توسعه رابط و سمت سرور.','',1],
    ['عضو دوم','طراح UI/UX','طراحی تجربه و رابط کاربری.','',2],
    ['عضو سوم','توسعه‌دهنده بازی','ساخت بازی و تجربه‌های تعاملی.','',3]
  ].forEach(x=>stmt.run(...x));
}
if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
  const existing = db.prepare('SELECT id FROM admins WHERE username=?').get(process.env.ADMIN_USERNAME);
  if (!existing) {
    db.prepare('INSERT INTO admins(username,password_hash) VALUES (?,?)')
      .run(process.env.ADMIN_USERNAME, bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12));
  }
}

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: DATA_DIR }),
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8*60*60*1000 }
}));
app.use(express.static(path.join(ROOT, 'public')));
const loginLimiter = rateLimit({ windowMs: 15*60*1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: {error:'تلاش‌های ورود زیاد است. کمی بعد دوباره امتحان کن.'} });
const storage = multer.diskStorage({
  destination: (req,file,cb)=>cb(null,UPLOAD_DIR),
  filename: (req,file,cb)=>cb(null, Date.now()+'-'+crypto.randomBytes(6).toString('hex')+path.extname(file.originalname).toLowerCase())
});
const upload = multer({
  storage,
  limits: { fileSize: 3*1024*1024 },
  fileFilter: (req,file,cb)=>{
    const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('فقط تصویر JPG، PNG، WEBP یا GIF مجاز است.'));
    cb(null,true);
  }
});
function adminOnly(req,res,next){ if(req.session.adminId) return next(); return res.status(401).json({error:'ابتدا وارد پنل مدیریت شو.'}); }
function allRows(table){ return db.prepare(`SELECT * FROM ${table} ORDER BY sort_order,id`).all(); }
function publicData(){
  const settings = Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r=>[r.key,r.value]));
  return {settings, services:allRows('services'), projects:allRows('projects'), team:allRows('team')};
}
app.get('/api/site', (req,res)=>res.json(publicData()));
app.post('/api/contact', (req,res)=>{
  const name=String(req.body.name||'').trim(), email=String(req.body.email||'').trim(), message=String(req.body.message||'').trim();
  if(!name||!email||!message||name.length>120||email.length>200||message.length>5000) return res.status(400).json({error:'لطفاً اطلاعات را کامل و درست وارد کن.'});
  db.prepare('INSERT INTO messages(name,email,message) VALUES (?,?,?)').run(name,email,message);
  res.json({ok:true,message:'پیام شما ثبت شد. ممنون از تماس شما.'});
});
app.post('/api/admin/login', loginLimiter, (req,res)=>{
  const username=String(req.body.username||''), password=String(req.body.password||'');
  const admin=db.prepare('SELECT * FROM admins WHERE username=?').get(username);
  if(!admin || !bcrypt.compareSync(password,admin.password_hash)) return res.status(401).json({error:'نام کاربری یا رمز عبور اشتباه است.'});
  req.session.regenerate(err=>{ if(err)return res.status(500).json({error:'خطا در ایجاد نشست.'}); req.session.adminId=admin.id; req.session.username=admin.username; res.json({ok:true,username:admin.username}); });
});
app.post('/api/admin/logout', adminOnly, (req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/admin/me', adminOnly, (req,res)=>res.json({ok:true,username:req.session.username}));
app.get('/api/admin/messages', adminOnly, (req,res)=>res.json(db.prepare('SELECT * FROM messages ORDER BY id DESC').all()));
app.delete('/api/admin/messages/:id', adminOnly, (req,res)=>{db.prepare('DELETE FROM messages WHERE id=?').run(Number(req.params.id));res.json({ok:true})});
app.put('/api/admin/settings', adminOnly, (req,res)=>{
  const allowed=Object.keys(seedSettings);
  const stmt=db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const tx=db.transaction(obj=>{for(const k of allowed)if(obj[k]!==undefined)stmt.run(k,String(obj[k]).slice(0,5000));});
  tx(req.body||{});res.json({ok:true});
});
const config = {
  services:{table:'services',fields:['title','description','icon']},
  projects:{table:'projects',fields:['title','description','category','image','url']},
  team:{table:'team',fields:['name','role','bio','image']}
};
app.put('/api/admin/:kind', adminOnly, (req,res)=>{
  const c=config[req.params.kind]; if(!c)return res.status(404).json({error:'بخش پیدا نشد.'});
  if(!Array.isArray(req.body.items))return res.status(400).json({error:'داده نامعتبر است.'});
  const tx=db.transaction(items=>{
    db.prepare(`DELETE FROM ${c.table}`).run();
    const cols=[...c.fields,'sort_order'];
    const stmt=db.prepare(`INSERT INTO ${c.table}(${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`);
    items.slice(0,100).forEach((item,i)=>stmt.run(...c.fields.map(f=>String(item[f]??'').slice(0,5000)),i+1));
  });
  tx(req.body.items);res.json({ok:true});
});
app.post('/api/admin/upload', adminOnly, upload.single('image'), (req,res)=>{
  if(!req.file)return res.status(400).json({error:'فایلی انتخاب نشده است.'});
  res.json({url:'/uploads/'+req.file.filename});
});
app.get('/admin', (req,res)=>res.sendFile(path.join(ROOT,'public','admin.html')));
app.use((err,req,res,next)=>{ if(err instanceof multer.MulterError) return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'حجم تصویر باید کمتر از ۳ مگابایت باشد.':err.message}); if(err) return res.status(400).json({error:err.message||'خطای درخواست'}); next(); });
app.listen(PORT,()=>console.log(`CodeNova running at http://localhost:${PORT}`));
