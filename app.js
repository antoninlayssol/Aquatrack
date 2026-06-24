import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getDatabase, ref, set, get, push, onValue } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

// Configuration de votre base de données Firebase
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

// Références dynamiques vers les éléments du DOM
const elements = {
  nameInput: document.getElementById("nameInput"),
  startManualBtn: document.getElementById("startManualBtn"),
  profileNameTitle: document.getElementById("profile-name-title"),
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
  toast: document.getElementById("toast")
};

console.log("AquaTrack Script — Connecté à Firebase (Mode Saisie Manuelle & Progression Dynamique)");

// Objectifs et conditions pour la gamification
const CONFIG_BADGES = [
  { id: "rapide", objectif: 5, verifier: (session) => toNumber(session.durationSeconds) < 300 }, // < 5 min
  { id: "econome", objectif: 5, verifier: (session) => toNumber(session.volumeLitres) < 30 },    // < 30 Litres
  { id: "ecoheros", objectif: 10, verifier: () => true }                                        // Total douches
];

// Utilitaires de traitement numérique et temporel
function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value, decimals = 1) {
  return toNumber(value).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function formatCurrency(value) {
  return toNumber(value).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSessionPrice(value) {
  return toNumber(value).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 4 });
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(toNumber(seconds)));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  if (minutes === 0) return `${remainingSeconds} s`;
  return `${minutes} min ${String(remainingSeconds).padStart(2, "0")} s`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

// Lancement d'une douche
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
    showToast(`Douche démarrée pour ${userName}`);
    if (elements.nameInput) elements.nameInput.value = "";
  } catch (error) {
    console.error("Erreur de lancement :", error);
    showToast("Erreur Firebase");
  }
};

// Fin d'une douche
window.stopShower = async function() {
  try {
    const currentSessionRef = ref(database, "currentSession");
    const snapshot = await get(currentSessionRef);
    const session = snapshot.val();

    if (!session || session.status !== "running") {
      showToast("Aucune douche en cours");
      return;
    }

    const finishedSession = { ...session, status: "finished", endTime: new Date().toISOString() };
    await push(ref(database, "sessions"), finishedSession);

    await set(currentSessionRef, { status: "stopped", userId: "", userName: "", flowLMin: 0, volumeLitres: 0, durationSeconds: 0, priceEuro: 0 });
    showToast("Douche sauvegardée !");
  } catch (error) {
    console.error("Erreur d'arrêt :", error);
    showToast("Erreur de sauvegarde");
  }
};

// Affichage temps réel sur mesure.html
function renderCurrentSession(data) {
  const session = data || {};
  const isRunning = session.status === "running";
  const userName = session.userName || "-";
  const status = session.status || "stopped";
  const volume = toNumber(session.volumeLitres);

  if (elements.userName) elements.userName.textContent = userName;
  if (elements.heroUserName) elements.heroUserName.textContent = isRunning ? userName : "Aucune";
  if (elements.heroStatus) elements.heroStatus.textContent = isRunning ? "Douche en cours" : "En attente";

  if (elements.statusBadge) {
    elements.statusBadge.textContent = status;
    elements.statusBadge.classList.toggle("running", isRunning);
  }

  if (elements.flow) elements.flow.textContent = formatNumber(session.flowLMin, 1);
  if (elements.volume) elements.volume.textContent = formatNumber(volume, 1);
  if (elements.ringVolume) elements.ringVolume.textContent = `${formatNumber(volume, 1)} L`;
  if (elements.duration) elements.duration.textContent = formatDuration(session.durationSeconds);
  if (elements.price) elements.price.textContent = formatSessionPrice(session.priceEuro);

  if (elements.startTimeLabel) {
    elements.startTimeLabel.textContent = session.startTime ? `Début : ${formatDate(session.startTime)}` : "Aucune session démarrée";
  }

  if (elements.stopButton) elements.stopButton.disabled = !isRunning;
  if (elements.startManualBtn) elements.startManualBtn.disabled = isRunning;
  if (elements.nameInput) elements.nameInput.disabled = isRunning;
}

