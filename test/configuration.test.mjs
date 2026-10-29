import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const withoutPrivateSettings=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('MIDEA_')&&!k.startsWith('FIREBASE_')));
test('missing identity settings reject otherwise plausible owner claims',()=>{
 const script="import {claimsValid} from './src/auth.mjs'; if(claimsValid({aud:undefined,iss:'https://securetoken.google.com/undefined',sub:undefined,email:undefined,email_verified:true,exp:Date.now()/1000+60,iat:Date.now()/1000,auth_time:Date.now()/1000})) process.exit(1)";
 const result=spawnSync(process.execPath,['--input-type=module','--eval',script],{env:withoutPrivateSettings,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});
test('missing protocol parameters fail before attempting manufacturer network access',()=>{
 const script="import {MideaClient} from './src/midea.mjs'; let calls=0; try{new MideaClient({account:'dummy@example.test',password:'dummy',target:{}},{fetcher:()=>calls++});process.exit(1)}catch(e){if(e.status!==503||calls!==0)process.exit(2)}";
 const result=spawnSync(process.execPath,['--input-type=module','--eval',script],{env:withoutPrivateSettings,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});
