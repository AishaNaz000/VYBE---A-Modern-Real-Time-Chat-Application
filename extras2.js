import { getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, addDoc, collection, query, where, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const auth = getAuth(getApp()), db = getFirestore(getApp());
const $ = (s) => document.querySelector(s);
const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => k === "class" ? (el.className = v) : k.startsWith("on") ? el.addEventListener(k.slice(2), v) : el.setAttribute(k, v));
  el.append(...kids.filter((k) => k != null));
  return el;
};
const uid = () => auth.currentUser?.uid, chat = () => window.fxChatId;
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const keep = (k, v) => localStorage.setItem(k, JSON.stringify(v));
let pins = ls("vx_pins", []), mutes = ls("vx_mutes", []), stars = ls("vx_stars", []);
let chats = {}, users = {}, unsubs = [], started = null, t0 = 0;
const nameOf = (u) => users[u]?.name || window.fxName?.(u) || "User";
const otherOf = (c) => c.participants.find((p) => p !== uid());
const title = (c) => (c.isGroup ? c.name : nameOf(otherOf(c)));
const av = (c) => { const u = c.isGroup ? null : users[otherOf(c)]; return h("span", { class: "fx-av" + (c.isGroup ? " group" : ""), style: u?.photoURL ? `background-image:url(${u.photoURL})` : "" }, c.isGroup ? "👥" : u?.photoURL ? "" : title(c)[0]?.toUpperCase() || "?"); };
const tm = (ms) => { const d = new Date(ms); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" }); };
const prevOf = (m) => m.type === "image" ? "📷 Photo" : (m.text || "").slice(0, 90);
const openChat = (c) => window.fxOpen?.(c.isGroup ? { uid: c.id, chatId: c.id, name: c.name, email: `${c.participants.length} members` } : { uid: otherOf(c), name: nameOf(otherOf(c)), email: users[otherOf(c)]?.email || "" });

/* ---------- sound + notifications ---------- */
function tone(f, at, d, ctx) { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = f; g.gain.setValueAtTime(0.0001, ctx.currentTime + at); g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + d); o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + d); }
function ding(ring) { try { const c = new (window.AudioContext || window.webkitAudioContext)(); ring ? (tone(660, 0, 0.3, c), tone(880, 0.35, 0.3, c)) : (tone(988, 0, 0.14, c), tone(1319, 0.14, 0.22, c)); } catch {} }
document.addEventListener("click", () => { if (window.Notification && Notification.permission === "default") Notification.requestPermission(); }, { once: true });
const seenNote = new Set();
function notify(c) {
  const k = c.id + ":" + c.last.at;
  if (seenNote.has(k) || c.last.by === uid() || c.last.at < t0) return;
  seenNote.add(k);
  if (mutes.includes(c.id) || (chat() === c.id && !document.hidden)) return;
  ding(); const who = c.isGroup ? `${nameOf(c.last.by)} · ${c.name}` : title(c);
  window.fxToast?.(`💬 ${who}: ${c.last.text}`);
  if (window.Notification && Notification.permission === "granted" && document.hidden) new Notification(who, { body: c.last.text });
}

/* ---------- last message hook (called from app.js / features.js) ---------- */
window.vx.touch = async (id, text) => {
  try {
    const ps = chats[id]?.participants || (await getDoc(doc(db, "chats", id))).data()?.participants || [];
    const u = { last: { text: String(text).slice(0, 90), by: uid(), at: Date.now() } };
    ps.filter((p) => p !== uid()).forEach((p) => (u["unread." + p] = increment(1)));
    await updateDoc(doc(db, "chats", id), u);
  } catch (e) { console.error("touch", e); }
};

/* ---------- delete chat (for me) ---------- */
const clearedMap = () => users[uid()]?.clearedChats || {};
window.vx.cleared = (m) => { const t = clearedMap()[m.chatId], ts = m.createdAt?.toMillis?.(); return !!t && !!ts && ts <= t; };
async function deleteChat(id) {
  const c = chats[id]; if (!id) return;
  if (!confirm(`"${c ? title(c) : "Is chat"}" ki saari purani messages sirf aapke liye delete ho jayengi. Continue?`)) return;
  try {
    const now = Date.now();
    await setDoc(doc(db, "users", uid()), { clearedChats: { [id]: now } }, { merge: true });
    users[uid()] = { ...users[uid()], clearedChats: { ...clearedMap(), [id]: now } };
    updateDoc(doc(db, "chats", id), { ["unread." + uid()]: 0 }).catch(() => {});
    pins = pins.filter((x) => x !== id); keep("vx_pins", pins);
    if (chat() === id) { $("#activeChat").hidden = true; $("#chatWelcome").hidden = false; }
    renderRecent(); window.fxToast?.("🗑 Chat delete ho gayi");
  } catch (e) { console.error(e); alert("Chat delete nahi hui: " + e.message); }
}

