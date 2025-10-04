
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards = document.querySelectorAll('.card');

  if (!reduceMotion) {
    cards.forEach(card => {
      let raf;
      function onMove(e){
        const r = card.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width/2)) / (r.width/2);
        const y = (e.clientY - (r.top + r.height/2)) / (r.height/2);
        const rx = (-y * 8).toFixed(2);
        const ry = (x * 8).toFixed(2);
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(()=>{
          card.style.setProperty('--rx', rx + 'deg');
          card.style.setProperty('--ry', ry + 'deg');
        });
      }
      function onLeave(){
        card.style.setProperty('--rx','0deg');
        card.style.setProperty('--ry','0deg');
      }
      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
      // For keyboard users
      card.addEventListener('focusin', ()=>card.classList.add('kbd'));
      card.addEventListener('focusout', ()=>card.classList.remove('kbd'));
    });
  }


  const overlay = document.getElementById('auth-modal');
const openers = document.querySelectorAll('[data-auth-open]');
const closer = document.querySelector('[data-auth-close]');
openers.forEach(btn => btn.addEventListener('click', () => {
  overlay.setAttribute('aria-hidden','false');
  document.getElementById('panel-signin').focus();
}));
closer.addEventListener('click', () => overlay.setAttribute('aria-hidden','true'));
overlay.addEventListener('click', (e)=> {
  if(e.target === overlay) overlay.setAttribute('aria-hidden','true');
});

// Tabs
const tabSignin = document.getElementById('tab-signin');
const tabSignup = document.getElementById('tab-signup');
const panelSignin = document.getElementById('panel-signin');
const panelSignup = document.getElementById('panel-signup');
const panelForgot = document.getElementById('panel-forgot');

function setTab(which){
  const signinActive = which === 'signin';
  tabSignin.classList.toggle('active', signinActive);
  tabSignup.classList.toggle('active', !signinActive);
  panelSignin.classList.toggle('active', signinActive);
  panelSignup.classList.toggle('active', !signinActive);
  panelForgot.classList.remove('active');
}
tabSignin.addEventListener('click', ()=>setTab('signin'));
tabSignup.addEventListener('click', ()=>setTab('signup'));

// Forgot Password
document.querySelector('[data-forgot-open]').addEventListener('click', ()=>{
  tabSignin.classList.remove('active');
  tabSignup.classList.remove('active');
  panelSignin.classList.remove('active');
  panelSignup.classList.remove('active');
  panelForgot.classList.add('active');
  panelForgot.focus();
});

// Helpers
function setError(id, msg){ const el = document.getElementById(id); if(el){ el.textContent = msg||''; } }
function setSuccess(id, msg){ const el = document.getElementById(id); if(el){ el.textContent = msg||''; } }

// SECURITY NOTE:
// Use server-issued HttpOnly, Secure, SameSite cookies for sessions.
// Do NOT store JWTs in localStorage/sessionStorage. Backend should set cookie on 200 OK. [Best practice] [1]
//
// [1] See references.

async function postJSON(url, data) {
  const res = await fetch(url, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    credentials:'include', // include cookies
    body: JSON.stringify(data)
  });
  const json = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(json.message || ('HTTP '+res.status));
  return json;
}

// Sign In
document.getElementById('form-signin').addEventListener('submit', async (e)=>{
  e.preventDefault();
  setError('signin-error','');
  const fd = new FormData(e.currentTarget);
  const payload = {
    email: fd.get('email'),
    password: fd.get('password'),
    remember: !!fd.get('remember')
  };
  try {
    // Backend should set session cookie: HttpOnly; Secure; SameSite=Lax; Max-Age if remember=true
    await postJSON('/api/auth/login', payload);
    overlay.setAttribute('aria-hidden','true');
    await afterLoginRoute();
  } catch(err){
    setError('signin-error', err.message || 'Invalid email or password');
  }
});

// Sign Up
document.getElementById('form-signup').addEventListener('submit', async (e)=>{
  e.preventDefault();
  setError('signup-error','');
  const fd = new FormData(e.currentTarget);
  const payload = {
    name: fd.get('name'),
    email: fd.get('email'),
    password: fd.get('password'),
    tos: !!fd.get('tos')
  };
  if(!payload.tos){ setError('signup-error','Please accept Terms and Privacy Policy'); return; }
  try {
    await postJSON('/api/auth/register', payload);
    // Optionally auto-start trial server-side and set session cookie.
    overlay.setAttribute('aria-hidden','true');
    await afterLoginRoute();
  } catch(err){
    setError('signup-error', err.message || 'Registration failed');
  }
});

