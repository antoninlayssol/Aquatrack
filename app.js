import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  get,
  push,
  onValue
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyA59CVLHSUyBqs_l1Zka6trBue6J01D1bc",
  authDomain: "projet-eau-84965.firebaseapp.com",
  databaseURL: "https://projet-eau-84965-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "projet-eau-84965",
  storageBucket: "projet-eau-84965.firebasestorage.app",
  messagingSenderId: "906648411400",
  appId: "1:906648411400:web:65497cacf365588606e0bd"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Initialisation de la liste des prénoms
let USERS = [
  { id: "u1", name: "Wang" },
  { id: "u2", name: "Shafiq" },
  { id: "u3", name: "Antonin" },
  { id: "u4", name: "Mehdi" }
];

const elements = {
  userName: document.getElementById("userName"),
  heroUserName: document.getElementById("heroUserName"),
  heroStatus: document.getElementById("heroStatus"),
  statusBadge: document.getElementById("statusBadge"),
  flow: document.getElementById("flow"),
  volume: document.getElementById("volume"),
  ringVolume: document.getElementById("ringVolume"),
  duration: document.getElementById("duration"),
  price: document.getElementById("price"),
  startTimeLabel: document.getElementById("startTimeLabel"),
  stopButton: document.getElementById("stopButton"),
  history: document.getElementById("history"),
  historyCount: document.getElementById("historyCount"),
  totalShowers: document.getElementById("totalShowers"),
  totalVolume: document.getElementById("totalVolume"),
  totalPrice: document.getElementById("totalPrice"),
  userStats: document.getElementById("userStats"),
  toast: document.getElementById("toast"),
  connectionStatus: document.getElementById("connectionStatus"),
  userGrid: document.getElementById("userGrid"),
  newUserName: document.getElementById("newUserName"),
  addUserButton: document.getElementById("addUserButton")
};