/* ---------- recent chats list ---------- */
function renderRecent() {
  let box = $("#vxRecent");
  if (!box) { const g = $("#fxGroups"); if (!g) return; box = h("div", { id: "vxRecent" }); g.before(box); }
  const list = Object.values(chats).filter((c) => c.last && c.last.at > (clearedMap()[c.id] || 0)).sort((a, b) => (pins.includes(b.id) - pins.includes(a.id)) || b.last.at - a.last.at);
  box.replaceChildren(h("div", { class: "fx-ghead" }, h("span", {}, "RECENT CHATS")),
    ...(list.length ? list.map((c) => { const n = c.unread?.[uid()] || 0;
      return h("div", { class: "fx-row vx-crow" + (chat() === c.id ? " on" : ""), title: "Right-click: delete chat", oncontextmenu: (ev) => { ev.preventDefault(); deleteChat(c.id); }, onclick: () => openChat(c) }, av(c),
        h("div", { class: "fx-grow" }, h("strong", {}, (pins.includes(c.id) ? "📌 " : "") + title(c)), h("small", { class: "vx-lp" }, (c.last.by === uid() ? "You: " : c.isGroup ? nameOf(c.last.by) + ": " : "") + c.last.text)),
        h("div", { class: "vx-rt" }, h("small", {}, tm(c.last.at)), n ? h("b", { class: "vx-ub" }, n > 99 ? "99+" : String(n)) : mutes.includes(c.id) ? h("small", {}, "🔕") : null)); })
      : [h("p", { class: "fx-empty" }, "Abhi koi chat nahi — kisi ko message bhejo 💜")]));
}