// Social buttons (placeholder)
document.getElementById('signin-google').addEventListener('click', ()=>{
  // Redirect to backend OAuth start; on success, backend sets HttpOnly cookie and redirects back.
  window.location.href = '/api/auth/oauth/google?mode=signin';
});
document.getElementById('signup-google').addEventListener('click', ()=>{
  window.location.href = '/api/auth/oauth/google?mode=signup';
});

// Forgot Password
document.getElementById('form-forgot').addEventListener('submit', async (e)=>{
  e.preventDefault();
  setSuccess('forgot-success',''); setError('forgot-error','');
  const fd = new FormData(e.currentTarget);
  try {
    await postJSON('/api/auth/forgot-password', { email: fd.get('email') });
    setSuccess('forgot-success','Reset link sent. Check inbox.');
  } catch(err){
    setError('forgot-error', err.message || 'Could not send reset link');
  }
});

// After login, check entitlements and route
async function afterLoginRoute(){
  // Ask backend for user status and subscription entitlements; session identified by cookie
  const res = await fetch('/api/me', { credentials:'include' });
  const me = await res.json().catch(()=>null);
  if(!res.ok || !me){ window.location.href='/login'; return; }

  const gate = document.getElementById('subscriber-gate');
  const msg = document.getElementById('entitlement-msg');
  gate.hidden = false;

  if(me.subscription?.status === 'active'){
    msg.textContent = 'Subscription active — enjoy premium access!';
    document.getElementById('go-dashboard').onclick = ()=> window.location.href='/dashboard';
    document.getElementById('start-trial').style.display='none';
    document.getElementById('upgrade-plan').style.display='none';
  } else if(me.subscription?.status === 'trial'){
    msg.textContent = 'On trial — explore premium features.';
    document.getElementById('go-dashboard').onclick = ()=> window.location.href='/dashboard';
    document.getElementById('start-trial').style.display='none';
    document.getElementById('upgrade-plan').onclick = ()=> window.location.href='/pricing';
  } else {
    msg.textContent = 'No active plan — start a free trial or upgrade to continue.';
    document.getElementById('start-trial').onclick = ()=> window.location.href='/api/subscription/start-trial';
    document.getElementById('upgrade-plan').onclick = ()=> window.location.href='/pricing';
    document.getElementById('go-dashboard').style.display='none';
  }
}


  // Append-only: opens existing auth modal if present
  document.addEventListener('click', (e)=>{
    const opener = e.target.closest('[data-auth-open]');
    if(!opener) return;
    const overlay = document.getElementById('auth-modal');
    if(!overlay){
      console.warn('Auth modal not found on this page.');
      return;
    }
    overlay.setAttribute('aria-hidden','false');
    const signinPanel = document.getElementById('panel-signin');
    if (signinPanel) signinPanel.focus();
  });

/* Append-only: Open modal and select tab */
document.addEventListener('click', (e)=>{
  const opener = e.target.closest('[data-auth-open]');
  if(!opener) return;

  const overlay = document.getElementById('auth-modal');
  if(!overlay){ console.warn('Auth modal not found'); return; }

  overlay.setAttribute('aria-hidden','false');

  const wantSignup = opener.getAttribute('data-auth-tab') === 'signup';
  const tabSignin = document.getElementById('tab-signin');
  const tabSignup = document.getElementById('tab-signup');
  const panelSignin = document.getElementById('panel-signin');
  const panelSignup = document.getElementById('panel-signup');
  const panelForgot = document.getElementById('panel-forgot');

  if (wantSignup && tabSignup && panelSignup) {
    tabSignin?.classList.remove('active');
    tabSignup?.classList.add('active');
    panelSignin?.classList.remove('active');
    panelSignup?.classList.add('active');
    panelForgot?.classList.remove('active');
    panelSignup.focus();
  } else {
    tabSignup?.classList.remove('active');
    tabSignin?.classList.add('active');
    panelSignup?.classList.remove('active');
    panelSignin?.classList.add('active');
    panelForgot?.classList.remove('active');
    panelSignin.focus();
  }
});

