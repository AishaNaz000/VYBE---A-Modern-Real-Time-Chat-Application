VYBE Chat App
=============
Files: index.html, app.js, features.js, style.css  (sab ek hi folder me rakho)
Rules: firestore.rules  (IMPORTANT: naye delete + poll ke liye ye rules dobara Publish karna zaroori hai)
  (Firebase Console > Firestore > Rules me paste karke Publish)

Run: folder ko Live Server / Firebase Hosting / kisi bhi web server par kholo
(file:// se seedha kholne par module scripts nahi chalenge).

Features:
- Chat: text, image, voice, emoji, reactions, delete (me / everyone)
- Delete for everyone => dono taraf "This message was deleted" dikhta hai (WhatsApp jaisa) + samnay wale ko toast: "<naam> ne message delete kiya"
- Group Polls: group chat me 📊 button, single/multiple answers, live % bars, kisne vote diya (View votes)
- Status (24h, text + photo, seen by)
- Groups (naam, members add/remove, leave, sender names)
- Time Capsule messages
- Online / last seen / typing indicator, online dots
- Settings: profile, theme (Light/Dark/System), accent, wallpaper, font size, privacy
- WhatsApp-style icon rail + 3-dot menu

NAYA (extras.js) — index.html me features.js ke baad load hota hai:
- Reply (quote) — message ke 3-dot / right-click menu se; quote par click => original message par jump
- Edit own message ("edited" label), Copy message
- Message time + date separators (Today / Yesterday / date)
- Read receipts: ✓✓ (seen hone par blue) — 1:1 aur groups dono
- Links clickable, sirf-emoji message bada dikhta hai
- Image lightbox (full screen + download)
- Location share 📍 (map card, OpenStreetMap) — https ya localhost par chalta hai
- Chat ke andar search 🔍
- Command palette: Ctrl/Cmd + K (kisi bhi person/group/setting par jump)
- 🎉 / "congrats" / "happy birthday" par confetti
- Jump-to-latest button, tab title me unread count + sound jab tab background me ho

IMPORTANT: firestore.rules naye hain (seen / edit ke liye) — Firebase Console > Firestore > Rules me paste karke Publish karo.

extras2.js: Recent chats (last message + unread badge), pin chat, mute, pinned message, star, forward, message sound + desktop notification, voice/video calls (WebRTC).
IMPORTANT: firestore.rules me chats 'seen' clause aur 'calls' block update karo (chat me bataya hai).
