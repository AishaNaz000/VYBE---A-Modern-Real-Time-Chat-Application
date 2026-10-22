import { getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, arrayUnion, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const app = getApp(), auth = getAuth(app), db = getFirestore(app);
const CLOUD = "hw9jfqyk", PRESET = "vybe_upload", DAY = 864e5;
const $ = (s) => document.querySelector(s);
const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => k === "class" ? (el.className = v) : k.startsWith("on") ? el.addEventListener(k.slice(2), v) : el.setAttribute(k, v));
  el.append(...kids.filter((k) => k != null));
  return el;
};

/* ---------- settings (saved on this device) ---------- */
const cfg = { theme: "Dark", accent: "Purple", wall: "None", font: 14, receipts: true, presence: true, ...JSON.parse(localStorage.getItem("vybe_settings") || "{}") };
const THEMES = { Dark: 1, Light: 1, System: 1 };
const isDark = () => cfg.theme === "Dark" || (cfg.theme === "System" && matchMedia("(prefers-color-scheme: dark)").matches);
const ACCENTS = { Purple: ["#9b6bff", "#c4a6ff", "#7041d8"], Pink: ["#ff6bb5", "#ffa6d6", "#d8419a"], Green: ["#25d366", "#8ef0b4", "#128c4a"], Blue: ["#4da3ff", "#a6d1ff", "#2275d8"] };
const WALLS = { None: "", Night: "linear-gradient(160deg,#120d22,#1d1236)", Ocean: "linear-gradient(160deg,#08202e,#0b3a4a)", Sunset: "linear-gradient(160deg,#2a1020,#3b1d12)", Forest: "linear-gradient(160deg,#0b2016,#12402a)", Rose: "linear-gradient(160deg,#2a0f1c,#4a1830)", Sky: "linear-gradient(160deg,#cfe8ff,#eaf4ff)", Cream: "#f6efe2", Dots: "radial-gradient(#8b5cf655 1.5px,transparent 1.6px) 0 0/22px 22px,#14101f", Waves: "repeating-linear-gradient(135deg,#1a1430 0 14px,#221b3b 14px 28px)" };
const wallCss = (spec) => !spec ? "" : spec.startsWith("url:") ? `linear-gradient(rgba(0,0,0,.28),rgba(0,0,0,.28)),url("${spec.slice(4).replace(/"/g, "%22")}") center/cover no-repeat` : (WALLS[spec] || "");
const curWall = (id) => (id && cfg.chatWalls && cfg.chatWalls[id] !== undefined ? cfg.chatWalls[id] : cfg.wall);
const BGS = ["linear-gradient(135deg,#8b5cf6,#5835a6)", "linear-gradient(135deg,#ec4899,#be185d)", "linear-gradient(135deg,#10b981,#047857)", "linear-gradient(135deg,#f59e0b,#b45309)", "linear-gradient(135deg,#3b82f6,#1d4ed8)"];
const styleTag = h("style");
document.head.append(styleTag);
function applyCfg() {
  const [a, b, c] = ACCENTS[cfg.accent];
  const r = document.documentElement.style;
  r.setProperty("--purple", a); r.setProperty("--purple-light", b); r.setProperty("--purple-dark", c);
  const wc = wallCss(curWall(window.fxChatId));
  styleTag.textContent = FX_CSS + `${wc ? `#chatDashboard #messagesList{background:${wc}!important}` : ""}.vybe-message-bubble{font-size:${cfg.font}px!important}`;
  document.body.classList.toggle("fx-dark", isDark());
  document.body.classList.toggle("fx-light", !isDark());
  const tb = $("#fxTheme"); if (tb) tb.replaceChildren(ico(isDark() ? "sun" : "moon"));
  localStorage.setItem("vybe_settings", JSON.stringify(cfg));
}

/* ---------- helpers ---------- */
window.fxName = (uid) => usersMap[uid]?.name || "Someone";
window.fxToast = (text) => {
  const t = h("div", { class: "fx-toast" }, text);
  document.body.append(t);
  setTimeout(() => t.classList.add("out"), 3200);
  setTimeout(() => t.remove(), 3700);
};
async function upload(file) {
  const fd = new FormData(); fd.append("file", file); fd.append("upload_preset", PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok || !data.secure_url) throw new Error(data.error?.message || "Upload failed");
  return data.secure_url;
}
const pickImage = () => new Promise((ok) => {
  const i = h("input", { type: "file", accept: "image/*" });
  i.onchange = () => ok(i.files[0] || null); i.click();
});
const ago = (ms) => { const m = Math.floor((Date.now() - ms) / 6e4); return m < 1 ? "Just now" : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`; };
const avatar = (name, url, cls = "") => h("span", { class: "fx-av " + cls, style: url ? `background-image:url(${url})` : "" }, url ? "" : (name || "?")[0].toUpperCase());

let me = null, myDoc = {}, statuses = [], stopStatus = null, tab = "chats";
let panels = {};

/* ---------- rail + 3-dot menu ---------- */
const ICONS = {
  chats: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  status: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="3.2 2.6"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  dots: '<circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/>'
};
const ico = (k) => { const e = h("span", { class: "fx-ico" }); e.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`; return e; };
let menu = null;
const closeMenu = () => { menu?.remove(); menu = null; };
document.addEventListener("click", closeMenu);

