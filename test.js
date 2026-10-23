const {spawn}=require('child_process'),http=require('http');
let fails=0;const ok=(c,n)=>{if(!c){fails++;console.log('  FAIL:',n)}};
const req=(port,p,method='GET',body)=>new Promise(r=>{const q=http.request({host:'127.0.0.1',port,path:p,method,headers:{'Content-Type':'application/json'}},s=>{let d='';s.on('data',c=>d+=c);s.on('end',()=>r({s:s.statusCode,b:d}))});q.on('error',e=>r({s:0,b:e.message}));q.end(body)});
const chat=(port,o)=>req(port,'/api/chat','POST',typeof o==='string'?o:JSON.stringify(o));
const mock=http.createServer((q,s)=>{let d='';q.on('data',c=>d+=c);q.on('end',()=>{const j=JSON.parse(d),last=j.messages[j.messages.length-1].content;
if(q.headers.authorization!=='Bearer test'){s.writeHead(401);return s.end('{"error":{"message":"bad key"}}')}
if(last.includes('FAIL')){s.writeHead(500);return s.end('{"error":{"message":"upstream down"}}')}
s.writeHead(200,{'Content-Type':'application/json'});s.end(JSON.stringify({choices:[{message:{content:'MOCK:'+last+'|sys='+j.messages[0].content.slice(-20)}}]}))})});
const start=(port,env)=>new Promise(r=>{const c=spawn('node',['server.js'],{env:{...process.env,PORT:port,...env},stdio:'pipe'});c.stdout.on('data',()=>r(c));});
(async()=>{await new Promise(r=>mock.listen(4101,r));
const a=await start(4102,{OPENAI_API_KEY:'test',OPENAI_BASE_URL:'http://127.0.0.1:4101',RATE_LIMIT:30});
const b=await start(4103,{OPENAI_API_KEY:'',OPENAI_BASE_URL:'http://127.0.0.1:4101'});
let r=await req(4102,'/api/health');ok(r.s===200&&JSON.parse(r.b).configured,'health');
r=await req(4102,'/');ok(r.s===200&&r.b.includes('StudyBuddy'),'index');
for(const f of['/manifest.json','/sw.js','/icon-192.png','/icon-512.png']){r=await req(4102,f);ok(r.s===200,'static '+f)}
r=await req(4102,'/..%2fserver.js');ok(r.s===403||r.s===404,'traversal blocked');
r=await req(4102,'/nope');ok(r.s===404,'404');
r=await chat(4102,{mode:'quiz',messages:[{role:'user',content:'hello'}]});ok(r.s===200&&JSON.parse(r.b).reply.startsWith('MOCK:hello'),'chat ok');
r=await chat(4102,{messages:[{role:'user',content:'hi'}]});ok(r.s===200,'default mode');
r=await chat(4102,{messages:[]});ok(r.s===400,'empty');
r=await chat(4102,{messages:[{role:'system',content:'x'}]});ok(r.s===400,'bad role');
r=await chat(4102,{messages:[{role:'user',content:'x'.repeat(9000)}]});ok(r.s===400,'too long');
r=await chat(4102,{messages:[{role:'assistant',content:'x'}]});ok(r.s===400,'last must be user');
r=await chat(4102,'{bad json');ok(r.s===400,'bad json');
r=await req(4102,'/api/chat','GET');ok(r.s===405,'GET chat');
r=await chat(4102,{messages:[{role:'user',content:'FAIL'}]});ok(r.s===502&&b&&JSON.parse(r.b).error.includes('upstream'),'upstream error');
r=await chat(4103,{messages:[{role:'user',content:'hi'}]});ok(r.s===500,'missing key');
let got429=false;for(let i=0;i<40;i++){r=await chat(4102,{messages:[{role:'user',content:'hi'}]});if(r.s===429)got429=true}ok(got429,'rate limit');
a.kill();b.kill();mock.close();console.log(fails?'FAILED '+fails:'ALL PASSED');process.exit(fails?1:0)})();
