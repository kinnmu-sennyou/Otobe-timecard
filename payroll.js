const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbykqf1T967tzrQ_A63vHsMfrNp_QBuoaRAfOvchF0MEpZ1ob5xgGXeNbglUvTj-rw8uKg/exec";
const APP_VERSION = "payroll-view-20260707-33";
const WAGE_STORAGE_KEY = "otobe-payroll:wages";

let payrollRows = [];
let filteredRows = [];
let isLoading = false;
let wages = readWages();
let dom = {};

window.addEventListener("error", (event) => {
  const el = document.getElementById("message");
  if (el) {
    el.textContent = `画面処理でエラー：${event.message || "不明なエラー"}`;
    el.className = "message error";
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPayrollView);
} else {
  initPayrollView();
}

function initPayrollView() {
  dom = {
    adminKeyInput: document.getElementById("adminKeyInput"),
    loadButton: document.getElementById("loadButton"),
    summaryArea: document.getElementById("summaryArea"),
    controlsArea: document.getElementById("controlsArea"),
    tableArea: document.getElementById("tableArea"),
    targetMonthText: document.getElementById("targetMonthText"),
    staffCountText: document.getElementById("staffCountText"),
    totalPayText: document.getElementById("totalPayText"),
    searchInput: document.getElementById("searchInput"),
    bulkHourlyWage: document.getElementById("bulkHourlyWage"),
    applyBulkWageButton: document.getElementById("applyBulkWageButton"),
    payrollBody: document.getElementById("payrollBody"),
    message: document.getElementById("message"),
  };

  const missingIds = Object.keys(dom).filter((key) => !dom[key]);

  if (missingIds.length) {
    const text = `画面部品が見つかりません：${missingIds.join(", ")}。payroll.htmlを最新版に張り替えてください。`;
    alert(text);
    return;
  }

  dom.loadButton.addEventListener("click", loadPayrollData);
  dom.adminKeyInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      loadPayrollData();
    }
  });

  dom.searchInput.addEventListener("input", renderPayrollTable);
  dom.applyBulkWageButton.addEventListener("click", applyBulkWageToVisibleRows);

  showMessage(`準備OK。合言葉を入力して表示してください。版：${APP_VERSION}`, "neutral");
}

async function loadPayrollData() {
  if (isLoading) return;

  const adminKey = dom.adminKeyInput.value.trim();

  if (!adminKey) {
    showMessage("合言葉を入力してください。", "error");
    return;
  }

  startLoading();

  try {
    const result = await postToScript({
      mode: "getPayrollCalc",
      adminKey,
      appVersion: APP_VERSION,
    });

    if (!result || !result.ok) {
      throw new Error((result && result.message) || "給与計算データを取得できませんでした。");
    }

    payrollRows = Array.isArray(result.rows) ? result.rows : [];
    dom.targetMonthText.textContent = result.targetKey || "-";

    dom.summaryArea.hidden = false;
    dom.controlsArea.hidden = false;
    dom.tableArea.hidden = false;

    renderPayrollTable();
    showMessage(result.message || "給与計算データを取得しました。", "ok");
  } catch (error) {
    console.error(error);
    showMessage(`取得できませんでした：${error.message}`, "error");
  } finally {
    stopLoading();
  }
}

function renderPayrollTable() {
  const query = normalizeName(dom.searchInput.value).toLowerCase();

  filteredRows = payrollRows.filter((row) => {
    const staffName = normalizeName(row.staffName).toLowerCase();
    return !query || staffName.includes(query);
  });

  dom.payrollBody.innerHTML = "";

  if (!filteredRows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 11;
    td.className = "empty-cell";
    td.textContent = payrollRows.length ? "該当スタッフがいません。" : "給与計算データがありません。";
    tr.appendChild(td);
    dom.payrollBody.appendChild(tr);
    updateSummary();
    return;
  }

  filteredRows.forEach((row) => {
    const staffName = String(row.staffName || "").trim();
    const wage = getWage(staffName);
    const calc = calculatePay(row, wage);

    const tr = document.createElement("tr");

    tr.appendChild(makeTextCell(staffName));
    tr.appendChild(makeNumberCell(row.month));
    tr.appendChild(makeNumberCell(row.attendanceDays));
    tr.appendChild(makeNumberCell(row.totalHours));
    tr.appendChild(makeNumberCell(row.overtimeHours));
    tr.appendChild(makeNumberCell(row.week40Over));
    tr.appendChild(makeNumberCell(row.nonWorkHours));
    tr.appendChild(makeWageCell(staffName, wage));
    tr.appendChild(makeMoneyCell(calc.basePay));
    tr.appendChild(makeMoneyCell(calc.overtimePay));
    tr.appendChild(makeMoneyCell(calc.totalPay, "strong-money"));

    dom.payrollBody.appendChild(tr);
  });

  updateSummary();
}

