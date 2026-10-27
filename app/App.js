import React,{createContext,useContext,useEffect,useState} from 'react';
import {View,Text,TextInput,Pressable,ScrollView,Image,ActivityIndicator,Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
const API=process.env.EXPO_PUBLIC_API_URL??(Platform.OS==='web'?'':'http://localhost:3000');
const C={pri:'#0F3D33',brass:'#B8802A',bg:'#F3F6F4',card:'#fff',ink:'#12261F',mute:'#55655F',line:'#D5DFDA',err:'#B3261E',ok:'#1E7A4F'};
const D={
ar:{name:'المزين',tag:'دورك محجوز',login:'دخول',register:'حساب جديد',customer:'عميل',barber:'حلاق',email:'البريد الإلكتروني',pass:'كلمة المرور (٨ أحرف على الأقل)',fullName:'الاسم',phone:'الهاتف',shop:'اسم المحل',area:'المنطقة',human:'اثبت إنك مش روبوت: كام ',out:'خروج',barbers:'الحلاقين',mine:'حجوزاتي',orders:'الحجوزات',svcs:'الخدمات',none:'مفيش بيانات لسه',book:'احجز',s1:'اختار الخدمة',s2:'اختار اليوم والميعاد',today:'النهارده',tomorrow:'بكرة',after:'بعد بكرة',total:'الإجمالي',booked:'تم الحجز ✓ ادفع للحلاق في المحل بعد الحلاقة.',code:'كود التأكيد',cancel:'إلغاء',confirm:'تأكيد',enter:'كود العميل',add:'إضافة',sname:'اسم الخدمة',price:'السعر',mins:'الدقائق',cur:'ج.م',back:'‹ رجوع',km:'كم',st:{booked:'محجوز',done:'تمّت',cancelled:'ملغي'},e:{bot_check:'إجابة التحقق غلط',bad_credentials:'البريد أو كلمة المرور غلط',email_exists:'البريد مستخدم قبل كده',slot_taken:'الميعاد اتحجز حالاً، اختار غيره',invalid:'بيانات ناقصة أو غلط',bad_code:'الكود غلط',too_many_requests:'محاولات كتير، جرّب بعد شوية',auth:'سجّل دخول تاني',generic:'حصل خطأ، جرّب تاني'}},
en:{name:'Almozayen',tag:'Your turn is booked',login:'Log in',register:'Sign up',customer:'Customer',barber:'Barber',email:'Email',pass:'Password (8+ characters)',fullName:'Name',phone:'Phone',shop:'Shop name',area:'Area',human:'Prove you are human: what is ',out:'Log out',barbers:'Barbers',mine:'My bookings',orders:'Bookings',svcs:'Services',none:'Nothing here yet',book:'Book',s1:'Choose a service',s2:'Choose a day and time',today:'Today',tomorrow:'Tomorrow',after:'Day after',total:'Total',booked:'Booked ✓ Pay the barber at the shop after the haircut.',code:'Confirmation code',cancel:'Cancel',confirm:'Confirm',enter:'Customer code',add:'Add',sname:'Service name',price:'Price',mins:'Minutes',cur:'EGP',back:'‹ Back',km:'km',st:{booked:'Booked',done:'Done',cancelled:'Cancelled'},e:{bot_check:'Wrong verification answer',bad_credentials:'Wrong email or password',email_exists:'Email already used',slot_taken:'That slot was just taken, pick another',invalid:'Missing or invalid data',bad_code:'Wrong code',too_many_requests:'Too many attempts, try again soon',auth:'Please log in again',generic:'Something went wrong, try again'}}};
const X=createContext();const useX=()=>useContext(X);
const call=async(p,{method='GET',body,token}={})=>{const r=await fetch(API+'/api'+p,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body&&JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||(r.status===429?'too_many_requests':'generic'));return j};
const Btn=({t,onPress,ghost,dis,style})=><Pressable onPress={onPress} disabled={dis} style={[{padding:14,borderRadius:12,alignItems:'center',backgroundColor:ghost?'transparent':C.pri,borderWidth:ghost?1:0,borderColor:C.line,opacity:dis?.5:1,marginTop:8},style]}><Text style={{color:ghost?C.ink:'#fff',fontWeight:'700',fontSize:16}}>{t}</Text></Pressable>;
const Card=({children,onPress})=><Pressable disabled={!onPress} onPress={onPress} style={{backgroundColor:C.card,borderWidth:1,borderColor:C.line,borderRadius:14,padding:14,marginVertical:6}}>{children}</Pressable>;
const Chip=({t,on,onPress,dis})=><Pressable disabled={dis} onPress={onPress} style={{paddingVertical:10,paddingHorizontal:16,borderRadius:99,borderWidth:1,borderColor:on?C.pri:C.line,backgroundColor:on?C.pri:C.card,opacity:dis?.35:1,margin:4}}><Text style={{color:on?'#fff':C.ink}}>{t}</Text></Pressable>;
const Tx=({children,b,c,s})=>{const{ta}=useX();return <Text style={[{textAlign:ta,color:c||C.ink,fontWeight:b?'700':'400',fontSize:s||15}]}>{children}</Text>};
const Row=({children})=>{const{row}=useX();return <View style={{flexDirection:row,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}>{children}</View>};
const Fld=({v,set,ph,secure,kb})=>{const{ta}=useX();return <TextInput value={v||''} onChangeText={set} placeholder={ph} secureTextEntry={secure} keyboardType={kb} autoCapitalize="none" placeholderTextColor={C.mute} style={{borderWidth:1,borderColor:C.line,borderRadius:12,padding:12,marginVertical:5,backgroundColor:C.card,color:C.ink,textAlign:ta,fontSize:16}}/>};
const Tabs=({tabs,cur,set})=>{const{row}=useX();return <View style={{flexDirection:row,marginVertical:8}}>{tabs.map(([k,l])=><Pressable key={k} onPress={()=>set(k)} style={{flex:1,padding:11,alignItems:'center',borderBottomWidth:3,borderBottomColor:cur===k?C.brass:C.line}}><Text style={{fontWeight:cur===k?'700':'400',color:C.ink}}>{l}</Text></Pressable>)}</View>};
const Err=({e})=>{const{t}=useX();return e?<Text style={{color:C.err,marginTop:6}}>{t.e[e]||t.e.generic}</Text>:null};
const hm=(iso,ar)=>new Date(iso).toLocaleTimeString(ar?'ar-EG':'en-US',{hour:'numeric',minute:'2-digit',timeZone:'Africa/Cairo'});
const dm=(iso,ar)=>new Date(iso).toLocaleDateString(ar?'ar-EG':'en-US',{day:'numeric',month:'short',timeZone:'Africa/Cairo'});

function Auth({done}){
 const{t,ta}=useX();const[mode,setMode]=useState('login'),[role,setRole]=useState('customer'),[f,setF]=useState({}),[ch,setCh]=useState(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 const set=k=>v=>setF(p=>({...p,[k]:v}));const load=()=>call('/challenge').then(setCh).catch(()=>{});
 useEffect(()=>{load()},[]);
 const go=async()=>{setBusy(true);setErr('');try{done(await call(mode==='login'?'/login':'/register',{method:'POST',body:{...f,role,ct:ch&&ch.ct,website:''}}))}catch(e){setErr(e.message);setF(p=>({...p,ca:''}));load()}setBusy(false)};
 const reg=mode==='register';
 return <View>
  <Tabs cur={mode} set={setMode} tabs={[['login',t.login],['register',t.register]]}/>
  <View style={{flexDirection:'row',justifyContent:'center'}}><Chip t={t.customer} on={role==='customer'} onPress={()=>setRole('customer')}/><Chip t={t.barber} on={role==='barber'} onPress={()=>setRole('barber')}/></View>
  {reg&&<Fld v={f.name} set={set('name')} ph={t.fullName}/>}
  {reg&&role==='barber'&&<><Fld v={f.shopName} set={set('shopName')} ph={t.shop}/><Fld v={f.area} set={set('area')} ph={t.area}/></>}
  {reg&&<Fld v={f.phone} set={set('phone')} ph={t.phone} kb="phone-pad"/>}
  <Fld v={f.email} set={set('email')} ph={t.email} kb="email-address"/><Fld v={f.password} set={set('password')} ph={t.pass} secure/>
  <Tx c={C.mute}>{t.human}{ch?ch.q:'…'}؟</Tx><Fld v={f.ca} set={set('ca')} ph="?" kb="number-pad"/>
  <Err e={err}/><Btn t={busy?'…':reg?t.register:t.login} onPress={go} dis={busy||!ch}/></View>};

function Book({s,b,back}){
 const{t,ar}=useX();const[ids,setIds]=useState([]),[day,setDay]=useState(0),[slots,setSlots]=useState([]),[slot,setSlot]=useState(null),[err,setErr]=useState(''),[res,setRes]=useState(null);
 const d=new Date();d.setDate(d.getDate()+day);const date=[d.getFullYear(),('0'+(d.getMonth()+1)).slice(-2),('0'+d.getDate()).slice(-2)].join('-');
 const loadSlots=()=>{setSlot(null);call(`/barbers/${b.id}/slots?date=${date}`,{token:s.token}).then(setSlots).catch(e=>setErr(e.message))};
 useEffect(loadSlots,[day]);
 const total=b.services.filter(v=>ids.includes(v.id)).reduce((a,v)=>a+v.price,0);
 const book=async()=>{setErr('');try{setRes(await call('/orders',{method:'POST',token:s.token,body:{barberId:b.id,serviceIds:ids,slot}}))}catch(e){setErr(e.message);if(e.message==='slot_taken')loadSlots()}};
 if(res)return <View><Card><Tx b s={20} c={C.ok}>{t.booked}</Tx><Tx c={C.mute}>{t.code}</Tx><Tx b s={34} c={C.pri}>{res.code}</Tx></Card><Btn t={t.back} onPress={back}/></View>;
 return <View><Pressable onPress={back}><Tx c={C.pri} b>{t.back}</Tx></Pressable><Card><Tx b s={18}>{b.shop_name}</Tx><Tx c={C.mute}>{b.area}</Tx></Card>
  <Tx b>{t.s1}</Tx>{b.services.map(v=><Card key={v.id} onPress={()=>setIds(p=>p.includes(v.id)?p.filter(x=>x!==v.id):[...p,v.id])}><Row><Tx b={ids.includes(v.id)}>{ids.includes(v.id)?'✓ ':''}{v.name} ({v.minutes} {t.mins})</Tx><Tx b>{v.price} {t.cur}</Tx></Row></Card>)}
  <Tx b>{t.s2}</Tx><View style={{flexDirection:'row',flexWrap:'wrap'}}>{[t.today,t.tomorrow,t.after].map((l,i)=><Chip key={i} t={l} on={day===i} onPress={()=>setDay(i)}/>)}</View>
  <View style={{flexDirection:'row',flexWrap:'wrap'}}>{slots.map(x=><Chip key={x.t} t={hm(x.t,ar)} on={slot===x.t} dis={x.taken} onPress={()=>setSlot(x.t)}/>)}</View>
  <Card><Row><Tx>{t.total}</Tx><Tx b s={20} c={C.pri}>{total} {t.cur}</Tx></Row></Card><Err e={err}/><Btn t={t.book} dis={!ids.length||!slot} onPress={book}/></View>};

function Orders({s,reload,list,barber}){
 const{t,ar}=useX();const[codes,setCodes]=useState({}),[err,setErr]=useState('');
 const act=async(id,p,body)=>{setErr('');try{await call(`/orders/${id}/${p}`,{method:'POST',token:s.token,body});reload()}catch(e){setErr(e.message)}};
 if(!list.length)return <Tx c={C.mute}>{t.none}</Tx>;
 return <View><Err e={err}/>{list.map(o=><Card key={o.id}><Row><Tx b>{barber?o.customer_name:o.shop_name}</Tx><Tx c={o.status==='done'?C.ok:C.brass} b>{t.st[o.status]}</Tx></Row>
  <Tx c={C.mute}>{dm(o.slot_start,ar)} {hm(o.slot_start,ar)}</Tx><Tx>{o.items.map(i=>i.name).join(' + ')}</Tx><Tx b>{o.total} {t.cur}</Tx>
  {!barber&&o.status==='booked'&&<><Tx c={C.pri} b>{t.code}: {o.code}</Tx><Btn ghost t={t.cancel} onPress={()=>act(o.id,'cancel')}/></>}
  {barber&&o.status==='booked'&&<View><Fld v={codes[o.id]} set={v=>setCodes(p=>({...p,[o.id]:v}))} ph={t.enter} kb="number-pad"/><Btn t={t.confirm} onPress={()=>act(o.id,'confirm',{code:codes[o.id]})}/></View>}</Card>)}</View>};

function Customer({s}){
 const{t,ar}=useX();const[tab,setTab]=useState('list'),[list,setList]=useState([]),[sel,setSel]=useState(null),[orders,setOrders]=useState([]);
 const load=()=>{call('/barbers',{token:s.token}).then(setList).catch(()=>{});call('/orders/mine',{token:s.token}).then(setOrders).catch(()=>{})};
 useEffect(load,[]);
 if(sel)return <Book s={s} b={sel} back={()=>{setSel(null);load()}}/>;
 return <View><Tabs cur={tab} set={setTab} tabs={[['list',t.barbers],['mine',t.mine]]}/>
  {tab==='list'?(list.length?list.map(b=><Card key={b.id} onPress={()=>setSel(b)}><Tx b s={17}>{b.shop_name}</Tx><Tx c={C.mute}>{b.area}{b.km!=null?` · ${b.km} ${t.km}`:''}</Tx><Tx c={C.mute}>{b.services.length?b.services.map(v=>v.name).join('، '):'—'}</Tx></Card>):<Tx c={C.mute}>{t.none}</Tx>):<Orders s={s} list={orders} reload={load}/>}</View>};

function Barber({s}){
 const{t}=useX();const[tab,setTab]=useState('orders'),[orders,setOrders]=useState([]),[svcs,setSvcs]=useState([]),[f,setF]=useState({}),[err,setErr]=useState('');
 const load=()=>{call('/orders/mine',{token:s.token}).then(setOrders).catch(()=>{});call('/services/mine',{token:s.token}).then(setSvcs).catch(()=>{})};
 useEffect(load,[]);
 const add=async()=>{setErr('');try{await call('/services',{method:'POST',token:s.token,body:{name:f.name,price:+f.price,minutes:+f.minutes}});setF({});load()}catch(e){setErr(e.message)}};
 const del=async id=>{await call('/services/'+id,{method:'DELETE',token:s.token}).catch(()=>{});load()};
 return <View><Tabs cur={tab} set={setTab} tabs={[['orders',t.orders],['svc',t.svcs]]}/>
  {tab==='orders'?<Orders s={s} list={orders} reload={load} barber/>:<View>{svcs.map(v=><Card key={v.id}><Row><Tx b>{v.name} ({v.minutes} {t.mins})</Tx><Tx>{v.price} {t.cur}</Tx></Row><Btn ghost t="✕" onPress={()=>del(v.id)}/></Card>)}
  <Card><Fld v={f.name} set={v=>setF(p=>({...p,name:v}))} ph={t.sname}/><Fld v={f.price} set={v=>setF(p=>({...p,price:v}))} ph={t.price} kb="number-pad"/><Fld v={f.minutes} set={v=>setF(p=>({...p,minutes:v}))} ph={t.mins} kb="number-pad"/><Err e={err}/><Btn t={t.add} onPress={add} dis={!f.name||!f.price||!f.minutes}/></Card></View>}</View>};

export default function App(){
 const[lang,setLang]=useState('ar'),[s,setS]=useState(null),[ready,setReady]=useState(false);
 useEffect(()=>{AsyncStorage.multiGet(['s','lang']).then(([[,a],[,b]])=>{if(a)setS(JSON.parse(a));if(b)setLang(b)}).finally(()=>setReady(true))},[]);
 const ar=lang==='ar',ctx={t:D[lang],ar,ta:ar?'right':'left',row:ar?'row-reverse':'row'};
 const save=r=>{setS(r);AsyncStorage.setItem('s',JSON.stringify(r))};
 const out=()=>{setS(null);AsyncStorage.removeItem('s')};
 const flip=()=>{const n=ar?'en':'ar';setLang(n);AsyncStorage.setItem('lang',n)};
 return <X.Provider value={ctx}><ScrollView style={{flex:1,backgroundColor:C.bg}} contentContainerStyle={{padding:16,paddingTop:Platform.OS==='web'?16:48,maxWidth:520,width:'100%',alignSelf:'center',paddingBottom:60}}>
  <View style={{flexDirection:ctx.row,alignItems:'center',marginBottom:6}}>
   <Image source={require('./assets/icon.png')} style={{width:48,height:48,borderRadius:12}}/>
   <View style={{flex:1,marginHorizontal:10}}><Text style={{fontSize:24,fontWeight:'800',color:C.pri,textAlign:ctx.ta}}>{ctx.t.name}</Text><Text style={{color:C.brass,textAlign:ctx.ta}}>{ctx.t.tag}</Text></View>
   <Chip t={ar?'English':'عربي'} onPress={flip}/>{s&&<Chip t={ctx.t.out} onPress={out}/>}</View>
  {!ready?<ActivityIndicator color={C.pri}/>:!s?<Auth done={save}/>:s.role==='barber'?<Barber s={s}/>:<Customer s={s}/>}
 </ScrollView></X.Provider>}