function sessionArrayFromFirebase(sessions) {
  if (!sessions) return [];
  return Object.entries(sessions)
    .map(([id, session]) => ({ id, ...session }))
    .sort((a, b) => new Date(b.endTime || b.startTime || 0).getTime() - new Date(a.endTime || a.startTime || 0).getTime());
}

// Affichage de l'historique et agrégation des compteurs globaux
function renderHistory(sessionsObject) {
  const sessions = sessionArrayFromFirebase(sessionsObject);

  if (elements.historyCount) elements.historyCount.textContent = `${sessions.length} session${sessions.length > 1 ? "s" : ""}`;
  if (elements.totalShowers) elements.totalShowers.textContent = sessions.length;

  const totalVolume = sessions.reduce((sum, s) => sum + toNumber(s.volumeLitres), 0);
  const totalPrice = sessions.reduce((sum, s) => sum + toNumber(s.priceEuro), 0);

  if (elements.totalVolume) elements.totalVolume.textContent = formatNumber(totalVolume, 1);
  if (elements.totalPrice) elements.totalPrice.textContent = formatCurrency(totalPrice);

  renderUserStatsDynamique(sessions);

  if (!elements.history) return;

  if (sessions.length === 0) {
    elements.history.innerHTML = `<p class="empty-state">Aucune douche enregistrée pour le moment.</p>`;
    return;
  }

  elements.history.innerHTML = sessions.map((session) => `
    <article class="history-item">
      <header>
        <strong>${session.userName || "Inconnu"}</strong>
        <span class="chip">${formatNumber(session.volumeLitres, 1)} L</span>
      </header>
      <div class="history-details">
        <span><small>Durée</small><b>${formatDuration(session.durationSeconds)}</b></span>
        <span><small>Coût</small><b>${formatSessionPrice(session.priceEuro)} €</b></span>
        <span><small>Date</small><b>${formatDate(session.endTime || session.startTime)}</b></span>
      </div>
    </article>
  `).join("");
}

// Génération dynamique des résumés par prénom saisi
function renderUserStatsDynamique(sessions) {
  if (!elements.userStats) return;

  const statsMap = {};
  sessions.forEach(session => {
    const nom = session.userName || "Anonyme";
    if (!statsMap[nom]) {
      statsMap[nom] = { name: nom, showers: 0, volume: 0 };
    }
    statsMap[nom].showers += 1;
    statsMap[nom].volume += toNumber(session.volumeLitres);
  });

  const statsArray = Object.values(statsMap).sort((a, b) => b.showers - a.showers);

  elements.userStats.innerHTML = statsArray.map((user) => `
    <div class="user-stat-row" style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
      <span style="font-weight:600; color:#fff;">${user.name}</span>
      <small style="color:#94a3b8;">${user.showers} douche${user.showers > 1 ? "s" : ""} · ${formatNumber(user.volume, 1)} L</small>
    </div>
  `).join("");
}

// Algorithme de calcul de points d'XP
function calculerXPSession(session) {
  const volume = toNumber(session.volumeLitres);
  const duree = toNumber(session.durationSeconds);
  
  let xpGagne = 50; 
  xpGagne += Math.max(0, Math.round((60 - volume) * 3.33));
  xpGagne += Math.max(0, Math.round((600 - duree) * 0.25));
  return xpGagne;
}

