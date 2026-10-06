<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=1080, height=1920" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&family=Fraunces:ital,opsz,wght@1,9..144,600&display=block" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; overflow: hidden; background: #0A0A0A; }
#root { position: relative; width: 1080px; height: 1920px; overflow: hidden; font-family: Inter, sans-serif; color: #fff; background: #0A0A0A; }
.bg { position: absolute; inset: 0; background: #0A0A0A; }
#glow { position: absolute; left: 90px; top: 520px; width: 900px; height: 900px; border-radius: 50%; background: radial-gradient(circle, rgba(107, 47, 232, 0.45), rgba(107, 47, 232, 0) 65%); }
/* BCON end card standard: logo 460 wide at y 640, one line, lime outline CTA pill */
#logo { position: absolute; left: 310px; top: 640px; width: 460px; height: 156px; }
#line { position: absolute; left: 40px; top: 870px; width: 1000px; text-align: center; font-weight: 800; font-size: 122px; line-height: 1.04; letter-spacing: -0.02em; }
#line em { font-family: Fraunces, serif; font-style: italic; font-weight: 600; letter-spacing: 0; }
#cta { position: absolute; left: 540px; top: 1250px; padding: 36px 80px; border-radius: 999px; border: 5px solid #CCFF00; color: #fff; font-weight: 700; font-size: 64px; white-space: nowrap; }
#hx { position: absolute; left: 0; top: 1700px; width: 1080px; text-align: center; font-weight: 500; font-size: 26px; letter-spacing: 0.4em; color: rgba(255, 255, 255, 0.45); }
</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="__DUR__" data-width="1080" data-height="1920">
  <div class="bg"></div><div id="glow"></div>
  <img id="logo" src="assets/BCON_logo-white.png" alt="" />
  <div id="line">__LINE__</div>
  <div id="cta">__CTA__</div>
  <div id="hx">HUMAN X AI</div>
</div>
<script>
const tl = gsap.timeline({ paused: true });
tl.fromTo("#logo", { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(1.8)" }, 0.0);
tl.fromTo("#line", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: "power3.out" }, 0.18);
tl.fromTo("#cta", { opacity: 0, scale: 0.8, xPercent: -50 }, { opacity: 1, scale: 1, xPercent: -50, duration: 0.3, ease: "back.out(2)" }, 0.4);
tl.fromTo("#hx", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.6);
tl.fromTo("#glow", { scale: 0.9 }, { scale: 1.05, duration: __DUR__, ease: "sine.inOut" }, 0);
window.__timelines = window.__timelines || {}; window.__timelines["main"] = tl;
</script></body></html>
