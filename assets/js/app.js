
const cfg = window.ZERO_HOUR_CONFIG || {};
const S = { client:null, user:null, profile:null, categories:[], videos:[] };
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const safe = (s='') => String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const configured = () => cfg.supabaseUrl && !cfg.supabaseUrl.includes('PASTE_') && cfg.supabaseAnonKey && !cfg.supabaseAnonKey.includes('PASTE_');
function toast(msg){const e=document.createElement('div');e.className='toast';e.textContent=msg;document.body.appendChild(e);setTimeout(()=>e.remove(),3500)}
function fmtDate(v){return v?new Date(v).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'—'}
function fmtViews(n=0){return Number(n||0).toLocaleString()+' views'}
function canUpload(){return !!(S.profile?.approved && ['owner','admin','uploader'].includes(S.profile.role))}
async function init(){
  wireCommon();
  if(!configured()){ $('#setupWarning')?.classList.remove('hidden'); return; }
  S.client = supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
  const {data:{session}} = await S.client.auth.getSession();
  S.user = session?.user || null;
  if(S.user) await loadProfile();
  refreshAuth();
  await loadCategories();
  if($('#videoGrid')) await loadVideos();
  if($('#watchPage')) await loadWatch();
}
function wireCommon(){
  $$('[data-discord]').forEach(a=>a.href=cfg.discordUrl);
  $$('[data-fivem]').forEach(a=>a.href=cfg.fivemUrl);
  $('#loginBtn')?.addEventListener('click',()=>$('#loginModal')?.classList.remove('hidden'));
  $('#closeLogin')?.addEventListener('click',()=>$('#loginModal')?.classList.add('hidden'));
  $('#loginForm')?.addEventListener('submit',login);
  $('#logoutBtn')?.addEventListener('click',logout);
  $('#searchForm')?.addEventListener('submit',e=>{e.preventDefault();location.href='index.html?q='+encodeURIComponent($('#searchInput').value.trim())});
}
async function loadProfile(){const {data}=await S.client.from('profiles').select('*').eq('id',S.user.id).maybeSingle();S.profile=data}
function refreshAuth(){
  $('#loginBtn')?.classList.toggle('hidden',!!S.user);
  $('#logoutBtn')?.classList.toggle('hidden',!S.user);
  $('#dashboardLink')?.classList.toggle('hidden',!canUpload());
}
async function login(e){
  e.preventDefault();
  if(!configured()) return toast('Connect Supabase in config.js first.');
  const {data,error}=await S.client.auth.signInWithPassword({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value});
  if(error)return toast(error.message);
  S.user=data.user;await loadProfile();refreshAuth();$('#loginModal').classList.add('hidden');
  toast(canUpload()?'Staff login successful.':'Account is not approved for uploads.');
}
async function logout(){await S.client.auth.signOut();location.reload()}
async function loadCategories(){
  if(!S.client)return;
  const {data}=await S.client.from('categories').select('*').order('name');
  S.categories=data||[];
  const row=$('#categoryRow');
  if(row){
    row.innerHTML='<button class="chip active" data-category="">All</button>'+S.categories.map(c=>`<button class="chip" data-category="${safe(c.name)}">${safe(c.name)}</button>`).join('');
    row.onclick=e=>{const b=e.target.closest('.chip');if(!b)return;$$('.chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderVideos(b.dataset.category)}
  }
}
async function loadVideos(){
  const {data,error}=await S.client.from('videos').select('*,categories(name),profiles(display_name)').eq('status','public').order('published_at',{ascending:false});
  if(error)return toast(error.message);
  S.videos=data||[];
  const search=(new URLSearchParams(location.search).get('q')||'').toLowerCase();
  renderVideos('',search);
}
function renderVideos(category='',search=''){
  const rows=S.videos.filter(v=>(!category||v.categories?.name===category)&&(!search||(`${v.title} ${v.description||''} ${v.categories?.name||''}`).toLowerCase().includes(search)));
  $('#videoGrid').innerHTML=rows.map(videoCard).join('');
  $('#emptyState').classList.toggle('hidden',rows.length>0);
}
function videoCard(v){
  const thumb=v.thumbnail_url?`<img src="${safe(v.thumbnail_url)}" alt="">`:`<img class="default-logo" src="${cfg.defaultThumbnail||'assets/images/zero-hour-logo.png'}" alt="">`;
  return `<a class="video-card" href="watch.html?id=${v.id}"><div class="thumb">${thumb}</div><div class="card-body"><div class="card-title">${safe(v.title)}</div><div class="meta">${safe(v.profiles?.display_name||'Zero Hour RP Staff')}</div><div class="meta">${fmtViews(v.views)} • ${fmtDate(v.published_at||v.created_at)}</div><div class="meta">${safe(v.categories?.name||'Other')}</div></div></a>`
}
async function loadWatch(){
  const id=new URLSearchParams(location.search).get('id');if(!id)return;
  const {data:v,error}=await S.client.from('videos').select('*,categories(name),profiles(display_name)').eq('id',id).eq('status','public').maybeSingle();
  if(error||!v){$('#watchPage').innerHTML='<div class="empty"><h3>Video not found</h3></div>';return}
  await S.client.rpc('increment_video_views',{video_id_input:id});
  $('#videoPlayer').src=v.video_url;$('#watchTitle').textContent=v.title;$('#watchMeta').textContent=`${fmtViews((v.views||0)+1)} • ${fmtDate(v.published_at||v.created_at)} • ${v.categories?.name||'Other'}`;$('#watchDescription').textContent=v.description||'';
  $('#likeBtn').onclick=()=>react(id,'like');$('#dislikeBtn').onclick=()=>react(id,'dislike');$('#commentForm').onsubmit=e=>addComment(e,id);
  await loadReactions(id);await loadComments(id)
}
async function react(id,reaction){
  const visitor=localStorage.getItem('zhrp_visitor')||crypto.randomUUID();localStorage.setItem('zhrp_visitor',visitor);
  const {error}=await S.client.from('reactions').upsert({video_id:id,visitor_key:visitor,reaction},{onConflict:'video_id,visitor_key'});
  if(error)return toast(error.message);await loadReactions(id)
}
async function loadReactions(id){const {data}=await S.client.from('reactions').select('reaction').eq('video_id',id);const rows=data||[];$('#likeCount').textContent=rows.filter(x=>x.reaction==='like').length;$('#dislikeCount').textContent=rows.filter(x=>x.reaction==='dislike').length}
async function loadComments(id){const {data}=await S.client.from('comments').select('*').eq('video_id',id).eq('approved',true).order('created_at',{ascending:false});$('#commentsList').innerHTML=(data||[]).map(c=>`<div class="comment"><strong>${safe(c.author_name)}</strong><div class="muted small">${fmtDate(c.created_at)}</div><p>${safe(c.body)}</p></div>`).join('')||'<p class="muted">No comments yet.</p>'}
async function addComment(e,id){e.preventDefault();const author=$('#commentName').value.trim(),body=$('#commentBody').value.trim();if(!author||!body)return;const {error}=await S.client.from('comments').insert({video_id:id,author_name:author,body,approved:true});if(error)return toast(error.message);e.target.reset();await loadComments(id)}
document.addEventListener('DOMContentLoaded',init);
