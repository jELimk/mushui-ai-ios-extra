if(window.AndroidHost){
 const pending=new Map();window.hostResult=r=>{const job=pending.get(r.id);if(!job)return;pending.delete(r.id);r.ok?job.resolve(r.data):job.reject(Error(r.error||'裝置操作失敗'));};
 window.Desktop={invoke:(op,data={})=>new Promise((resolve,reject)=>{const id='host:'+crypto.randomUUID();pending.set(id,{resolve,reject});AndroidHost.request(id,'host'+op,JSON.stringify(data));})};
}
