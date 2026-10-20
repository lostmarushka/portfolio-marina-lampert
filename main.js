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
});

// 2. Clock in the menu bar
const clock = document.getElementById("clock");
const tick = () => clock.textContent = new Date().toLocaleString("en-GB",
  { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
tick(); setInterval(tick, 30000);

// 3. Generic drag helper (works for mouse and touch). Calls onTap if it barely moved.
function makeDraggable(el, handle, { onTap, onStart } = {}) {
  handle.addEventListener("pointerdown", e => {
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
  w.querySelector(".info h2").textContent = p.title;

  // Media: keep exactly one of video / cover image / colour block
  const video = w.querySelector("iframe.media"), cover = w.querySelector("img.media"), block = w.querySelector("div.media");
  if (p.video) {
    video.src = video.dataset.embed.replace("{id}", encodeURIComponent(p.video));
    video.title = p.title; cover.remove(); block.remove();
  } else if (p.img) {
    cover.src = p.img; cover.alt = p.title; video.remove(); block.remove();
  } else { video.remove(); cover.remove(); }

  // Text and facts go into the info area; details and gallery follow in the order they appear in the article
  const info = w.querySelector(".info"), body = w.querySelector(".body");
  p.el.querySelectorAll(".text, .meta").forEach(n => info.append(n.cloneNode(true)));
  p.el.querySelectorAll(".details, .gallery").forEach(n => body.append(n.cloneNode(true)));
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
  el.addEventListener("keydown", e => { if (e.key === "Enter") openWin(p, el); });
});
desk.addEventListener("pointerdown", e => {
  if (e.target === desk) document.querySelectorAll(".icon.sel").forEach(i => i.classList.remove("sel"));
});

const aboutBtn = document.getElementById("open-about");
const about = read(document.getElementById("about"));
aboutBtn.onclick = () => openWin(about, aboutBtn);
// // Let the desktop settle for a moment, then About grows out of the dock
// setTimeout(() => openWin(about, aboutBtn), reduce ? 0 : 900);