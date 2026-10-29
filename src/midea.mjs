// SmartHome transport adapted from midea-lan (MIT). Personal keys remain server-side.
import {createHash,createHmac,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {env as settings} from 'node:process';
export const APP_KEY=settings.MIDEA_APP_KEY;
export const IOT_KEY=settings.MIDEA_IOT_KEY;
export const HMAC_KEY=settings.MIDEA_HMAC_KEY;
const fixedKey=Buffer.from(settings.MIDEA_FIXED_KEY||'');
const fixedIV=Buffer.from(settings.MIDEA_FIXED_IV||'');
export const hash=(s,alg='sha256')=>createHash(alg).update(s,'utf8').digest('hex');
export function aesEncrypt(data,key,iv){let c=createCipheriv(`aes-${Buffer.byteLength(key)*8}-cbc`,Buffer.from(key),Buffer.from(iv));return Buffer.concat([c.update(data),c.final()]).toString('hex');}
export function aesDecrypt(data,key,iv){let c=createDecipheriv(`aes-${Buffer.byteLength(key)*8}-cbc`,Buffer.from(key),Buffer.from(iv));return Buffer.concat([c.update(Buffer.from(data,'hex')),c.final()]).toString('utf8');}
export const passwordHashes=(id,password)=>({password:hash(id+hash(password)+APP_KEY),iampwd:hash(id+hash(hash(password,'md5'),'md5')+APP_KEY)});
export const signRequest=(body,random)=>createHmac('sha256',HMAC_KEY).update(IOT_KEY+body+random,'utf8').digest('hex');
const stamp=()=>new Date().toISOString().replace(/\D/g,'').slice(0,14);
const BASE='https://mp-prod.appsmb.com/mas/v5/app/proxy?alias=';
export const STATUS='/v1/device/status/lua/get',CONTROL='/v1/device/lua/control';
const ROUTE='/v1/multicloud/platform/user/route',LOGIN_ID='/v1/user/login/id/get',LOGIN='/mj/user/login',LIST='/v1/appliance/user/list/get';
const permitted=new Set([ROUTE,LOGIN_ID,LOGIN,LIST,STATUS,CONTROL]);
export class MideaError extends Error{constructor(message,code=502){super(message);this.status=code;}}
export function validBase(value){let u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.pathname!=='/mas/v5/app/proxy'||u.search!=='?alias='||!['appsmb.com','smartmidea.net','msmartlife.net'].some(d=>u.hostname.endsWith('.'+d)))throw new MideaError('Servidor SmartHome não reconhecido.');return value;}
export class MideaClient{
 constructor(credentials,{fetcher=fetch,store=null,readOnly=true}={}){if(![APP_KEY,IOT_KEY,HMAC_KEY].every(v=>typeof v==='string'&&v.length)||![16,24,32].includes(fixedKey.length)||fixedIV.length!==16)throw new MideaError('Configure os parâmetros privados do protocolo antes de conectar.',503);this.credentials=credentials;this.fetcher=fetcher;this.store=store;this.readOnly=readOnly;this.session=null;this.base=BASE;this.deviceId=hash(`Hello, ${credentials.account}!`).slice(0,16);}
 general(){return {src:'1010',format:'2',stamp:stamp(),platformId:'1',deviceId:this.deviceId,reqId:randomBytes(16).toString('hex'),uid:this.session?.uid??null,clientType:'1',appId:'1010',language:'en_US'};}
 async request(endpoint,data){ this.stage=endpoint;
  if(!permitted.has(endpoint)||(this.readOnly&&endpoint===CONTROL))throw new MideaError('Operação bloqueada pelo modo de leitura.',403);
  data={...data,reqId:data.reqId||randomBytes(16).toString('hex'),stamp:data.stamp||stamp()};
  // ASCII JSON matches Python ensure_ascii, including passwords with Unicode.
  const body=JSON.stringify(data).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  const random=String(Math.floor(Date.now()/1000));
  const headers={'content-type':'application/json; charset=utf-8',secretVersion:'1',sign:signRequest(body,random),random,'x-recipe-app':'1010',authorization:'Basic '+Buffer.from(APP_KEY+':'+IOT_KEY).toString('base64')};
  if(this.session){headers.uid=String(this.session.uid);headers.accessToken=this.session.token;}
  // Exactly one HTTP attempt: a lost control response must never replay a command.
  const fetcher=this.fetcher;let response;try{response=await fetcher(validBase(this.base)+endpoint,{method:'POST',headers,body,redirect:'manual',signal:AbortSignal.timeout(12000)});}catch(cause){let e=new MideaError(endpoint===CONTROL?'Não foi possível confirmar o comando. Atualize antes de repetir.':'A nuvem SmartHome não respondeu.');e.upstreamCode='network-'+(cause.name||'Error')+(/Illegal invocation/i.test(cause.message||'')?'-invocation':/timed|timeout|abort/i.test(cause.message||'')?'-timeout':/redirect/i.test(cause.message||'')?'-redirect':/TLS|SSL|certificate/i.test(cause.message||'')?'-tls':/connection/i.test(cause.message||'')?'-connection':'');throw e;}
  let result;try{result=await response.json();}catch{let e=new MideaError('Resposta SmartHome inválida.');e.upstreamCode='json-http-'+response.status;throw e;}
  if(response.status===401||['40001','40002','44001'].includes(String(result.code))||(endpoint===STATUS&&String(result.code)==='3102')){let e=new MideaError('A sessão SmartHome expirou.');e.expired=true;e.upstreamCode=String(result.code);throw e;}
  if(!response.ok||String(result.code)!=='0'||!result.data){let e=new MideaError('A nuvem SmartHome recusou a solicitação.');e.upstreamCode=/^-?\d{1,8}$/.test(String(result.code))?String(result.code):'http-'+response.status;throw e;}
  return result.data;
 }
 async login(){
  this.session=null;this.base=BASE;
  const route=await this.request(ROUTE,{...this.general(),userType:'0',userName:this.credentials.account});
  if(route.masUrl)this.base=validBase(route.masUrl);
  const id=await this.request(LOGIN_ID,{...this.general(),loginAccount:this.credentials.account});
  if(typeof id.loginId!=='string')throw new MideaError('Não foi possível validar a conta SmartHome.');
  let iotData=this.general();delete iotData.uid;
  const result=await this.request(LOGIN,{iotData:{...iotData,...passwordHashes(id.loginId,this.credentials.password),loginAccount:this.credentials.account},data:{appKey:APP_KEY,deviceId:this.deviceId,platform:'2'},stamp:stamp()});
  const digest=hash(APP_KEY),key=digest.slice(0,16),iv=digest.slice(16,32);
  this.session={uid:result.uid,token:result.mdata?.accessToken,key:aesDecrypt(result.accessToken,key,iv),iv:aesDecrypt(result.randomData,key,iv),base:this.base};
  if(!this.session.token||![16,24,32].includes(Buffer.byteLength(this.session.key))||Buffer.byteLength(this.session.iv)!==16)throw new MideaError('Sessão SmartHome inválida.');
  await this.findTarget();await this.store?.save('midea-session',this.session);
 }
 async findTarget(){
  const result=await this.request(LIST,this.general());
  const row=result.list?.find(d=>String(d.id)===String(this.credentials.target.device_id));
  if(!row||aesDecrypt(row.sn,this.session.key,this.session.iv)!==this.credentials.target.sn||parseInt(row.type,16)!==0xdb)throw new MideaError('A conta não confirmou a lavadora cadastrada.');
  this.session.info={model_number:String(row.modelNumber||'18485'),manufacturer_code:row.enterpriseCode||'0000'};
 }
 async ensure(){
  if(this.session)return;
  const saved=await this.store?.load('midea-session');
  if(saved?.info&&saved.token){this.base=validBase(saved.base);this.session=saved;}else await this.renew();
 }
 async renew(){
  const failure=await this.store?.load('midea-login-failure');
  if(failure?.retryAfter>Date.now())throw new MideaError('Não foi possível renovar o acesso SmartHome. Aguarde alguns minutos antes de tentar novamente.');
  try{await this.login();if(failure)await this.store?.save('midea-login-failure',{retryAfter:0});}
  catch(error){if(error.upstreamCode==='3102'&&[LOGIN,LOGIN_ID].includes(this.stage))await this.store?.save('midea-login-failure',{retryAfter:Date.now()+300000});throw error;}
 }
 data(){let t=this.credentials.target;return {clientType:'1',appId:'1010',format:'2',deviceId:this.deviceId,iotAppId:'1010',applianceMFCode:this.session.info.manufacturer_code,applianceType:'0xDB',modelNumber:this.session.info.model_number,applianceSn:aesEncrypt(Buffer.from(t.sn,'ascii'),fixedKey,fixedIV),version:'0','encryptedType ':'2',applianceCode:t.device_id};}
 async read(){
  await this.ensure();let state;
  try{state=await this.request(STATUS,{...this.data(),command:{query:{}}});}
  catch(e){if(!e.expired)throw e;await this.renew();state=await this.request(STATUS,{...this.data(),command:{query:{}}});}
  state=state.status&&typeof state.status==='object'?state.status:state;
  if(typeof state.running_status!=='string')throw new MideaError('A lavadora não confirmou seu estado.');
  return state;
 }
 async control(control,current){if(this.readOnly)throw new MideaError('Controle desativado neste teste.',403);await this.ensure();return this.request(CONTROL,{...this.data(),command:{control,status:current}});}
}