// Traitement des données d'XP et badges (pour le focus du haut dans eco-badge.html)
function calculerEtAfficherBadgesEtXP(sessionsObject, nomCible) {
  if (!nomCible) return;

  const sessions = sessionArrayFromFirebase(sessionsObject);
  const douchesUtilisateur = sessions.filter(s => (s.userName || "").toLowerCase() === nomCible.toLowerCase());

  let totalXPGlobale = 0;
  douchesUtilisateur.forEach(session => { totalXPGlobale += calculerXPSession(session); });

  const XP_PAR_NIVEAU = 500; 
  const niveauActuel = Math.floor(totalXPGlobale / XP_PAR_NIVEAU) + 1;
  const xpDansLeNiveauActuel = totalXPGlobale % XP_PAR_NIVEAU;

  if (elements.profileNameTitle) elements.profileNameTitle.textContent = `Statut de ${nomCible}`;
  
  const elLevelDisplay = document.getElementById("xp-level-display");
  const elBarXpGlobal = document.getElementById("bar-xp-global");
  const elTextXpGlobal = document.getElementById("text-xp-global");

  if (elLevelDisplay) elLevelDisplay.textContent = `NIVEAU ${niveauActuel}`;
  if (elBarXpGlobal) elBarXpGlobal.style.width = `${(xpDansLeNiveauActuel / XP_PAR_NIVEAU) * 100}%`;
  if (elTextXpGlobal) elTextXpGlobal.textContent = `${xpDansLeNiveauActuel} / ${XP_PAR_NIVEAU} XP (Total : ${totalXPGlobale} XP)`;

  CONFIG_BADGES.forEach((badge) => {
    const elementBadge = document.getElementById(`badge-${badge.id}`);
    if (elementBadge) {
      const barre = document.getElementById(`bar-${badge.id}`);
      const texte = document.getElementById(`text-${badge.id}`);
      const score = douchesUtilisateur.filter(badge.verifier).length;

      if (score >= badge.objectif) {
        elementBadge.classList.remove("locked");
        elementBadge.classList.add("unlocked");
        elementBadge.style.opacity = "1";
        elementBadge.style.filter = "grayscale(0%)";
        elementBadge.style.borderColor = "#22d3ee";
        elementBadge.style.boxShadow = "0 0 15px rgba(34, 211, 238, 0.15)";
        if (barre) barre.style.width = "100%";
        if (texte) texte.textContent = "Débloqué ! ✨";
      } else {
        elementBadge.classList.remove("unlocked");
        elementBadge.classList.add("locked");
        elementBadge.style.opacity = "0.5";
        elementBadge.style.filter = "grayscale(70%)";
        elementBadge.style.borderColor = "#334155";
        elementBadge.style.boxShadow = "none";
        if (barre) barre.style.width = `${Math.min(100, (score / badge.objectif) * 100)}%`;
        if (texte) texte.textContent = `${score} / ${badge.objectif} douches`;
      }
    }
  });
}

