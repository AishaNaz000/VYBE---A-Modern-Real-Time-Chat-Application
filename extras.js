import { getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, updateDoc, onSnapshot, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const auth = getAuth(getApp()), db = getFirestore(getApp());
const $ = (s) => document.querySelector(s);
const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => k === "class" ? (el.className = v) : k.startsWith("on") ? el.addEventListener(k.slice(2), v) : el.setAttribute(k, v));
  el.append(...kids.filter((k) => k != null));
  return el;
};
const uid = () => auth.currentUser?.uid;
const chat = () => window.fxChatId;
const tsOf = (m) => m.createdAt?.toMillis?.() ?? Date.now();
const preview = (m) => m.deleted ? "Deleted message" : m.type === "image" ? "📷 Photo" : m.type === "audio" ? "🎤 Voice message" : m.type === "location" ? "📍 Location" : m.type === "poll" ? m.text : m.capsule ? "⏳ Time capsule" : (m.text || "").slice(0, 90);

let replyTo = null, edit = null, seen = {}, parts = [], seenChat = null, stopSeen = null, lastMark = 0, unread = 0;
const played = new Set();

/* ---------- reply / edit bar ---------- */
const bar = h("div", { class: "vx-bar", hidden: "" });
function showBar(kind, who, text) {
  bar.replaceChildren(h("div", { class: "vx-bar-t" }, h("b", {}, kind === "edit" ? "✏️ Editing message" : "↩ Replying to " + who), h("span", {}, text)),
    h("button", { type: "button", onclick: clearBar, title: "Cancel" }, "✕"));
  bar.hidden = false;
}
function clearBar() {
  if (edit && $("#messageInput")) $("#messageInput").value = "";
  replyTo = edit = null; bar.hidden = true;
}

