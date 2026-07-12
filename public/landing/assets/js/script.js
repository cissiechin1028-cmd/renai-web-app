// ===========================
// ReplyAI V3
// ===========================

// Reveal Animation
const reveals = document.querySelectorAll(".reveal");

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
      }
    });
  },
  {
    threshold: 0.15,
  }
);

reveals.forEach((item) => {
  revealObserver.observe(item);
});

// ===========================
// Header Blur
// ===========================

const header = document.querySelector(".site-header");

let headerActive=false;
window.addEventListener('scroll',()=>{
 const active=window.scrollY>30;
 if(active===headerActive) return;
 headerActive=active;
 if(active){header.style.background='rgba(255,255,255,.92)';header.style.boxShadow='0 20px 60px rgba(48,30,96,.12)';}
 else{header.style.background='rgba(255,255,255,.74)';header.style.boxShadow='0 18px 60px rgba(48,30,96,.08)';}
},{passive:true});

// ===========================
// Smooth Scroll
// ===========================

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", function (e) {
    const id = this.getAttribute("href");

    if (id === "#") return;

    const target = document.querySelector(id);

    if (!target) return;

    e.preventDefault();

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
});

// ===========================
// Floating Phone
// ===========================

const phone = document.querySelector(".phone");

if (phone) {
  let angle = 0;

  function floatPhone() {
    angle += 0.008;

    const y = Math.sin(angle) * 3.5;
    const r = 0;

    phone.style.transform = `translateY(${y}px)`;

    requestAnimationFrame(floatPhone);
  }

  floatPhone();
}

// ===========================
// Mouse Glow
// ===========================

const glow = document.querySelector(".glow-2");

window.addEventListener("mousemove", (e) => {
  if (!glow) return;

  const x = e.clientX / window.innerWidth;
  const y = e.clientY / window.innerHeight;

  glow.style.transform =
    `translate(${x * 40}px, ${y * 40}px)`;
});

// ===========================
// Button Hover Ripple
// ===========================

document.querySelectorAll(".primary-btn").forEach((button) => {
  button.addEventListener("mouseenter", () => {
    button.style.transform = "translateY(-3px) scale(1.02)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "";
  });
});

// ===========================
// Hero Tags Animation
// ===========================

const tags = document.querySelectorAll(".hero-tags span");

tags.forEach((tag, index) => {
  tag.style.animationDelay = `${index * 0.15}s`;
});

// ===========================
// Chat Bubble Animation
// ===========================

const bubbles = document.querySelectorAll(".chat-bubble");

bubbles.forEach((bubble, index) => {
  bubble.animate(
    [
      {
        opacity: 0,
        transform: "translateY(15px)",
      },
      {
        opacity: 1,
        transform: "translateY(0)",
      },
    ],
    {
      duration: 500,
      delay: 500 + index * 250,
      fill: "forwards",
      easing: "ease",
    }
  );
});

// ===========================
// Parallax Background
// ===========================

let glowTick=false;
window.addEventListener('scroll',()=>{
 if(glowTick) return;
 glowTick=true;
 requestAnimationFrame(()=>{
 const scroll=window.scrollY;
 document.querySelectorAll('.glow').forEach((item,index)=>{const speed=(index+1)*0.12;item.style.transform=`translateY(${scroll*speed}px)`;});
 glowTick=false;
 });
},{passive:true});

// ===========================
// Footer Fade
// ===========================

const footer = document.querySelector(".footer");

const footerObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        footer.animate(
          [
            {
              opacity: 0,
              transform: "translateY(30px)",
            },
            {
              opacity: 1,
              transform: "translateY(0)",
            },
          ],
          {
            duration: 700,
            fill: "forwards",
          }
        );
      }
    });
  },
  {
    threshold: 0.2,
  }
);

if (footer) {
  footerObserver.observe(footer);
}
