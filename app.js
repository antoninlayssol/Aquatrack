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

const USERS = [
  { id: "u1", name: "Shafiq" },
  { id: "u2", name: "Mehdi" },
  { id: "u3", name: "Antonin" },
  { id: "u4", name: "Marcus" }
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
  connectionStatus: document.getElementById("connectionStatus")
};

console.log("Firebase initialisé avec succès");

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
  window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function setActiveUser(userId) {
  document.querySelectorAll(".user-card").forEach((button) => {
    button.classList.toggle("active", button.dataset.userId === userId);
  });
}

window.startShower = async function(userId, userName) {
  try {
    await set(ref(database, "currentSession"), {
      status: "running",
      userId,
      userName,
      flowLMin: 0,
      volumeLitres: 0,
      durationSeconds: 0,
      priceEuro: 0,
      startTime: new Date().toISOString()
    });

    showToast(`Douche démarrée pour ${userName}`);
  } catch (error) {
    console.error("Erreur démarrage douche :", error);
    showToast("Erreur lors du démarrage");
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

    showToast("Douche enregistrée dans l’historique");
  } catch (error) {
    console.error("Erreur arrêt douche :", error);
    showToast("Erreur lors de l’arrêt");
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
  elements.price.textContent = formatCurrency(session.priceEuro);
  elements.startTimeLabel.textContent = session.startTime
    ? `Début : ${formatDate(session.startTime)}`
    : "Aucune session démarrée";
  elements.stopButton.disabled = !isRunning;

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

  const totalVolume = sessions.reduce((sum, session) => sum + toNumber(session.volumeLitres), 0);
  const totalPrice = sessions.reduce((sum, session) => sum + toNumber(session.priceEuro), 0);

  elements.totalVolume.textContent = formatNumber(totalVolume, 1);
  elements.totalPrice.textContent = formatCurrency(totalPrice);

  renderUserStats(sessions);

  if (sessions.length === 0) {
    elements.history.innerHTML = `<p class="empty-state">Aucune douche enregistrée pour le moment.</p>`;
    return;
  }

  elements.history.innerHTML = sessions
    .map((session) => {
      const volume = formatNumber(session.volumeLitres, 1);
      const duration = formatDuration(session.durationSeconds);
      const price = formatCurrency(session.priceEuro);
      const date = formatDate(session.endTime || session.startTime);

      return `
        <article class="history-item">
          <header>
            <strong>${session.userName || "Utilisateur"}</strong>
            <span class="chip">${volume} L</span>
          </header>
          <div class="history-details">
            <span><small>Durée</small><b>${duration}</b></span>
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
    const userSessions = sessions.filter((session) => session.userId === user.id || session.userName === user.name);
    const volume = userSessions.reduce((sum, session) => sum + toNumber(session.volumeLitres), 0);

    return {
      ...user,
      showers: userSessions.length,
      volume
    };
  });

  elements.userStats.innerHTML = stats
    .map((user) => `
      <div class="user-stat-row">
        <span>${user.name}</span>
        <small>${user.showers} douche${user.showers > 1 ? "s" : ""} · ${formatNumber(user.volume, 1)} L</small>
      </div>
    `)
    .join("");
}

document.querySelectorAll(".user-card").forEach((button) => {
  button.addEventListener("click", () => {
    window.startShower(button.dataset.userId, button.dataset.userName);
  });
});

elements.stopButton.addEventListener("click", window.stopShower);

onValue(ref(database, "currentSession"), (snapshot) => {
  renderCurrentSession(snapshot.val());
});

onValue(ref(database, "sessions"), (snapshot) => {
  renderHistory(snapshot.val());
});