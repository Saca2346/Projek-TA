// =========================
// Firebase Config
// =========================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://power-monitor-ina219-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// =========================
// DOM ELEMENTS
// =========================
const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");

const userInfo = document.getElementById("user-info");
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("btn-logout");

const statusConnEl = document.getElementById("status-conn");

const voltageEl = document.getElementById("voltage-value");
const currentEl = document.getElementById("current-value");
const powerEl = document.getElementById("power-value");
const tsEl = document.getElementById("timestamp-value");

const historyBody = document.getElementById("history-body");
const btnExportJson = document.getElementById("btn-export-json");

// =========================
// CHART SETUP
// =========================
const maxPoints = 50;
let labels = [];
let voltageData = [];
let currentData = [];
let powerData = [];

// Combined chart
const combinedCtx = document.getElementById("combined-chart").getContext("2d");
const combinedChart = new Chart(combinedCtx, {
  type: "line",
  data: {
    labels,
    datasets: [
      {
        label: "Voltage (V)",
        data: voltageData,
        borderWidth: 1.5,
        borderColor: "rgba(56,189,248,0.9)",
        pointRadius: 0,
        tension: 0.3,
      },
      {
        label: "Current (mA)",
        data: currentData,
        borderWidth: 1.2,
        borderColor: "rgba(251,191,36,0.9)",
        pointRadius: 0,
        tension: 0.3,
      },
      {
        label: "Power (W)",
        data: powerData,
        borderWidth: 1.5,
        borderColor: "rgba(34,197,94,0.9)",
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { display: true, maxTicksLimit: 6 },
        grid: { display: false },
      },
      y: {
        grid: { color: "rgba(51,65,85,0.4)" },
      },
    },
    plugins: {
      legend: { labels: { color: "#e5e7eb", font: { size: 10 } } },
    },
  },
});

// Voltage-only chart
const voltageCtx = document.getElementById("voltage-chart").getContext("2d");
const voltageChart = new Chart(voltageCtx, {
  type: "line",
  data: {
    labels,
    datasets: [
      {
        label: "Voltage (V)",
        data: voltageData,
        borderWidth: 1.8,
        borderColor: "rgba(56,189,248,0.9)",
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { ticks: { display: false }, grid: { display: false } },
      y: { grid: { color: "rgba(51,65,85,0.4)" } },
    },
    plugins: {
      legend: { labels: { color: "#e5e7eb", font: { size: 10 } } },
    },
  },
});

// Power-only chart
const powerCtx = document.getElementById("power-chart").getContext("2d");
const powerChart = new Chart(powerCtx, {
  type: "line",
  data: {
    labels,
    datasets: [
      {
        label: "Power (W)",
        data: powerData,
        borderWidth: 1.8,
        borderColor: "rgba(34,197,94,0.9)",
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { ticks: { display: false }, grid: { display: false } },
      y: { grid: { color: "rgba(51,65,85,0.4)" } },
    },
    plugins: {
      legend: { labels: { color: "#e5e7eb", font: { size: 10 } } },
    },
  },
});

// Helper: tambah titik data
function addDataPoint(label, v, i, p) {
  labels.push(label);
  voltageData.push(v);
  currentData.push(i);
  powerData.push(p);

  if (labels.length > maxPoints) {
    labels.shift();
    voltageData.shift();
    currentData.shift();
    powerData.shift();
  }

  combinedChart.update();
  voltageChart.update();
  powerChart.update();
}

// =========================
// AUTH
// =========================
auth.onAuthStateChanged((user) => {
  if (user) {
    // Logged in
    authSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");
    userInfo.classList.remove("hidden");
    userEmailEl.textContent = user.email || "";
    setConnectionStatus(true);

    // Mulai subscribe data
    attachRealtimeListeners();
  } else {
    // Logged out
    authSection.classList.remove("hidden");
    dashboardSection.classList.add("hidden");
    userInfo.classList.add("hidden");
    userEmailEl.textContent = "";
    setConnectionStatus(false);
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  const email = loginEmail.value.trim();
  const pass = loginPassword.value.trim();

  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (err) {
    console.error(err);
    loginError.textContent = translateAuthError(err);
    loginError.classList.remove("hidden");
  }
});

logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
});

function translateAuthError(err) {
  if (!err || !err.code) return "Login gagal. Periksa kembali email dan password.";
  if (err.code === "auth/user-not-found") return "User tidak ditemukan.";
  if (err.code === "auth/wrong-password") return "Password salah.";
  if (err.code === "auth/invalid-email") return "Format email tidak valid.";
  return "Login gagal: " + err.message;
}

function setConnectionStatus(isOnline) {
  if (!statusConnEl) return;
  statusConnEl.classList.remove("status-online", "status-offline");
  if (isOnline) {
    statusConnEl.textContent = "Online";
    statusConnEl.classList.add("status-online");
  } else {
    statusConnEl.textContent = "Offline";
    statusConnEl.classList.add("status-offline");
  }
}

// =========================
// REALTIME DATABASE
// =========================
let listenersAttached = false;
let historyCache = [];

function attachRealtimeListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  // Latest
  const latestRef = db.ref("ina219/latest");

  latestRef.on("value", (snap) => {
    const data = snap.val();
    if (!data) return;

    const v = Number(data.voltage ?? 0);
    const i = Number(data.current ?? 0);
    const p = Number(data.power ?? 0);
    const t = data.timestamp ?? 0;

    voltageEl.textContent = v.toFixed(2);
    currentEl.textContent = i.toFixed(0);
    powerEl.textContent = p.toFixed(2);

    const label = formatTimestamp(t);
    tsEl.textContent = label;

    addDataPoint(label, v, i, p);
  });

  // History
  const historyRef = db.ref("ina219/history").limitToLast(100);
  historyRef.on("value", (snap) => {
    historyCache = [];
    historyBody.innerHTML = "";
    snap.forEach((child) => {
      const d = child.val() || {};
      historyCache.push(d);
    });

    historyCache.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    for (const row of historyCache) {
      const tr = document.createElement("tr");
      const label = formatTimestamp(row.timestamp || 0);

      tr.innerHTML = `
        <td>${label}</td>
        <td>${Number(row.voltage ?? 0).toFixed(2)}</td>
        <td>${Number(row.current ?? 0).toFixed(0)}</td>
        <td>${Number(row.power ?? 0).toFixed(2)}</td>
      `;
      historyBody.appendChild(tr);
    }
  });
}

function formatTimestamp(ts) {
  // ts dari ESP32: detik sejak boot -> di sini sekadar tampil detik
  if (!ts) return "--";
  // Kalau nanti pakai timestamp UNIX (detik epoch), tinggal ubah ke Date.
  return ts + " s";
}

// =========================
// EXPORT JSON
// =========================
btnExportJson.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(historyCache, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ina219_history.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
