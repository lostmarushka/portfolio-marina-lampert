const desk = document.getElementById("desktop");
let z = 10, openCount = 0;
const wins = {};

// 1. All markup lives in index.html (the project articles and the <template> blocks at the bottom).
//    This file only copies, fills and wires them up.
const clone = id => document.importNode(document.getElementById(id).content, true).firstElementChild;
const read = el => ({
  el,                                                                  // the project article itself
  title: el.querySelector("h2").textContent.trim(),
  tint: el.style.getPropertyValue("--tint").trim(),
  img: el.querySelector(".thumb img")?.getAttribute("src") || "",     // cover image
  video: el.dataset.video || "",                                       // YouTube video ID, optional
   small: el.dataset.cover === "small",                                // small cover image, top left
});

// 2. Clock in the menu bar
const clock = document.getElementById("clock");
const tick = () => clock.textContent = new Date().toLocaleString("en-GB",
  { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
tick(); setInterval(tick, 30000);

const compact = matchMedia("(max-width: 1100px)");
// 3. Generic drag helper (works for mouse and touch). Calls onTap if it barely moved.
function makeDraggable(el, handle, { onTap, onStart } = {}) {
  handle.addEventListener("pointerdown", e => {
    if (el.classList.contains("icon") && compact.matches) return; // grid mode: no dragging
    if (e.target.closest("button")) return;
    if (el.classList.contains("max")) return;
    onStart && onStart();
    const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
    let moved = false;
    handle.setPointerCapture(e.pointerId);
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      el.style.left = Math.min(Math.max(ox + dx, -el.offsetWidth + 60), innerWidth - 60) + "px";
      el.style.top  = Math.min(Math.max(oy + dy, 0), innerHeight - 140) + "px";
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      if (!moved && onTap) onTap();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  });
}

// 4. Windows
function focusWin(w) { w.style.zIndex = ++z; }
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Windows grow out of (and shrink back into) whatever opened them: an icon or the dock button
function setOrigin(w, from) {
  if (!from) return;
  const r = from.getBoundingClientRect(), d = desk.getBoundingClientRect();
  w.style.setProperty("--ox", (r.left + r.width / 2 - w.offsetLeft) + "px");
  w.style.setProperty("--oy", (r.top + r.height / 2 - d.top - w.offsetTop) + "px");
}
function replay(w) { w.style.animation = "none"; void w.offsetWidth; w.style.animation = ""; }
function leave(w, done) {
  if (reduce) return done();
  w.classList.add("closing");
  w.addEventListener("animationend", () => { w.classList.remove("closing"); done(); }, { once: true });
}

function openWin(p, from) {
  if (wins[p.title]) { const e = wins[p.title]; e.classList.remove("hidden"); setOrigin(e, from); replay(e); focusWin(e); return; }
  const w = clone("tpl-window");
  w.style.setProperty("--tint", p.tint);
  const off = (openCount++ % 6) * 28;
  w.style.left = Math.max(8, Math.min(innerWidth / 2 - 280, innerWidth - 580) + off) + "px";
  w.style.top = 60 + off + "px";
  w.querySelector(".t").textContent = p.title;

  // Media: keep exactly one of video / cover image / colour block
  if (p.small) w.classList.add("cover-small");
  const video = w.querySelector("iframe.media"), cover = w.querySelector("img.media"), block = w.querySelector("div.media");
  if (p.video) {
    video.src = video.dataset.embed.replace("{id}", encodeURIComponent(p.video));
    video.title = p.title; cover.remove(); block.remove();
  } else if (p.img) {
    cover.src = p.img; cover.alt = p.title; video.remove(); block.remove();
  } else { video.remove(); cover.remove(); block.remove(); }

  // Text and facts go into the info area; details and gallery follow in the order they appear in the article
  const info = w.querySelector(".info"), body = w.querySelector(".body");
  p.el.querySelectorAll(".text").forEach(n => info.append(n.cloneNode(true)));
  p.el.querySelectorAll(".details, .meta, .gallery").forEach(n => body.append(n.cloneNode(true)));
  w.querySelectorAll(".gallery img").forEach(i => i.loading = "lazy");

  w.querySelector(".r").onclick = () => leave(w, () => { w.remove(); delete wins[p.title]; });
  w.querySelector(".y").onclick = () => leave(w, () => {
    w.classList.add("hidden");
    const f = w.querySelector("iframe");
    if (f) f.contentWindow.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
  });
  w.querySelector(".g").onclick = () => w.classList.toggle("max");
  w.addEventListener("pointerdown", () => focusWin(w));
  makeDraggable(w, w.querySelector(".bar"));
  desk.appendChild(w); setOrigin(w, from); wins[p.title] = w; focusWin(w);
}

// 5. Icons: single tap opens on touch screens, double-click opens with a mouse
const coarse = matchMedia("(pointer: coarse)").matches;
document.querySelectorAll(".icon").forEach(el => {
  // Video project without its own cover image: use the YouTube preview picture as the icon
  const thumb = el.querySelector(".thumb");
  if (el.dataset.video && !thumb.querySelector("img")) {
    const img = clone("tpl-yt-thumb");
    img.src = img.dataset.src.replace("{id}", encodeURIComponent(el.dataset.video));
    thumb.append(img);
  }
  const p = read(el);
  const select = () => { document.querySelectorAll(".icon.sel").forEach(i => i.classList.remove("sel")); el.classList.add("sel"); el.style.zIndex = ++z; };
  makeDraggable(el, el, { onStart: select, onTap: () => coarse && openWin(p, el) });
  el.addEventListener("dblclick", () => openWin(p, el));
  el.addEventListener("click", () => { if (compact.matches) { select(); openWin(p, el); } });
  el.addEventListener("keydown", e => { if (e.key === "Enter") openWin(p, el); });
});
desk.addEventListener("pointerdown", e => {
  if (e.target === desk) document.querySelectorAll(".icon.sel").forEach(i => i.classList.remove("sel"));
});

const aboutBtn = document.getElementById("open-about");
const about = read(document.getElementById("about"));
aboutBtn.onclick = () => openWin(about, aboutBtn);

const copyrightBtn = document.getElementById("open-copyright");
const copyright = read(document.getElementById("copyright"));
copyrightBtn.onclick = () => openWin(copyright, copyrightBtn);

const notesBtn = document.getElementById("open-notes");
const notes = read(document.getElementById("notes"));
notesBtn.onclick = () => openWin(notes, notesBtn);

const ideasBtn = document.getElementById("open-ideas");
const ideas = read(document.getElementById("ideas"));
ideasBtn.onclick = () => openWin(ideas, ideasBtn);

// copyright stizzle
document.addEventListener("contextmenu", function(e) {
    if (e.target.tagName === "IMG") {
        e.preventDefault();
    }
});

// Lavalampe: Metaballs auf einem kleinen Canvas
(() => {
  const cv = document.getElementById("lava");
  const ctx = cv.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PX = 8;                                   // je grösser, desto gröber und schneller

 const palette = [
  [255, 210, 20],   // kräftiges Gelb
  [139, 52, 255],   // leuchtendes Violett
  [255, 190, 30],   // goldgelb
  [106, 30, 214],   // tiefes Violett
  [255, 225, 60],   // helles Gelb
  [170, 80, 255],   // helles Violett
  [250, 200, 40],   // Gelb
  [120, 40, 230]    // Violett
];
  const balls = palette.map((c, i) => ({
    c,
    bx: 0.12 + (i / (palette.length - 1)) * 0.76, // Grundposition links-rechts
    ph: Math.random() * 6.28,
    sp: 0.035 + Math.random() * 0.04,             // Tempo (kleiner = langsamer)
    sw: 0.05 + Math.random() * 0.06,              // seitliches Schwanken
    r: 0.11 + Math.random() * 0.08                // Grösse
  }));

  let w, h, img, k;
  function resize() {
    w = Math.max(40, Math.ceil(innerWidth / PX));
    h = Math.max(40, Math.ceil(innerHeight / PX));
    cv.width = w; cv.height = h;
    img = ctx.createImageData(w, h);
    k = Math.sqrt(w * h);
  }

  function draw(t) {
    const pos = balls.map(b => ({
      x: (b.bx + b.sw * Math.sin(t * b.sp * 1.7 + b.ph)) * w,
      y: (0.5 + 0.46 * Math.sin(t * b.sp + b.ph)) * h,
      r2: Math.pow(k * b.r * (1 + 0.12 * Math.sin(t * b.sp * 2.3 + b.ph)), 2),
      c: b.c
    }));
    const d = img.data;
    let i = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i += 4) {
        let f = 0, r = 0, g = 0, b = 0;
        for (const p of pos) {
          const dx = x - p.x, dy = y - p.y;
          const v = p.r2 / (dx * dx + dy * dy + 1);
          f += v; r += p.c[0] * v; g += p.c[1] * v; b += p.c[2] * v;
        }
        const edge = Math.min(1, Math.max(0, (f - 0.85) / 0.3));  // harte Blasenkante, weich geglättet
        const glow = Math.min(f, 0.85) * 0.22;                    // leichter Schein um die Blasen
        d[i] = r / f; d[i + 1] = g / f; d[i + 2] = b / f;
        d[i + 3] = 255 * Math.max(edge, glow);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  resize();
  addEventListener("resize", resize);
  if (still) { draw(0); return; }

  let last = 0;
  const loop = ms => {
    if (ms - last > 33) { draw(ms / 1000); last = ms; }  // ca. 30 Bilder pro Sekunde
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();

