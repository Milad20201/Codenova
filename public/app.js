const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function loadSite(){
 try{
  const r=await fetch('/api/site');const d=await r.json();const s=d.settings;
  $('#brand').textContent=s.brandName;$('#footer-brand').textContent=s.brandName;document.title=s.brandName+' | تیم خلاق دیجیتال';
  $('#tagline').innerHTML=esc(s.tagline).replace(/، /g,'،<br>');$('#hero-desc').textContent=s.heroDescription;$('#about-title').textContent=s.aboutTitle;$('#about-desc').textContent=s.aboutDescription;
  if(s.primaryColor)document.documentElement.style.setProperty('--purple',s.primaryColor);
  $('#services-list').innerHTML=d.services.map(x=>`<article class="card"><span class="card-icon">${esc(x.icon)}</span><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p></article>`).join('');
  $('#projects-list').innerHTML=d.projects.map(x=>`<article class="project"><div class="project-image">${x.image?`<img src="${esc(x.image)}" alt="${esc(x.title)}">`:esc(x.title.slice(0,1))}</div><div class="project-info"><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p><span class="tag">${esc(x.category)}</span>${x.url?`<p><a href="${esc(x.url)}" target="_blank" rel="noopener">مشاهده پروژه ↗</a></p>`:''}</div></article>`).join('');
  $('#team-list').innerHTML=d.team.map(x=>`<article class="member">${x.image?`<img src="${esc(x.image)}" alt="${esc(x.name)}">`:`<div class="avatar">${esc(x.name.slice(0,1))}</div>`}<h3>${esc(x.name)}</h3><p>${esc(x.role)}</p>${x.bio?`<p>${esc(x.bio)}</p>`:''}</article>`).join('');
  $('#socials').innerHTML=[['ایمیل',s.contactEmail?'mailto:'+s.contactEmail:''],['تلگرام',s.telegram],['اینستاگرام',s.instagram],['گیت‌هاب',s.github]].filter(x=>x[1]).map(x=>`<a href="${esc(x[1])}" target="_blank" rel="noopener">${esc(x[0])}</a>`).join('');
 }catch(e){console.error('Could not load site data',e)}
}
$('#contact-form').addEventListener('submit',async e=>{e.preventDefault();const status=$('#contact-status');status.textContent='در حال ارسال...';const body=Object.fromEntries(new FormData(e.currentTarget));try{const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);status.textContent=d.message;e.currentTarget.reset()}catch(err){status.textContent=err.message||'ارسال پیام ناموفق بود.'}});
$('#year').textContent=new Date().getFullYear();loadSite();
