import {createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {Buffer} from 'node:buffer';
export class Store{
 constructor(env){this.db=env.DB;this.key=Buffer.from(env.STATE_KEY,'base64url');if(this.key.length!==32)throw Error('Missing storage key');}
 async load(name,fallback=null){const row=await this.db.prepare('SELECT value FROM kv WHERE name=?').bind(name).first();if(!row)return fallback;let data=Buffer.from(row.value,'base64url');let c=createDecipheriv('aes-256-gcm',this.key,data.subarray(0,12));c.setAAD(Buffer.from(name));c.setAuthTag(data.subarray(12,28));return JSON.parse(Buffer.concat([c.update(data.subarray(28)),c.final()]).toString());}
 async save(name,value){const nonce=randomBytes(12),c=createCipheriv('aes-256-gcm',this.key,nonce);c.setAAD(Buffer.from(name));let ciphertext=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);let data=Buffer.concat([nonce,c.getAuthTag(),ciphertext]).toString('base64url');await this.db.prepare('INSERT INTO kv(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value').bind(name,data).run();}
 async lease(fn){let holder=randomUUID(),now=Date.now();const row=await this.db.prepare('INSERT INTO lease(name,holder,expires) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET holder=excluded.holder,expires=excluded.expires WHERE lease.expires<? RETURNING holder').bind('washer',holder,now+180000,now).first();if(!row){let e=new Error('A lavadora está sendo consultada. Aguarde alguns segundos e atualize.');e.status=409;throw e;}try{return await fn();}finally{await this.db.prepare('DELETE FROM lease WHERE name=? AND holder=?').bind('washer',holder).run();}}
}

