require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rate = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');

const SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-that-is-long-enough-24-chars';

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '20kb' }));

// ---- Mock In-Memory Database Seed Data ----
const mockUsers = {
  customers: [
    {
      id: 1,
      name: 'Ahmed',
      email: 'zezo@gmail.com',
      phone: '01158172978',
      // Hash for password: "12345678"
      password_hash: '$2a$10$wT282R11kGjC0D3gXnI7eO2H4Dkg2qGz2.6nZ2rS3X1c2m3v4b5a6', 
      active: true
    }
  ],
  barbers: [
    {
      id: 1,
      name: 'حسان علي',
      shop_name: 'صالون المزين الذهبي',
      area: 'الدقي',
      email: 'hassan@barber.com',
      phone: '01001234567',
      password_hash: '$2a$10$wT282R11kGjC0D3gXnI7eO2H4Dkg2qGz2.6nZ2rS3X1c2m3v4b5a6',
      lat: 30.0371,
      lng: 31.2118,
      active: true
    },
    {
      id: 2,
      name: 'كريم محمود',
      shop_name: 'VIP Barber Shop',
      area: 'المدينة المنورة',
      email: 'karim@barber.com',
      phone: '01229876543',
      password_hash: '$2a$10$wT282R11kGjC0D3gXnI7eO2H4Dkg2qGz2.6nZ2rS3X1c2m3v4b5a6',
      lat: 30.0500,
      lng: 31.2333,
      active: true
    }
  ],
  admins: []
};

// Seed hash helper for dynamic registration/login comparison
const mockPasswords = {
  'zezo@gmail.com': '12345678',
  'hassan@barber.com': '12345678',
  'karim@barber.com': '12345678'
};

const mockServices = [
  { id: 1, barber_id: 1, name: 'حلاقة شعر حديثة', price: 100, minutes: 30 },
  { id: 2, barber_id: 1, name: 'تهذيب وتحديد الذقن', price: 50, minutes: 15 },
  { id: 3, barber_id: 1, name: 'تنظيف بشرة وسشوار', price: 150, minutes: 45 },
  { id: 4, barber_id: 2, name: 'Haircut & Styling', price: 120, minutes: 30 },
  { id: 5, barber_id: 2, name: 'Beard Trim & Care', price: 70, minutes: 20 }
];

const mockOrders = [
  {
    id: 1,
    customer_id: 1,
    barber_id: 1,
    slot_start: new Date(Date.now() + 86400000).toISOString(),
    status: 'booked',
    total: 150,
    items: [
      { id: 1, name: 'حلاقة شعر حديثة', price: 100, minutes: 30 },
      { id: 2, name: 'تهذيب وتحديد الذقن', price: 50, minutes: 15 }
    ],
    code: '4821'
  }
];

// ---- Rate limits (per IP) ----
const lim = (min, n) => rate({ windowMs: min * 60000, limit: n, standardHeaders: true, legacyHeaders: false, message: { error: 'too_many_requests' } });
app.use('/api', lim(1, 120));
const authLim = lim(15, Number(process.env.AUTH_LIMIT || 20)), bookLim = lim(1, 10);
const h = f => (q, s, n) => f(q, s).catch(n);
const hash = x => crypto.createHmac('sha256', SECRET).update(String(x)).digest('hex');
const T = { customer: 'customers', barber: 'barbers', admin: 'admins' };

const auth = roles => (q, s, n) => {
  try {
    q.user = jwt.verify((q.headers.authorization || '').slice(7), SECRET);
  } catch {
    return s.status(401).json({ error: 'auth' });
  }
  if (roles && !roles.includes(q.user.role)) return s.status(403).json({ error: 'forbidden' });
  n();
};

// ---- Anti-bot Bypassed ----
const human = b => true;

app.get('/api/challenge', lim(1, 30), (q, s) => {
  const a = 1 + crypto.randomInt(9), b = 1 + crypto.randomInt(9);
  s.json({ q: `${a} + ${b}`, ct: jwt.sign({ h: hash(a + b), j: crypto.randomUUID() }, SECRET, { expiresIn: '3m' }) });
});

// ---- Users ----
const tok = (u, role) => jwt.sign({ id: u.id, role, name: u.name }, SECRET, { expiresIn: '7d' });

app.post('/api/register', authLim, h(async (q, s) => {
  const b = q.body, role = b.role;
  if (!['customer', 'barber'].includes(role) || !/^\S+@\S+\.\S+$/.test(b.email || '') || String(b.password || '').length < 6 || !String(b.name || '').trim() || (role === 'barber' && !String(b.shopName || '').trim())) {
    return s.status(400).json({ error: 'invalid' });
  }

  const em = b.email.toLowerCase();
  const targetTable = role === 'customer' ? mockUsers.customers : mockUsers.barbers;

  if (targetTable.find(u => u.email === em)) {
    return s.status(409).json({ error: 'email_exists' });
  }

  const pw = await bcrypt.hash(b.password, 10);
  mockPasswords[em] = b.password; // Save plain password reference for fast mock checking

  const newUser = {
    id: targetTable.length + 1,
    name: b.name,
    email: em,
    phone: b.phone || null,
    password_hash: pw,
    active: true,
    ...(role === 'barber' ? { shop_name: b.shopName, area: b.area || null, lat: null, lng: null } : {})
  };

  targetTable.push(newUser);
  s.status(201).json({ token: tok(newUser, role), role, name: newUser.name });
}));

app.post('/api/login', authLim, h(async (q, s) => {
  const b = q.body;
  const collectionKey = T[b.role];
  if (!collectionKey) return s.status(400).json({ error: 'invalid' });

  const table = mockUsers[collectionKey] || [];
  const em = String(b.email || '').toLowerCase();
  const u = table.find(x => x.email === em);

  if (!u || u.active === false) return s.status(401).json({ error: 'bad_credentials' });

  // Check stored mock password or compare bcrypt hash
  const passMatch = mockPasswords[em] ? mockPasswords[em] === String(b.password || '') : await bcrypt.compare(String(b.password || ''), u.password_hash);
  
  if (!passMatch) return s.status(401).json({ error: 'bad_credentials' });

  s.json({ token: tok({ id: u.id, name: u.name || 'Admin' }, b.role), role: b.role, name: u.name || 'Admin' });
}));

// ---- Barbers, services, slots ----
app.get('/api/barbers', auth(['customer', 'admin']), h(async (q, s) => {
  const result = mockUsers.barbers.filter(b => b.active !== false).map(b => ({
    id: b.id,
    shop_name: b.shop_name,
    area: b.area,
    lat: b.lat,
    lng: b.lng,
    services: mockServices.filter(v => v.barber_id === b.id),
    km: 1.5