function makeTextCell(value) {
  const td = document.createElement("td");
  td.textContent = value || "";
  return td;
}

function makeNumberCell(value) {
  const td = document.createElement("td");
  td.className = "number-cell";
  td.textContent = formatNumber(value);
  return td;
}

function makeMoneyCell(value, className) {
  const td = document.createElement("td");
  td.className = `money-cell ${className || ""}`.trim();
  td.textContent = formatYen(value);
  return td;
}

function makeWageCell(staffName, wage) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "1";
  input.inputMode = "numeric";
  input.className = "wage-input";
  input.value = wage ? String(wage) : "";
  input.placeholder = "時給";

  input.addEventListener("change", () => {
    const nextWage = normalizeMoneyInput(input.value);
    if (nextWage === null) {
      input.value = "";
      delete wages[staffName];
    } else {
      input.value = String(nextWage);
      wages[staffName] = nextWage;
    }

    saveWages();
    renderPayrollTable();
  });

  td.appendChild(input);
  return td;
}

function calculatePay(row, wage) {
  const hourlyWage = Number(wage || 0);
  const totalHours = safeNumber(row.totalHours);
  const overtimeHours = safeNumber(row.overtimeHours);

  const basePay = hourlyWage * totalHours;
  const overtimePay = hourlyWage * overtimeHours * 0.25;
  const totalPay = basePay + overtimePay;

  return {
    basePay: Math.round(basePay),
    overtimePay: Math.round(overtimePay),
    totalPay: Math.round(totalPay),
  };
}

function updateSummary() {
  let totalPay = 0;

  filteredRows.forEach((row) => {
    const wage = getWage(row.staffName);
    totalPay += calculatePay(row, wage).totalPay;
  });

  dom.staffCountText.textContent = `${filteredRows.length}名`;
  dom.totalPayText.textContent = formatYen(totalPay);
}

function applyBulkWageToVisibleRows() {
  const wage = normalizeMoneyInput(dom.bulkHourlyWage.value);

  if (wage === null) {
    showMessage("共通時給を入力してください。", "error");
    return;
  }

  filteredRows.forEach((row) => {
    const staffName = String(row.staffName || "").trim();
    if (staffName) {
      wages[staffName] = wage;
    }
  });

  saveWages();
  renderPayrollTable();
  showMessage(`表示中の${filteredRows.length}名に時給${formatYen(wage)}を入れました。`, "ok");
}

function postToScript(payload) {
  return new Promise((resolve, reject) => {
    if (!ENDPOINT_URL || ENDPOINT_URL.includes("ここに")) {
      reject(new Error("Apps Script URLが設定されていません。"));
      return;
    }

    const callbackName = `payrollCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Apps Scriptから応答がありませんでした。デプロイURL・公開設定・新バージョン反映を確認してください。"));
    }, 30000);

    function cleanup() {
      window.clearTimeout(timer);
      delete window[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    window[callbackName] = (result) => {
      cleanup();
      resolve(result);
    };

    const params = new URLSearchParams();
    params.set("callback", callbackName);
    params.set("payload", JSON.stringify(payload));
    params.set("_", String(Date.now()));

    script.onerror = () => {
      cleanup();
      reject(new Error("Apps Scriptを読み込めませんでした。ウェブアプリURLか公開設定を確認してください。"));
    };

    script.src = `${ENDPOINT_URL}?${params.toString()}`;
    document.body.appendChild(script);
  });
}

function startLoading() {
  isLoading = true;
  dom.loadButton.disabled = true;
  dom.loadButton.classList.add("is-loading");
  showMessage("給与計算データを取得中...", "loading");
}

function stopLoading() {
  isLoading = false;
  dom.loadButton.disabled = false;
  dom.loadButton.classList.remove("is-loading");
}

function showMessage(text, status) {
  if (!dom.message) return;
  dom.message.textContent = text;
  dom.message.className = `message ${status || ""}`.trim();
  dom.message.classList.remove("flash");
  void dom.message.offsetWidth;
  dom.message.classList.add("flash");
}

function readWages() {
  try {
    const raw = localStorage.getItem(WAGE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("時給設定を読み込めませんでした。", error);
    return {};
  }
}

function saveWages() {
  localStorage.setItem(WAGE_STORAGE_KEY, JSON.stringify(wages));
}

function getWage(staffName) {
  return safeNumber(wages[String(staffName || "").trim()]);
}

function normalizeMoneyInput(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  const num = Number(text);
  if (!Number.isFinite(num) || num < 0) return null;

  return Math.round(num);
}

function safeNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function normalizeName(value) {
  return String(value || "").replace(/\s/g, "");
}

function formatNumber(value) {
  const num = safeNumber(value);
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 100) / 100);
}

function formatYen(value) {
  const num = Math.round(safeNumber(value));
  return `${num.toLocaleString("ja-JP")}円`;
}
