import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,sign} from 'node:crypto';
import worker from '../src/index.mjs';import {Store} from '../src/store.mjs';
test('owner can read notification settings while washer is leased; state remains serialized',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});const oldFetch=globalThis.fetch;let upstreamCalls=0;
 globalThis.fetch=async(url)=>{assert.ok(String(url).startsWith('https://www.googleapis.com/'));upstreamCalls++;return Response.json({test:publicKey.export({type:'spki',format:'pem'})},{headers:{'Cache-Control':'max-age=3600'}});};
 const records=new Map();let leaseAttempts=0;
 const db={prepare(sql){return {bind(...args){return {async first(){if(sql.includes('FROM kv'))return records.has(args[0])?{value:records.get(args[0])}:null;if(sql.includes('INTO lease')){leaseAttempts++;return null;}throw Error('Unexpected SQL');},async run(){if(sql.includes('INTO kv'))records.set(args[0],args[1]);else throw Error('Unexpected write');}};}};}};
 const origin='https://washer.example.test';const env={PUBLIC_ORIGIN:origin,STATE_KEY:Buffer.alloc(32,5).toString('base64url'),DB:db};
 await new Store(env).save('notifications',{public:'dummy-public-key',subscriptions:{},outbox:[]});
 const claims={aud:'example-project',iss:'https://securetoken.google.com/example-project',sub:'example-owner-uid',email:'owner@example.test',email_verified:true,iat:Date.now()/1000,auth_time:Date.now()/1000,exp:Date.now()/1000+1000};const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'test'})).toString('base64url'),body=Buffer.from(JSON.stringify(claims)).toString('base64url'),message=header+'.'+body,jwt=message+'.'+sign('RSA-SHA256',Buffer.from(message),privateKey).toString('base64url');
 try{let response=await worker.fetch(new Request(origin+'/api/notifications',{headers:{Cookie:'lavadora='+jwt}}),env);assert.equal(response.status,200);assert.equal((await response.json()).publicKey,'dummy-public-key');assert.equal(leaseAttempts,0);response=await worker.fetch(new Request(origin+'/api/state',{headers:{Cookie:'lavadora='+jwt}}),env);assert.equal(response.status,409);assert.equal(leaseAttempts,1);assert.equal(upstreamCalls,1);}finally{globalThis.fetch=oldFetch;}
});