console.log("Firebase initialise avec succes");

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, decimals = 1) {
  return toNumber(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

function formatCurrency(value) {
  return toNumber(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatSessionPrice(value) {
  return toNumber(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 4
  });
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(toNumber(seconds)));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds} s`;
  }

  return `${minutes} min ${String(remainingSeconds).padStart(2, "0")} s`;
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function showToast(message) {
  if (!elements.toast) return;

  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2600);
}

function setActiveUser(userId) {
  document.querySelectorAll(".user-card").forEach((button) => {
    button.classList.toggle("active", button.dataset.userId === userId);
  });
}

function renderUserGrid() {
  elements.userGrid.innerHTML = USERS.map(user => `
    <button class="user-card" data-user-id="${user.id}" data-user-name="${user.name}">
      <span>${user.name}</span>
    </button>
  `).join('');

  elements.userGrid.querySelectorAll(".user-card").forEach((button) => {
    button.addEventListener("click", () => {
      window.startShower(button.dataset.userId, button.dataset.userName);
    });
  });
}

function handleAddUser() {
  const name = elements.newUserName.value.trim();
  if (!name) {
    showToast("Veuillez entrer un prénom valide");
    return;
  }

  const exists = USERS.some(user => user.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    showToast("Cet utilisateur existe déjà");
    return;
  }

  const newId = "u_" + Date.now();
  USERS.push({ id: newId, name: name });
  
  elements.newUserName.value = "";
  renderUserGrid();
  showToast(`${name} a été ajouté !`);

  get(ref(database, "currentSession")).then((snapshot) => {
    const session = snapshot.val();
    if (session && session.status === "running") {
      setActiveUser(session.userId);
    }
  });
}

elements.addUserButton.addEventListener("click", handleAddUser);
elements.newUserName.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleAddUser();
});

window.startShower = async function(userId, userName) {
  try {
    await set(ref(database, "currentSession"), {
      status: "running",
      userId: userId,
      userName: userName,
      flowLMin: 0,
      volumeLitres: 0,
      durationSeconds: 0,
      priceEuro: 0,
      startTime: new Date().toISOString()
    });

    showToast(`Douche demarree pour ${userName}`);
  } catch (error) {
    console.error("Erreur demarrage douche :", error);
    showToast("Erreur lors du demarrage");
  }
};

window.stopShower = async function() {
  try {
    const currentSessionRef = ref(database, "currentSession");
    const snapshot = await get(currentSessionRef);
    const session = snapshot.val();

    if (!session || session.status !== "running") {
      showToast("Aucune douche en cours");
      return;
    }

    const finishedSession = {
      ...session,
      status: "finished",
      endTime: new Date().toISOString()
    };

    await push(ref(database, "sessions"), finishedSession);

    await set(currentSessionRef, {
      status: "stopped",
      userId: "",
      userName: "",
      flowLMin: 0,
      volumeLitres: 0,
      durationSeconds: 0,
      priceEuro: 0
    });

    showToast("Douche enregistree dans l'historique");
  } catch (error) {
    console.error("Erreur arret douche :", error);
    showToast("Erreur lors de l'arret");
  }
};

function renderCurrentSession(data) {
  const session = data || {};
  const isRunning = session.status === "running";

  const userName = session.userName || "-";
  const status = session.status || "stopped";
  const volume = toNumber(session.volumeLitres);

  elements.userName.textContent = userName;
  elements.heroUserName.textContent = isRunning ? userName : "Aucune";
  elements.heroStatus.textContent = isRunning ? "Douche en cours" : "En attente";

  elements.statusBadge.textContent = status;
  elements.statusBadge.classList.toggle("running", isRunning);

  elements.flow.textContent = formatNumber(session.flowLMin, 1);
  elements.volume.textContent = formatNumber(volume, 1);
  elements.ringVolume.textContent = `${formatNumber(volume, 1)} L`;
  elements.duration.textContent = formatDuration(session.durationSeconds);
  elements.price.textContent = formatSessionPrice(session.priceEuro);

  elements.startTimeLabel.textContent = session.startTime
    ? `Debut : ${formatDate(session.startTime)}`
    : "Aucune session demarree";

  elements.stopButton.disabled = !isRunning;

  if (isRunning && session.userId && !USERS.some(u => u.id === session.userId)) {
    USERS.push({ id: session.userId, name: session.userName });
    renderUserGrid();
  }

  setActiveUser(isRunning ? session.userId : "");
}

function sessionArrayFromFirebase(sessions) {
  if (!sessions) return [];

  return Object.entries(sessions)
    .map(([id, session]) => ({ id, ...session }))
    .sort((a, b) => {
      const dateA = new Date(a.endTime || a.startTime || 0).getTime();
      const dateB = new Date(b.endTime || b.startTime || 0).getTime();
      return dateB - dateA;
    });
}

function renderHistory(sessionsObject) {
  const sessions = sessionArrayFromFirebase(sessionsObject);

  elements.historyCount.textContent = `${sessions.length} session${sessions.length > 1 ? "s" : ""}`;
  elements.totalShowers.textContent = sessions.length;

  const totalVolume = sessions.reduce((sum, session) => {
    return sum + toNumber(session.volumeLitres);
  }, 0);

  const totalPrice = sessions.reduce((sum, session) => {
    return sum + toNumber(session.priceEuro);
  }, 0);

  elements.totalVolume.textContent = formatNumber(totalVolume, 1);
  elements.totalPrice.textContent = formatCurrency(totalPrice);

  renderUserStats(sessions);

  if (sessions.length === 0) {
    elements.history.innerHTML = `<p class="empty-state">Aucune douche enregistree pour le moment.</p>`;
    return;
  }

  elements.history.innerHTML = sessions
    .map((session) => {
      const volume = formatNumber(session.volumeLitres, 1);
      const duration = formatDuration(session.durationSeconds);
      const price = formatSessionPrice(session.priceEuro);
      const date = formatDate(session.endTime || session.startTime);

      return `
        <article class="history-item">
          <header>
            <strong>${session.userName || "Utilisateur"}</strong>
            <span class="chip">${volume} L</span>
          </header>
          <div class="history-details">
            <span><small>Duree</small><b>${duration}</b></span>
            <span><small>Prix</small><b>${price} €</b></span>
            <span><small>Date</small><b>${date}</b></span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderUserStats(sessions) {
  const stats = USERS.map((user) => {
    const userSessions = sessions.filter((session) => {
      return session.userId === user.id || session.userName === user.name;
    });

    const volume = userSessions.reduce((sum, session) => {
      return sum + toNumber(session.volumeLitres);
    }, 0);

    // --- SYSTEME DE GAMIFICATION (XP & BADGES) ---
    let xp = 0;
    let badges = [];
    let hasEcoBadge = false;
    let hasFastBadge = false;

    userSessions.forEach(session => {
      xp += 10; // +10 XP par douche réalisée

      const vol = toNumber(session.volumeLitres);
      const dur = toNumber(session.durationSeconds);

      // Condition badge Économe (< 30 L)
      if (vol > 0 && vol < 30) {
        hasEcoBadge = true;
        xp += 15; // Bonus XP
      }

      // Condition badge Rapide (< 3 min)
      if (dur > 0 && dur < 180) {
        hasFastBadge = true;
        xp += 10; // Bonus XP
      }
    });

    if (hasEcoBadge) badges.push({ icon: "💧", title: "Économe" });
    if (hasFastBadge) badges.push({ icon: "⚡", title: "Rapide" });
    
    // Condition badge Éco-Héros (Plus de 5 douches enregistrées)
    if (userSessions.length >= 5) {
      badges.push({ icon: "🌱", title: "Éco-Héros" });
      xp += 50; 
    }

    // Progression par palier de 100 XP par niveau
    const level = Math.floor(xp / 100) + 1;
    const xpPercent = xp % 100;

    return {
      ...user,
      showers: userSessions.length,
      volume,
      xp,
      level,
      xpPercent,
      badges
    };
  });

  elements.userStats.innerHTML = stats
    .map((user) => {
      const badgesHtml = user.badges.length > 0 
        ? user.badges.map(b => `<span class="badge-pill" title="${b.title}">${b.icon} ${b.title}</span>`).join("")
        : `<span class="no-badge">Aucun badge</span>`;

      return `
        <div class="user-stat-card">
          <div class="user-stat-header">
            <strong>${user.name}</strong>
            <span class="level-tag">Niv. ${user.level}</span>
          </div>
          
          <div class="user-stat-meta">
            ${user.showers} douche${user.showers > 1 ? "s" : ""} · ${formatNumber(user.volume, 1)} L au total
          </div>

          <div class="xp-container">
            <div class="xp-labels">
              <span>Progression XP</span>