/* ---------- public hooks used by app.js ---------- */
window.vx = {
  get editing() { return !!edit; },
  takeReply() { const r = replyTo; if (!r) return null; replyTo = null; bar.hidden = true; return { reply: r }; },
  async submitEdit(text) {
    const e = edit; if (!e) return false;
    try { await updateDoc(doc(db, "chats", e.chatId, "messages", e.id), { text, edited: true }); } catch (err) { console.error(err); alert("Edit save nahi hua. Firestore Rules check karo."); return true; }
    edit = null; bar.hidden = true; $("#messageInput").value = ""; return true;
  },
  menu(m, add, close) {
    if (m.deleted) return;
    add("↩ Reply", () => { close(); edit = null; replyTo = { id: m.id, name: m.senderId === uid() ? "You" : window.fxName?.(m.senderId) || "User", text: preview(m) }; showBar("reply", replyTo.name, replyTo.text); $("#messageInput")?.focus(); });
    if (m.text && !m.capsule && m.type !== "poll") add("⧉ Copy", () => { close(); navigator.clipboard?.writeText(m.text).then(() => window.fxToast?.("Copied ✓")); });
    if (m.senderId === uid() && (m.type === "text" || !m.type) && !m.capsule) add("✏️ Edit", () => { close(); replyTo = null; edit = { id: m.id, chatId: m.chatId }; showBar("edit", "", m.text); const i = $("#messageInput"); i.value = m.text; i.focus(); });
  },
  text(bubble, m) {
    const t = m.text || "";
    if (/^(?:\p{Extended_Pictographic}|\s|\u200d|\ufe0f){1,6}$/u.test(t)) bubble.classList.add("vx-big");
    const parts = t.split(/(https?:\/\/[^\s<]+)/g);
    if (parts.length < 2) return;
    bubble.replaceChildren(...parts.map((p, i) => i % 2 ? h("a", { href: p, target: "_blank", rel: "noopener noreferrer", class: "vx-link" }, p) : document.createTextNode(p)));
  },
  lightbox(url) {
    const close = () => ov.remove();
    const ov = h("div", { class: "vx-lb", onclick: close }, h("img", { src: url, onclick: (e) => e.stopPropagation() }),
      h("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "vx-lb-dl", onclick: (e) => e.stopPropagation() }, "⬇ Open / Download"),
      h("button", { type: "button", class: "vx-lb-x", onclick: close }, "✕"));
    document.body.append(ov);
  },
  loc(bubble, m) {
    const lat = Number(m.lat), lng = Number(m.lng);
    if (!isFinite(lat) || !isFinite(lng)) { bubble.textContent = "📍 Location"; return; }
    bubble.classList.add("media-bubble");
    bubble.append(h("div", { class: "vx-loc" },
      h("iframe", { src: `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`, loading: "lazy", title: "Map" }),
      h("a", { href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`, target: "_blank", rel: "noopener noreferrer" }, "📍 Open in Maps")));
  },
  decorate(bubble, m, row) {
    const ml = $("#messagesList"), ts = tsOf(m), day = new Date(ts).toDateString();
    const prev = ml.lastElementChild;
    if (!prev || prev.dataset.day !== day) {
      const d = new Date(ts), now = new Date(), y = new Date(Date.now() - 864e5);
      const label = day === now.toDateString() ? "Today" : day === y.toDateString() ? "Yesterday" : d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
      ml.append(h("div", { class: "vx-sep", "data-day": day }, h("span", {}, label)));
    }
    row.dataset.day = day; row.dataset.mid = m.id; row.dataset.ts = ts; row.dataset.text = (m.text || "").toLowerCase();
    if (m.deleted) return;
    const mine = m.senderId === uid();
    if (m.reply) {
      bubble.prepend(h("div", { class: "vx-quote", onclick: () => { const t = ml.querySelector(`[data-mid="${m.reply.id}"]`); if (t) { t.scrollIntoView({ behavior: "smooth", block: "center" }); t.classList.add("vx-flash"); setTimeout(() => t.classList.remove("vx-flash"), 1400); } } },
        h("b", {}, m.reply.name || "User"), h("span", {}, m.reply.text || "")));
    }
    const time = new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    bubble.append(h("div", { class: "vx-meta" }, ...(m.edited ? [h("i", {}, "edited")] : []), h("span", {}, time), ...(mine ? [h("span", { class: "vx-tick", "data-ts": ts }, "✓✓")] : [])));
    paintTicks();
    if (!mine && Date.now() - ts < 4000 && !played.has(m.id)) {
      played.add(m.id);
      if (/🎉|🥳|congrat|happy birthday|mubarak/i.test(m.text || "")) confetti();
      if (document.hidden) { unread++; document.title = `(${unread}) VYBE`; beep(); }
    }
    if (mine && Date.now() - ts < 4000 && !played.has(m.id) && /🎉|🥳/.test(m.text || "")) { played.add(m.id); confetti(); }
  }
};

/* ---------- read receipts (ticks) ---------- */
function paintTicks() {
  const others = parts.filter((p) => p !== uid());
  document.querySelectorAll(".vx-tick").forEach((t) => {
    const ts = Number(t.dataset.ts);
    t.classList.toggle("seen", others.length > 0 && others.every((p) => (seen[p] || 0) >= ts));
  });
}
function watchChat() {
  const id = chat();
  if (id === seenChat) return;
  seenChat = id; stopSeen?.(); seen = {}; parts = []; stopSeen = null; clearBar();
  $("#vxSearchBar")?.classList.remove("on");
  if (id && uid()) stopSeen = onSnapshot(doc(db, "chats", id), (s) => { const d = s.data() || {}; seen = d.seen || {}; parts = d.participants || []; paintTicks(); }, () => {});
}
function markSeen() {
  const id = chat();
  if (!id || !uid() || document.hidden || Date.now() - lastMark < 2500) return;
  lastMark = Date.now();
  updateDoc(doc(db, "chats", id), { ["seen." + uid()]: Date.now(), ["unread." + uid()]: 0 }).catch(() => {});
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) { unread = 0; document.title = "VYBE — Conversations, Reimagined"; markSeen(); } });

/* ---------- confetti + beep ---------- */
function confetti() {
  const c = h("canvas", { class: "vx-confetti" }); c.width = innerWidth; c.height = innerHeight; document.body.append(c);
  const g = c.getContext("2d"), cols = ["#9b6bff", "#ff6bb5", "#25d366", "#ffd166", "#4da3ff"];
  const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.5, r: 4 + Math.random() * 5, vy: 2 + Math.random() * 4, vx: -1.5 + Math.random() * 3, col: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6 }));
  let f = 0;
  (function tick() {
    g.clearRect(0, 0, c.width, c.height);
    ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.a += 0.15; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.col; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); });
    if (++f < 190) requestAnimationFrame(tick); else c.remove();
  })();
}
function beep() {
  try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.08, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.25); o.start(); o.stop(a.currentTime + 0.25); } catch {}
}

/* ---------- in-chat search ---------- */
const sBar = h("div", { id: "vxSearchBar", class: "vx-search" }, h("input", { type: "search", placeholder: "Search in this chat…", oninput: (e) => doSearch(e.target.value) }), h("small", { id: "vxCount" }), h("button", { type: "button", onclick: () => { sBar.classList.remove("on"); doSearch(""); } }, "✕"));
function doSearch(q) {
  q = q.trim().toLowerCase(); let n = 0;
  document.querySelectorAll("#messagesList .vybe-message-row").forEach((r) => { const hit = !q || (r.dataset.text || "").includes(q); r.style.display = hit ? "" : "none"; if (q && hit) n++; });
  document.querySelectorAll("#messagesList .vx-sep").forEach((s) => (s.style.display = q ? "none" : ""));
  $("#vxCount").textContent = q ? `${n} found` : "";
}

/* ---------- command palette (Ctrl/Cmd + K) ---------- */
function palette() {
  if ($("#chatDashboard")?.hidden) return;
  if ($(".vx-pal")) return;
  const items = [...document.querySelectorAll("#usersList .vybe-person, #fxGroups .fx-row")].map((el) => ({ label: (el.querySelector("strong")?.textContent || el.textContent).trim(), icon: el.matches(".fx-row") ? "👥" : "👤", run: () => el.click() }));
  items.push({ label: "Settings", icon: "⚙️", run: () => $('#fxRail [data-t="settings"]')?.click() }, { label: "Status", icon: "◌", run: () => $('#fxRail [data-t="status"]')?.click() }, { label: "Toggle light / dark", icon: "🌗", run: () => $("#fxTheme")?.click() }, { label: "Log out", icon: "⎋", run: () => $("#logoutBtn")?.click() });
  const list = h("div", { class: "vx-pal-l" }), inp = h("input", { placeholder: "Jump to a person, group or action…" });
  const close = () => ov.remove();
  const draw = () => {
    const q = inp.value.trim().toLowerCase(), hits = items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 8);
    list.replaceChildren(...hits.map((i) => h("button", { type: "button", onclick: () => { close(); i.run(); } }, h("span", {}, i.icon), i.label)));
    list.firstElementChild?.classList.add("on");
  };
  inp.oninput = draw;
  inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); list.firstElementChild?.click(); } if (e.key === "Escape") close(); };
  const ov = h("div", { class: "vx-pal", onclick: (e) => e.target === ov && close() }, h("div", { class: "vx-pal-b" }, inp, list));
  document.body.append(ov); draw(); inp.focus();
}
document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && auth.currentUser) { e.preventDefault(); palette(); } if (e.key === "Escape") { $(".vx-lb")?.remove(); $(".vx-pal")?.remove(); } });

/* ---------- mount ---------- */
function sendLocation() {
  const id = chat(); if (!id) return alert("Pehle kisi ki chat open karo.");
  if (!navigator.geolocation) return alert("Is browser me location support nahi.");
  window.fxToast?.("📍 Location le raha hoon…");
  navigator.geolocation.getCurrentPosition(async (p) => {
    try { await addDoc(collection(db, "chats", id, "messages"), { senderId: uid(), type: "location", text: "📍 Location", lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), createdAt: serverTimestamp() }); window.vx.touch?.(id, "📍 Location"); }
    catch (e) { console.error(e); alert("Location send nahi hui: " + e.message); }
  }, () => alert("Location permission allow karo (https ya localhost par chalta hai)."), { enableHighAccuracy: true, timeout: 10000 });
}
let jump = null, observed = false;
function mount() {
  const hd = $("#activeChat .active-chat-header"), form = $("#messageForm"), ml = $("#messagesList"), ac = $("#activeChat");
  if (!hd || !form || !ml || !ac) return;
  if (!$("#vxSearchBtn")) hd.append(h("button", { id: "vxSearchBtn", type: "button", class: "fx-info-btn", title: "Search in chat", style: "margin-left:0", onclick: () => { sBar.classList.toggle("on"); if (sBar.classList.contains("on")) sBar.firstElementChild.focus(); else doSearch(""); } }, "🔍"));
  if (!sBar.isConnected) { ml.before(sBar); form.before(bar); }
  if (!$("#vxLocBtn")) form.insertBefore(h("button", { id: "vxLocBtn", type: "button", class: "vybe-media-btn", title: "Share location", onclick: sendLocation }, "📍"), $("#messageInput"));
  if (!jump) {
    jump = h("button", { type: "button", class: "vx-jump", title: "Latest messages", onclick: () => ml.scrollTo({ top: ml.scrollHeight, behavior: "smooth" }) }, "⌄");
    if (getComputedStyle(ac).position === "static") ac.style.position = "relative";
    ac.append(jump);
    ml.addEventListener("scroll", () => jump.classList.toggle("on", ml.scrollHeight - ml.scrollTop - ml.clientHeight > 260), { passive: true });
  }
  if (!observed) { observed = true; new MutationObserver(markSeen).observe(ml, { childList: true }); }
}
setInterval(() => { if (!auth.currentUser) return; mount(); watchChat(); }, 600);

/* ---------- styles ---------- */
const css = `
.vx-bar{display:flex;align-items:center;gap:10px;padding:8px 14px;border-left:4px solid var(--purple);background:var(--fx-card,#1a1528);color:var(--fx-text,#fff);font-size:13px}.vx-bar[hidden]{display:none}
.vx-bar-t{flex:1;min-width:0;display:flex;flex-direction:column}.vx-bar-t span{opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vx-bar button{border:0;background:transparent;color:inherit;font-size:16px;cursor:pointer}
.vx-sep{align-self:center;text-align:center;margin:10px 0 4px;width:100%}.vx-sep span{display:inline-block;padding:4px 12px;border-radius:14px;background:#7a6aa033;color:var(--fx-muted,#9b94b3);font-size:11.5px;font-weight:600}
.vx-meta{display:flex;justify-content:flex-end;align-items:center;gap:6px;margin-top:3px;font-size:10.5px;opacity:.72}.vx-meta i{font-style:italic}
.vx-tick{letter-spacing:-3px;font-weight:700}.vx-tick.seen{color:#53bdeb;opacity:1}
.vx-quote{margin-bottom:6px;padding:6px 9px;border-left:3px solid var(--purple-light,#c4a6ff);border-radius:8px;background:#00000026;cursor:pointer;font-size:12.5px;display:flex;flex-direction:column}.vx-quote b{font-size:12px}.vx-quote span{opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}
.vx-flash .vybe-message-bubble{animation:vxflash 1.4s}@keyframes vxflash{0%,60%{box-shadow:0 0 0 3px var(--purple-light,#c4a6ff)}100%{box-shadow:none}}
.vx-link{color:inherit;text-decoration:underline;word-break:break-all}.vybe-message-bubble.vx-big{font-size:38px!important;background:transparent!important;border-color:transparent!important;box-shadow:none!important;line-height:1.2}
.vx-lb{position:fixed;inset:0;z-index:100003;background:#000d;display:grid;place-items:center;animation:fxpop .2s}.vx-lb img{max-width:92vw;max-height:84vh;border-radius:12px}
.vx-lb-dl{position:absolute;bottom:22px;padding:10px 18px;border-radius:20px;background:#fff2;color:#fff;text-decoration:none;font-size:14px}.vx-lb-x{position:absolute;top:16px;right:16px;width:38px;height:38px;border:0;border-radius:50%;background:#fff2;color:#fff;cursor:pointer}
.vx-loc{width:240px;display:flex;flex-direction:column;gap:6px}.vx-loc iframe{width:100%;height:150px;border:0;border-radius:12px}.vx-loc a{color:inherit;font-size:13px;text-align:center;padding:2px}
.vx-search{display:none;align-items:center;gap:8px;padding:8px 14px;background:var(--fx-card,#1a1528)}.vx-search.on{display:flex}.vx-search input{flex:1;padding:9px 12px;border-radius:10px;border:1px solid var(--fx-line,#3a3150);background:transparent;color:var(--fx-text,#fff);font:inherit}.vx-search small{color:var(--fx-muted,#9b94b3)}.vx-search button{border:0;background:transparent;color:var(--fx-text,#fff);cursor:pointer}
.vx-jump{display:none;position:absolute;right:22px;bottom:84px;width:42px;height:42px;border:0;border-radius:50%;background:var(--purple);color:#fff;font-size:22px;cursor:pointer;box-shadow:0 6px 20px #0006;z-index:20}.vx-jump.on{display:block}
.vx-confetti{position:fixed;inset:0;z-index:100004;pointer-events:none}
.vx-pal{position:fixed;inset:0;z-index:100005;background:#0009;display:flex;justify-content:center;padding-top:14vh}.vx-pal-b{width:min(480px,92vw);height:fit-content;background:var(--fx-card,#1a1528);border:1px solid var(--fx-line,#3a3150);border-radius:16px;padding:10px;box-shadow:0 20px 60px #000a}
.vx-pal-b input{width:100%;box-sizing:border-box;padding:13px;border-radius:12px;border:0;background:var(--fx-card2,#2a2240);color:var(--fx-text,#fff);font:16px inherit;outline:0}.vx-pal-l{display:flex;flex-direction:column;margin-top:8px;max-height:320px;overflow:auto}
.vx-pal-l button{display:flex;gap:12px;padding:11px;border:0;border-radius:10px;background:transparent;color:var(--fx-text,#fff);font:15px inherit;text-align:left;cursor:pointer}.vx-pal-l button:hover,.vx-pal-l button.on{background:var(--fx-card2,#2a2240)}
`;
document.head.append(h("style", {}, css));
