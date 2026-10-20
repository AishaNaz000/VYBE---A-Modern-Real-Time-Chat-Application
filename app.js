
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  arrayUnion,
  deleteDoc,
  runTransaction,
  where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* ================= FIREBASE CONFIG ================= */

const firebaseConfig = {
  apiKey: "AIzaSyBwqF7Mnm8vVm1aqNq_nmLt5D7CTYfNS_k",
  authDomain: "vybe-chat-app-dcf3b.firebaseapp.com",
  projectId: "vybe-chat-app-dcf3b",
  storageBucket: "vybe-chat-app-dcf3b.firebasestorage.app",
  messagingSenderId: "68534940740",
  appId: "1:68534940740:web:6dafe69d9ca988e3313811",
  measurementId: "G-VF9ZSVNXDC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= CLOUDINARY ================= */

const CLOUDINARY_CLOUD_NAME = "hw9jfqyk";
const CLOUDINARY_UPLOAD_PRESET = "vybe_upload";

/* ================= ELEMENTS ================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const authModal = $("#authModal");
const authTitle = $("#authTitle");
const authSubtitle = $("#authSubtitle");
const loginTab = $("#loginTab");
const signupTab = $("#signupTab");
const nameField = $("#nameField");
const nameInput = $("#name");
const emailInput = $("#email");
const passwordInput = $("#password");
const authForm = $("#authForm");
const authMessage = $("#authMessage");
const submitBtnText = $("#submitBtnText");
const passwordToggle = $("#passwordToggle");
const mobileMenuBtn = $("#mobileMenuBtn");
const navLinks = $("#navLinks");

const chatDashboard = $("#chatDashboard");
const usersList = $("#usersList");
const userSearch = $("#userSearch");
const messagesList = $("#messagesList");
const messageForm = $("#messageForm");
const messageInput = $("#messageInput");

/* ================= STATE ================= */

let authMode = "login";
let allVYBEUsers = [];
let stopUsersListener = null;
let stopMessagesListener = null;
let activeChatId = null;
let chatOpenToken = 0;

let mediaRecorder = null;
let recordingTimer = null;
let audioChunks = [];
let recordingSeconds = 0;
let activeDeleteMenu = null;

/* ================= PREMIUM VYBE ALERTS ================= */

function showVybeAlert(type, customMessage = "") {
  const configurations = {
    signup: {
      icon: "💜",
      title: "Welcome to VYBE!",
      message: "Your journey starts here. Let's connect! ✨",
      color: "#B794FF"
    },
    login: {
      icon: "✦",
      title: "Welcome Back!",
      message: "You're connected again. Happy chatting! 💜",
      color: "#C4A1FF"
    },
    logout: {
      icon: "🌙",
      title: "See You Soon!",
      message: "Take care! VYBE will be here when you return 💜",
      color: "#A78BFA"
    }
  };

  const config = configurations[type];
  if (!config) return;

  // Remove any previous toast and its timer.
  const existing = document.querySelector("#vybe-toast");
  if (existing) {
    clearTimeout(existing.dismissTimer);
    existing.remove();
  }

  if (!document.querySelector("#vybe-toast-styles")) {
    const style = document.createElement("style");
    style.id = "vybe-toast-styles";

    style.textContent = `
      #vybe-toast {
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 1000000;
        width: min(370px, calc(100vw - 32px));
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 17px 19px;
        border: 1px solid rgba(196,161,255,.4);
        border-radius: 20px;
        color: #fff;
        background: linear-gradient(135deg,#191226 0%,#302044 55%,#241735 100%);
        box-shadow: 0 18px 55px rgba(12,5,28,.32),
                    0 0 25px rgba(167,139,250,.13);
        font-family: inherit;
        overflow: hidden;
        animation: vybeToastEnter .42s cubic-bezier(.2,.8,.2,1) both;
      }

      #vybe-toast::before {
        content: "";
        position: absolute;
        left: 0;
        top: 12px;
        bottom: 12px;
        width: 3px;
        border-radius: 10px;
        background: linear-gradient(180deg,#E9D5FF,#8B5CF6);
      }

      #vybe-toast .vybe-toast-icon {
        width: 49px;
        height: 49px;
        min-width: 49px;
        display: grid;
        place-items: center;
        border: 1px solid rgba(255,255,255,.22);
        border-radius: 16px;
        background: linear-gradient(145deg,#8B5CF6,#5835A6);
        box-shadow: 0 5px 20px rgba(139,92,246,.3);
        font-size: 23px;
      }

      #vybe-toast .vybe-toast-content {
        flex: 1;
        min-width: 0;
      }

      #vybe-toast .vybe-toast-title {
        margin: 0 0 5px;
        color: #fff;
        font-size: 15px;
        font-weight: 750;
        letter-spacing: -.2px;
      }

      #vybe-toast .vybe-toast-message {
        margin: 0;
        color: #D8CBEA;
        font-size: 12.5px;
        line-height: 1.55;
        overflow-wrap: anywhere;
      }

      #vybe-toast .vybe-toast-close {
        align-self: flex-start;
        flex-shrink: 0;
        padding: 2px 4px;
        border: 0;
        border-radius: 7px;
        background: transparent;
        color: #CFC0E6;
        font-size: 19px;
        line-height: 1;
        cursor: pointer;
      }

      #vybe-toast .vybe-toast-close:hover {
        background: rgba(255,255,255,.1);
        color: #fff;
      }

      #vybe-toast .vybe-toast-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        width: 100%;
        background: linear-gradient(90deg,#A78BFA,#E9D5FF);
        transform-origin: left;
        animation: vybeToastProgress 4.2s linear forwards;
      }

      @keyframes vybeToastEnter {
        from { opacity: 0; transform: translate3d(24px,-8px,0) scale(.96); }
        to { opacity: 1; transform: translate3d(0,0,0) scale(1); }
      }

      @keyframes vybeToastLeave {
        from { opacity: 1; transform: translate3d(0,0,0) scale(1); }
        to { opacity: 0; transform: translate3d(18px,-5px,0) scale(.97); }
      }

      @keyframes vybeToastProgress {
        from { transform: scaleX(1); }
        to { transform: scaleX(0); }
      }

      @media(max-width:480px) {
        #vybe-toast {
          top: 14px;
          right: 12px;
          width: calc(100vw - 24px);
          padding: 15px;
          gap: 11px;
          border-radius: 17px;
        }

        #vybe-toast .vybe-toast-icon {
          width: 43px;
          height: 43px;
          min-width: 43px;
          border-radius: 13px;
        }
      }

      @media(prefers-reduced-motion:reduce) {
        #vybe-toast,
        #vybe-toast .vybe-toast-progress {
          animation-duration: .01ms !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  const toast = document.createElement("div");
  toast.id = "vybe-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  const icon = document.createElement("div");
  icon.className = "vybe-toast-icon";
  icon.textContent = config.icon;
  icon.style.color = config.color;

  const content = document.createElement("div");
  content.className = "vybe-toast-content";

  const title = document.createElement("div");
  title.className = "vybe-toast-title";
  title.textContent = config.title;

  const message = document.createElement("p");
  message.className = "vybe-toast-message";
  message.textContent = customMessage || config.message;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "vybe-toast-close";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Close notification");

  const progress = document.createElement("div");
  progress.className = "vybe-toast-progress";

  content.append(title, message);
  toast.append(icon, content, closeButton, progress);
  document.body.appendChild(toast);

  function dismissToast() {
    if (!toast.isConnected) return;

    clearTimeout(toast.dismissTimer);
    toast.style.animation = "vybeToastLeave .3s ease forwards";

    setTimeout(() => toast.remove(), 320);
  }

  closeButton.addEventListener("click", dismissToast);

  toast.dismissTimer = setTimeout(dismissToast, 4200);
}

/* ================= HELPERS ================= */

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function showAuthMessage(message, type = "error") {
  if (!authMessage) return;

  authMessage.textContent = message;
  authMessage.classList.toggle("success", type === "success");
}

function clearAuthMessage() {
  if (!authMessage) return;

  authMessage.textContent = "";
  authMessage.classList.remove("success");
}

function showFirebaseError(label, error) {
  console.error(label, error);
}

function closeMobileMenu() {
  if (!navLinks || !mobileMenuBtn) return;

  navLinks.classList.remove("mobile-open");
  mobileMenuBtn.innerHTML = '<i data-lucide="menu"></i>';
  mobileMenuBtn.setAttribute("aria-expanded", "false");
  refreshIcons();
}


/* ================= AUTH MODAL ================= */

function openAuthModal(mode = "login") {
  if (!authModal) return;

  setAuthMode(mode);
  authModal.classList.add("is-open");
  authModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  closeMobileMenu();

  setTimeout(() => {
    (mode === "signup" ? nameInput : emailInput)?.focus();
  }, 150);
}

function closeAuthModal() {
  if (!authModal) return;

  authModal.classList.remove("is-open");
  authModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  clearAuthMessage();
}

function setAuthMode(mode) {
  authMode = mode;

  const signup = mode === "signup";

  loginTab?.classList.toggle("active", !signup);
  signupTab?.classList.toggle("active", signup);

  if (nameField) nameField.hidden = !signup;
  if (nameInput) nameInput.required = signup;

  if (authTitle) {
    authTitle.textContent = signup ? "Create your space." : "Welcome back.";
  }

  if (authSubtitle) {
    authSubtitle.textContent = signup
      ? "Join VYBE and connect with your people."
      : "Sign in to reconnect with your people.";
  }

  if (submitBtnText) {
    submitBtnText.textContent = signup
      ? "Create my account"
      : "Sign in to VYBE";
  }

  if (passwordInput) {
    passwordInput.value = "";
    passwordInput.type = "password";
    passwordInput.autocomplete = signup ? "new-password" : "current-password";
  }

  if (passwordToggle) {
    passwordToggle.innerHTML = '<i data-lucide="eye"></i>';
    passwordToggle.setAttribute("aria-label", "Show password");
  }

  clearAuthMessage();
  refreshIcons();
}

$("#navSignIn")?.addEventListener("click", () => openAuthModal("login"));
$("#navGetStarted")?.addEventListener("click", () => openAuthModal("signup"));
$("#heroGetStarted")?.addEventListener("click", () => openAuthModal("signup"));
$("#bottomGetStarted")?.addEventListener("click", () => openAuthModal("signup"));
$("#closeAuthModal")?.addEventListener("click", closeAuthModal);

authModal?.addEventListener("click", (event) => {
  if (event.target === authModal) closeAuthModal();
});

loginTab?.addEventListener("click", () => setAuthMode("login"));
signupTab?.addEventListener("click", () => setAuthMode("signup"));

passwordToggle?.addEventListener("click", () => {
  if (!passwordInput) return;

  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";

  passwordToggle.innerHTML = show
    ? '<i data-lucide="eye-off"></i>'
    : '<i data-lucide="eye"></i>';

  refreshIcons();
});

[emailInput, passwordInput, nameInput].filter(Boolean).forEach((input) => {
  input.addEventListener("input", clearAuthMessage);
});

mobileMenuBtn?.addEventListener("click", () => {
  if (!navLinks) return;

  const open = navLinks.classList.toggle("mobile-open");

  mobileMenuBtn.innerHTML = open
    ? '<i data-lucide="x"></i>'
    : '<i data-lucide="menu"></i>';

  mobileMenuBtn.setAttribute("aria-expanded", String(open));
  refreshIcons();
});

$$(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    closeMobileMenu();
    $$(".nav-link").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAuthModal();
    closeMobileMenu();
    closeMessageDeleteMenu();
    closeAllReactionPickers();
  }
});

/* ================= USER PROFILE ================= */

async function repairMyVYBEProfile(user) {
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);

    const name =
      user.displayName ||
      snapshot.data()?.name ||
      user.email?.split("@")[0] ||
      "VYBE User";

    if (!snapshot.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        name,
        email: user.email || "",
        createdAt: serverTimestamp()
      });
      return;
    }

    const profile = snapshot.data();

    if (
      !profile.name ||
      profile.uid !== user.uid ||
      profile.email !== (user.email || "")
    ) {
      await setDoc(userRef, {
        uid: user.uid,
        name,
        email: user.email || ""
      }, { merge: true });
    }
  } catch (error) {
    showFirebaseError("Profile repair error", error);
  }
}

/* ================= SIGNUP / LOGIN ================= */

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = nameInput?.value.trim() || "";
  const email = emailInput?.value.trim() || "";
  const password = passwordInput?.value || "";

  if (authMode === "signup" && !name) {
    showAuthMessage("Please enter your name.");
    return;
  }

  if (!email || !password) {
    showAuthMessage("Please fill in all required fields.");
    return;
  }

  if (password.length < 6) {
    showAuthMessage("Password must be at least 6 characters.");
    return;
  }

  const submittedMode = authMode;

  if (submitBtnText) submitBtnText.textContent = "Please wait...";
  clearAuthMessage();

  try {
    if (submittedMode === "signup") {
      const result = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(result.user, { displayName: name });

      await setDoc(doc(db, "users", result.user.uid), {
        uid: result.user.uid,
        name,
        email,
        createdAt: serverTimestamp()
      });

      showAuthMessage("Account created successfully! 💜", "success");
      showVybeAlert("signup");
    } else {
      const result = await signInWithEmailAndPassword(auth, email, password);

      await repairMyVYBEProfile(result.user);

      showAuthMessage("Login successful! 💜", "success");
      showVybeAlert("login");
    }

    authForm.reset();
    setTimeout(closeAuthModal, 700);
  } catch (error) {
    showFirebaseError("VYBE authentication error", error);

    const messages = {
      "auth/email-already-in-use": "This email already has an account. Please sign in.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/network-request-failed": "Network error. Check your internet.",
      "permission-denied": "Firestore permission denied. Check Firestore Rules."
    };

    showAuthMessage(messages[error.code] || error.message);
  } finally {
    if (submitBtnText) {
      submitBtnText.textContent =
        authMode === "signup" ? "Create my account" : "Sign in to VYBE";
    }
  }
});

/* ================= DASHBOARD ================= */

function showChatDashboard(user) {
  document.querySelectorAll(
    "body > .navbar, body > .hero, body > section, body > footer"
  ).forEach((element) => {
    if (element !== chatDashboard && !element.closest("#authModal")) {
      element.dataset.landingHidden = "true";
      element.hidden = true;
    }
  });

  if (chatDashboard) chatDashboard.hidden = false;

  const name = user.displayName || user.email?.split("@")[0] || "VYBE User";

  if ($("#currentUserName")) $("#currentUserName").textContent = name;
  if ($("#currentUserEmail")) $("#currentUserEmail").textContent = user.email || "";

  if ($("#currentUserAvatar")) {
    $("#currentUserAvatar").textContent = name.charAt(0).toUpperCase();
  }

  if ($("#chatWelcome")) $("#chatWelcome").hidden = false;
  if ($("#activeChat")) $("#activeChat").hidden = true;

  setupMediaComposer();
  refreshIcons();
}

function showLandingPage() {
  if (chatDashboard) chatDashboard.hidden = true;

  document.querySelectorAll("[data-landing-hidden='true']").forEach((element) => {
    element.hidden = false;
    delete element.dataset.landingHidden;
  });

  closeAuthModal();
}

/* ================= USERS LIST ================= */

function renderUsers(searchText = "") {
  if (!usersList || !auth.currentUser) return;

  const search = searchText.trim().toLowerCase();
  const currentUid = auth.currentUser.uid;

  const filtered = allVYBEUsers.filter((person) => {
    const name = (person.name || "").toLowerCase();
    const email = (person.email || "").toLowerCase();

    return person.uid !== currentUid &&
      (name.includes(search) || email.includes(search));
  });

  usersList.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-chat-text";
    empty.textContent = search
      ? "No users match your search."
      : "No other users yet. Sign up with another account to start a chat.";

    usersList.appendChild(empty);
    return;
  }

  filtered.forEach((person) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vybe-person";

    const avatar = document.createElement("span");
    avatar.className = "vybe-person-avatar";
    avatar.textContent = (person.name || person.email || "?").charAt(0).toUpperCase();

    const info = document.createElement("span");
    info.className = "vybe-person-info";

    const name = document.createElement("strong");
    name.className = "vybe-person-name";
    name.textContent = person.name || "VYBE User";

    const email = document.createElement("small");
    email.className = "vybe-person-email";
    email.textContent = person.email || "";

    const arrow = document.createElement("span");
    arrow.className = "vybe-person-arrow";
    arrow.textContent = "›";

    info.append(name, email);
    button.append(avatar, info, arrow);
    button.addEventListener("click", () => openVYBEChat(person));

    usersList.appendChild(button);
  });
}

function listenForVYBEUsers() {
  if (!auth.currentUser || !usersList) return;

  if (stopUsersListener) stopUsersListener();

  usersList.textContent = "Loading people...";

  stopUsersListener = onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      allVYBEUsers = snapshot.docs.map((item) => ({
        uid: item.id,
        ...item.data()
      }));

      renderUsers(userSearch?.value || "");
    },
    (error) => {
      showFirebaseError("Users loading error", error);
      usersList.textContent = "Could not load users. Check Firestore Rules.";
    }
  );
}

userSearch?.addEventListener("input", () => renderUsers(userSearch.value));

/* ================= CHAT ID ================= */

function makeChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

/* ================= CLOUDINARY UPLOAD ================= */

async function uploadToCloudinary(file, resourceType) {
  if (!file) throw new Error("No file selected.");

  const endpoint =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Cloudinary upload error:", data);
    throw new Error(data.error?.message || "Cloudinary upload failed.");
  }

  if (!data.secure_url) throw new Error("Cloudinary did not return a file URL.");

  return data.secure_url;
}

/* ================= SAVE MEDIA MESSAGE ================= */

async function saveMediaMessage(chatId, type, mediaUrl) {
  const user = auth.currentUser;

  if (!user || !chatId || !mediaUrl) {
    throw new Error("User, chat ID, or media URL is missing.");
  }

  if (!["image", "audio"].includes(type)) {
    throw new Error("Unsupported media type.");
  }

  if (!mediaUrl.startsWith("https://res.cloudinary.com/")) {
    throw new Error("Invalid Cloudinary media URL.");
  }

  const chatRef = doc(db, "chats", chatId);
  const chatSnapshot = await getDoc(chatRef);

  if (!chatSnapshot.exists()) {
    throw new Error("Chat document is missing. Reopen the conversation.");
  }

  const participants = chatSnapshot.data().participants || [];

  if (!participants.includes(user.uid)) {
    throw new Error("You are not a participant in this chat.");
  }

  await addDoc(collection(db, "chats", chatId, "messages"), {
    senderId: user.uid,
    text: "",
    type,
    mediaUrl,
    createdAt: serverTimestamp()
  });
}

/* ================= DELETE MENU ================= */

function closeMessageDeleteMenu() {
  if (activeDeleteMenu) {
    activeDeleteMenu.remove();
    activeDeleteMenu = null;
  }
}

async function deleteMessageForMe(message) {
  const user = auth.currentUser;
  if (!user || !message.id || !message.chatId) return;

  try {
    await updateDoc(
      doc(db, "chats", message.chatId, "messages", message.id),
      { hiddenFor: arrayUnion(user.uid) }
    );

    closeMessageDeleteMenu();
  } catch (error) {
    showFirebaseError("Delete for me error", error);
    alert("Message hide nahi hua. Firestore Rules check karo.");
  }
}

async function deleteMessageForEveryone(message) {
  const user = auth.currentUser;

  if (
    !user ||
    !message.id ||
    !message.chatId ||
    message.senderId !== user.uid
  ) return;

  if (!window.confirm("Kya tum ye message sab ke liye delete karna chahti ho?")) {
    return;
  }

  try {
    await deleteDoc(doc(db, "chats", message.chatId, "messages", message.id));
    closeMessageDeleteMenu();
  } catch (error) {
    showFirebaseError("Delete for everyone error", error);
    alert("Message delete nahi hua. Firestore Rules check karo.");
  }
}

function showMessageDeleteMenu(event, message) {
  closeMessageDeleteMenu();

  const user = auth.currentUser;
  if (!user || !message.id || !message.chatId) return;

  const menu = document.createElement("div");
  menu.className = "vybe-delete-menu";

  const heading = document.createElement("div");
  heading.className = "vybe-delete-menu-heading";
  heading.textContent = "Message options";
  menu.appendChild(heading);

  function addMenuButton(label, action, danger = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;

    if (danger) button.classList.add("danger");

    button.addEventListener("click", action);
    menu.appendChild(button);
  }

  addMenuButton("Delete for me", () => deleteMessageForMe(message), true);

  if (message.senderId === user.uid) {
    addMenuButton("Delete for everyone", () => deleteMessageForEveryone(message), true);
  }

  addMenuButton("Cancel", closeMessageDeleteMenu);

  document.body.appendChild(menu);
  activeDeleteMenu = menu;

  const x = event.clientX ?? 20;
  const y = event.clientY ?? 20;

  menu.style.left =
    `${Math.max(8, Math.min(x, window.innerWidth - menu.offsetWidth - 8))}px`;

  menu.style.top =
    `${Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8))}px`;
}

document.addEventListener("click", (event) => {
  if (activeDeleteMenu && !activeDeleteMenu.contains(event.target)) {
    closeMessageDeleteMenu();
  }
});

/* ================= PREMIUM MESSAGE REACTIONS ================= */

const VYBE_REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

function closeAllReactionPickers() {
  document.querySelectorAll(".vybe-floating-reaction-picker").forEach((picker) => {
    picker.style.display = "none";
  });
}

async function toggleMessageReaction(message, emoji) {
  const user = auth.currentUser;

  if (!user || !message.id || !message.chatId) return;

  const messageRef = doc(
    db,
    "chats",
    message.chatId,
    "messages",
    message.id
  );

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(messageRef);

      if (!snapshot.exists()) return;

      const reactions = Array.isArray(snapshot.data().reactions)
        ? snapshot.data().reactions
        : [];

      const alreadyReacted = reactions.some(
        (reaction) => reaction.uid === user.uid && reaction.emoji === emoji
      );

      const updatedReactions = alreadyReacted
        ? reactions.filter(
            (reaction) =>
              !(reaction.uid === user.uid && reaction.emoji === emoji)
          )
        : [
            ...reactions.filter((reaction) => reaction.uid !== user.uid),
            { uid: user.uid, emoji }
          ];

      transaction.update(messageRef, {
        reactions: updatedReactions
      });
    });
  } catch (error) {
    showFirebaseError("Reaction error", error);
    alert(
      error.code === "permission-denied"
        ? "Reaction permission denied. Firestore Rules check karo."
        : "Reaction save nahi hui. Dobara try karo."
    );
  }
}

function renderMessageReactions(message, row) {
  const reactions = Array.isArray(message.reactions)
    ? message.reactions
    : [];

  row.style.flexWrap = "wrap";
  row.style.alignItems = "flex-start";

  const reactionWrap = document.createElement("div");
  reactionWrap.className = "vybe-reaction-wrap";

  reactionWrap.style.cssText = `
    display:flex;
    align-items:center;
    gap:6px;
    flex-wrap:wrap;
    width:100%;
    flex-basis:100%;
    order:2;
    margin:3px 0 10px;
    position:relative;
  `;

  const usedEmojis = [...new Set(reactions.map((reaction) => reaction.emoji))];

  usedEmojis.forEach((emoji) => {
    const matching = reactions.filter((reaction) => reaction.emoji === emoji);

    const mine = matching.some(
      (reaction) => reaction.uid === auth.currentUser?.uid
    );

    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "vybe-reaction-pill";
    pill.textContent = `${emoji} ${matching.length}`;
    pill.title = mine ? "Remove your reaction" : `React with ${emoji}`;
    pill.setAttribute("aria-pressed", String(mine));

    pill.style.cssText = `
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:5px;
      min-height:31px;
      padding:5px 11px;
      border-radius:20px;
      border:1px solid ${mine ? "#A875FF" : "#443753"};
      background:${mine ? "linear-gradient(135deg,#55317B,#34234D)" : "#241D2F"};
      color:#FFFFFF;
      font-size:13px;
      font-weight:600;
      cursor:pointer;
      box-shadow:${mine ? "0 0 13px rgba(168,117,255,.25)" : "0 2px 8px rgba(0,0,0,.12)"};
      transition:transform .18s ease,background .18s ease,border-color .18s ease;
    `;

    pill.addEventListener("mouseenter", () => {
      pill.style.transform = "translateY(-2px) scale(1.04)";
      pill.style.borderColor = "#C4A4FF";
    });

    pill.addEventListener("mouseleave", () => {
      pill.style.transform = "translateY(0) scale(1)";
      pill.style.borderColor = mine ? "#A875FF" : "#443753";
    });

    pill.addEventListener("click", () => {
      toggleMessageReaction(message, emoji);
    });

    reactionWrap.appendChild(pill);
  });

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "vybe-add-reaction";
  addButton.textContent = "＋ 😊";
  addButton.title = "Add a reaction";
  addButton.setAttribute("aria-label", "Add a reaction");

  addButton.style.cssText = `
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-height:31px;
    padding:5px 11px;
    border-radius:20px;
    border:1px solid #443753;
    background:#241D2F;
    color:#DCCBFF;
    font-size:13px;
    cursor:pointer;
    transition:all .18s ease;
  `;

  addButton.addEventListener("mouseenter", () => {
    addButton.style.background = "#38264F";
    addButton.style.borderColor = "#A875FF";
    addButton.style.transform = "translateY(-2px)";
  });

  addButton.addEventListener("mouseleave", () => {
    addButton.style.background = "#241D2F";
    addButton.style.borderColor = "#443753";
    addButton.style.transform = "translateY(0)";
  });

  const picker = document.createElement("div");
  picker.className = "vybe-floating-reaction-picker";

  picker.style.cssText = `
    display:none;
    position:absolute;
    left:0;
    bottom:42px;
    z-index:1000;
    align-items:center;
    gap:4px;
    padding:8px;
    border:1px solid #514064;
    border-radius:18px;
    background:#211A2C;
    box-shadow:0 10px 30px rgba(0,0,0,.35);
    animation:vybeReactionPop .16s ease-out;
  `;

  VYBE_REACTIONS.forEach((emoji) => {
    const emojiButton = document.createElement("button");
    emojiButton.type = "button";
    emojiButton.className = "vybe-reaction-choice";
    emojiButton.textContent = emoji;
    emojiButton.title = `React with ${emoji}`;

    emojiButton.style.cssText = `
      border:0;
      border-radius:10px;
      background:transparent;
      padding:7px;
      font-size:20px;
      cursor:pointer;
      transition:transform .15s ease,background .15s ease;
    `;

    emojiButton.addEventListener("mouseenter", () => {
      emojiButton.style.transform = "scale(1.25)";
      emojiButton.style.background = "#38264F";
    });

    emojiButton.addEventListener("mouseleave", () => {
      emojiButton.style.transform = "scale(1)";
      emojiButton.style.background = "transparent";
    });

    emojiButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      picker.style.display = "none";
      await toggleMessageReaction(message, emoji);
    });

    picker.appendChild(emojiButton);
  });

  addButton.addEventListener("click", (event) => {
    event.stopPropagation();

    const isOpen = picker.style.display === "flex";
    closeAllReactionPickers();
    picker.style.display = isOpen ? "none" : "flex";
  });

  picker.addEventListener("click", (event) => event.stopPropagation());

  reactionWrap.append(addButton, picker);
  row.appendChild(reactionWrap);
}

/* ================= DISPLAY MESSAGES ================= */

function addMessageToScreen(message) {
  if (!messagesList || !auth.currentUser) return;

  const user = auth.currentUser;

  if (
    Array.isArray(message.hiddenFor) &&
    message.hiddenFor.includes(user.uid)
  ) return;

  const row = document.createElement("div");
  row.className = message.senderId === user.uid
    ? "vybe-message-row mine"
    : "vybe-message-row theirs";

  const bubble = document.createElement("div");
  bubble.className = "vybe-message-bubble";

  if (message.type === "image" && message.mediaUrl) {
    bubble.classList.add("media-bubble");

    const image = document.createElement("img");
    image.className = "vybe-chat-image";
    image.src = message.mediaUrl;
    image.alt = "Shared image";
    image.loading = "lazy";

    image.addEventListener("click", () => {
      window.open(message.mediaUrl, "_blank", "noopener,noreferrer");
    });

    bubble.appendChild(image);
  } else if (message.type === "audio" && message.mediaUrl) {
    bubble.classList.add("media-bubble");

    const wrapper = document.createElement("div");
    wrapper.className = "vybe-audio-message";

    const microphone = document.createElement("span");
    microphone.className = "vybe-audio-icon";
    microphone.textContent = "🎤";

    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "metadata";
    audio.src = message.mediaUrl;

    wrapper.append(microphone, audio);
    bubble.appendChild(wrapper);
  } else {
    bubble.textContent = message.text || "";
  }

  row.appendChild(bubble);

  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "vybe-message-menu-button";
  menuButton.textContent = "⋮";
  menuButton.title = "Message options";
  menuButton.setAttribute("aria-label", "Message options");

  menuButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const rect = menuButton.getBoundingClientRect();

    showMessageDeleteMenu({
      clientX: rect.left,
      clientY: rect.bottom,
      preventDefault() {}
    }, message);
  });

  row.appendChild(menuButton);
  renderMessageReactions(message, row);

  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showMessageDeleteMenu(event, message);
  });

  let pressTimer;

  row.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    pressTimer = setTimeout(() => {
      showMessageDeleteMenu({
        clientX: x,
        clientY: y,
        preventDefault() {}
      }, message);
    }, 650);
  }, { passive: true });

  ["touchend", "touchmove", "touchcancel"].forEach((type) => {
    row.addEventListener(type, () => clearTimeout(pressTimer), {
      passive: true
    });
  });

  messagesList.appendChild(row);
}

/* ================= OPEN CHAT ================= */

async function openVYBEChat(person) {
  const user = auth.currentUser;
  if (!user || !person?.uid) return;

  const chatId = makeChatId(user.uid, person.uid);
  const token = ++chatOpenToken;

  activeChatId = chatId;
  closeMessageDeleteMenu();
  closeAllReactionPickers();

  if (stopMessagesListener) {
    stopMessagesListener();
    stopMessagesListener = null;
  }

  if ($("#chatWelcome")) $("#chatWelcome").hidden = true;
  if ($("#activeChat")) $("#activeChat").hidden = false;

  if ($("#activeChatName")) {
    $("#activeChatName").textContent = person.name || person.email || "VYBE User";
  }

  if ($("#activeChatAvatar")) {
    $("#activeChatAvatar").textContent =
      (person.name || person.email || "?").charAt(0).toUpperCase();
  }

  if ($("#activeChatStatus")) {
    $("#activeChatStatus").textContent = person.email || "VYBE conversation";
  }

  if (messagesList) messagesList.textContent = "Loading messages...";

  try {
    const chatRef = doc(db, "chats", chatId);
    const chatSnapshot = await getDoc(chatRef);

    if (!chatSnapshot.exists()) {
      await setDoc(chatRef, {
        participants: [user.uid, person.uid].sort(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      const participants = chatSnapshot.data().participants || [];

      if (!participants.includes(user.uid) || !participants.includes(person.uid)) {
        throw new Error("Chat participants do not match.");
      }
    }

    if (activeChatId !== chatId || token !== chatOpenToken) return;

    const messagesQuery = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    stopMessagesListener = onSnapshot(messagesQuery, (snapshot) => {
      if (!messagesList || activeChatId !== chatId || token !== chatOpenToken) {
        return;
      }

      messagesList.replaceChildren();

      if (snapshot.empty) {
        const empty = document.createElement("p");
        empty.className = "empty-chat-text";
        empty.textContent = "Say hello 💜 Send your first message!";
        messagesList.appendChild(empty);
        return;
      }

      snapshot.forEach((item) => {
        addMessageToScreen({
          ...item.data(),
          id: item.id,
          chatId
        });
      });

      if (!messagesList.children.length) {
        const empty = document.createElement("p");
        empty.className = "empty-chat-text";
        empty.textContent = "No messages here. Send a message 💜";
        messagesList.appendChild(empty);
      }

      messagesList.scrollTop = messagesList.scrollHeight;
    }, (error) => {
      showFirebaseError("Messages loading error", error);

      if (messagesList) {
        messagesList.textContent =
          "Could not load messages. Check Firestore Rules.";
      }
    });
  } catch (error) {
    showFirebaseError("Opening chat error", error);

    if (messagesList) {
      messagesList.textContent = `Could not open chat: ${error.message}`;
    }
  }

  refreshIcons();
}

/* ================= IMAGE PICKER ================= */

function openImagePicker() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/jpeg,image/png,image/webp,image/gif";
  input.hidden = true;

  document.body.appendChild(input);

  input.addEventListener("change", async () => {
    const file = input.files?.[0];

    if (!file) {
      input.remove();
      return;
    }

    const chatId = activeChatId;

    if (!chatId) {
      alert("Pehle kisi user ki chat open karo.");
      input.remove();
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("Image 10MB se choti honi chahiye.");
      input.remove();
      return;
    }

    try {
      setMediaButtonsDisabled(true);
      setComposerStatus("Uploading image...");

      const url = await uploadToCloudinary(file, "image");
      await saveMediaMessage(chatId, "image", url);

      setComposerStatus("Image sent ✓");
    } catch (error) {
      console.error("Image send error:", error);
      alert(`Image send nahi hui: ${error.message}`);
      setComposerStatus("");
    } finally {
      setMediaButtonsDisabled(false);
      input.remove();
      setTimeout(() => setComposerStatus(""), 2000);
    }
  });

  input.click();
}

/* ================= VOICE RECORDING ================= */

function getSupportedAudioMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus"
  ];

  return types.find((type) =>
    window.MediaRecorder && MediaRecorder.isTypeSupported(type)
  ) || "";
}

async function startVoiceRecording() {
  if (!activeChatId) {
    alert("Pehle kisi user ki chat open karo.");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    alert("Your browser does not support voice recording.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getSupportedAudioMimeType();

    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    audioChunks = [];
    recordingSeconds = 0;

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size > 0) audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", async () => {
      stream.getTracks().forEach((track) => track.stop());
      clearInterval(recordingTimer);

      const blob = new Blob(audioChunks, {
        type: mediaRecorder?.mimeType || "audio/webm"
      });

      mediaRecorder = null;
      await sendRecordedAudio(blob);
    });

    mediaRecorder.start();
    updateRecordingUI(true);

    recordingTimer = setInterval(() => {
      recordingSeconds++;
      updateRecordingTime();

      if (recordingSeconds >= 60) stopVoiceRecording();
    }, 1000);
  } catch (error) {
    console.error("Microphone error:", error);

    alert(error.name === "NotAllowedError"
      ? "Microphone permission allow karo phir voice message send hoga."
      : "Microphone start nahi ho saka.");
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    updateRecordingUI(false, "Uploading voice...");
  }
}

async function sendRecordedAudio(blob) {
  const chatId = activeChatId;

  if (!chatId) {
    setComposerStatus("");
    return;
  }

  try {
    setMediaButtonsDisabled(true);
    setComposerStatus("Uploading voice...");

    const url = await uploadToCloudinary(blob, "video");
    await saveMediaMessage(chatId, "audio", url);

    setComposerStatus("Voice sent ✓");
  } catch (error) {
    console.error("Voice send error:", error);
    alert(`Voice nahi bheji gayi: ${error.message}`);
    setComposerStatus("");
  } finally {
    setMediaButtonsDisabled(false);
    updateRecordingUI(false);
    setTimeout(() => setComposerStatus(""), 2000);
  }
}

/* ================= MEDIA COMPOSER ================= */

function setupMediaComposer() {
  if (!messageForm || messageForm.dataset.mediaReady === "true") return;

  messageForm.dataset.mediaReady = "true";

  if (messageInput) messageInput.required = false;

  const imageButton = document.createElement("button");
  imageButton.type = "button";
  imageButton.className = "vybe-media-btn vybe-image-btn";
  imageButton.title = "Send image";
  imageButton.setAttribute("aria-label", "Send image");
  imageButton.innerHTML = '<i data-lucide="image"></i>';
  imageButton.addEventListener("click", openImagePicker);

  const voiceButton = document.createElement("button");
  voiceButton.type = "button";
  voiceButton.className = "vybe-media-btn vybe-voice-btn";
  voiceButton.title = "Record voice";
  voiceButton.setAttribute("aria-label", "Record voice");
  voiceButton.innerHTML = '<i data-lucide="mic"></i>';

  voiceButton.addEventListener("click", () => {
    if (mediaRecorder?.state === "recording") {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  });

  const status = document.createElement("span");
  status.id = "vybeComposerStatus";
  status.className = "vybe-composer-status";

  if (messageInput) {
    messageForm.insertBefore(imageButton, messageInput);
    messageForm.insertBefore(voiceButton, messageInput);
  } else {
    messageForm.prepend(imageButton, voiceButton);
  }

  messageForm.appendChild(status);

  addMediaStyles();
  setupEmojiPicker();
  refreshIcons();
}

function setComposerStatus(text) {
  const status = $("#vybeComposerStatus");
  if (status) status.textContent = text || "";
}

function updateRecordingTime() {
  const status = $("#vybeComposerStatus");
  if (!status) return;

  const minutes = String(Math.floor(recordingSeconds / 60)).padStart(2, "0");
  const seconds = String(recordingSeconds % 60).padStart(2, "0");

  status.textContent = `🔴 Recording ${minutes}:${seconds} — tap mic to stop`;
}

function updateRecordingUI(recording, statusText = "") {
  const button = $(".vybe-voice-btn");
  if (!button) return;

  if (recording) {
    button.classList.add("recording");
    button.innerHTML = '<i data-lucide="square"></i>';
    button.title = "Stop recording";
  } else {
    button.classList.remove("recording");
    button.innerHTML = '<i data-lucide="mic"></i>';
    button.title = "Record voice";

    if (statusText) setComposerStatus(statusText);
  }

  refreshIcons();
}

function setMediaButtonsDisabled(disabled) {
  const imageButton = $(".vybe-image-btn");
  const voiceButton = $(".vybe-voice-btn");

  if (imageButton) imageButton.disabled = disabled;
  if (voiceButton) voiceButton.disabled = disabled;
}

/* ================= MEDIA + REACTION CSS ================= */

function addMediaStyles() {
  if ($("#vybeMediaStyles")) return;

  const style = document.createElement("style");
  style.id = "vybeMediaStyles";

  style.textContent = `
    .vybe-media-btn {
      width:42px;height:42px;min-width:42px;
      border:none;border-radius:12px;
      background:#f3f1f7;color:#6d4aff;
      display:inline-flex;align-items:center;justify-content:center;
      cursor:pointer;transition:all .2s ease;
    }

    .vybe-media-btn:hover {
      background:#e9e3ff;transform:translateY(-1px);
    }

    .vybe-media-btn:disabled {
      opacity:.5;cursor:not-allowed;transform:none;
    }

    .vybe-voice-btn.recording {
      background:#ffeded;color:#e53935;
      animation:vybePulse 1s infinite;
    }

    .vybe-composer-status {
      position:absolute;left:50%;bottom:100%;
      transform:translateX(-50%);margin-bottom:8px;
      font-size:12px;color:#777;white-space:nowrap;
      pointer-events:none;
    }

    .vybe-message-row {
      position:relative;display:flex;align-items:flex-start;
      gap:5px;-webkit-touch-callout:none;
    }

    .vybe-message-menu-button {
      display:inline-flex;align-items:center;justify-content:center;
      flex-shrink:0;width:30px;height:34px;margin:2px 0;
      padding:0;border:1px solid #e8e0ff;border-radius:9px;
      background:#f7f4ff;color:#6d4aff;font-size:24px;
      line-height:1;cursor:pointer;
    }

    .vybe-message-menu-button:hover { background:#e9e0ff; }

    .vybe-message-bubble.media-bubble {
      padding:6px;overflow:hidden;
    }

    .vybe-chat-image {
      display:block;width:min(260px,100%);
      max-height:330px;object-fit:cover;
      border-radius:12px;cursor:pointer;
    }

    .vybe-audio-message {
      display:flex;align-items:center;gap:8px;min-width:240px;
    }

    .vybe-audio-icon { font-size:20px; }

    .vybe-audio-message audio {
      width:210px;max-width:100%;height:38px;
    }

    .vybe-delete-menu {
      position:fixed;z-index:99999;min-width:190px;padding:7px;
      border:1px solid #e9e5f2;border-radius:14px;background:#fff;
      box-shadow:0 12px 35px rgba(25,15,55,.18);
      display:flex;flex-direction:column;gap:3px;font-family:inherit;
    }

    .vybe-delete-menu-heading {
      padding:9px 11px;color:#777080;font-size:11px;
      font-weight:700;text-transform:uppercase;letter-spacing:.08em;
    }

    .vybe-delete-menu button {
      width:100%;border:0;border-radius:9px;padding:11px;
      text-align:left;background:transparent;color:#292333;
      font:inherit;font-size:13px;cursor:pointer;
    }

    .vybe-delete-menu button:hover { background:#f3f0fa; }
    .vybe-delete-menu button.danger { color:#d93650; }
    .vybe-delete-menu button.danger:hover { background:#fff0f2; }

    .vybe-reaction-wrap { isolation:isolate; }

    .vybe-reaction-pill,
    .vybe-add-reaction {
      -webkit-tap-highlight-color:transparent;
      user-select:none;
    }

    .vybe-reaction-pill:focus-visible,
    .vybe-add-reaction:focus-visible,
    .vybe-reaction-choice:focus-visible {
      outline:2px solid #B995FF;
      outline-offset:2px;
    }

    @keyframes vybePulse {
      0%,100% { transform:scale(1); }
      50% { transform:scale(1.06); }
    }

    @keyframes vybeReactionPop {
      from { opacity:0;transform:translateY(5px) scale(.94); }
      to { opacity:1;transform:translateY(0) scale(1); }
    }

    @media(max-width:600px) {
      .vybe-media-btn { width:38px;height:38px;min-width:38px; }
      .vybe-chat-image { width:min(220px,100%); }
      .vybe-audio-message { min-width:190px; }
      .vybe-audio-message audio { width:165px; }
      .vybe-composer-status { font-size:11px; }
      .vybe-floating-reaction-picker {
        max-width:calc(100vw - 48px);
        flex-wrap:wrap;
      }
    }
  `;

  document.head.appendChild(style);
}

/* ================= VYBE EMOJI PICKER ================= */

function setupEmojiPicker() {
  if (!messageForm || !messageInput || $("#vybeEmojiButton")) return;

  const emojiButton = document.createElement("button");
  emojiButton.type = "button";
  emojiButton.id = "vybeEmojiButton";
  emojiButton.textContent = "😊";
  emojiButton.title = "Choose emoji";
  emojiButton.setAttribute("aria-label", "Choose emoji");

  emojiButton.style.cssText = `
    width:40px;height:40px;flex-shrink:0;
    border:0;border-radius:12px;
    background:#f0e9ff;font-size:22px;cursor:pointer;
  `;

  const picker = document.createElement("div");
  picker.id = "vybeEmojiPicker";
  picker.hidden = true;

  picker.style.cssText = `
    position:absolute;bottom:calc(100% + 10px);left:8px;
    z-index:9999;width:280px;max-width:calc(100vw - 40px);
    padding:12px;background:#fff;border:1px solid #eeeaf3;
    border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.15);
    display:grid;grid-template-columns:repeat(7,1fr);
    gap:5px;max-height:230px;overflow-y:auto;
  `;

  const emojis = [
    "😀","😃","😄","😁","😆","😂","🤣",
    "😊","😍","🥰","😘","😉","😎","🥳",
    "😭","🥹","😔","😴","🤔","😜","🤗",
    "❤️","🩷","💜","💙","💚","💛","🖤",
    "💕","💞","💖","💗","💋","💯","🔥",
    "✨","⭐","🌸","🌹","🦋","🎀","🌙",
    "👍","👎","👏","🙌","🫶","🙏","💪",
    "👀","🥺","😏","🤭","🤩","😇","💐"
  ];

  emojis.forEach((emoji) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = emoji;
    button.title = emoji;

    button.style.cssText = `
      border:0;background:transparent;border-radius:8px;
      padding:5px 2px;font-size:22px;cursor:pointer;
    `;

    button.addEventListener("mouseenter", () => {
      button.style.background = "#f0e9ff";
    });

    button.addEventListener("mouseleave", () => {
      button.style.background = "transparent";
    });

    button.addEventListener("click", () => {
      const start = messageInput.selectionStart ?? messageInput.value.length;
      const end = messageInput.selectionEnd ?? start;

      messageInput.value =
        messageInput.value.slice(0, start) +
        emoji +
        messageInput.value.slice(end);

      const cursor = start + emoji.length;

      messageInput.focus();
      messageInput.setSelectionRange(cursor, cursor);
      messageInput.dispatchEvent(new Event("input", { bubbles: true }));

      picker.hidden = true;
      picker.style.display = "none";
    });

    picker.appendChild(button);
  });

  if (getComputedStyle(messageForm).position === "static") {
    messageForm.style.position = "relative";
  }

  emojiButton.addEventListener("click", () => {
    const opening = picker.hidden;
    picker.hidden = !opening;
    picker.style.display = opening ? "grid" : "none";
  });

  document.addEventListener("click", (event) => {
    if (
      !picker.hidden &&
      !picker.contains(event.target) &&
      !emojiButton.contains(event.target)
    ) {
      picker.hidden = true;
      picker.style.display = "none";
    }
  });

  messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      picker.hidden = true;
      picker.style.display = "none";
    }
  });

  messageForm.insertBefore(emojiButton, messageInput);
  messageForm.appendChild(picker);
}

/* ================= SEND TEXT MESSAGE ================= */

messageForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = messageInput?.value.trim() || "";
  const user = auth.currentUser;
  const chatId = activeChatId;

  if (!user || !chatId || !text) return;

  const button = messageForm.querySelector('button[type="submit"]');
  if (button) button.disabled = true;

  try {
    const chatSnapshot = await getDoc(doc(db, "chats", chatId));

    if (!chatSnapshot.exists()) {
      throw new Error("Chat document is missing. Open the conversation again.");
    }

    const participants = chatSnapshot.data().participants || [];

    if (!participants.includes(user.uid)) {
      throw new Error("Your account is not a participant in this chat.");
    }

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      type: "text",
      senderId: user.uid,
      createdAt: serverTimestamp()
    });

    if (activeChatId === chatId && messageInput) {
      messageInput.value = "";
      messageInput.focus();
    }
  } catch (error) {
    showFirebaseError("Sending message error", error);

    alert(
      error.code === "permission-denied"
        ? "Firebase permission denied. Check Firestore Rules."
        : `Message send nahi hua: ${error.message}`
    );
  } finally {
    if (button) button.disabled = false;
  }
});

/* ================= LOGOUT ================= */

$("#logoutBtn")?.addEventListener("click", async () => {
  try {
    if (stopUsersListener) stopUsersListener();
    if (stopMessagesListener) stopMessagesListener();

    if (mediaRecorder?.state === "recording") mediaRecorder.stop();

    clearInterval(recordingTimer);
    closeMessageDeleteMenu();
    closeAllReactionPickers();

    stopUsersListener = null;
    stopMessagesListener = null;
    activeChatId = null;
    chatOpenToken++;

    await signOut(auth);

    // Show the logout alert after Firebase confirms sign-out.
    showVybeAlert("logout");
  } catch (error) {
    showFirebaseError("Logout error", error);
    alert("Logout nahi hua. Please dobara try karo.");
  }
});

/* ================= AUTH STATE ================= */

onAuthStateChanged(auth, async (user) => {
  if (user) {
    showChatDashboard(user);
    await repairMyVYBEProfile(user);

    if (auth.currentUser?.uid === user.uid) {
      listenForVYBEUsers();
    }
  } else {
    if (stopUsersListener) stopUsersListener();
    if (stopMessagesListener) stopMessagesListener();

    stopUsersListener = null;
    stopMessagesListener = null;
    allVYBEUsers = [];
    activeChatId = null;
    chatOpenToken++;

    closeMessageDeleteMenu();
    closeAllReactionPickers();

    if (usersList) usersList.replaceChildren();
    if (messagesList) messagesList.replaceChildren();

    showLandingPage();
  }
});

/* ================= INITIALIZE ================= */

authModal?.setAttribute("aria-hidden", "true");
mobileMenuBtn?.setAttribute("aria-expanded", "false");

refreshIcons();

console.log(
  "💜 VYBE ready: text, image, voice, emoji picker, premium reactions, delete features and success alerts!"
);
