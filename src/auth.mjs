import {createPublicKey,verify} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {env as settings} from 'node:process';
const PROJECT=settings.FIREBASE_PROJECT_ID,UID=settings.FIREBASE_OWNER_UID,EMAIL=settings.FIREBASE_OWNER_EMAIL;
const configured=()=>[PROJECT,UID,EMAIL].every(v=>typeof v==='string'&&v.length>0);
const CERT_URL='https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certificates=null,expires=0;const keys=new Map();
export function claimsValid(c,now=Date.now()/1000){return configured()&&c.aud===PROJECT&&c.iss==='https://securetoken.google.com/'+PROJECT&&c.sub===UID&&c.email?.toLowerCase()===EMAIL&&c.email_verified===true&&Number.isFinite(c.exp)&&c.exp>now&&Number.isFinite(c.iat)&&c.iat<=now+30&&c.iat>=now-3700&&Number.isFinite(c.auth_time)&&c.auth_time<=now+30;}
export function verifyTokenWithCertificates(token,certs){
 if(typeof token!=='string'||token.length>8192)throw Error('Invalid identity');
 const parts=token.split('.');if(parts.length!==3)throw Error('Invalid identity');
 const h=JSON.parse(Buffer.from(parts[0],'base64url')),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
 if(h.alg!=='RS256'||typeof h.kid!=='string'||!Object.hasOwn(certs,h.kid)||!claimsValid(claims))throw Error('Invalid identity');
 const certificate=certs[h.kid];let key=keys.get(certificate);if(!key){key=createPublicKey(certificate);if(keys.size>10)keys.clear();keys.set(certificate,key);}
 if(!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2],'base64url')))throw Error('Invalid signature');return claims;
}
export async function owner(token){
 try{
  if(!certificates||expires<Date.now()){
   const cache=globalThis.caches?.default;let res=await cache?.match(CERT_URL);
   if(!res){res=await fetch(CERT_URL,{redirect:'manual',signal:AbortSignal.timeout(8000)});if(!res.ok)throw Error('certificates');if(cache)await cache.put(CERT_URL,res.clone());}
   certificates=await res.json();const age=Math.min(3600,Number(res.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]||300));expires=Date.now()+age*1000;
  }return verifyTokenWithCertificates(token,certificates);
 }catch{let e=new Error('Entre com sua conta autorizada para continuar.');e.status=401;throw e;}
}
export const sessionCookie=token=>'lavadora='+token+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3500';
export const getCookie=req=>req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('lavadora='))?.slice(9)||'';