// NOUVEAU : Affichage dynamique de la progression globale de CHAQUE personne
function renderToutesLesProgressions(sessionsObject) {
  const elContainer = document.getElementById("toutes-les-progressions");
  if (!elContainer) return; // Sécurité si on n'est pas sur la page eco-badge.html

  const sessions = sessionArrayFromFirebase(sessionsObject);
  
  if (sessions.length === 0) {
    elContainer.innerHTML = `<p style="color: #64748b; font-style: italic;">Aucune douche enregistrée pour le moment.</p>`;
    return;
  }

  // Regroupement par utilisateur unique
  const utilisteursMap = {};
  sessions.forEach(session => {
    const nom = session.userName || "Anonyme";
    const nomCle = nom.toLowerCase().trim();
    if (!utilisteursMap[nomCle]) {
      utilisteursMap[nomCle] = { name: nom, sessions: [] };
    }
    utilisteursMap[nomCle].sessions.push(session);
  });

  const listeUtilisateurs = Object.values(utilisteursMap);

  // Construction dynamique du tableau HTML
  elContainer.innerHTML = listeUtilisateurs.map(user => {
    let totalXP = 0;
    user.sessions.forEach(s => { totalXP += calculerXPSession(s); });

    const XP_PAR_NIVEAU = 500;
    const niveau = Math.floor(totalXP / XP_PAR_NIVEAU) + 1;
    const xpDansLeNiveau = totalXP % XP_PAR_NIVEAU;
    const pourcentXP = (xpDansLeNiveau / XP_PAR_NIVEAU) * 100;

    const nbRapide = user.sessions.filter(s => toNumber(s.durationSeconds) < 300).length;
    const nbEconome = user.sessions.filter(s => toNumber(s.volumeLitres) < 30).length;
    const nbTotal = user.sessions.length;

    const bRapideUnlocked = nbRapide >= 5;
    const bEconomeUnlocked = nbEconome >= 5;
    const bHeroUnlocked = nbTotal >= 10;

    return `
      <div class="user-progression-card" style="background: rgba(30, 41, 59, 0.4); border: 1px solid #1e293b; padding: 20px; border-radius: 16px; margin-bottom: 5px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
          <div>
            <strong style="font-size: 1.3rem; color: #22d3ee;">${user.name}</strong>
            <span style="margin-left: 10px; background: #0ea5e9; color: #fff; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; font-weight: bold;">NIV. ${niveau}</span>
          </div>
          <span style="color: #94a3b8; font-size: 0.9rem;">${xpDansLeNiveau} / ${XP_PAR_NIVEAU} XP (Total : ${totalXP} XP)</span>
        </div>
        
        <div style="width: 100%; height: 8px; background: #0f172a; border-radius: 999px; overflow: hidden; margin-bottom: 15px; border: 1px solid #334155;">
          <div style="width: ${pourcentXP}%; height: 100%; background: linear-gradient(90deg, #38bdf8, #22d3ee); transition: width 0.4s ease;"></div>
        </div>

        <div style="display: flex; gap: 15px; flex-wrap: wrap; font-size: 0.85rem;">
          <div style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 8px; background: ${bRapideUnlocked ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${bRapideUnlocked ? '#f59e0b' : '#334155'}; color: ${bRapideUnlocked ? '#f59e0b' : '#64748b'};">
            <span>⚡ Rapide:</span> <strong>${nbRapide}/5</strong> ${bRapideUnlocked ? '✨' : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 8px; background: ${bEconomeUnlocked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${bEconomeUnlocked ? '#10b981' : '#334155'}; color: ${bEconomeUnlocked ? '#10b981' : '#64748b'};">
            <span>🌱 Économe:</span> <strong>${nbEconome}/5</strong> ${bEconomeUnlocked ? '✨' : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 8px; background: ${bHeroUnlocked ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${bHeroUnlocked ? '#3b82f6' : '#334155'}; color: ${bHeroUnlocked ? '#3b82f6' : '#64748b'};">
            <span>🦸‍♂️ Héros:</span> <strong>${nbTotal}/10</strong> ${bHeroUnlocked ? '✨' : ''}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Fonction coordinatrice de mise à jour pour Eco-Badge
function triggerEcoBadgeUpdate() {
  let nomCible = "";
  
  // 1. Session courante active prioritaire
  if (currentSessionData && currentSessionData.status === "running" && currentSessionData.userName) {
    nomCible = currentSessionData.userName;
  } else {
    // 2. Repli vers le dernier utilisateur de l'historique global
    const tableauSessions = sessionArrayFromFirebase(sessionsData);
    if (tableauSessions.length > 0) {
      nomCible = tableauSessions[0].userName;
    }
  }

  if (nomCible) {
    calculerEtAfficherBadgesEtXP(sessionsData, nomCible);
  } else {
    if (elements.profileNameTitle) {
      elements.profileNameTitle.textContent = "Aucun éco-aventurier";
    }
  }

  // 3. Rafraîchir la liste de tout le monde
  renderToutesLesProgressions(sessionsData);
}

// Variables d'état partagées
let currentSessionData = null;
let sessionsData = null;

// Déclencheurs événementiels
if (elements.startManualBtn && elements.nameInput) {
  elements.startManualBtn.addEventListener("click", () => {
    const nomSaisi = elements.nameInput.value.trim();
    if (nomSaisi === "") {
      showToast("Veuillez inscrire un prénom !");
      return;
    }
    const userIdSaisi = "u_" + nomSaisi.toLowerCase().replace(/[^a-z0-9]/g, "");
    window.startShower(userIdSaisi, nomSaisi);
  });
}

if (elements.stopButton) {
  elements.stopButton.addEventListener("click", window.stopShower);
}

// Synchronisation Firebase en temps réel (gère aussi instantanément les suppressions)
onValue(ref(database, "currentSession"), (snapshot) => {
  currentSessionData = snapshot.val();
  renderCurrentSession(currentSessionData);
  triggerEcoBadgeUpdate();
});

onValue(ref(database, "sessions"), (snapshot) => {
  sessionsData = snapshot.val();
  renderHistory(sessionsData);
  triggerEcoBadgeUpdate();
});