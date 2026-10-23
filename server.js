const http=require('http'),https=require('https'),fs=require('fs'),path=require('path'),{URL}=require('url');
try{fs.readFileSync(path.join(__dirname,'.env'),'utf8').split(/\r?\n/).forEach(l=>{const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})}catch{}
const PORT=process.env.PORT||3000,KEY=process.env.OPENAI_API_KEY||'',MODEL=process.env.OPENAI_MODEL||'gpt-4o-mini';
const BASE=process.env.OPENAI_BASE_URL||'https://api.openai.com/v1',LIMIT=+process.env.RATE_LIMIT||20;
const PUB=path.join(__dirname,'public');
const BASE_PROMPT='You are StudyBuddy, a friendly, accurate study assistant for college students. Be clear and concise, use examples, and admit when unsure. Help students learn rather than just hand over answers to graded work.';
const MODES={explain:'Explain the topic simply, then give an example and a quick check question.',summarize:'Summarize the given notes into key points with headings and bullet points.',quiz:'Quiz the student: ask one question at a time, wait for the answer, then give feedback.',flashcards:'Create flashcards in the format "Q: ... / A: ..." from the given material.',essay:'Help with essay structure, thesis, and feedback. Suggest improvements; do not write the whole essay.',solve:'Solve problems step by step, explaining each step and the reasoning.'};
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.css':'text/css'};
const hits=new Map();
function limited(ip){const n=Date.now(),a=(hits.get(ip)||[]).filter(t=>n-t<60000);a.push(n);hits.set(ip,a);return a.length>LIMIT}
function send(res,code,obj){res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(obj))}
function callAI(messages){return new Promise((ok,bad)=>{const u=new URL(BASE+'/chat/completions'),lib=u.protocol==='https:'?https:http,body=JSON.stringify({model:MODEL,messages,temperature:0.5});
const r=lib.request(u,{method:'POST',timeout:60000,headers:{'Content-Type':'application/json','Authorization':'Bearer '+KEY,'Content-Length':Buffer.byteLength(body)}},s=>{let d='';s.on('data',c=>d+=c);s.on('end',()=>{let j;try{j=JSON.parse(d)}catch{return bad(new Error('Bad response from AI service'))}
if(s.statusCode>=400)return bad(new Error((j.error&&j.error.message)||'AI service error '+s.statusCode));const t=j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;t?ok(t):bad(new Error('Empty AI response'))})});
r.on('timeout',()=>r.destroy(new Error('AI service timed out')));r.on('error',bad);r.end(body)})}
function validate(b){if(!b||typeof b!=='object')return'Invalid request';if(!Array.isArray(b.messages)||!b.messages.length)return'No messages';if(b.messages.length>40)return'Too many messages';
for(const m of b.messages){if(!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!m.content.trim())return'Invalid message';if(m.content.length>8000)return'Message too long (max 8000 characters)'}
if(b.messages[b.messages.length-1].role!=='user')return'Last message must be from the user';return null}
const server=http.createServer(async(req,res)=>{
try{const url=new URL(req.url,'http://x');
if(url.pathname==='/api/health')return send(res,200,{ok:true,configured:!!KEY});
if(url.pathname==='/api/chat'){if(req.method!=='POST')return send(res,405,{error:'Use POST'});
if(!KEY)return send(res,500,{error:'Server missing OPENAI_API_KEY. Add it to .env and restart.'});
if(limited(req.socket.remoteAddress))return send(res,429,{error:'Too many requests. Wait a minute and try again.'});
let raw='';for await(const c of req){raw+=c;if(raw.length>300000)return send(res,413,{error:'Request too large'})}
let b;try{b=JSON.parse(raw)}catch{return send(res,400,{error:'Invalid JSON'})}
const err=validate(b);if(err)return send(res,400,{error:err});
const sys=BASE_PROMPT+' '+(MODES[b.mode]||MODES.explain);
try{const reply=await callAI([{role:'system',content:sys},...b.messages.slice(-20).map(m=>({role:m.role,content:m.content}))]);return send(res,200,{reply})}
catch(e){return send(res,502,{error:e.message})}}
if(req.method!=='GET')return send(res,405,{error:'Method not allowed'});
let p=decodeURIComponent(url.pathname);if(p==='/')p='/index.html';
const f=path.normalize(path.join(PUB,p));if(!f.startsWith(PUB+path.sep))return send(res,403,{error:'Forbidden'});
fs.readFile(f,(e,d)=>{if(e)return send(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'});res.end(d)})
}catch(e){send(res,400,{error:'Bad request'})}});
server.listen(PORT,'0.0.0.0',()=>console.log('StudyBuddy running on http://localhost:'+PORT+(KEY?'':'  (WARNING: OPENAI_API_KEY not set)')));
