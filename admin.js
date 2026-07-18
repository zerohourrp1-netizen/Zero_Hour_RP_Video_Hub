
const A={client:null,user:null,profile:null,categories:[],videos:[],comments:[],profiles:[]};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const safe=(s='')=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const configured=()=>cfg.supabaseUrl&&!cfg.supabaseUrl.includes('PASTE_')&&cfg.supabaseAnonKey&&!cfg.supabaseAnonKey.includes('PASTE_');
function toast(m){const e=document.createElement('div');e.className='toast';e.textContent=m;document.body.append(e);setTimeout(()=>e.remove(),3500)}
function fmtDate(v){return v?new Date(v).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'—'}
function canUpload(){return A.profile?.approved&&['owner','admin','uploader'].includes(A.profile.role)}
function isAdmin(){return A.profile?.approved&&['owner','admin'].includes(A.profile.role)}
async function initAdmin(){
  wirePanel();
  if(!configured()){$('#adminSetupWarning').classList.remove('hidden');return}
  A.client=supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
  const {data:{session}}=await A.client.auth.getSession();A.user=session?.user||null;
  if(!A.user){location.href='index.html';return}
  const {data:p}=await A.client.from('profiles').select('*').eq('id',A.user.id).maybeSingle();A.profile=p;
  if(!canUpload()){location.href='index.html';return}
  $('#staffName').textContent=A.profile.display_name||A.profile.email||'Staff';
  $('#staffRole').textContent=A.profile.role;
  if(!isAdmin()){$$('[data-admin-only]').forEach(e=>e.classList.add('hidden'))}
  await reloadAll();
  $('#uploadForm').onsubmit=uploadVideo;
  $('#newCategoryForm').onsubmit=createCategory;
}
function wirePanel(){
  $$('[data-page]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();showPage(a.dataset.page);if(innerWidth<760)$('#sidebar').classList.remove('open')}));
  $('#mobileMenu')?.addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  $('#panelLogout')?.addEventListener('click',async()=>{if(A.client)await A.client.auth.signOut();location.href='index.html'});
  $$('[data-discord]').forEach(a=>a.href=cfg.discordUrl);$$('[data-fivem]').forEach(a=>a.href=cfg.fivemUrl);
}
function showPage(name){
  $$('.panel-page').forEach(p=>p.classList.toggle('active',p.id===`page-${name}`));
  $$('.side-link').forEach(l=>l.classList.toggle('active',l.dataset.page===name));
  $('#panelTitle').textContent=({overview:'Overview',upload:'Upload Video',videos:'Videos',categories:'Categories',comments:'Comments',staff:'Staff',analytics:'Analytics',settings:'Settings'})[name]||'Dashboard';
  history.replaceState(null,'','#'+name)
}
async function reloadAll(){
  const [{data:cats},{data:vids},{data:comments},{data:profiles}] = await Promise.all([
    A.client.from('categories').select('*').order('name'),
    A.client.from('videos').select('*,categories(name),profiles(display_name)').order('created_at',{ascending:false}),
    A.client.from('comments').select('*,videos(title)').order('created_at',{ascending:false}).limit(200),
    isAdmin()?A.client.from('profiles').select('*').order('created_at'):{data:[]}
  ]);
  A.categories=cats||[];A.videos=vids||[];A.comments=comments||[];A.profiles=profiles||[];
  renderAll();
  const hash=location.hash.replace('#','');if(hash&&$(`#page-${hash}`))showPage(hash)
}
function renderAll(){
  $('#statVideos').textContent=A.videos.length;
  $('#statPublic').textContent=A.videos.filter(v=>v.status==='public').length;
  $('#statViews').textContent=A.videos.reduce((n,v)=>n+Number(v.views||0),0).toLocaleString();
  $('#statComments').textContent=A.comments.length;
  $('#recentVideos').innerHTML=A.videos.slice(0,6).map(v=>`<tr><td><span class="table-title">${safe(v.title)}</span><div class="muted small">${safe(v.categories?.name||'Other')}</div></td><td><span class="badge ${v.status}">${v.status}</span></td><td>${Number(v.views||0).toLocaleString()}</td><td>${fmtDate(v.created_at)}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">No videos yet.</td></tr>';
  const datalist=$('#categorySuggestions');datalist.innerHTML=A.categories.map(c=>`<option value="${safe(c.name)}">`).join('');
  renderVideos();renderCategories();renderComments();renderStaff();renderAnalytics();
}
function renderVideos(){
  $('#videoTableBody').innerHTML=A.videos.map(v=>`<tr><td><span class="table-title">${safe(v.title)}</span><div class="muted small">${safe(v.profiles?.display_name||'Staff')}</div></td><td>${safe(v.categories?.name||'Other')}</td><td><span class="badge ${v.status}">${v.status}</span></td><td>${Number(v.views||0).toLocaleString()}</td><td>${fmtDate(v.created_at)}</td><td><button class="btn btn-small" onclick="togglePublish('${v.id}','${v.status}')">${v.status==='public'?'Make Draft':'Publish'}</button> <button class="btn btn-danger btn-small" onclick="deleteVideo('${v.id}','${safe(v.video_path||'')}')">Delete</button></td></tr>`).join('')||'<tr><td colspan="6" class="muted">No videos uploaded.</td></tr>'
}
function renderCategories(){
  $('#categoryGrid').innerHTML=A.categories.map(c=>`<div class="category-card"><div><strong>${safe(c.name)}</strong><div class="muted small">${A.videos.filter(v=>v.category_id===c.id).length} video(s)</div></div><button class="btn btn-danger btn-small" onclick="deleteCategory('${c.id}')">Delete</button></div>`).join('')
}
function renderComments(){
  $('#commentTableBody').innerHTML=A.comments.map(c=>`<tr><td><strong>${safe(c.author_name)}</strong></td><td>${safe(c.videos?.title||'Video')}</td><td>${safe(c.body)}</td><td>${fmtDate(c.created_at)}</td><td><button class="btn btn-danger btn-small" onclick="deleteComment('${c.id}')">Delete</button></td></tr>`).join('')||'<tr><td colspan="5" class="muted">No comments.</td></tr>'
}
function renderStaff(){
  if(!isAdmin())return;
  $('#staffTableBody').innerHTML=A.profiles.map(p=>`<tr><td><strong>${safe(p.display_name||p.email||p.id)}</strong><div class="muted small">${safe(p.email||'')}</div></td><td><select onchange="updateStaffRole('${p.id}',this.value)"><option value="viewer" ${p.role==='viewer'?'selected':''}>viewer</option><option value="uploader" ${p.role==='uploader'?'selected':''}>uploader</option><option value="admin" ${p.role==='admin'?'selected':''}>admin</option><option value="owner" ${p.role==='owner'?'selected':''}>owner</option></select></td><td><span class="badge ${p.role}">${p.approved?'Approved':'Not approved'}</span></td><td><button class="btn ${p.approved?'btn-danger':'btn-green'} btn-small" onclick="toggleStaff('${p.id}',${!p.approved})">${p.approved?'Revoke':'Approve'}</button></td></tr>`).join('')
}
function renderAnalytics(){
  const total=Math.max(...A.videos.map(v=>Number(v.views||0)),1);
  $('#analyticsBars').innerHTML=A.videos.slice().sort((a,b)=>Number(b.views||0)-Number(a.views||0)).slice(0,10).map(v=>`<div class="analytics-row"><div class="small">${safe(v.title)}</div><div class="analytics-track"><div class="analytics-fill" style="width:${Math.max(2,Number(v.views||0)/total*100)}%"></div></div><div class="small">${Number(v.views||0).toLocaleString()}</div></div>`).join('')||'<p class="muted">No analytics yet.</p>'
}
async function ensureCategory(name){
  let c=A.categories.find(x=>x.name.toLowerCase()===name.toLowerCase());if(c)return c.id;
  const {data,error}=await A.client.from('categories').insert({name}).select().single();if(error)throw error;return data.id
}
async function uploadVideo(e){
  e.preventDefault();
  const title=$('#videoTitle').value.trim(),description=$('#videoDescription').value.trim(),category=$('#videoCategory').value.trim(),status=$('#videoStatus').value,video=$('#videoFile').files[0],thumb=$('#thumbFile').files[0];
  if(!title||!category||!video)return toast('Title, category, and video are required.');
  const b=$('#uploadSubmit');b.disabled=true;$('#uploadProgressBox').classList.remove('hidden');
  try{
    $('#uploadProgress').style.width='10%';
    const category_id=await ensureCategory(category);
    const ext=video.name.split('.').pop(),video_path=`${A.user.id}/${crypto.randomUUID()}.${ext}`;
    const up=await A.client.storage.from('videos').upload(video_path,video,{contentType:video.type,upsert:false});if(up.error)throw up.error;
    $('#uploadProgress').style.width='60%';
    const video_url=A.client.storage.from('videos').getPublicUrl(video_path).data.publicUrl;
    let thumbnail_url=null,thumbnail_path=null;
    if(thumb){const te=thumb.name.split('.').pop();thumbnail_path=`${A.user.id}/${crypto.randomUUID()}.${te}`;const tu=await A.client.storage.from('thumbnails').upload(thumbnail_path,thumb,{contentType:thumb.type});if(tu.error)throw tu.error;thumbnail_url=A.client.storage.from('thumbnails').getPublicUrl(thumbnail_path).data.publicUrl}
    $('#uploadProgress').style.width='85%';
    const {error}=await A.client.from('videos').insert({title,description,category_id,video_url,video_path,thumbnail_url,thumbnail_path,uploader_id:A.user.id,status,published_at:status==='public'?new Date().toISOString():null});if(error)throw error;
    $('#uploadProgress').style.width='100%';toast(status==='public'?'Video is now public for everybody.':'Video saved as a draft.');
    e.target.reset();setTimeout(async()=>{b.disabled=false;$('#uploadProgressBox').classList.add('hidden');await reloadAll();showPage('videos')},700)
  }catch(err){toast(err.message||String(err));b.disabled=false}
}
async function createCategory(e){e.preventDefault();const name=$('#newCategoryName').value.trim();if(!name)return;const {error}=await A.client.from('categories').insert({name});if(error)return toast(error.message);e.target.reset();await reloadAll();toast('Category created.')}
window.deleteVideo=async(id,path)=>{if(!confirm('Permanently delete this video?'))return;const {error}=await A.client.from('videos').delete().eq('id',id);if(error)return toast(error.message);if(path)await A.client.storage.from('videos').remove([path]);await reloadAll()}
window.togglePublish=async(id,status)=>{const next=status==='public'?'draft':'public';const {error}=await A.client.from('videos').update({status:next,published_at:next==='public'?new Date().toISOString():null}).eq('id',id);if(error)return toast(error.message);await reloadAll();toast(next==='public'?'Video published globally.':'Video changed to draft.')}
window.deleteCategory=async id=>{if(!confirm('Delete this category? Videos will remain and show as Other.'))return;const {error}=await A.client.from('categories').delete().eq('id',id);if(error)return toast(error.message);await reloadAll()}
window.deleteComment=async id=>{const {error}=await A.client.from('comments').delete().eq('id',id);if(error)return toast(error.message);await reloadAll()}
window.updateStaffRole=async(id,role)=>{const {error}=await A.client.from('profiles').update({role}).eq('id',id);toast(error?error.message:'Staff role updated.')}
window.toggleStaff=async(id,approved)=>{const {error}=await A.client.from('profiles').update({approved}).eq('id',id);if(error)return toast(error.message);await reloadAll()}
document.addEventListener('DOMContentLoaded',initAdmin);