/* ---------- message menu: star, forward, pin ---------- */
const baseMenu = window.vx.menu, baseDecorate = window.vx.decorate;
window.vx.menu = (m, add, close) => {
  baseMenu(m, add, close);
  if (m.deleted) return;
  const key = m.chatId + "/" + m.id, starred = stars.some((s) => s.key === key);
  add(starred ? "☆ Unstar" : "⭐ Star", () => { close(); stars = starred ? stars.filter((s) => s.key !== key) : [...stars, { key, chatId: m.chatId, id: m.id, text: prevOf(m) || "Message", name: m.senderId === uid() ? "You" : nameOf(m.senderId), at: Date.now() }]; keep("vx_stars", stars); window.fxToast?.(starred ? "Star hata diya" : "⭐ Starred"); });
  if (m.type === "text" || m.type === "image" || !m.type) {
    if (!m.capsule) add("➡ Forward", () => { close(); forwardUI(m); });
    add("📌 Pin message", () => { close(); updateDoc(doc(db, "chats", m.chatId), { pinnedMsg: { id: m.id, text: prevOf(m) || "Message", by: nameOf(m.senderId) } }).catch((e) => alert("Pin nahi hua: " + e.message)); });
  }
};
window.vx.decorate = (bubble, m, row) => { baseDecorate(bubble, m, row); if (m.forwarded && !m.deleted) bubble.prepend(h("div", { class: "vx-fwd" }, "↪ Forwarded")); };
function modal(...kids) { const ov = h("div", { class: "fx-overlay" }, h("div", { class: "fx-capbox" }, ...kids, h("button", { class: "fx-btn ghost", type: "button", onclick: () => ov.remove() }, "Close"))); document.body.append(ov); return ov; }
function forwardUI(m) {
  const search = h("input", { type: "search", placeholder: "Search people / groups…" }), list = h("div", { class: "fx-plist" });
  const targets = () => [...Object.values(chats).filter((c) => c.isGroup).map((c) => ({ label: c.name, id: c.id, g: 1 })), ...Object.values(users).filter((u) => u.uid !== uid()).map((u) => ({ label: u.name || u.email || "User", id: [uid(), u.uid].sort().join("_"), p: [uid(), u.uid].sort() }))];
  const draw = () => list.replaceChildren(...targets().filter((t) => t.label.toLowerCase().includes(search.value.trim().toLowerCase())).map((t) => h("button", { type: "button", class: "fx-prow", onclick: () => send(t) }, h("span", { class: "fx-grow" }, h("strong", {}, (t.g ? "👥 " : "") + t.label)))));
  const send = async (t) => {
    try {
      if (t.p && !(await getDoc(doc(db, "chats", t.id))).exists()) await setDoc(doc(db, "chats", t.id), { participants: t.p, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      const img = m.type === "image";
      await addDoc(collection(db, "chats", t.id, "messages"), { senderId: uid(), type: img ? "image" : "text", text: img ? "" : m.text, ...(img ? { mediaUrl: m.mediaUrl } : {}), forwarded: true, createdAt: serverTimestamp() });
      window.vx.touch(t.id, "↪ " + prevOf(m)); ov.remove(); window.fxToast?.("Forwarded ✓");
    } catch (e) { alert("Forward nahi hua: " + e.message); }
  };
  search.oninput = draw; draw();
  const ov = modal(h("h3", {}, "➡ Forward to…"), search, list);
}
function starsUI() {
  const list = h("div", { class: "fx-plist" });
  const draw = () => list.replaceChildren(...(stars.length ? stars.map((s) => h("div", { class: "fx-prow" }, h("span", { class: "fx-grow", style: "cursor:pointer", onclick: () => { const c = chats[s.chatId]; ov.remove(); if (c) { openChat(c); setTimeout(() => $(`[data-mid="${s.id}"]`)?.scrollIntoView({ block: "center" }), 1200); } } }, h("strong", {}, s.name), h("small", {}, s.text)), h("button", { type: "button", class: "fx-rm", onclick: () => { stars = stars.filter((x) => x.key !== s.key); keep("vx_stars", stars); draw(); } }, "✕"))) : [h("p", { class: "fx-empty" }, "Koi starred message nahi. Message menu se ⭐ lagao.")]));
  draw(); const ov = modal(h("h3", {}, "⭐ Starred messages"), list);
}

/* ---------- header buttons, pinned banner ---------- */
const pinBar = h("div", { class: "vx-pinbar", hidden: "", onclick: () => { const id = chats[chat()]?.pinnedMsg?.id; $(`[data-mid="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); } });
function mountUI() {
  const hd = $("#activeChat .active-chat-header"); if (!hd) return;
  const b = (id, label, title_, fn) => !$("#" + id) && hd.append(h("button", { id, type: "button", class: "fx-info-btn", style: "margin-left:0", title: title_, onclick: fn }, label));
  b("vxCall", "📞", "Voice call", () => startCall(false)); b("vxVid", "🎥", "Video call", () => startCall(true));
  b("vxStar", "⭐", "Starred messages", starsUI);
  b("vxMute", "🔔", "Mute / unmute", () => { const id = chat(); mutes = mutes.includes(id) ? mutes.filter((x) => x !== id) : [...mutes, id]; keep("vx_mutes", mutes); renderRecent(); });
  b("vxDel", "🗑", "Delete chat", () => deleteChat(chat()));
  b("vxPinC", "📌", "Pin / unpin chat", () => { const id = chat(); pins = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id]; keep("vx_pins", pins); renderRecent(); });
  if (!pinBar.isConnected) ($("#vxSearchBar") || $("#messagesList"))?.before(pinBar);
}
function refreshUI() {
  const id = chat(), c = chats[id] || {}, grp = !!c.isGroup || !!window.fxGroupIds?.includes?.(id);
  ["vxCall", "vxVid"].forEach((x) => { const e = $("#" + x); if (e) e.style.display = grp ? "none" : ""; });
  const mu = $("#vxMute"); if (mu) mu.textContent = mutes.includes(id) ? "🔕" : "🔔";
  const pm = c.pinnedMsg; pinBar.hidden = !pm;
  if (pm) pinBar.replaceChildren(h("span", {}, "📌 " + pm.by + ": " + pm.text), h("button", { type: "button", onclick: (e) => { e.stopPropagation(); updateDoc(doc(db, "chats", id), { pinnedMsg: null }).catch(() => {}); } }, "✕"));
  const rec = $("#vxRecent"), g = $("#fxGroups"); if (rec && g) rec.style.display = g.style.display === "none" ? "none" : "";
}

/* ---------- audio / video calls (WebRTC + Firestore signaling) ---------- */
const ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };
let call = null, ring = null, ringTimer = null;
const getMedia = (video) => navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: "user" } : false });
function callUI(name, video) {
  const rv = h("video", { autoplay: "", playsinline: "", class: "vx-rv" }), lv = h("video", { autoplay: "", playsinline: "", class: "vx-lv" }); lv.muted = true;
  const st = h("small", {}, "Calling…");
  const mute = h("button", { type: "button", onclick: () => { const t = call?.local.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; mute.textContent = t.enabled ? "🎤" : "🔇"; } } }, "🎤");
  const cam = h("button", { type: "button", onclick: () => { const t = call?.local.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; cam.textContent = t.enabled ? "🎥" : "🚫"; } } }, "🎥");
  const ov = h("div", { class: "vx-call" }, rv, ...(video ? [lv] : []), h("div", { class: "vx-cn" }, h("b", {}, (video ? "🎥 " : "📞 ") + name), st), h("div", { class: "vx-cb" }, mute, ...(video ? [cam] : []), h("button", { type: "button", class: "vx-end", onclick: () => endCall(true) }, "📵")));
  document.body.append(ov); return { ov, rv, lv, st };
}
function wire(pc, local, ui) {
  local.getTracks().forEach((t) => pc.addTrack(t, local));
  pc.ontrack = (e) => { ui.rv.srcObject = e.streams[0]; };
  ui.lv.srcObject = local;
  pc.onconnectionstatechange = () => { if (pc.connectionState === "connected") { ui.st.textContent = "00:00"; const s = Date.now(); call.iv = setInterval(() => { const t = Math.floor((Date.now() - s) / 1000); ui.st.textContent = String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); }, 1000); } if (["failed", "closed"].includes(pc.connectionState)) endCall(true, "Call disconnect ho gayi"); };
}
function endCall(notify, msg) {
  if (!call) return; const c = call; call = null;
  clearTimeout(c.to); clearInterval(c.iv); c.unsubs.forEach((u) => u()); c.local.getTracks().forEach((t) => t.stop()); try { c.pc.close(); } catch {}
  c.ui.ov.remove(); if (notify) updateDoc(doc(db, "calls", c.id), { status: "ended" }).catch(() => {});
  if (msg) window.fxToast?.(msg);
}
async function startCall(video) {
  const id = chat(); if (!id || call) return;
  const other = id.split("_").find((x) => x !== uid()); if (!other || chats[id]?.isGroup) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) return alert("Is browser me calls support nahi (https/localhost chahiye).");
  let local; try { local = await getMedia(video); } catch { return alert("Mic/camera permission allow karo."); }
  const ref = doc(collection(db, "calls")), pc = new RTCPeerConnection(ICE), ui = callUI(nameOf(other), video);
  call = { id: ref.id, pc, local, unsubs: [], ui }; wire(pc, local, ui);
  let ready = false; const buf = [];
  pc.onicecandidate = (e) => { if (!e.candidate) return; ready ? addDoc(collection(ref, "caller"), e.candidate.toJSON()) : buf.push(e.candidate.toJSON()); };
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await setDoc(ref, { from: uid(), to: other, video, status: "ringing", offer: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }, createdAt: Date.now() });
    ready = true; buf.forEach((c) => addDoc(collection(ref, "caller"), c));
  } catch (e) { endCall(false, "Call start nahi hui: " + e.message); return; }
  let got = false;
  call.unsubs.push(onSnapshot(ref, (s) => {
    const d = s.data(); if (!d || !call) return;
    if (d.status === "ended" || d.status === "declined") return endCall(false, d.status === "declined" ? "Call decline hui" : "Call khatam");
    if (d.answer && !got) { got = true; clearTimeout(call.to); ui.st.textContent = "Connecting…"; pc.setRemoteDescription(d.answer).then(() => call?.unsubs.push(onSnapshot(collection(ref, "callee"), (q) => q.docChanges().forEach((ch) => ch.type === "added" && pc.addIceCandidate(ch.doc.data()).catch(() => {}))))); }
  }));
  call.to = setTimeout(() => endCall(true, "Jawab nahi aaya"), 45000);
}
async function acceptCall(id, d) {
  stopRing(); if (call) return;
  let local; try { local = await getMedia(d.video); } catch { updateDoc(doc(db, "calls", id), { status: "declined" }); return alert("Mic/camera permission allow karo."); }
  const ref = doc(db, "calls", id), pc = new RTCPeerConnection(ICE), ui = callUI(nameOf(d.from), d.video);
  call = { id, pc, local, unsubs: [], ui }; wire(pc, local, ui);
  pc.onicecandidate = (e) => e.candidate && addDoc(collection(ref, "callee"), e.candidate.toJSON());
  try {
    await pc.setRemoteDescription(d.offer); await pc.setLocalDescription(await pc.createAnswer());
    await updateDoc(ref, { answer: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }, status: "active" });
  } catch (e) { endCall(true, "Call connect nahi hui"); return; }
  call.unsubs.push(onSnapshot(collection(ref, "caller"), (q) => q.docChanges().forEach((ch) => ch.type === "added" && pc.addIceCandidate(ch.doc.data()).catch(() => {}))));
  call.unsubs.push(onSnapshot(ref, (s) => { const x = s.data(); if (x && ["ended", "declined"].includes(x.status)) endCall(false, "Call khatam"); }));
}
function stopRing() { clearInterval(ringTimer); ring?.remove(); ring = null; }
function showRing(id, d) {
  if (ring || call) return;
  const q = (ok) => () => { if (ok) acceptCall(id, d); else { stopRing(); updateDoc(doc(db, "calls", id), { status: "declined" }).catch(() => {}); } };
  ring = h("div", { class: "vx-ring" }, h("b", {}, (d.video ? "🎥 Video" : "📞 Voice") + " call"), h("span", {}, nameOf(d.from)), h("div", {}, h("button", { type: "button", class: "vx-acc", onclick: q(true) }, "Accept"), h("button", { type: "button", class: "vx-end", onclick: q(false) }, "Decline")));
  document.body.append(ring); ding(true); ringTimer = setInterval(() => ding(true), 2200);
}

/* ---------- lifecycle ---------- */
function start() {
  started = uid(); t0 = Date.now();
  unsubs.push(onSnapshot(collection(db, "users"), (s) => { users = {}; s.forEach((d) => (users[d.id] = { uid: d.id, ...d.data() })); renderRecent(); }, () => {}));
  unsubs.push(onSnapshot(query(collection(db, "chats"), where("participants", "array-contains", uid())), (s) => {
    s.docChanges().forEach((ch) => { chats[ch.doc.id] = { id: ch.doc.id, ...ch.doc.data() }; if (ch.type === "removed") delete chats[ch.doc.id]; else if (chats[ch.doc.id].last) notify(chats[ch.doc.id]); });
    renderRecent();
  }, (e) => console.error("chats", e)));
  unsubs.push(onSnapshot(query(collection(db, "calls"), where("to", "==", uid()), where("status", "==", "ringing")), (s) => {
    s.docChanges().forEach((ch) => { const d = ch.doc.data(); if (ch.type === "added" && Date.now() - d.createdAt < 50000) showRing(ch.doc.id, d); if (ch.type === "removed") stopRing(); });
  }, (e) => console.error("calls", e)));
}
function stop() { unsubs.forEach((u) => u()); unsubs = []; started = null; chats = {}; endCall(false); stopRing(); $("#vxRecent")?.remove(); }
setInterval(() => { if (!auth.currentUser) { if (started) stop(); return; } if (started !== uid()) { if (started) stop(); start(); } mountUI(); refreshUI(); }, 700);
setInterval(renderRecent, 30000);

document.head.append(h("style", {}, `
.vx-crow.on{background:var(--fx-card)}.vx-lp{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vx-rt{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.vx-ub{min-width:20px;padding:2px 6px;border-radius:11px;background:#25d366;color:#04200f;font-size:11px;text-align:center}
#vxRecent{max-height:300px;overflow:auto;margin-bottom:6px}.vx-fwd{font-size:11px;opacity:.7;font-style:italic;margin-bottom:3px}
.vx-pinbar{display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--fx-card2,#2a2240);color:var(--fx-text,#fff);font-size:13px;cursor:pointer}.vx-pinbar[hidden]{display:none}.vx-pinbar span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vx-pinbar button{border:0;background:transparent;color:inherit;cursor:pointer}
.vx-call{position:fixed;inset:0;z-index:100010;background:linear-gradient(160deg,#120d22,#2a1850);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;color:#fff}
.vx-rv{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.vx-lv{position:absolute;right:16px;top:16px;width:110px;height:150px;object-fit:cover;border-radius:14px;border:2px solid #fff4;z-index:2;transform:scaleX(-1)}
.vx-cn{position:absolute;top:22px;left:0;right:0;text-align:center;z-index:2;display:flex;flex-direction:column;text-shadow:0 1px 6px #000}.vx-cn b{font-size:20px}
.vx-cb{display:flex;gap:16px;margin-bottom:34px;z-index:2}.vx-cb button,.vx-ring button{width:58px;height:58px;border:0;border-radius:50%;background:#ffffff30;color:#fff;font-size:24px;cursor:pointer}.vx-cb .vx-end,.vx-ring .vx-end{background:#e5384f}
.vx-ring{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:100011;display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 26px;border-radius:20px;background:#241a3a;color:#fff;border:1px solid #514064;box-shadow:0 14px 40px #000a}
.vx-ring div{display:flex;gap:14px;margin-top:6px}.vx-ring button{width:auto;border-radius:24px;padding:0 20px;height:44px;font-size:15px}.vx-ring .vx-acc{background:#25d366;color:#04200f}
`));
