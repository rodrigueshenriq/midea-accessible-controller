import {createECDH,hkdfSync,randomBytes,createCipheriv,createPrivateKey,sign} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {hash} from './midea.mjs';import {UserError} from './domain.mjs';
const b64=b=>Buffer.from(b).toString('base64url');
export function subscription(v){
 try{const u=new URL(v.endpoint),h=u.hostname;const allowed=h.endsWith('.push.apple.com')||['web.push.apple.com','fcm.googleapis.com','updates.push.services.mozilla.com'].includes(h)||h.endsWith('.notify.windows.com');if(!allowed||u.protocol!=='https:'||u.port||u.username||u.password||u.hash||v.endpoint.length>4096)throw Error();
  const p=Buffer.from(v.keys.p256dh,'base64url'),a=Buffer.from(v.keys.auth,'base64url');if(p.length!==65||p[0]!==4||a.length!==16)throw Error();let ec=createECDH('prime256v1');ec.generateKeys();ec.computeSecret(p);
  return {endpoint:u.href,keys:{p256dh:b64(p),auth:b64(a)}};
 }catch{throw new UserError('Inscrição de aviso inválida.',400);}
}
const hkdf=(key,salt,info,len)=>Buffer.from(hkdfSync('sha256',key,salt,info,len));
export function encryptedPush(device,payload){
 const receiver=Buffer.from(device.keys.p256dh,'base64url'),auth=Buffer.from(device.keys.auth,'base64url');
 let ec=createECDH('prime256v1');ec.generateKeys();const pub=ec.getPublicKey(),salt=randomBytes(16);
 const ikm=hkdf(ec.computeSecret(receiver),auth,Buffer.concat([Buffer.from('WebPush: info\0'),receiver,pub]),32);
 const key=hkdf(ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16),nonce=hkdf(ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12);
 const text=Buffer.concat([Buffer.from(JSON.stringify(payload)),Buffer.from([2])]);if(text.length>3000)throw Error('Push too large');
 let cipher=createCipheriv('aes-128-gcm',key,nonce),ciphertext=Buffer.concat([cipher.update(text),cipher.final(),cipher.getAuthTag()]);
 const rs=Buffer.alloc(4);rs.writeUInt32BE(4096);return Buffer.concat([salt,rs,Buffer.from([65]),pub,ciphertext]);
}
export function vapidHeader(data,endpoint,origin){
 const p=Buffer.from(data.public,'base64url');const key=createPrivateKey({key:{kty:'EC',crv:'P-256',d:data.private,x:b64(p.subarray(1,33)),y:b64(p.subarray(33))},format:'jwk'});
 const head=b64(JSON.stringify({typ:'JWT',alg:'ES256'})),body=b64(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+43200,sub:origin}));const msg=head+'.'+body;
 return 'vapid t='+msg+'.'+b64(sign('sha256',Buffer.from(msg),{key:key.export({type:'pkcs8',format:'pem'}),dsaEncoding:'ieee-p1363'}))+', k='+data.public;
}
export class Notifications{
 constructor(store,origin,sender=null){this.store=store;this.origin=origin;this.sender=sender;}
 async setup(){this.data=await this.store.load('notifications');if(!this.data){let ec=createECDH('prime256v1');ec.generateKeys();this.data={private:b64(ec.getPrivateKey()),public:b64(ec.getPublicKey()),subscriptions:{},cycle:0,armed:false,program:null,outbox:[]};await this.save();}}
 save(){return this.store.save('notifications',this.data);}
 status(){return {configured:true,origin:this.origin,publicKey:this.data.public,devices:Object.keys(this.data.subscriptions).length,registrations:Object.keys(this.data.subscriptions),monitor:{trackingCycle:!!this.data.armed,trackedProgram:this.data.program??null,lastObservation:this.data.lastObservation??null,lastCompletionAt:this.data.lastCompletionAt??null,pendingNotifications:this.data.outbox.reduce((sum,e)=>sum+e.pending.length,0),lastDelivery:this.data.lastDelivery??null}};}
 async add(v){v=subscription(v);let id=hash(v.endpoint);if(!this.data.subscriptions[id]&&Object.keys(this.data.subscriptions).length>=10)throw new UserError('Desative um aviso antes de adicionar outro aparelho.');this.data.subscriptions[id]=v;await this.save();}
 async remove(v){delete this.data.subscriptions[hash(v.endpoint||'')];await this.save();}
 async cancel(){this.data.armed=false;await this.save();}
 async observe(s){
  const d=this.data,now=Date.now();
  // The protocol reports power and cycle status independently. Explicit END wins over auto power-off.
  if(s.running_status==='end'&&d.armed&&d.program===s.program&&String(s.error_code??0)==='0'){
   d.outbox.push({id:'wash-'+d.cycle,title:'Lavagem concluída',body:'Sua lavadora terminou o ciclo.',pending:Object.keys(d.subscriptions),attempts:0,next:0,created:now});d.armed=false;d.lastCompletionAt=new Date(now).toISOString();
  }else if(s.power==='off'){d.armed=false;}
  else if(s.running_status==='start'){if(!d.armed||d.program!==s.program)d.cycle++;d.armed=true;d.program=s.program;}
  else if(['standby','idle'].includes(s.running_status)||(d.armed&&s.program!==d.program))d.armed=false;
  d.lastObservation={at:new Date(now).toISOString(),status:s.running_status,power:s.power,program:s.program};
  d.outbox=d.outbox.filter(e=>e.pending.length&&now-e.created<3600000&&e.attempts<4).slice(-20);await this.save();
 }
 async send(device,payload){
  let phase='preparation',status=null;
  const kind=String(payload.tag||'').startsWith('test-')?'test':'completion';
  try{
   if(this.sender){phase='send';const result=await this.sender(device,payload);status=result?.status??null;}
   else{device=subscription(device);const authorization=vapidHeader(this.data,device.endpoint,this.origin),body=encryptedPush(device,payload);phase='send';const response=await fetch(device.endpoint,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{authorization,'content-encoding':'aes128gcm','content-type':'application/octet-stream',TTL:'3600',Urgency:'normal'},body});status=response.status;if(!response.ok){const e=Error('Push rejected');e.status=status;throw e;}}
   this.data.lastDelivery={at:new Date().toISOString(),kind,result:'accepted',status};await this.save();
  }catch(error){this.data.lastDelivery={at:new Date().toISOString(),kind,result:'failed',status:Number.isInteger(error.status)?error.status:status,phase};await this.save();throw error;}
 }
 async test(value){let device=subscription(value);if(!this.data.subscriptions[hash(device.endpoint)])throw new UserError('Ative os avisos neste aparelho antes de testar.');try{await this.send(device,{title:'Minha Lavadora',body:'Os avisos deste aparelho estão funcionando.',tag:'test-'+b64(randomBytes(6)),url:'/#notifications'});}catch{throw new UserError('O serviço não confirmou o envio. Confira a permissão de avisos.',502);}}
 async deliver(){
  // One endpoint per invocation bounds native crypto CPU and lease duration on Workers Free.
  for(let e of this.data.outbox){if(e.next>Date.now())continue;const id=e.pending[0];if(!id)continue;let device=this.data.subscriptions[id];try{if(device)await this.send(device,{title:e.title,body:e.body,tag:e.id,url:'/#status'});e.pending.shift();e.attempts=0;}catch(err){if([404,410].includes(err.status)){delete this.data.subscriptions[id];e.pending.shift();e.attempts=0;}else{e.attempts++;if(e.attempts>=4){e.pending.shift();e.attempts=0;}}}e.next=Date.now()+60000*Math.max(1,e.attempts);this.data.outbox=this.data.outbox.filter(e=>e.pending.length&&Date.now()-e.created<3600000);await this.save();return;}
 }
}


