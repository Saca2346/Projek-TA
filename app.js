// =============================
// Firebase (modular v9+) via CDN
// =============================

// IMPORT LANGSUNG DARI CDN (tanpa bundler)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  onValue,
  query,
  limitToLast,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-analytics.js";

// =============================
// 1. Firebase configuration
// =============================

const firebaseConfig = {
  apiKey: "AIzaSyA0y6dzLy4OjaXAzz3GlPQURfJOCiObVWw",
  authDomain: "power-monitor-ina219.firebaseapp.com",
  databaseURL:
    "https://power-monitor-ina219-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "power-monitor-ina219",
  storageBucket: "power-monitor-ina219.appspot.com", // dibetulkan
  messagingSenderId: "552140214086",
  appId: "1:552140214086:web:dd75d389aa249a28089f47",
  measurementId: "G-79CJQDWL2M",
};

// Init Firebase
const app = initializeApp(firebaseConfig);
getAnalytics(app);

const auth = getAuth(app);
const db = getDatabase(app);

// =============================
// 2. DOM elements
// =============================
const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const loginForm = document.getElementById("login-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");

const userInfo = document.getElementById("user-info");
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("btn-logout");

const voltageEl = document.getElementById("voltage-value");
const currentEl = document.getElementById("current-value");
const powerEl = document.getElementById("power-value");
const tsEl = document.getElementById("timestamp-value");

const historyBody = document.getElementById("history-body");
const btnExportJson = document.getElementById("btn-export-json");
const btnExportCsv = document.getElementById("btn-export-csv");

const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");

// =============================
// 3. Auth handlers
// ============================
onAuthStateChanged(auth, (user) => {
  if (user) {
    // logged in
    authSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");
    userInfo.classList.remove("hidden");
    userEmailEl.textContent = user.email || "Logged in";

    subscribeSensorData();
    subscribeHistory();
  } else {
    // logged out
    authSection.classList.remove("hidden");
    dashboardSection.classList.add("hidden");
    userInfo.classList.add("hidden");
    userEmailEl.textContent = "";
    loginError.classList.add("hidden");
    loginForm.reset();
}
});


loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  loginError.textContent = "";

  const email = loginEmail.value.trim();
  const pass = loginPassword.value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    console.error(err);
    loginError.textContent = translateAuthError(err);
    loginError.classList.remove("hidden");
  }
});


logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});


function translateAuthError(err) {
  if (!err || !err.code) return "Login gagal. Periksa kembali data Anda.";
  switch (err.code) {
    case "auth/user-not-found":
      return "User tidak ditemukan.";
    case "auth/wrong-password":
      return "Password salah.";
    case "auth/invalid-email":
      return "Format email tidak valid.";
    default:
      return err.message || "Login gagal.";
  }
}

// =============================
// 4. Tabs (Live / History)
// =============================
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(target).classList.add("active");
  });
});

// =============================
// 5. Chart.js setup
// =============================
const ctx = document.getElementById("live-chart").getContext("2d");

const maxPoints = 40;
const chartData = {
  labels: [],
  voltage: [],
  current: [],
  power: [],
};

const liveChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: chartData.labels,
    datasets: [
      {
        label: "Voltage (V)",
        data: chartData.voltage,
        borderWidth: 2,
        tension: 0.25,
      },
      {
        label: "Current (mA)",
        data: chartData.current,
        borderWidth: 2,
        tension: 0.25,
      },
      {
        label: "Power (W)",
        data: chartData.power,
        borderWidth: 2,
        tension: 0.25,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#e5e7eb",
          font: { size: 11 },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#9ca3af",
          maxRotation: 0,
          autoSkip: true,
        },
        grid: { color: "rgba(31,41,55,0.4)" },
      },
      y: {
        ticks: { color: "#9ca3af" },
        grid: { color: "rgba(31,41,55,0.4)" },
      },
    },
  },
});

function pushChartPoint(tsLabel, v, i, p) {
  chartData.labels.push(tsLabel);
  chartData.voltage.push(v);
  chartData.current.push(i);
  chartData.power.push(p);

  if (chartData.labels.length > maxPoints) {
    chartData.labels.shift();
    chartData.voltage.shift();
    chartData.current.shift();
    chartData.power.shift();
  }

  liveChart.update("none");
}