/* Append-only: Toast helpers */
function showToast(kind, title, desc){
  const stack = document.getElementById('app-toasts');
  if(!stack) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<div class="title">${title}</div>${desc ? `<div class="desc">${desc}</div>` : ''}`;
  stack.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('show'));
  setTimeout(()=>{
    el.classList.remove('show');
    el.addEventListener('transitionend', ()=> el.remove(), { once:true });
  }, 3500);
}

/* Append-only: lightweight heartbeat to decide offline vs success */
async function isOnline(){
  try{
    // Hit a lightweight endpoint in your app; fallback to navigator.onLine
    const res = await fetch('/api/health', { method:'GET', cache:'no-store' });
    return res.ok;
  }catch(e){
    return navigator.onLine; // approximate
  }
}

/* Append-only: intercept Sign In submit to show response */
(function wireSignIn(){
  const form = document.getElementById('form-signin');
  if(!form) return;
  form.addEventListener('submit', async (e)=>{
    // Let existing handler run if present; we only attach after it.
    // We preventDefault only if no other handler called it.
    // To be safe, we always prevent and simulate success/offline for now.
    e.preventDefault();

    const ok = await isOnline();
    if(ok){
      showToast('success', 'Signed in', 'Welcome back — redirecting to your dashboard.');
      // Optional: close modal after a short delay
      setTimeout(()=>{
        document.getElementById('auth-modal')?.setAttribute('aria-hidden','true');
      }, 600);
    }else{
      showToast('error', 'We’re offline now', 'Please try again in a moment.');
    }
  }, { capture:false });
})();

/* Append-only: intercept Sign Up submit to show response */
(function wireSignUp(){
  const form = document.getElementById('form-signup');
  if(!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();

    const ok = await isOnline();
    if(ok){
      showToast('success', 'Account created', 'Your free trial is ready — let’s get started.');
      setTimeout(()=>{
        document.getElementById('auth-modal')?.setAttribute('aria-hidden','true');
      }, 600);
    }else{
      showToast('error', 'We’re offline now', 'Please try again in a moment.');
    }
  });
})();


document.addEventListener("DOMContentLoaded", function() {
  const sections = document.querySelectorAll('#our-story-alt .story-section');
  const observerOptions = {
    threshold: 0.15
  };
  
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if(entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));
});

document.getElementById("contactForm").addEventListener("submit", function(e){
    e.preventDefault();
    const response = document.getElementById("formResponse");
    response.style.display = "block";
    response.style.color = "green";
    response.textContent = "✅ Thank you! Your message has been sent.";
    this.reset();
  });

  
  // Get all select buttons
  const buttons = document.querySelectorAll(".select-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", function () {
      // Remove highlight + message from all cards first
      document.querySelectorAll(".sub-card").forEach(card => {
        card.classList.remove("active");
        card.querySelector(".msg").textContent = "";
      });

      // Highlight selected card
      const card = this.closest(".sub-card");
      card.classList.add("active");

      // Show message
      card.querySelector(".msg").textContent = "🚀 Coming Soon!";
    });
  });


 document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".menu-item").forEach(item => {
    item.style.cursor = "pointer"; // make it look clickable
    item.addEventListener("click", () => {
      // Smooth scroll to subscription section
      const subSection = document.querySelector("#subscription");
      if (!subSection) return;

      subSection.scrollIntoView({ behavior: "smooth" });

      // Highlight subscription section briefly
      subSection.classList.add("highlight-sub");
      setTimeout(() => subSection.classList.remove("highlight-sub"), 2000);
    });
  });
});


// Reveal animation on scroll (renamed to card1)
const card1s = document.querySelectorAll(".feature-card1");

function revealCard1s() {
  const triggerBottom = window.innerHeight * 0.85;
  card1s.forEach(card1 => {
    const cardTop = card1.getBoundingClientRect().top;
    if (cardTop < triggerBottom) {
      card1.classList.add("show1");
    }
  });
}

window.addEventListener("scroll", revealCard1s);
window.addEventListener("load", revealCard1s);



