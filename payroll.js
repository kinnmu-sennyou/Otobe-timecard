const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbykqf1T967tzrQ_A63vHsMfrNp_QBuoaRAfOvchF0MEpZ1ob5xgGXeNbglUvTj-rw8uKg/exec";
const APP_VERSION = "payroll-view-20260707-40";

const PAY_SETTING_STORAGE_KEY = "otobe-payroll:paySettings:v35";
const OVERTIME_MULTIPLIER_STORAGE_KEY = "otobe-payroll:overtimeMultiplier";
const MONTHLY_AVERAGE_HOURS_STORAGE_KEY = "otobe-payroll:monthlyAverageHours";
const DEFAULT_OVERTIME_MULTIPLIER = 1.25;
const DEFAULT_MONTHLY_AVERAGE_HOURS = 173.33;

let payrollRows = [];
let filteredRows = [];
let isLoading = false;
let paySettings = readPaySettings();
let overtimeMultiplier = readNumberSetting(OVERTIME_MULTIPLIER_STORAGE_KEY, DEFAULT_OVERTIME_MULTIPLIER, 1);
let monthlyAverageHours = readNumberSetting(MONTHLY_AVERAGE_HOURS_STORAGE_KEY, DEFAULT_MONTHLY_AVERAGE_HOURS, 1);
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
    monthlyAverageHours: document.getElementById("monthlyAverageHours"),
    overtimeMultiplier: document.getElementById("overtimeMultiplier"),
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
    if (event.key === "Enter") loadPayrollData();
  });
  dom.searchInput.addEventListener("input", renderPayrollTable);

  dom.monthlyAverageHours.value = formatDecimal(monthlyAverageHours);
  dom.monthlyAverageHours.addEventListener("change", updateMonthlyAverageHours);

  dom.overtimeMultiplier.value = formatDecimal(overtimeMultiplier);
  dom.overtimeMultiplier.addEventListener("change", updateOvertimeMultiplier);

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
    td.colSpan = 15;
    td.className = "empty-cell";
    td.textContent = payrollRows.length ? "該当スタッフがいません。" : "給与計算データがありません。";
    tr.appendChild(td);
    dom.payrollBody.appendChild(tr);
    updateSummary();
    return;
  }

  filteredRows.forEach((row) => {
    const staffName = String(row.staffName || "").trim();
    const employmentType = normalizeEmploymentType(row.employmentType);
    const setting = getPaySetting(staffName);
    const calc = calculatePay(row, setting, employmentType);
    const tr = document.createElement("tr");

    tr.appendChild(makeTextCell(staffName));
    tr.appendChild(makeTextCell(employmentType || "未設定"));
    tr.appendChild(makeNumberCell(row.month));
    tr.appendChild(makeNumberCell(row.attendanceDays));
    tr.appendChild(makeNumberCell(row.totalHours));
    tr.appendChild(makeNumberCell(row.overtimeHours));
    tr.appendChild(makeNumberCell(row.week40Over));
    tr.appendChild(makeNumberCell(row.nonWorkHours));
    tr.appendChild(makePayInputCell(staffName, setting, employmentType));
    tr.appendChild(makeMultiplierInputCell(staffName, setting));
    tr.appendChild(makeMoneyCell(calc.hourlyUnit));
    tr.appendChild(makeMoneyCell(calc.basePay));
    tr.appendChild(makeMoneyCell(calc.overtimePay));
    tr.appendChild(makeMoneyCell(calc.nonWorkDeduction));
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

function makePayInputCell(staffName, setting, employmentType) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "1";
  input.inputMode = "numeric";
  input.className = "wage-input";

  if (employmentType === "社員") {
    input.value = setting.monthlySalary ? String(setting.monthlySalary) : "";
    input.placeholder = "月給";
  } else {
    input.value = setting.hourlyWage ? String(setting.hourlyWage) : "";
    input.placeholder = "時給";
  }

  input.addEventListener("change", () => {
    const amount = normalizeMoneyInput(input.value);
    const current = getPaySetting(staffName);

    if (employmentType === "社員") {
      if (amount === null) {
        input.value = "";
        delete current.monthlySalary;
      } else {
        input.value = String(amount);
        current.monthlySalary = amount;
      }
    } else {
      if (amount === null) {
        input.value = "";
        delete current.hourlyWage;
      } else {
        input.value = String(amount);
        current.hourlyWage = amount;
      }
    }

    paySettings[staffName] = current;
    savePaySettings();
    renderPayrollTable();
  });

  td.appendChild(input);
  return td;
}


function makeMultiplierInputCell(staffName, setting) {
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.step = "0.01";
  input.inputMode = "decimal";
  input.className = "multiplier-input";
  input.placeholder = formatDecimal(getOvertimeMultiplier());

  if (setting.overtimeMultiplier) {
    input.value = formatDecimal(setting.overtimeMultiplier);
  }

  input.title = "空欄の場合は共通残業割増倍率を使います。";

  input.addEventListener("change", () => {
    const value = normalizeDecimalInput(input.value, 1);
    const current = getPaySetting(staffName);

    if (value === null) {
      input.value = "";
      delete current.overtimeMultiplier;
    } else {
      input.value = formatDecimal(value);
      current.overtimeMultiplier = value;
    }

    paySettings[staffName] = current;
    savePaySettings();
    renderPayrollTable();
  });

  td.appendChild(input);
  return td;
}

function calculatePay(row, setting, employmentType) {
  const totalHours = safeNumber(row.totalHours);
  const overtimeHours = safeNumber(row.overtimeHours);
  const nonWorkHours = safeNumber(row.nonWorkHours);
  const normalHours = Math.max(0, totalHours - overtimeHours);
  const multiplier = getStaffOvertimeMultiplier(setting);

  if (employmentType === "社員") {
    const monthlySalary = safeNumber(setting.monthlySalary);
    const hourlyUnit = monthlySalary > 0 ? monthlySalary / getMonthlyAverageHours() : 0;
    const basePay = monthlySalary;
    const overtimePay = hourlyUnit * overtimeHours * multiplier;
    const nonWorkDeduction = hourlyUnit * nonWorkHours;
    const totalPay = basePay + overtimePay - nonWorkDeduction;

    return roundPay({ hourlyUnit, basePay, overtimePay, nonWorkDeduction, totalPay });
  }

  const hourlyWage = safeNumber(setting.hourlyWage);
  const hourlyUnit = hourlyWage;
  const basePay = hourlyWage * normalHours;
  const overtimePay = hourlyWage * overtimeHours * multiplier;
  const nonWorkDeduction = 0;
  const totalPay = basePay + overtimePay;

  return roundPay({ hourlyUnit, basePay, overtimePay, nonWorkDeduction, totalPay });
}

function roundPay(calc) {
  return {
    hourlyUnit: Math.round(safeNumber(calc.hourlyUnit)),
    basePay: Math.round(safeNumber(calc.basePay)),
    overtimePay: Math.round(safeNumber(calc.overtimePay)),
    nonWorkDeduction: Math.round(safeNumber(calc.nonWorkDeduction)),
    totalPay: Math.round(safeNumber(calc.totalPay)),
  };
}

function updateSummary() {
  let totalPay = 0;

  filteredRows.forEach((row) => {
    const staffName = String(row.staffName || "").trim();
    const setting = getPaySetting(staffName);
    const employmentType = normalizeEmploymentType(row.employmentType);
    totalPay += calculatePay(row, setting, employmentType).totalPay;
  });

  dom.staffCountText.textContent = `${filteredRows.length}名`;
  dom.totalPayText.textContent = formatYen(totalPay);
}

function updateMonthlyAverageHours() {
  const value = normalizeDecimalInput(dom.monthlyAverageHours.value, 1);

  if (value === null) {
    monthlyAverageHours = DEFAULT_MONTHLY_AVERAGE_HOURS;
    dom.monthlyAverageHours.value = formatDecimal(monthlyAverageHours);
    localStorage.removeItem(MONTHLY_AVERAGE_HOURS_STORAGE_KEY);
    showMessage(`月平均所定労働時間を初期値 ${formatDecimal(monthlyAverageHours)} に戻しました。`, "neutral");
  } else {
    monthlyAverageHours = value;
    dom.monthlyAverageHours.value = formatDecimal(monthlyAverageHours);
    localStorage.setItem(MONTHLY_AVERAGE_HOURS_STORAGE_KEY, String(monthlyAverageHours));
    showMessage(`月平均所定労働時間を ${formatDecimal(monthlyAverageHours)} 時間にしました。`, "ok");
  }

  renderPayrollTable();
}

function updateOvertimeMultiplier() {
  const value = normalizeDecimalInput(dom.overtimeMultiplier.value, 1);

  if (value === null) {
    overtimeMultiplier = DEFAULT_OVERTIME_MULTIPLIER;
    dom.overtimeMultiplier.value = formatDecimal(overtimeMultiplier);
    localStorage.removeItem(OVERTIME_MULTIPLIER_STORAGE_KEY);
    showMessage(`共通残業割増倍率を初期値 ${formatDecimal(overtimeMultiplier)} に戻しました。`, "neutral");
  } else {
    overtimeMultiplier = value;
    dom.overtimeMultiplier.value = formatDecimal(overtimeMultiplier);
    localStorage.setItem(OVERTIME_MULTIPLIER_STORAGE_KEY, String(overtimeMultiplier));
    showMessage(`共通残業割増倍率を ${formatDecimal(overtimeMultiplier)} にしました。`, "ok");
  }

  renderPayrollTable();
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
      if (script.parentNode) script.parentNode.removeChild(script);
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

function readPaySettings() {
  try {
    const raw = localStorage.getItem(PAY_SETTING_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("給与設定を読み込めませんでした。", error);
    return {};
  }
}

function savePaySettings() {
  localStorage.setItem(PAY_SETTING_STORAGE_KEY, JSON.stringify(paySettings));
}

function getPaySetting(staffName) {
  const key = String(staffName || "").trim();
  const setting = paySettings[key];
  return setting && typeof setting === "object" ? setting : {};
}

function readNumberSetting(key, fallback, min) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? Number(raw) : fallback;
    return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
  } catch (error) {
    console.warn("数値設定を読み込めませんでした。", error);
    return fallback;
  }
}

function getMonthlyAverageHours() {
  const value = Number(monthlyAverageHours || DEFAULT_MONTHLY_AVERAGE_HOURS);
  return Number.isFinite(value) && value >= 1 ? value : DEFAULT_MONTHLY_AVERAGE_HOURS;
}

function getOvertimeMultiplier() {
  const value = Number(overtimeMultiplier || DEFAULT_OVERTIME_MULTIPLIER);
  return Number.isFinite(value) && value >= 1 ? value : DEFAULT_OVERTIME_MULTIPLIER;
}


function getStaffOvertimeMultiplier(setting) {
  const value = Number(setting && setting.overtimeMultiplier);
  return Number.isFinite(value) && value >= 1 ? value : getOvertimeMultiplier();
}

function normalizeEmploymentType(value) {
  const text = String(value || "").trim();
  if (text === "社員" || text === "正社員") return "社員";
  if (text === "パート" || text === "アルバイト") return "パート";
  return text;
}

function normalizeMoneyInput(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const num = Number(text);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

function normalizeDecimalInput(value, min) {
  const text = String(value || "").trim();
  if (!text) return null;
  const num = Number(text);
  if (!Number.isFinite(num) || num < min) return null;
  return Math.round(num * 100) / 100;
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

function formatDecimal(value) {
  const num = safeNumber(value);
  return String(Math.round(num * 100) / 100);
}

function formatYen(value) {
  const num = Math.round(safeNumber(value));
  return `${num.toLocaleString("ja-JP")}円`;
}