// =============================
// 6. Subscribe to sensor data
// =============================

let sensorListenerAttached = false;
let historyListenerAttached = false;

function subscribeSensorData() {
  if (sensorListenerAttached) return;
  sensorListenerAttached = true;


  const sensorRef = ref(db, "ina219/latest");

  onValue(sensorRef, (snap) => {
    const val = snap.val();
    if (!val) return;

    const voltage = Number(val.voltage || 0);
    const current = Number(val.current || 0);
    const power = Number(val.power || 0);
    const tsMs =
      typeof val.timestamp === "number"
        ? val.timestamp * 1000
        : Date.parse(val.timestamp) || Date.now();

    voltageEl.textContent = voltage.toFixed(2);
    currentEl.textContent = current.toFixed(0);
    powerEl.textContent = power.toFixed(2);
    tsEl.textContent = new Date(tsMs).toLocaleString();

    const label = new Date(tsMs).toLocaleTimeString();
    pushChartPoint(label, voltage, current, power);
  });
}

// =============================
// 7. Subscribe to history data
// =============================

let historyCache = [];

function subscribeHistory() {
  if (historyListenerAttached) return;
  historyListenerAttached = true;

  const historyQ = query(ref(db, "ina219/history"), limitToLast(200));

  onValue(historyQ, (snap) => {
    const val = snap.val() || {};
    const rows = [];

    Object.keys(val)
      .sort()
      .forEach((key) => {
        const item = val[key];
        const voltage = Number(item.voltage || 0);
        const current = Number(item.current || 0);
        const power = Number(item.power || 0);
        const tsMs =
          typeof item.timestamp === "number"
            ? item.timestamp * 1000
            : Date.parse(item.timestamp) || Date.now();

        rows.push({
          timestamp: tsMs,
          voltage,
          current,
          power,
        });
      });

    historyCache = rows;
    renderHistoryTable(rows);
  });
}

function renderHistoryTable(rows) {
  historyBody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "Belum ada data history.";
    td.style.textAlign = "center";
    tr.appendChild(td);
    historyBody.appendChild(tr);
    return;
  }

  rows
    .slice()
    .reverse()
    .forEach((row) => {
      const tr = document.createElement("tr");

      const tsTd = document.createElement("td");
      tsTd.textContent = new Date(row.timestamp).toLocaleString();

      const vTd = document.createElement("td");
      vTd.textContent = row.voltage.toFixed(2);

      const iTd = document.createElement("td");
      iTd.textContent = row.current.toFixed(0);

      const pTd = document.createElement("td");
      pTd.textContent = row.power.toFixed(2);

      tr.appendChild(tsTd);
      tr.appendChild(vTd);
      tr.appendChild(iTd);
      tr.appendChild(pTd);

      historyBody.appendChild(tr);
    });
}

// =============================
// 8. Export JSON & CS// =============================
btnExportJson.addEventListener("click", () => {
  if (!historyCache.length) return;
  const data = historyCache.map((row) => ({
    timestamp: row.timestamp,
    timestamp_iso: new Date(row.timestamp).toISOString(),
    voltage: row.voltage,
    current: row.current,
    power: row.power,
  }));

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ina219-history.json";
  a.click();
  URL.revokeObjectURL(url);
});

btnExportCsv.addEventListener("click", () => {
  if (!historyCache.length) return;

  const header = [
    "timestamp_ms",
    "timestamp_iso",
    "voltage_V",
    "current_mA",
    "power_W",
  ];
  const lines = [header.join(",")];

  historyCache.forEach((row) => {
    const tsIso = new Date(row.timestamp).toISOString();
    lines.push(
      [
        row.timestamp,
        tsIso,
        row.voltage.toFixed(2),
        row.current.toFixed(0),
        row.power.toFixed(2),
      ].join(",")
    );
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ina219-history.csv";
  a.click();
  URL.revokeObjectURL(url);
});





