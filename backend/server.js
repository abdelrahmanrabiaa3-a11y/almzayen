require('dotenv').config();
const express=require('express'),helmet=require('helmet'),cors=require('cors'),rate=require('express-rate-limit'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),crypto=require('crypto'),fs=require('fs'),path=require('path'),{Pool}=require('pg');
const SECRET=process.env.JWT_SECRET;
if(!SECRET||SECRET.length<24){console.error('Set JWT_SECRET (24+ chars)');process.exit(1)}
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='1'?{rejectUnauthorized:false}:false,max:process.env.VERCEL?3:10});
const app=express();app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}),cors({origin:process.env.ALLOWED_ORIGIN?process.env.ALLOWED_ORIGIN.split(','):true}),express.json({limit:'20kb'}));
app.use((q,s,n)=>ready.then(()=>n(),n));// wait for DB init (needed when running as a serverless function)
// ---- Rate limits (per IP) ----
const lim=(min,n)=>rate({windowMs:min*60000,limit:n,standardHeaders:true,legacyHeaders:false,message:{error:'too_many_requests'}});
app.use('/api',lim(1,120));
const authLim=lim(15,Number(process.env.AUTH_LIMIT||20)),bookLim=lim(1,10);
const h=f=>(q,s,n)=>f(q,s).catch(n);
const hash=x=>crypto.createHmac('sha256',SECRET).update(String(x)).digest('hex');
const T={customer:'customers',barber:'barbers',admin:'admins'};
const auth=roles=>(q,s,n)=>{try{q.user=jwt.verify((q.headers.authorization||'').slice(7),SECRET)}catch{return s.status(401).json({error:'auth'})}if(roles&&!roles.includes(q.user.role))return s.status(403).json({error:'forbidden'});n()};
// ---- Anti-bot: signed one-time challenge + honeypot field ("website") ----
const used=new Set();setInterval(()=>used.clear(),600000).unref();
const human=b=>{try{if(b.website||!b.ct||used.has(b.ct))return false;const p=jwt.verify(b.ct,SECRET);used.add(b.ct);return p.h===hash(String(b.ca).trim())}catch{return false}};
app.get('/api/challenge',lim(1,30),(q,s)=>{const a=1+crypto.randomInt(9),b=1+crypto.randomInt(9);s.json({q:`${a} + ${b}`,ct:jwt.sign({h:hash(a+b),j:crypto.randomUUID()},SECRET,{expiresIn:'3m'})})});
// ---- Users ----
const tok=(u,role)=>jwt.sign({id:u.id,role,name:u.name},SECRET,{expiresIn:'7d'});
app.post('/api/register',authLim,h(async(q,s)=>{
 const b=q.body,role=b.role;
 if(!human(b))return s.status(400).json({error:'bot_check'});
 if(!['customer','barber'].includes(role)||!/^\S+@\S+\.\S+$/.test(b.email||'')||String(b.password||'').length<8||!String(b.name||'').trim()||(role==='barber'&&!String(b.shopName||'').trim()))return s.status(400).json({error:'invalid'});
 const pw=await bcrypt.hash(b.password,10),em=b.email.toLowerCase();
 try{
  const r=role==='customer'?await pool.query('insert into customers(name,email,phone,password_hash) values($1,$2,$3,$4) returning id,name',[b.name,em,b.phone||null,pw]):await pool.query('insert into barbers(name,shop_name,area,email,phone,password_hash,lat,lng) values($1,$2,$3,$4,$5,$6,$7,$8) returning id,name',[b.name,b.shopName,b.area||null,em,b.phone||null,pw,b.lat??null,b.lng??null]);
  s.status(201).json({token:tok(r.rows[0],role),role,name:r.rows[0].name});
 }catch(e){if(e.code==='23505')return s.status(409).json({error:'email_exists'});throw e}
}));
app.post('/api/login',authLim,h(async(q,s)=>{
 const b=q.body;if(!human(b))return s.status(400).json({error:'bot_check'});
 const t=T[b.role];if(!t)return s.status(400).json({error:'invalid'});
 const u=(await pool.query(`select * from ${t} where email=$1`,[String(b.email||'').toLowerCase()])).rows[0];
 if(!u||u.active===false||!(await bcrypt.compare(String(b.password||''),u.password_hash)))return s.status(401).json({error:'bad_credentials'});
 s.json({token:tok({id:u.id,name:u.name||'Admin'},b.role),role:b.role,name:u.name||'Admin'});
}));
// ---- Barbers, services, slots ----
app.get('/api/barbers',auth(['customer','admin']),h(async(q,s)=>{
 const r=await pool.query(`select b.id,b.shop_name,b.area,b.lat,b.lng,coalesce(json_agg(json_build_object('id',v.id,'name',v.name,'price',v.price,'minutes',v.minutes) order by v.id) filter (where v.id is not null),'[]') services from barbers b left join services v on v.barber_id=b.id where b.active group by b.id`);
 const la=parseFloat(q.query.lat),ln=parseFloat(q.query.lng),rad=x=>x*Math.PI/180;
 const km=b=>b.lat==null||isNaN(la)||isNaN(ln)?null:Math.round(6371*Math.acos(Math.min(1,Math.sin(rad(la))*Math.sin(rad(b.lat))+Math.cos(rad(la))*Math.cos(rad(b.lat))*Math.cos(rad(b.lng-ln))))*10)/10;
 s.json(r.rows.map(b=>({...b,km:km(b)})).sort((a,b)=>(a.km??1e9)-(b.km??1e9)));
}));
const GRID=(d)=>`generate_series((${d}+time '12:00') at time zone 'Africa/Cairo',(${d}+time '21:30') at time zone 'Africa/Cairo',interval '30 minutes')`;
app.get('/api/barbers/:id/slots',auth(),h(async(q,s)=>{
 if(!/^\d{4}-\d\d-\d\d$/.test(q.query.date||''))return s.status(400).json({error:'invalid'});
 const r=await pool.query(`select g as t,(g<now() or exists(select 1 from orders o where o.barber_id=$2 and o.slot_start=g and o.status<>'cancelled')) as taken from ${GRID('$1::date')} g order by 1`,[q.query.date,parseInt(q.params.id)||0]);
 s.json(r.rows);
}));
app.get('/api/services/mine',auth(['barber']),h(async(q,s)=>s.json((await pool.query('select id,name,price,minutes from services where barber_id=$1 order by id',[q.user.id])).rows)));
app.post('/api/services',auth(['barber']),h(async(q,s)=>{
 const{name,price,minutes}=q.body;if(!String(name||'').trim()||!(price>0)||!(minutes>0))return s.status(400).json({error:'invalid'});
 s.status(201).json((await pool.query('insert into services(barber_id,name,price,minutes) values($1,$2,$3,$4) returning id,name,price,minutes',[q.user.id,String(name).slice(0,60),Math.round(price),Math.round(minutes)])).rows[0]);
}));
app.delete('/api/services/:id',auth(['barber']),h(async(q,s)=>{await pool.query('delete from services where id=$1 and barber_id=$2',[parseInt(q.params.id)||0,q.user.id]);s.json({ok:true})}));
// ---- Orders (bookings) ----
const local='(($1::timestamptz) at time zone \'Africa/Cairo\')::date';
app.post('/api/orders',auth(['customer']),bookLim,h(async(q,s)=>{
 const{barberId,serviceIds,slot}=q.body;
 if(!Number.isInteger(barberId)||!Array.isArray(serviceIds)||!serviceIds.length||!serviceIds.every(Number.isInteger)||isNaN(Date.parse(slot)))return s.status(400).json({error:'invalid'});
 const iso=new Date(slot).toISOString();
 const v=await pool.query('select id,name,price,minutes from services where barber_id=$1 and id=any($2::int[])',[barberId,serviceIds]);
 if(v.rowCount!==new Set(serviceIds).size)return s.status(400).json({error:'invalid'});
 const ok=await pool.query(`select 1 from ${GRID(local)} g where g=$1::timestamptz and g>now()`,[iso]);
 if(!ok.rowCount)return s.status(400).json({error:'invalid'});
 const total=v.rows.reduce((a,x)=>a+x.price,0),code=String(crypto.randomInt(1000,10000));
 try{
  // One atomic INSERT. The partial unique index makes the DB pick exactly one winner when two users hit the same slot.
  const r=await pool.query('insert into orders(customer_id,barber_id,slot_start,total,items,code) values($1,$2,$3,$4,$5,$6) returning id,slot_start,total,code',[q.user.id,barberId,iso,total,JSON.stringify(v.rows),code]);
  s.status(201).json(r.rows[0]);
 }catch(e){if(e.code==='23505')return s.status(409).json({error:'slot_taken'});throw e}
}));
app.get('/api/orders/mine',auth(['customer','barber']),h(async(q,s)=>{
 const c=q.user.role==='customer';
 s.json((await pool.query(`select o.id,o.slot_start,o.status,o.total,o.items,${c?'o.code,':''}b.shop_name,b.area,u.name as customer_name from orders o join barbers b on b.id=o.barber_id join customers u on u.id=o.customer_id where o.${c?'customer_id':'barber_id'}=$1 order by o.slot_start desc limit 100`,[q.user.id])).rows);
}));
app.post('/api/orders/:id/confirm',auth(['barber']),h(async(q,s)=>{
 const r=await pool.query("update orders set status='done' where id=$1 and barber_id=$2 and status='booked' and code=$3 returning id",[parseInt(q.params.id)||0,q.user.id,String(q.body.code||'')]);
 r.rowCount?s.json({ok:true}):s.status(400).json({error:'bad_code'});
}));
app.post('/api/orders/:id/cancel',auth(['customer']),h(async(q,s)=>{
 const r=await pool.query("update orders set status='cancelled' where id=$1 and customer_id=$2 and status='booked' and slot_start>now() returning id",[parseInt(q.params.id)||0,q.user.id]);
 r.rowCount?s.json({ok:true}):s.status(400).json({error:'invalid'});
}));
// ---- Admin dashboard (admins only) ----
app.get('/api/admin/stats',auth(['admin']),h(async(q,s)=>{
 const[t,d,top]=await Promise.all([
  pool.query("select (select count(*) from customers)::int customers,(select count(*) from barbers)::int barbers,count(*) filter(where status='booked')::int booked,count(*) filter(where status='done')::int done,count(*) filter(where status='cancelled')::int cancelled,coalesce(sum(total) filter(where status='done'),0)::int gmv,count(*) filter(where created_at>=date_trunc('day',now()))::int today from orders"),
  pool.query("select to_char(created_at at time zone 'Africa/Cairo','MM-DD') d,count(*)::int n from orders where created_at>now()-interval '7 days' group by 1 order by 1"),
  pool.query("select b.shop_name,count(*)::int n,sum(o.total)::int revenue from orders o join barbers b on b.id=o.barber_id where o.status='done' group by b.id order by n desc limit 5")]);
 s.json({totals:t.rows[0],daily:d.rows,topBarbers:top.rows});
}));
app.use('/admin',express.static(path.join(__dirname,'public/admin')));
app.get('/health',(q,s)=>s.json({ok:true}));
app.use((e,q,s,n)=>{console.error(e);s.status(500).json({error:'server'})});
async function init(){
 const c=await pool.connect();
 try{
  await c.query('select pg_advisory_lock(7342)');
  await c.query(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
  const{ADMIN_EMAIL:e,ADMIN_PASSWORD:p}=process.env;
  if(e&&p)await c.query('insert into admins(email,password_hash) values($1,$2) on conflict(email) do nothing',[e.toLowerCase(),await bcrypt.hash(p,10)]);
 }finally{await c.query('select pg_advisory_unlock(7342)').catch(()=>{});c.release()}
}
const ready=init();ready.catch(e=>console.error('init failed',e));
module.exports=app;
if(!process.env.VERCEL&&require.main===module)ready.then(()=>app.listen(process.env.PORT||3000,()=>console.log('API on',process.env.PORT||3000)),()=>process.exit(1));
