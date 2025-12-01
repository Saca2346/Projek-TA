/* ========================================
   FIREBASE CONFIG (COMPAT)
======================================== */
const firebaseConfig = {
  apiKey: "AIzaSyA0y6dzLy4OjaXAzz3GlPQURfJOCiObVWw",
  authDomain: "power-monitor-ina219.firebaseapp.com",
  databaseURL: "https://power-monitor-ina219-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "power-monitor-ina219",
  storageBucket: "power-monitor-ina219.appspot.com",
  messagingSenderId: "552140214086",
  appId: "1:552140214086:web:dd75d389aa249a28089f47",
  measurementId: "G-79CJQDWL2M",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

/* ========================================
   DOM ELEMENTS
======================================== */
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

/* ========================================
   CHART SETUP (Combined, Voltage, Power)
======================================== */
const maxPoints = 60;
let labels = [];
let voltageData = [];
let currentData = [];
let powerData = [];

const combinedCtx = document.getElementById("combined-chart").getContext("2d");
const voltageCtx = document.getElementById("voltage-chart").getContext("2d");
const powerCtx = document.getElementById("power-chart").getContext("2d");

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      ticks: { color: "#9ca3af", maxTicksLimit: 6 },
      grid: { color: "rgba(51,65,85,0.3)" },
    },
    y: {
      ticks: { color: "#9ca3af" },
      grid: { color: "rgba(51,65,85,0.3)" },
    },
  },
  plugins: {
    legend: {
      labels: {
        color: "#e5e7eb",
        font: { size: 10 },
      },
    },
  },
};

const combinedChart = new Chart(combinedCtx, {
  type: "line",
  data: {
    labels,
    datasets: [
      {
        label: "Voltage (V)",
        data: voltageData,
        borderColor: "rgba(56,189,248,0.95)",
        backgroundColor: "rgba(56,189,248,0.12)",
        borderWidth: 1.6,
        pointRadius: 0,
        tension: 0.3,
      },
      {
        label: "Current (mA)",
        data: currentData,
        borderColor: "rgba(251,191,36,0.95)",
        backgroundColor: "rgba(251,191,36,0.08)",
        borderWidth: 1.2,
        pointRadius: 0,
        tension: 0.3,
      },
      {
        label: "Power (W)",
        data: powerData,
        borderColor: "rgba(34,197,94,0.95)",
        backgroundColor: "rgba(34,197,94,0.12)",
        borderWidth: 1.6,
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  },
  options: baseOptions,
});

const voltageChart = new Chart(voltageCtx, {
  type: "line",
  data: {
    labels,
    datasets: [
      {
        label: "Voltage (V)",
        data: voltageData,
        borderColor: "rgba(56,189,248,0.95)",
        backgroundColor: "rgba(56,189,248,0.12)",
        borderWidth: 1.8,
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  },
  options: {
    ...baseOptions,
    scales: {
      ...baseOptions.scales,
      x: { ...baseOptions.scales.x, ticks: { display: false } },
    },
  },
});

const powerChart = new Chart(powerCtx, {
  type: "line",
  data: {
    labels,
    datasets: [
      {
        label: "Power (W)",
        data: powerData,
        borderColor: "rgba(34,197,94,0.95)",
        backgroundColor: "rgba(34,197,94,0.12)",
        borderWidth: 1.8,
        pointRadius: 0,
        tension: 0.3,
      },
    ],
  },
  options: {
    ...baseOptions,
    scales: {
      ...baseOptions.scales,
      x: { ...baseOptions.scales.x, ticks: { display: false } },
    },
  },
});

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

/* ========================================
   AUTH
======================================== */
auth.onAuthStateChanged((user) => {
  if (user) {
    authSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");
    userInfo.classList.remove("hidden");
    userEmailEl.textContent = user.email || "";
    setConnectionStatus(true);
    attachRealtimeListeners();
  } else {
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
    loginError.textContent = mapAuthError(err);
    loginError.classList.remove("hidden");
  }
});

logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
});

function mapAuthError(err) {
  if (!err || !err.code) return "Login gagal. Periksa kembali email dan password.";
  switch (err.code) {
    case "auth/user-not-found":
      return "User tidak ditemukan di Firebase Authentication.";
    case "auth/wrong-password":
      return "Password salah.";
    case "auth/invalid-email":
      return "Format email tidak valid.";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan. Coba lagi beberapa saat.";
    default:
      return "Login gagal: " + err.message;
  }
}

/* ========================================
   UI HELPERS
======================================== */
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

function formatTimestamp(ts) {
  if (!ts) return "--";
  // ts dari ESP32: detik sejak boot (millis()/1000)
  return ts + " s";
}

/* ========================================
   REALTIME DATABASE (INA219)
======================================== */
let listenersAttached = false;
let historyCache = [];

function attachRealtimeListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  // ---- Latest ----
  const latestRef = db.ref("ina219/latest");
  latestRef.on(
    "value",
    (snap) => {
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
    },
    (err) => {
      console.error("Error latest:", err);
      setConnectionStatus(false);
    }
  );

  // ---- History ----
  const historyRef = db.ref("ina219/history").limitToLast(100);
  historyRef.on(
    "value",
    (snap) => {
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
    },
    (err) => {
      console.error("Error history:", err);
    }
  );
}

/* ========================================
   EXPORT JSON
======================================== */
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
