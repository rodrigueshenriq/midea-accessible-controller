import {pollDue} from './polling.mjs';
import {MideaClient} from './midea.mjs';import {Store} from './store.mjs';import {owner,getCookie,sessionCookie} from './auth.mjs';import {CATALOG,Washer,UserError} from './domain.mjs';import {Notifications} from './push.mjs';
import {Buffer} from 'node:buffer';
const json=(v,status=200,headers={})=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}});
const assets=new Map([['/','/index.html'],['/signin','/signin.html'],['/signin.js','/signin.js'],['/signin.css','/signin.css'],['/sw.js','/sw.js'],...['app.js','style.css','icon.svg','icon-180.png','icon-192.png','icon-512.png','manifest.webmanifest'].map(s=>['/assets/'+s,'/'+s])]);
const publicPaths=new Set(['/signin','/signin.js','/signin.css','/auth-config','/health','/api/login']);
async function body(req){if(Number(req.headers.get('content-length')||0)>16384)throw new UserError('Pedido muito grande.',413);const reader=req.body?.getReader();if(!reader)return {};let chunks=[],size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw new UserError('Pedido muito grande.',413);}chunks.push(value);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new UserError('Pedido inválido.',400);}}
async function context(env,readOnly,fn){const store=new Store(env);return store.lease(async()=>{const n=new Notifications(store,env.PUBLIC_ORIGIN);await n.setup();const c=new MideaClient(JSON.parse(env.MIDEA_CREDENTIALS_JSON),{store,readOnly});const w=new Washer(c,store,n);return fn(w,n,store);});}
async function notificationStatus(env){const store=new Store(env);const data=await store.load('notifications');if(!data)return context(env,true,async(w,n)=>n.status());const n=new Notifications(store,env.PUBLIC_ORIGIN);n.data=data;return n.status();}
function headers(response,path){const r=new Response(response.body,response);let signin=path.startsWith('/signin');r.headers.set('Cache-Control','no-store');r.headers.set('X-Lavadora-Auth','firebase');r.headers.set('X-Content-Type-Options','nosniff');r.headers.set('Referrer-Policy','no-referrer');r.headers.set('X-Frame-Options','DENY');r.headers.set('X-Robots-Tag','noindex, nofollow');r.headers.set('Content-Security-Policy',signin?"default-src 'self'; script-src 'self' https://www.gstatic.com; style-src 'self'; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'":"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");if(path==='/sw.js')r.headers.set('Service-Worker-Allowed','/');return r;}
export default {
 async fetch(req,env){const url=new URL(req.url),path=url.pathname;let response;
  try{
   if(url.origin!==env.PUBLIC_ORIGIN)throw new UserError('Endereço de acesso inválido.',403);
   if(!['GET','POST','HEAD'].includes(req.method))throw new UserError('Método inválido.',405);
   if(req.method==='POST'&&(req.headers.get('origin')!==env.PUBLIC_ORIGIN||!req.headers.get('content-type')?.startsWith('application/json')))throw new UserError('Abra a interface pelo endereço autorizado.',403);
   if(!publicPaths.has(path)){try{await owner(getCookie(req));}catch(e){if(path==='/')return headers(Response.redirect(url.origin+'/signin',302),path);if(assets.has(path))return headers(new Response('Não encontrado.',{status:404}),path);throw e;}}
   if(path==='/health')response=json({ok:true});
   else if(path==='/auth-config')response=json({apiKey:env.FIREBASE_WEB_API_KEY,projectId:env.FIREBASE_PROJECT_ID,authDomain:env.FIREBASE_PROJECT_ID+'.firebaseapp.com'});
   else if(path==='/api/login'&&req.method==='POST'){const value=await body(req);await owner(value.idToken);response=json({ok:true},200,{'set-cookie':sessionCookie(value.idToken)});}
   else if(path==='/api/logout'&&req.method==='POST')response=json({ok:true,cloud:true},200,{'set-cookie':'lavadora=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'});
   else if(path==='/api/catalog'&&req.method==='GET')response=json({programs:CATALOG,model:'MF200W110WB/GK-01',demo:false});
   else if(path==='/api/state'&&req.method==='GET')response=json(await context(env,true,async(w,n,store)=>{let last=await store.load('last-state');if(url.searchParams.get('refresh')==='1'||!last||Date.now()-Date.parse(last.checkedAt)>12000){await w.read();return w.public();}return last;}));
   else if(['/api/apply','/api/action'].includes(path)&&req.method==='POST'){if(env.CONTROL_ENABLED!=='true')throw new UserError('Os controles estão em validação. Nenhuma alteração foi enviada.',409);const v=await body(req);response=json(await context(env,false,(w)=>path==='/api/apply'?w.apply(v.draft,v.revision,v.pauseActive):w.action(v)));}
   else if(path==='/api/notifications'&&req.method==='GET')response=json(await notificationStatus(env));
   else if(['/api/notifications/subscribe','/api/notifications/unsubscribe','/api/notifications/test'].includes(path)&&req.method==='POST'){const v=await body(req);await context(env,true,async(w,n)=>{if(path.endsWith('/subscribe'))await n.add(v);else if(path.endsWith('/unsubscribe'))await n.remove(v);else await n.test(v);});response=json({ok:true});}
   else if(assets.has(path)&&['GET','HEAD'].includes(req.method)){let assetUrl=new URL(req.url);assetUrl.pathname=assets.get(path);response=await env.ASSETS.fetch(new Request(assetUrl,req));}
   else response=new Response('Não encontrado.',{status:404});
  }catch(e){response=json({error:e.status?e.message:'Não foi possível concluir. Atualize antes de tentar novamente.'},e.status||503);}
  return headers(response,path);
 },
 async scheduled(event,env,ctx){ctx.waitUntil((async()=>{const store=new Store(env);if(!await pollDue(store))return;await context(env,true,async(w,n,lockedStore)=>{try{await w.read();await lockedStore.db.prepare('INSERT INTO health(name,ok,stage,code,checked) VALUES(?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET ok=excluded.ok,stage=excluded.stage,code=excluded.code,checked=excluded.checked').bind('poll',1,'read','ok',Date.now()).run();}catch(e){await lockedStore.db.prepare('INSERT INTO health(name,ok,stage,code,checked) VALUES(?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET ok=excluded.ok,stage=excluded.stage,code=excluded.code,checked=excluded.checked').bind('poll',0,w.client.stage||'setup',e.upstreamCode||e.name||'error',Date.now()).run();await lockedStore.save('poll-plan',{next:Date.now()+300000});}if(n.data.outbox.length){await n.deliver();if(n.data.outbox.length)await lockedStore.save('poll-plan',{next:Date.now()+60000});}});})().catch(()=>{}));}
};