function mountUI() {
  const side = $(".chat-sidebar"), dash = $("#chatDashboard");
  if (!side || $("#fxRail")) return;
  const rail = h("nav", { id: "fxRail", class: "fx-rail" },
    h("button", { type: "button", "data-t": "chats", title: "Chats", onclick: () => setTab("chats") }, ico("chats")),
    h("button", { type: "button", "data-t": "status", title: "Status", onclick: () => setTab("status") }, ico("status"), h("i", { class: "fx-badge", hidden: "" })),
    h("span", { class: "fx-sp" }),
    h("button", { id: "fxTheme", type: "button", title: "Light / Dark", onclick: () => { cfg.theme = isDark() ? "Light" : "Dark"; applyCfg(); if (tab === "settings") renderSettings(); } }, ico(isDark() ? "sun" : "moon")),
    h("button", { type: "button", "data-t": "settings", title: "Settings", class: "fx-me", onclick: () => setTab("settings") }, avatar(me.displayName, ""))
  );
  dash.prepend(rail);
  if (!$("#fxGroups")) $(".chat-search")?.after(h("div", { id: "fxGroups" }));
  $("#userSearch")?.addEventListener("input", renderGroups);
  const hd = $("#activeChat .active-chat-header");
  if (hd && !$("#fxInfoBtn")) hd.append(h("button", { id: "fxInfoBtn", type: "button", class: "fx-info-btn", title: "Group info", style: "display:none", onclick: groupInfo }, "ⓘ"));
  $("#messageInput")?.addEventListener("input", onType);
  $("#logoutBtn")?.addEventListener("click", () => setPresence(false), true);
  if (hd && !$("#fxWallBtn")) hd.insertBefore(h("button", { id: "fxWallBtn", type: "button", class: "fx-info-btn", title: "Chat wallpaper", onclick: wallpaperPicker }, "🎨"), $("#fxInfoBtn"));
  const form = $("#messageForm");
  if (form && !$("#fxCapBtn")) form.insertBefore(h("button", { id: "fxCapBtn", type: "button", class: "vybe-media-btn", title: "Time capsule", onclick: composeCapsule }, "⏳"), $("#messageInput"));
  if (form && !$("#fxPollBtn")) form.insertBefore(h("button", { id: "fxPollBtn", type: "button", class: "vybe-media-btn", title: "Create poll", style: "display:none", onclick: composePoll }, "📊"), $("#messageInput"));
  const dots = h("button", { type: "button", class: "fx-dots-btn", title: "Menu", onclick: (e) => {
    e.stopPropagation();
    if (menu) return closeMenu();
    const r = dots.getBoundingClientRect();
    const item = (label, fn, danger) => h("button", { type: "button", class: danger ? "danger" : "", onclick: () => { closeMenu(); fn(); } }, label);
    menu = h("div", { class: "fx-menu", style: `top:${r.bottom + 6}px;left:${Math.min(r.left, innerWidth - 200)}px`, onclick: (ev) => ev.stopPropagation() },
      item("＋  New status", () => composeStatus()),
      item("⚙️  Settings", () => setTab("settings")),
      item("⎋  Log out", () => $("#logoutBtn")?.click(), true));
    document.body.append(menu);
  } }, ico("dots"));
  $(".chat-user-profile").append(dots);
  panels.status = h("div", { class: "fx-panel", hidden: "" });
  panels.settings = h("div", { class: "fx-panel", hidden: "" });
  side.append(panels.status, panels.settings);
}
function setTab(t) {
  tab = t;
  document.querySelectorAll("#fxRail button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
  [".chat-search", "#fxGroups", ".sidebar-heading", "#usersList"].forEach((q) => { const e = $(q); if (e) e.style.display = t === "chats" ? "" : "none"; });
  panels.status.hidden = t !== "status"; panels.settings.hidden = t !== "settings";
  if (t === "status") renderStatus(); if (t === "settings") renderSettings();
}
function updateBadge() {
  const b = $("#fxRail .fx-badge"); if (!b || !me) return;
  b.hidden = !statuses.some((s) => s.uid !== me.uid && !(s.viewers || []).some((v) => v.uid === me.uid));
}

/* ---------- status ---------- */
function listenStatuses() {
  stopStatus?.();
  stopStatus = onSnapshot(query(collection(db, "statuses"), where("expiresAt", ">", Date.now())), (snap) => {
    statuses = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.expiresAt > Date.now()).sort((a, b) => a.createdAt - b.createdAt);
    updateBadge(); if (tab === "status") renderStatus();
  }, (e) => { console.error(e); panels.status.textContent = "Status load nahi hua. Firestore Rules me 'statuses' allow karo."; });
}
function renderStatus() {
  const p = panels.status; p.replaceChildren(h("div", { class: "fx-title" }, "Status", h("button", { type: "button", class: "fx-add", title: "New status", onclick: composeStatus }, "＋")));
  const mine = statuses.filter((s) => s.uid === me.uid);
  p.append(h("div", { class: "fx-row", onclick: () => (mine.length ? openViewer(mine) : composeStatus()) },
    avatar(myDoc.name || me.displayName, myDoc.photoURL, mine.length ? "ring" : ""),
    h("div", { class: "fx-grow" }, h("strong", {}, "My status"), h("small", {}, mine.length ? `${mine.length} update(s) · ${ago(mine.at(-1).createdAt)}` : "Tap to add status update")),
    h("button", { class: "fx-add", type: "button", onclick: (e) => { e.stopPropagation(); composeStatus(); } }, "＋")));
  const groups = {};
  statuses.filter((s) => s.uid !== me.uid).forEach((s) => (groups[s.uid] ||= []).push(s));
  p.append(h("h4", { class: "fx-h" }, "RECENT UPDATES"));
  if (!Object.keys(groups).length) p.append(h("p", { class: "fx-empty" }, "Abhi kisi ka status nahi hai."));
  Object.values(groups).forEach((list) => {
    const seen = list.every((s) => (s.viewers || []).some((v) => v.uid === me.uid));
    p.append(h("div", { class: "fx-row", onclick: () => openViewer(list) },
      avatar(list[0].name, list[0].photoURL, seen ? "ring seen" : "ring"),
      h("div", { class: "fx-grow" }, h("strong", {}, list[0].name), h("small", {}, ago(list.at(-1).createdAt)))));
  });
}
function composeStatus() {
  let bg = 0, file = null;
  const ta = h("textarea", { placeholder: "Type a status…", maxlength: "300" });
  const box = h("div", { class: "fx-compose", style: `background:${BGS[0]}` }, ta);
  const note = h("small", { class: "fx-note" });
  const close = () => ov.remove();
  const post = h("button", { class: "fx-btn", type: "button" }, "Post status");
  post.onclick = async () => {
    const text = ta.value.trim();
    if (!text && !file) return;
    post.disabled = true; note.textContent = "Posting…";
    try {
      const mediaUrl = file ? await upload(file) : "";
      await addDoc(collection(db, "statuses"), { uid: me.uid, name: myDoc.name || me.displayName || "VYBE User", photoURL: myDoc.photoURL || "", type: file ? "image" : "text", text, bg: BGS[bg], mediaUrl, createdAt: Date.now(), expiresAt: Date.now() + DAY, viewers: [] });
      close();
    } catch (e) { note.textContent = "Error: " + e.message; post.disabled = false; }
  };
  const photo = h("button", { class: "fx-btn ghost", type: "button", onclick: async () => {
    file = await pickImage(); if (!file) return;
    box.style.background = `#000 url(${URL.createObjectURL(file)}) center/contain no-repeat`; ta.placeholder = "Add a caption…";
  } }, "🖼️ Photo");
  const dots = h("div", { class: "fx-dots" }, ...BGS.map((g, i) => h("button", { type: "button", style: `background:${g}`, onclick: () => { if (file) return; bg = i; box.style.background = g; } })));
  const ov = h("div", { class: "fx-overlay" }, h("button", { class: "fx-x", type: "button", onclick: close }, "✕"), box, dots, h("div", { class: "fx-actions" }, photo, post), note);
  document.body.append(ov); ta.focus();
}
function openViewer(items) {
  let i = 0, t;
  const ov = h("div", { class: "fx-overlay fx-view" });
  document.body.append(ov);
  const close = () => { clearTimeout(t); ov.remove(); };
  const show = () => {
    clearTimeout(t);
    if (i >= items.length) return close();
    if (i < 0) i = 0;
    const s = items[i], mineS = s.uid === me.uid;
    if (!mineS && cfg.receipts && !(s.viewers || []).some((v) => v.uid === me.uid)) {
      s.viewers = [...(s.viewers || []), { uid: me.uid }];
      updateDoc(doc(db, "statuses", s.id), { viewers: arrayUnion({ uid: me.uid, name: myDoc.name || me.displayName || "User", at: Date.now() }) }).catch(console.error);
    }
    const bars = h("div", { class: "fx-bars" }, ...items.map((_, k) => h("span", { class: k < i ? "done" : k === i ? "run" : "" }, h("i"))));
    const body = s.type === "image"
      ? h("div", { class: "fx-story", style: `background:#000 url(${s.mediaUrl}) center/contain no-repeat` }, h("p", { class: "fx-cap" }, s.text))
      : h("div", { class: "fx-story", style: `background:${s.bg}` }, h("p", {}, s.text));
    const head = h("div", { class: "fx-vhead" }, avatar(s.name, s.photoURL), h("div", { class: "fx-grow" }, h("strong", {}, s.name), h("small", {}, ago(s.createdAt))), h("button", { type: "button", class: "fx-x", onclick: close }, "✕"));
    const foot = mineS ? h("div", { class: "fx-vfoot" },
      h("button", { type: "button", onclick: () => { clearTimeout(t); alert((s.viewers || []).length ? "Seen by:\n" + s.viewers.map((v) => v.name || "User").join("\n") : "Abhi kisi ne nahi dekha"); t = setTimeout(() => { i++; show(); }, 5000); } }, `👁 ${(s.viewers || []).length}`),
      h("button", { type: "button", onclick: async () => { await deleteDoc(doc(db, "statuses", s.id)); items.splice(i, 1); show(); } }, "🗑 Delete")) : null;
    const l = h("div", { class: "fx-tap l", onclick: () => { i--; show(); } }), r = h("div", { class: "fx-tap r", onclick: () => { i++; show(); } });
    ov.replaceChildren(bars, head, body, l, r, ...(foot ? [foot] : []));
    t = setTimeout(() => { i++; show(); }, 5000);
  };
  show();
}

