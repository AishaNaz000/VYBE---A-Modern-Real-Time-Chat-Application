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