/* ---------- settings ---------- */
function renderSettings() {
  const p = panels.settings; p.replaceChildren(h("div", { class: "fx-title" }, h("button", { type: "button", class: "fx-back", onclick: () => setTab("chats") }, "←"), "Settings"));
  const name = h("input", { value: myDoc.name || me.displayName || "", maxlength: "40", placeholder: "Your name" });
  const about = h("input", { value: myDoc.about ?? "Hey there! I am using VYBE.", maxlength: "100", placeholder: "About" });
  const msg = h("small", { class: "fx-note" });
  const save = h("button", { class: "fx-btn", type: "button" }, "Save profile");
  save.onclick = async () => {
    const n = name.value.trim(); if (!n) return;
    try {
      await updateProfile(me, { displayName: n });
      await setDoc(doc(db, "users", me.uid), { name: n, about: about.value.trim() }, { merge: true });
      myDoc = { ...myDoc, name: n, about: about.value.trim() };
      if ($("#currentUserName")) $("#currentUserName").textContent = n;
      msg.textContent = "Saved ✓";
    } catch (e) { msg.textContent = "Error: " + e.message; }
  };
  const av = avatar(myDoc.name, myDoc.photoURL, "big");
  av.onclick = async () => {
    const f = await pickImage(); if (!f) return;
    try { msg.textContent = "Uploading…"; const url = await upload(f); await setDoc(doc(db, "users", me.uid), { photoURL: url }, { merge: true }); myDoc.photoURL = url; msg.textContent = "Photo updated ✓"; renderSettings(); }
    catch (e) { msg.textContent = "Error: " + e.message; }
  };
  const chips = (obj, key) => h("div", { class: "fx-chips" }, ...Object.keys(obj).map((k) =>
    h("button", { type: "button", class: cfg[key] === k ? "on" : "", onclick: () => { cfg[key] = k; applyCfg(); renderSettings(); } }, k)));
  const toggle = (label, key) => h("label", { class: "fx-toggle" }, h("span", {}, label),
    h("input", { type: "checkbox", ...(cfg[key] ? { checked: "" } : {}), onchange: (e) => { cfg[key] = e.target.checked; applyCfg(); if (key === "presence") setPresence(!document.hidden); } }));
  p.append(
    h("h4", { class: "fx-h" }, "PROFILE"), h("div", { class: "fx-prof" }, av, h("small", {}, "Tap photo to change")), name, about, save, msg,
    h("h4", { class: "fx-h" }, "APPEARANCE"), h("small", {}, "Theme"), chips(THEMES, "theme"), h("small", {}, "Accent color"), chips(ACCENTS, "accent"), h("small", {}, "Chat wallpaper"), h("button", { class: "fx-btn", type: "button", onclick: wallpaperPicker }, "🎨 Change wallpaper"),
    h("small", {}, "Message font size"), h("div", { class: "fx-chips" }, ...[[13, "Small"], [14, "Medium"], [16, "Large"]].map(([v, l]) =>
      h("button", { type: "button", class: cfg.font === v ? "on" : "", onclick: () => { cfg.font = v; applyCfg(); renderSettings(); } }, l))),
    h("h4", { class: "fx-h" }, "PRIVACY"), toggle("Status read receipts (seen)", "receipts"), toggle("Show online & last seen", "presence"),
    h("h4", { class: "fx-h" }, "ACCOUNT"), h("small", {}, me.email || ""),
    h("button", { class: "fx-btn danger", type: "button", onclick: async () => {
      const mine = statuses.filter((s) => s.uid === me.uid);
      if (!mine.length) return alert("Koi status nahi hai.");
      if (confirm("Apne saare status delete karein?")) await Promise.all(mine.map((s) => deleteDoc(doc(db, "statuses", s.id))));
    } }, "Delete all my status"),
    h("button", { class: "fx-btn danger", type: "button", onclick: () => $("#logoutBtn")?.click() }, "Log out"));
}

/* ---------- boot ---------- */
onAuthStateChanged(auth, async (user) => {
  me = user;
  if (!user) { clearInterval(pTimer); stopStatus?.(); stopUsers?.(); stopGroups?.(); stopStatus = stopUsers = stopGroups = null; groups = []; return; }
  mountUI(); applyCfg();
  try { myDoc = (await getDoc(doc(db, "users", user.uid))).data() || {}; } catch (e) { console.error(e); }
  const a = $("#currentUserAvatar");
  if (a && myDoc.photoURL) { a.textContent = ""; a.style.cssText += `;background:url(${myDoc.photoURL}) center/cover`; }
  const me_ = $("#fxRail .fx-me"); if (me_) me_.replaceChildren(avatar(myDoc.name || user.displayName, myDoc.photoURL));
  listenStatuses(); listenData(); startPresence(); setTab("chats");
});

/* ---------- time capsule ---------- */
const fmt = (ms) => new Date(ms).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const left = (ms) => { let s = Math.max(0, Math.floor((ms - Date.now()) / 1000)); const d = Math.floor(s / 86400); s %= 86400; const p = (n) => String(n).padStart(2, "0"); return `${d ? d + "d " : ""}${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`; };
window.fxCapsule = (bubble, m) => {
  if (!m.capsule || !m.unlockAt) return;
  const mine = m.senderId === me?.uid, wrap = h("div", { class: "fx-capsule" });
  bubble.replaceChildren(wrap);
  const draw = () => {
    if (Date.now() >= m.unlockAt) {
      wrap.className = "fx-capsule fx-open";
      wrap.replaceChildren(h("small", {}, `🎁 Time capsule opened · ${fmt(m.unlockAt)}`), h("span", {}, m.capsuleText || ""));
      return true;
    }
    wrap.replaceChildren(h("b", {}, mine ? "⏳ Your time capsule" : "🔒 Time capsule"), h("span", { class: "fx-count" }, left(m.unlockAt)), h("small", {}, `Opens ${fmt(m.unlockAt)}`),
      ...(mine ? [h("small", { class: "fx-peek" }, "You wrote: " + m.capsuleText)] : []));
    return false;
  };
  if (!draw()) { const iv = setInterval(() => { if (!wrap.isConnected || draw()) clearInterval(iv); }, 1000); }
};
function composeCapsule() {
  const chatId = window.fxChatId, input = $("#messageInput");
  if (!chatId) return alert("Pehle kisi ki chat open karo.");
  const ta = h("textarea", { placeholder: "Kuch aisa likho jo baad me khulna chahiye…", maxlength: "1000" });
  ta.value = input?.value || "";
  const dt = h("input", { type: "datetime-local" });
  const set = (ms) => { dt.value = new Date(ms - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
  const at = (days, hr) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hr, 0, 0, 0); return d.getTime(); };
  const presets = [["1 hour", () => Date.now() + 36e5], ["Tonight 9 PM", () => (at(0, 21) > Date.now() + 6e4 ? at(0, 21) : at(1, 21))], ["Tomorrow 9 AM", () => at(1, 9)], ["1 week", () => Date.now() + 7 * DAY]];
  set(presets[1][1]());
  const note = h("small", { class: "fx-note" }), close = () => ov.remove();
  const send = h("button", { class: "fx-btn", type: "button" }, "Seal & send ⏳");
  send.onclick = async () => {
    const text = ta.value.trim(), when = new Date(dt.value).getTime();
    if (!text) return (note.textContent = "Message likho.");
    if (!when || when < Date.now() + 3e4) return (note.textContent = "Future ka time chuno.");
    if (when > Date.now() + 365 * DAY) return (note.textContent = "Maximum 1 saal.");
    send.disabled = true;
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), { senderId: me.uid, type: "text", text: "⏳ Time capsule", capsule: true, capsuleText: text, unlockAt: when, createdAt: serverTimestamp() });
      if (input && input.value.trim() === text) input.value = "";
      close();
    } catch (e) { note.textContent = "Error: " + e.message; send.disabled = false; }
  };
  const box = h("div", { class: "fx-capbox" }, h("h3", {}, "⏳ Time Capsule"),
    h("small", {}, "Message abhi chala jayega, lekin samnay wala usay sirf tay waqt par khol payega."), ta,
    h("div", { class: "fx-chips" }, ...presets.map(([l, f]) => h("button", { type: "button", onclick: () => set(f()) }, l))), dt,
    h("div", { class: "fx-actions" }, h("button", { class: "fx-btn ghost", type: "button", onclick: close }, "Cancel"), send), note);
  const ov = h("div", { class: "fx-overlay" }, box);
  document.body.append(ov); ta.focus();
}

/* ---------- groups ---------- */
let usersMap = {}, groups = [], stopUsers = null, stopGroups = null;
const SC = ["#a855f7", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"];
window.fxBubble = (bubble, m) => {
  const g = groups.find((x) => x.id === window.fxChatId);
  if (!g || m.senderId === me?.uid) return;
  const n = usersMap[m.senderId]?.name || "Member";
  bubble.prepend(h("div", { class: "fx-sender", style: `color:${SC[[...m.senderId].reduce((t, c) => t + c.charCodeAt(0), 0) % SC.length]}` }, n));
};
function listenData() {
  stopUsers?.(); stopGroups?.();
  stopUsers = onSnapshot(collection(db, "users"), (snap) => { usersMap = {}; snap.forEach((d) => (usersMap[d.id] = { uid: d.id, ...d.data() })); });
  stopGroups = onSnapshot(query(collection(db, "chats"), where("participants", "array-contains", me.uid)), (snap) => {
    groups = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((g) => g.isGroup).sort((a, b) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
    const cur = groups.find((g) => g.id === window.fxChatId);
    if (cur) { if ($("#activeChatName")) $("#activeChatName").textContent = cur.name; if ($("#activeChatStatus")) $("#activeChatStatus").textContent = `${cur.participants.length} members`; }
    renderGroups();
  }, (e) => console.error("Groups error", e));
}
const openGroup = (g) => window.fxOpen?.({ uid: g.id, chatId: g.id, name: g.name, email: `${g.participants.length} members` });
function renderGroups() {
  const box = $("#fxGroups"); if (!box) return;
  const q = ($("#userSearch")?.value || "").trim().toLowerCase();
  const list = groups.filter((g) => (g.name || "").toLowerCase().includes(q));
  box.replaceChildren(h("div", { class: "fx-ghead" }, h("span", {}, "GROUPS"), h("button", { type: "button", onclick: newGroup }, "＋ New group")),
    ...(list.length ? list.map((g) => h("div", { class: "fx-row", onclick: () => openGroup(g) }, h("span", { class: "fx-av group" }, "👥"),
      h("div", { class: "fx-grow" }, h("strong", {}, g.name), h("small", {}, `${g.participants.length} members`))))
      : groups.length ? [] : [h("p", { class: "fx-empty" }, "Abhi koi group nahi. ＋ New group se banao.")]));
}
function memberPicker(exclude, sel) {
  const search = h("input", { type: "search", placeholder: "Search people…" }), list = h("div", { class: "fx-plist" });
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    list.replaceChildren(...Object.values(usersMap).filter((u) => u.uid !== me.uid && !exclude.includes(u.uid) && ((u.name || "") + (u.email || "")).toLowerCase().includes(q)).map((u) =>
      h("button", { type: "button", class: "fx-prow" + (sel.has(u.uid) ? " on" : ""), onclick: () => { sel.has(u.uid) ? sel.delete(u.uid) : sel.add(u.uid); draw(); } },
        avatar(u.name, u.photoURL), h("span", { class: "fx-grow" }, h("strong", {}, u.name || "User"), h("small", {}, u.email || "")), h("span", { class: "fx-chk" }, sel.has(u.uid) ? "✓" : ""))));
    if (!list.children.length) list.append(h("p", { class: "fx-empty" }, "Koi user nahi mila."));
  };
  search.oninput = draw; draw();
  return h("div", { class: "fx-picker" }, search, list);
}
function newGroup() {
  const sel = new Set(), name = h("input", { placeholder: "Group name", maxlength: "50" }), note = h("small", { class: "fx-note" });
  const close = () => ov.remove(), go = h("button", { class: "fx-btn", type: "button" }, "Create group");
  go.onclick = async () => {
    const n = name.value.trim();
    if (!n) return (note.textContent = "Group ka naam likho.");
    if (!sel.size) return (note.textContent = "Kam az kam 1 member chuno.");
    go.disabled = true;
    try {
      const ref = await addDoc(collection(db, "chats"), { isGroup: true, name: n, admin: me.uid, createdBy: me.uid, participants: [me.uid, ...sel], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      close(); setTab("chats"); openGroup({ id: ref.id, name: n, participants: [me.uid, ...sel] });
    } catch (e) { note.textContent = "Error: " + e.message; go.disabled = false; }
  };
  const ov = h("div", { class: "fx-overlay" }, h("div", { class: "fx-capbox" }, h("h3", {}, "👥 New group"), name, h("small", {}, "Members chuno:"), memberPicker([], sel),
    h("div", { class: "fx-actions" }, h("button", { class: "fx-btn ghost", type: "button", onclick: close }, "Cancel"), go), note));
  document.body.append(ov); name.focus();
}
function groupInfo() {
  const id = window.fxChatId; if (!groups.find((x) => x.id === id)) return;
  const box = h("div", { class: "fx-capbox" }), ov = h("div", { class: "fx-overlay" }, box), close = () => ov.remove();
  let adding = false; const sel = new Set();
  const draw = () => {
    const g = groups.find((x) => x.id === id); if (!g) return close();
    const admin = g.admin === me.uid, ref = doc(db, "chats", id), note = h("small", { class: "fx-note" });
    const run = async (fn) => { try { await fn(); } catch (e) { note.textContent = "Error: " + e.message; } };
    const nm = h("input", { value: g.name, maxlength: "50", ...(admin ? {} : { disabled: "" }) });
    box.replaceChildren(h("h3", {}, "👥 Group info"), nm,
      ...(admin ? [h("button", { class: "fx-btn ghost", type: "button", onclick: () => run(async () => { const n = nm.value.trim(); if (n) { await updateDoc(ref, { name: n, updatedAt: serverTimestamp() }); note.textContent = "Saved ✓"; } }) }, "Save name")] : []),
      h("small", {}, `${g.participants.length} members`),
      h("div", { class: "fx-plist" }, ...g.participants.map((uid) => { const u = usersMap[uid] || {};
        return h("div", { class: "fx-prow" }, avatar(u.name, u.photoURL), h("span", { class: "fx-grow" }, h("strong", {}, (u.name || "User") + (uid === me.uid ? " (You)" : "")), h("small", {}, uid === g.admin ? "Group admin" : (u.email || ""))),
          admin && uid !== me.uid ? h("button", { type: "button", class: "fx-rm", title: "Remove", onclick: () => run(() => updateDoc(ref, { participants: g.participants.filter((x) => x !== uid), updatedAt: serverTimestamp() }).then(draw)) }, "✕") : null); })),
      ...(admin ? [adding
        ? h("div", { class: "fx-capbox" }, memberPicker(g.participants, sel), h("button", { class: "fx-btn", type: "button", onclick: () => run(async () => { if (!sel.size) return; await updateDoc(ref, { participants: [...g.participants, ...sel], updatedAt: serverTimestamp() }); sel.clear(); adding = false; draw(); }) }, "Add selected"))
        : h("button", { class: "fx-btn ghost", type: "button", onclick: () => { adding = true; draw(); } }, "＋ Add members")] : []),
      h("button", { class: "fx-btn danger", type: "button", onclick: () => run(async () => {
        if (!confirm("Group chhor dein?")) return;
        const rest = g.participants.filter((x) => x !== me.uid), upd = { participants: rest, updatedAt: serverTimestamp() };
        if (admin && rest.length) upd.admin = rest[0];
        await updateDoc(ref, upd); close();
        if ($("#activeChat")) $("#activeChat").hidden = true; if ($("#chatWelcome")) $("#chatWelcome").hidden = false;
      }) }, "Leave group"),
      h("button", { class: "fx-btn ghost", type: "button", onclick: close }, "Close"), note);
  };
  draw(); document.body.append(ov);
}

/* ---------- group polls ---------- */
window.fxPoll = (bubble, m) => {
  const p = m.poll || {}, votes = m.votes || {}, chatId = m.chatId, uid = me?.uid;
  const opts = p.options || [], multi = !!p.multiple;
  const mine = Array.isArray(votes[uid]) ? votes[uid] : [];
  const voters = Object.keys(votes).filter((u) => Array.isArray(votes[u]) && votes[u].length);
  const wrap = h("div", { class: "fx-poll" });
  const cast = async (idx) => {
    if (!uid) return;
    let next;
    if (multi) next = mine.includes(idx) ? mine.filter((x) => x !== idx) : [...mine, idx];
    else next = mine.includes(idx) ? [] : [idx];
    try { await updateDoc(doc(db, "chats", chatId, "messages", m.id), { ["votes." + uid]: next }); }
    catch (e) { console.error(e); alert("Vote save nahi hua. Firestore Rules (poll votes) check karo."); }
  };
  wrap.append(h("div", { class: "fx-poll-q" }, "📊 " + (p.question || "Poll")), h("small", { class: "fx-poll-hint" }, multi ? "Select one or more" : "Select one"));
  opts.forEach((label, i) => {
    const who = voters.filter((u) => votes[u].includes(i)), n = who.length, pct = voters.length ? Math.round((n / voters.length) * 100) : 0, on = mine.includes(i);
    const row = h("button", { type: "button", class: "fx-opt" + (on ? " on" : ""), onclick: (e) => { e.stopPropagation(); cast(i); } },
      h("i", { class: "fx-bar", style: `width:${pct}%` }),
      h("span", { class: "fx-chk2" }, on ? "✓" : ""),
      h("span", { class: "fx-olabel" }, label),
      h("b", {}, String(n)));
    row.title = n ? who.map((u) => (u === uid ? "You" : usersMap[u]?.name || "Member")).join(", ") : "No votes yet";
    wrap.append(row);
  });
  const foot = h("div", { class: "fx-poll-foot" }, h("small", {}, `${voters.length} vote${voters.length === 1 ? "" : "s"}`),
    voters.length ? h("button", { type: "button", class: "fx-link", onclick: (e) => { e.stopPropagation(); showVoters(p, votes); } }, "View votes") : null);
  wrap.append(foot);
  bubble.replaceChildren(wrap);
};
function showVoters(p, votes) {
  const close = () => ov.remove();
  const body = (p.options || []).map((label, i) => {
    const who = Object.keys(votes).filter((u) => Array.isArray(votes[u]) && votes[u].includes(i));
    return h("div", { class: "fx-vsec" }, h("strong", {}, `${label} · ${who.length}`),
      ...(who.length ? who.map((u) => h("div", { class: "fx-prow" }, avatar(usersMap[u]?.name, usersMap[u]?.photoURL), h("span", { class: "fx-grow" }, h("strong", {}, u === me.uid ? "You" : usersMap[u]?.name || "Member")))) : [h("small", {}, "No votes")]));
  });
  const ov = h("div", { class: "fx-overlay" }, h("div", { class: "fx-capbox" }, h("h3", {}, "📊 " + (p.question || "Poll")), ...body, h("button", { class: "fx-btn", type: "button", onclick: close }, "Close")));
  document.body.append(ov);
}
function composePoll() {
  const chatId = window.fxChatId;
  if (!chatId || !groups.find((g) => g.id === chatId)) return alert("Poll sirf group me ban sakta hai.");
  const q = h("input", { placeholder: "Question poochho…", maxlength: "200" });
  const list = h("div", { class: "fx-plist" }), note = h("small", { class: "fx-note" });
  let inputs = [h("input", { placeholder: "Option 1", maxlength: "80" }), h("input", { placeholder: "Option 2", maxlength: "80" })];
  const multi = h("input", { type: "checkbox" });
  const draw = () => list.replaceChildren(...inputs);
  const add = h("button", { class: "fx-btn ghost", type: "button", onclick: () => { if (inputs.length >= 8) return (note.textContent = "Maximum 8 options."); inputs.push(h("input", { placeholder: "Option " + (inputs.length + 1), maxlength: "80" })); draw(); inputs.at(-1).focus(); } }, "＋ Add option");
  const close = () => ov.remove(), send = h("button", { class: "fx-btn", type: "button" }, "Send poll 📊");
  send.onclick = async () => {
    const question = q.value.trim(), options = [...new Set(inputs.map((i) => i.value.trim()).filter(Boolean))];
    if (!question) return (note.textContent = "Question likho.");
    if (options.length < 2) return (note.textContent = "Kam az kam 2 alag options do.");
    send.disabled = true;
    try {
      await addDoc(collection(db, "chats", chatId, "messages"), { senderId: me.uid, type: "poll", text: "📊 " + question, poll: { question, options, multiple: multi.checked }, votes: {}, createdAt: serverTimestamp() });
      close();
    } catch (e) { note.textContent = "Error: " + e.message; send.disabled = false; }
  };
  const ov = h("div", { class: "fx-overlay" }, h("div", { class: "fx-capbox" }, h("h3", {}, "📊 Create poll"), q, h("small", {}, "Options:"), list, add,
    h("label", { class: "fx-toggle" }, h("span", {}, "Allow multiple answers"), multi),
    h("div", { class: "fx-actions" }, h("button", { class: "fx-btn ghost", type: "button", onclick: close }, "Cancel"), send), note));
  draw(); document.body.append(ov); q.focus();
}

/* ---------- presence (online / last seen), typing, online dots ---------- */
const isOnline = (u) => !!u && u.showPresence !== false && u.online && Date.now() - (u.lastSeen || 0) < 75000;
const typingNow = (u, id) => !!u && u.showPresence !== false && u.typingIn === id && Date.now() - (u.typingAt || 0) < 4500;
const seenText = (u) => {
  if (!u || u.showPresence === false || !u.lastSeen) return "";
  const d = new Date(u.lastSeen), t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `last seen ${d.toDateString() === new Date().toDateString() ? "today" : d.toLocaleDateString([], { day: "numeric", month: "short" })} at ${t}`;
};
let pTimer = null, lastTyping = 0;
function setPresence(on) {
  if (!me) return;
  setDoc(doc(db, "users", me.uid), { online: on, lastSeen: Date.now(), showPresence: cfg.presence !== false, ...(on ? {} : { typingIn: "" }) }, { merge: true }).catch(() => {});
}
const startPresence = () => { clearInterval(pTimer); setPresence(!document.hidden); pTimer = setInterval(() => setPresence(!document.hidden), 30000); };
document.addEventListener("visibilitychange", () => setPresence(!document.hidden));
addEventListener("pagehide", () => setPresence(false));
function onType() {
  if (!me || cfg.presence === false || !window.fxChatId || Date.now() - lastTyping < 2500) return;
  lastTyping = Date.now();
  setDoc(doc(db, "users", me.uid), { typingIn: window.fxChatId, typingAt: Date.now() }, { merge: true }).catch(() => {});
}
function paintDots() {
  document.querySelectorAll("#usersList .vybe-person").forEach((b) => {
    const em = b.querySelector(".vybe-person-email")?.textContent, av = b.querySelector(".vybe-person-avatar");
    if (!av) return;
    const want = isOnline(Object.values(usersMap).find((x) => x.email === em)), has = av.querySelector(".fx-dot");
    if (want && !has) av.append(h("i", { class: "fx-dot" })); else if (!want && has) has.remove();
  });
}
setInterval(() => {
  const id = window.fxChatId, g = groups.find((x) => x.id === id), b = $("#fxInfoBtn"), st = $("#activeChatStatus");
  if (b) b.style.display = g ? "" : "none";
  const pb = $("#fxPollBtn"); if (pb) pb.style.display = g ? "" : "none";
  if (me && id && st) {
    if (g) {
      const names = g.participants.filter((u) => u !== me.uid && typingNow(usersMap[u], id)).map((u) => usersMap[u]?.name || "Someone");
      st.textContent = names.length ? `${names.join(", ")} typing…` : `${g.participants.length} members`;
    } else {
      const u = usersMap[id.split("_").find((x) => x !== me.uid)];
      if (u) st.textContent = typingNow(u, id) ? "typing…" : isOnline(u) ? "online" : seenText(u) || u.email || "";
    }
  }
  if (id !== wallChat) { wallChat = id; applyCfg(); }
  paintDots();
}, 800);


/* ---------- wallpaper picker ---------- */
function wallpaperPicker() {
  const id = window.fxChatId; let scope = id ? "chat" : "all";
  const prev = h("div", { class: "fx-wprev" }, h("span", { class: "l" }, "Hey! Kaisi ho? 👋"), h("span", { class: "r" }, "Wallpaper mast hai 💜"));
  const grid = h("div", { class: "fx-wgrid" }), scopeBar = h("div", { class: "fx-chips" }), note = h("small", { class: "fx-note" });
  const apply = (spec) => {
    if (scope === "chat" && id) (cfg.chatWalls ||= {})[id] = spec;
    else { cfg.wall = spec; if (id && cfg.chatWalls) delete cfg.chatWalls[id]; }
    applyCfg(); draw();
  };
  const draw = () => {
    const cur = curWall(id);
    prev.style.background = wallCss(cur) || "#0b0913";
    grid.replaceChildren(...Object.keys(WALLS).map((k) => h("button", { type: "button", class: cur === k ? "on" : "", style: `background:${wallCss(k) || "#0b0913"}`, onclick: () => apply(k) }, k === "None" ? "Default" : k)),
      ...(cur.startsWith("url:") ? [h("button", { type: "button", class: "on", style: `background:${wallCss(cur)}` }, "Your photo")] : []));
    scopeBar.replaceChildren(...(id ? [["chat", "This chat only"], ["all", "All chats"]].map(([v, l]) => h("button", { type: "button", class: scope === v ? "on" : "", onclick: () => { scope = v; draw(); } }, l)) : []));
  };
  const up = h("button", { class: "fx-btn ghost", type: "button" }, "📷 Upload your photo");
  up.onclick = async () => {
    const f = await pickImage(); if (!f) return;
    if (f.size > 10 * 1024 * 1024) return (note.textContent = "Photo 10MB se choti ho.");
    try { note.textContent = "Uploading…"; apply("url:" + (await upload(f))); note.textContent = "Wallpaper set ✓"; } catch (e) { note.textContent = "Error: " + e.message; }
  };
  const reset = h("button", { class: "fx-btn ghost", type: "button", onclick: () => { if (id && cfg.chatWalls) delete cfg.chatWalls[id]; applyCfg(); draw(); } }, "↺ Use default for this chat");
  const close = () => ov.remove();
  const ov = h("div", { class: "fx-overlay" }, h("div", { class: "fx-capbox" }, h("h3", {}, "🎨 Chat wallpaper"), prev, scopeBar, grid, up, ...(id ? [reset] : []),
    h("button", { class: "fx-btn", type: "button", onclick: close }, "Done"), note));
  document.body.append(ov); draw();
}
let wallChat;

const FX_CSS = `

.vybe-deleted-bubble{font-style:italic;opacity:.72;background:transparent!important;border:1px dashed var(--fx-line,#5a4d78)!important;color:var(--fx-muted,#9b94b3)!important;box-shadow:none!important}
.fx-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:100002;background:#2a2240;color:#fff;border:1px solid #514064;padding:11px 18px;border-radius:24px;font:600 14px inherit;box-shadow:0 10px 30px #0008;animation:fxpop .3s cubic-bezier(.2,1.4,.3,1);transition:opacity .4s}.fx-toast.out{opacity:0}
.fx-poll{display:flex;flex-direction:column;gap:8px;min-width:240px;max-width:320px}.fx-poll-q{font:700 15px inherit}.fx-poll-hint{opacity:.7;font-size:11px}
.fx-opt{position:relative;overflow:hidden;display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #ffffff30;border-radius:12px;background:#ffffff12;color:inherit;font:500 14px inherit;cursor:pointer;text-align:left}
.fx-opt.on{border-color:var(--purple-light)}.fx-bar{position:absolute;left:0;top:0;bottom:0;background:var(--purple);opacity:.35;transition:width .4s ease;pointer-events:none}
.fx-opt>*:not(.fx-bar){position:relative}.fx-olabel{flex:1}.fx-chk2{width:16px;font-weight:700}
.fx-poll-foot{display:flex;justify-content:space-between;align-items:center}.fx-link{border:0;background:transparent;color:inherit;text-decoration:underline;cursor:pointer;font-size:12px}
.fx-vsec{display:flex;flex-direction:column;gap:6px;margin-bottom:6px}
body{--fx-rail:#0d0a17;--fx-side:#100d1c;--fx-card:#1a1528;--fx-card2:#2a2240;--fx-line:#3a3150;--fx-hover:#ffffff14;--fx-text:#f8f6ff;--fx-sub:#cfc6e6;--fx-muted:#9b94b3;--fx-seen:#4b4560}
body.fx-light{--fx-rail:#ece7f6;--fx-side:#f6f3fb;--fx-card:#ffffff;--fx-card2:#ebe5f5;--fx-line:#d9d0e8;--fx-hover:#00000010;--fx-text:#241d33;--fx-sub:#5b5070;--fx-muted:#80779a;--fx-seen:#c8bfd8}
.fx-capsule{display:flex;flex-direction:column;gap:3px;min-width:190px}.fx-capsule b{font-size:13px}.fx-capsule small{opacity:.75;font-size:11px}
.fx-count{font:700 22px ui-monospace,Menlo,monospace;letter-spacing:.5px}.fx-peek{border-top:1px dashed #8886;padding-top:4px;margin-top:3px}
.fx-open{animation:fxpop .6s cubic-bezier(.2,1.4,.3,1)}@keyframes fxpop{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
.fx-capbox{width:min(420px,100%);display:flex;flex-direction:column;gap:12px}.fx-capbox h3{margin:0;font-size:22px}.fx-capbox small{color:#cfc6e6}
.fx-capbox textarea,.fx-capbox input{padding:12px;border-radius:12px;border:1px solid #3a3150;background:#1a1528;color:#fff;font:15px inherit;color-scheme:dark}.fx-capbox textarea{height:130px;resize:none}
.fx-capbox .fx-chips button{color:#cfc6e6;border-color:#3a3150}
.fx-ghead{display:flex;align-items:center;justify-content:space-between;margin:6px 2px;font-size:11px;letter-spacing:.1em;color:var(--fx-muted)}
.fx-ghead button{border:0;background:var(--purple);color:#fff;border-radius:20px;padding:5px 11px;font:600 11px inherit;cursor:pointer}
#fxGroups{max-height:230px;overflow:auto;margin-bottom:6px}.fx-av.group{background:linear-gradient(135deg,#8b5cf6,#5835a6);font-size:20px}
.fx-sender{font-size:12px;font-weight:700;margin-bottom:2px}.fx-info-btn{margin-left:auto;border:0;background:transparent;font-size:22px;cursor:pointer;color:inherit}
.fx-capbox{max-height:92vh;overflow:auto}.fx-plist{max-height:230px;overflow:auto;display:flex;flex-direction:column;gap:4px}
.fx-prow{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #3a3150;border-radius:12px;background:#1a1528;color:#fff;text-align:left;font:inherit}
button.fx-prow{cursor:pointer}.fx-prow.on{border-color:var(--purple);background:#2a2240}.fx-prow small{color:#9b94b3}.fx-chk{width:22px;color:var(--purple-light);font-weight:700}
.fx-rm{border:0;background:#3a1822;color:#ff8a9d;border-radius:50%;width:28px;height:28px;cursor:pointer}
.vybe-person-avatar{position:relative}.fx-dot{position:absolute;right:-2px;bottom:-2px;width:12px;height:12px;border-radius:50%;background:#25d366;border:2px solid var(--fx-side)}
#fxInfoBtn{margin-left:0}
.fx-wgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.fx-wgrid button{height:70px;border-radius:14px;border:2px solid #3a3150;cursor:pointer;color:#fff;font:600 11px inherit;display:flex;align-items:flex-end;padding:6px;text-shadow:0 1px 3px #000}
.fx-wgrid button.on{border-color:var(--purple-light);box-shadow:0 0 0 2px var(--purple)}
.fx-wprev{height:130px;border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:8px;border:1px solid #3a3150}.fx-wprev span{max-width:70%;padding:8px 12px;border-radius:14px;font-size:14px}
.fx-wprev .l{background:#fff;color:#222;align-self:flex-start}.fx-wprev .r{background:var(--purple);color:#fff;align-self:flex-end}
body.fx-dark{color-scheme:dark}
body.fx-dark #chatDashboard{background:#0b0913}
body.fx-dark #chatDashboard .chat-sidebar{background:var(--fx-side)}
body.fx-dark #chatDashboard .chat-main,body.fx-dark #chatDashboard .chat-welcome,body.fx-dark #chatDashboard #messagesList{background:#0b0913;color:#f8f6ff}
body.fx-dark #chatDashboard #activeChat{background:#0f0c19;border-color:#ffffff12;box-shadow:none}
body.fx-dark #chatDashboard .active-chat-header{background:#151022;border-bottom-color:#ffffff12}
body.fx-dark #chatDashboard .active-chat-header h3,body.fx-dark #chatDashboard #activeChatName,body.fx-dark #chatDashboard .chat-welcome h2{color:#fff}
body.fx-dark #chatDashboard .chat-welcome p{color:#a29bb4}
body.fx-dark #chatDashboard .welcome-icon{background:#241a3a;border-color:#3a2d58;color:#c4a6ff;box-shadow:none}
body.fx-dark #chatDashboard #messageForm{background:#151022;border-color:#ffffff14}
body.fx-dark #chatDashboard #messageInput{background:#1c162b;border-color:#ffffff14;color:#fff}
body.fx-dark #chatDashboard #messageInput::placeholder{color:#79738c}
body.fx-dark #chatDashboard .vybe-message-row.theirs .vybe-message-bubble{background:#221b33;border-color:#ffffff10;color:#f1ecfa}
body.fx-dark #chatDashboard #messagesList .empty-chat-text{background:#1a1528;color:#a29bb4;box-shadow:none}
body.fx-dark .vybe-media-btn,body.fx-dark .vybe-message-menu-button,body.fx-dark #vybeEmojiButton{background:#2a2240!important;border-color:#3a3150!important;color:#c4a6ff!important}
body.fx-dark #vybeEmojiPicker{background:#1a1528!important;border-color:#3a3150!important}
body.fx-dark .vybe-delete-menu{background:#1a1528;border-color:#3a3150}
body.fx-dark .vybe-delete-menu button{color:#f8f6ff}body.fx-dark .vybe-delete-menu button:hover{background:#2a2240}
body.fx-dark .vybe-delete-menu button.danger{color:#ff8a9d}body.fx-dark .vybe-delete-menu button.danger:hover{background:#3a1822}
body.fx-dark .vybe-delete-menu-heading{color:#9b94b3}
body.fx-light #chatDashboard .chat-sidebar{background:var(--fx-side)!important;color:var(--fx-text)!important;border-right:1px solid var(--fx-line)!important}
body.fx-light #chatDashboard .chat-sidebar .chat-brand,body.fx-light #chatDashboard .chat-sidebar .chat-user-profile h3,body.fx-light #chatDashboard .chat-sidebar .users-list,body.fx-light #chatDashboard .chat-sidebar .users-list *{color:var(--fx-text)!important}
body.fx-light #chatDashboard .chat-sidebar .chat-user-profile{background:var(--fx-card)!important;border-color:var(--fx-line)!important}
body.fx-light #chatDashboard .chat-sidebar .chat-user-profile p,body.fx-light #chatDashboard .chat-sidebar .sidebar-heading,body.fx-light #chatDashboard .chat-sidebar .users-list .vybe-person-email,body.fx-light #chatDashboard .chat-sidebar .users-list .vybe-person-arrow,body.fx-light #chatDashboard .chat-sidebar .users-list .empty-chat-text{color:var(--fx-muted)!important}
body.fx-light #chatDashboard .chat-sidebar .chat-search{background:var(--fx-card)!important;border-color:var(--fx-line)!important}
body.fx-light #chatDashboard .chat-sidebar .chat-search input{color:var(--fx-text)!important}
body.fx-light #chatDashboard .chat-sidebar .chat-search input::placeholder{color:var(--fx-muted)!important}
body.fx-light #chatDashboard .chat-sidebar svg{color:var(--fx-sub)!important}
body.fx-light #chatDashboard .chat-sidebar .users-list>*:hover{background:var(--fx-hover)!important}
body.fx-light .fx-btn.danger{background:#fde8ec;color:#c0213f}body.fx-light .fx-menu button.danger{color:#c0213f}
body.fx-light .fx-menu{box-shadow:0 14px 40px #3b2a6a26}
#chatDashboard{grid-template-columns:68px 320px minmax(0,1fr)!important}#logoutBtn{display:none!important}
.fx-rail{display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 0;background:var(--fx-rail);border-right:1px solid var(--fx-hover)}
.fx-rail button{position:relative;width:44px;height:44px;border:0;border-radius:14px;background:transparent;color:var(--fx-muted);display:grid;place-items:center;cursor:pointer;transition:.18s}
.fx-rail button:hover{background:var(--fx-card);color:var(--fx-text)}.fx-rail button.on{background:var(--purple);color:#fff}
.fx-rail .fx-me{margin-bottom:4px}.fx-rail .fx-me.on{background:transparent;box-shadow:0 0 0 2px var(--purple)}.fx-rail .fx-me .fx-av{width:34px;height:34px;min-width:34px;font-size:14px}
.fx-sp{flex:1}.fx-ico{display:grid;place-items:center}.fx-badge{position:absolute;top:8px;right:9px;width:10px;height:10px;border-radius:50%;background:#25d366;border:2px solid var(--fx-rail)}
.fx-dots-btn{margin-left:auto;width:36px;height:36px;border:0;border-radius:11px;background:transparent;color:var(--fx-sub);display:grid;place-items:center;cursor:pointer}.fx-dots-btn:hover{background:var(--fx-hover)}
.fx-menu{position:fixed;z-index:100001;width:190px;padding:6px;border:1px solid var(--fx-line);border-radius:14px;background:var(--fx-card);box-shadow:0 14px 40px #0009;display:flex;flex-direction:column}
.fx-menu button{padding:11px 12px;border:0;border-radius:9px;background:transparent;color:var(--fx-text);text-align:left;font:500 14px inherit;cursor:pointer}.fx-menu button:hover{background:var(--fx-card2)}.fx-menu button.danger{color:#ff8a9d}
.fx-title{display:flex;align-items:center;gap:10px;font:700 20px inherit;padding:2px 2px 8px}.fx-title .fx-add{margin-left:auto}
.fx-back{width:34px;height:34px;border:0;border-radius:50%;background:var(--fx-hover);color:var(--fx-text);font-size:18px;cursor:pointer}
@media(max-width:860px){#chatDashboard{grid-template-columns:1fr!important;padding-bottom:60px}.fx-rail{position:fixed;left:0;right:0;bottom:0;height:60px;flex-direction:row;justify-content:space-around;padding:0 10px;z-index:200;border-right:0;border-top:1px solid var(--fx-hover)}.fx-sp{display:none}}

.fx-tabs{display:flex;gap:6px;margin:0 0 14px}.fx-tabs button{flex:1;padding:9px 4px;border:0;border-radius:12px;background:var(--fx-card);color:var(--fx-sub);font:600 12px inherit;cursor:pointer}
.fx-tabs button.on{background:var(--purple);color:#fff}.fx-panel{flex:1;overflow:auto;display:flex;flex-direction:column;gap:8px;color:var(--fx-text)}
.fx-panel[hidden]{display:none}.fx-h{margin:14px 0 4px;font-size:11px;letter-spacing:.1em;color:var(--fx-muted)}.fx-empty{color:var(--fx-muted);font-size:13px}
.fx-row{display:flex;align-items:center;gap:12px;padding:10px;border-radius:14px;cursor:pointer}.fx-row:hover{background:var(--fx-card)}
.fx-grow{flex:1;display:flex;flex-direction:column;min-width:0}.fx-grow small,.fx-panel small{color:var(--fx-muted);font-size:12px}
.fx-av{width:46px;height:46px;min-width:46px;border-radius:50%;display:grid;place-items:center;background:var(--purple-dark) center/cover;color:#fff;font-weight:700}
.fx-av.ring{box-shadow:0 0 0 2px var(--fx-side),0 0 0 4px var(--purple)}.fx-av.ring.seen{box-shadow:0 0 0 2px var(--fx-side),0 0 0 4px var(--fx-seen)}
.fx-av.big{width:84px;height:84px;font-size:30px;cursor:pointer}.fx-prof{display:flex;align-items:center;gap:12px}
.fx-add{width:34px;height:34px;border:0;border-radius:50%;background:var(--purple);color:#fff;font-size:20px;cursor:pointer}
.fx-panel input:not([type=checkbox]){padding:11px;border:1px solid var(--fx-line);border-radius:10px;background:var(--fx-card);color:var(--fx-text);font:inherit}
.fx-btn{padding:11px 16px;border:0;border-radius:12px;background:var(--purple);color:#fff;font:600 13px inherit;cursor:pointer}
.fx-btn.ghost{background:#2a2240}.fx-btn.danger{background:#3a1822;color:#ff8a9d}.fx-note{min-height:14px}
.fx-chips{display:flex;flex-wrap:wrap;gap:6px}.fx-chips button{padding:7px 12px;border:1px solid var(--fx-line);border-radius:20px;background:transparent;color:var(--fx-sub);cursor:pointer}
.fx-chips button.on{background:var(--purple);border-color:var(--purple);color:#fff}
.fx-toggle{display:flex;justify-content:space-between;align-items:center;padding:8px 2px;font-size:14px}
.fx-overlay{position:fixed;inset:0;z-index:100000;background:#0b0912;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:20px;color:#fff}
.fx-x{position:absolute;top:16px;right:16px;z-index:5;border:0;background:rgba(255,255,255,.12);color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer}
.fx-compose{width:min(420px,100%);height:min(60vh,480px);border-radius:20px;display:grid;place-items:center;padding:20px}
.fx-compose textarea{width:100%;height:100%;border:0;background:transparent;color:#fff;font:600 24px inherit;text-align:center;resize:none;outline:0}
.fx-dots{display:flex;gap:10px}.fx-dots button{width:30px;height:30px;border:2px solid #fff3;border-radius:50%;cursor:pointer}.fx-actions{display:flex;gap:10px}
.fx-view{justify-content:flex-start;padding:0;gap:0}.fx-bars{display:flex;gap:4px;width:min(440px,100%);padding:12px 12px 0;z-index:5}
.fx-bars span{flex:1;height:3px;background:#fff4;border-radius:3px;overflow:hidden}.fx-bars i{display:block;height:100%;width:0;background:#fff}
.fx-bars .done i{width:100%}.fx-bars .run i{animation:fxrun 5s linear forwards}@keyframes fxrun{to{width:100%}}
.fx-vhead{display:flex;align-items:center;gap:10px;width:min(440px,100%);padding:12px 60px 12px 12px;z-index:5}
.fx-story{position:absolute;inset:0;display:grid;place-items:center;padding:30px}.fx-story p{font:600 26px inherit;text-align:center;max-width:420px;margin:0}
.fx-story .fx-cap{position:absolute;bottom:80px;font-size:16px;background:#0008;padding:8px 14px;border-radius:12px}
.fx-tap{position:absolute;top:70px;bottom:70px;width:40%;z-index:3}.fx-tap.l{left:0}.fx-tap.r{right:0}
.fx-vfoot{position:absolute;bottom:18px;display:flex;gap:12px;z-index:5}.fx-vfoot button{border:0;border-radius:20px;padding:10px 16px;background:#fff2;color:#fff;cursor:pointer}
`;

applyCfg();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => cfg.theme === "System" && applyCfg());
