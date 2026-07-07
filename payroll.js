const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbykqf1T967tzrQ_A63vHsMfrNp_QBuoaRAfOvchF0MEpZ1ob5xgGXeNbglUvTj-rw8uKg/exec";
const APP_VERSION = "payroll-view-20260707-43";

const PAY_SETTING_STORAGE_KEY = "otobe-payroll:paySettings:v35";
const OVERTIME_MULTIPLIER_STORAGE_KEY = "otobe-payroll:overtimeMultiplier";
const MONTHLY_AVERAGE_HOURS_STORAGE_KEY = "otobe-payroll:monthlyAverageHours";
const DEFAULT_OVERTIME_MULTIPLIER = 1.25;
const DEFAULT_MONTHLY_AVERAGE_HOURS = 173.33;

let payrollRows = [];
let filteredRows = [];
let isLoading = false;
let selectedStaffName = "";
let paySettings = readPaySettings();
let overtimeMultiplier = readNumberSetting(OVERTIME_MULTIPLIER_STORAGE_KEY, DEFAULT_OVERTIME_MULTIPLIER, 1);
let monthlyAverageHours = readNumberSetting(MONTHLY_AVERAGE_HOURS_STORAGE_KEY, DEFAULT_MONTHLY_AVERAGE_HOURS, 1);
let pendingCommonSettingType = "";
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
    updateMonthlyAverageHoursButton: document.getElementById("updateMonthlyAverageHoursButton"),
    updateOvertimeMultiplierButton: document.getElementById("updateOvertimeMultiplierButton"),
    commonSettingConfirmArea: document.getElementById("commonSettingConfirmArea"),
    commonSettingConfirmText: document.getElementById("commonSettingConfirmText"),
    confirmCommonSettingYesButton: document.getElementById("confirmCommonSettingYesButton"),
    confirmCommonSettingNoButton: document.getElementById("confirmCommonSettingNoButton"),
    payrollBody: document.getElementById("payrollBody"),
    staffEditArea: document.getElementById("staffEditArea"),
    editStaffNameText: document.getElementById("editStaffNameText"),
    editEmploymentTypeText: document.getElementById("editEmploymentTypeText"),
    monthlySalaryLabel: document.getElementById("monthlySalaryLabel"),
    hourlyWageLabel: document.getElementById("hourlyWageLabel"),
    editMonthlySalary: document.getElementById("editMonthlySalary"),
    editHourlyWage: document.getElementById("editHourlyWage"),
    editOvertimeMultiplier: document.getElementById("editOvertimeMultiplier"),
    staffMonthlyAverageHoursLabel: document.getElementById("staffMonthlyAverageHoursLabel"),
    editStaffMonthlyAverageHours: document.getElementById("editStaffMonthlyAverageHours"),
    staffEditHelpText: document.getElementById("staffEditHelpText"),
    saveStaffSettingButton: document.getElementById("saveStaffSettingButton"),
    closeStaffSettingButton: document.getElementById("closeStaffSettingButton"),
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
  dom.searchInput.addEventListener("input", () => {
    closeStaffEditor(false);
    renderPayrollTable();
  });

  dom.monthlyAverageHours.value = formatDecimal(monthlyAverageHours);
  dom.updateMonthlyAverageHoursButton.addEventListener("click", () => requestCommonSettingUpdate("monthlyAverageHours"));

  dom.overtimeMultiplier.value = formatDecimal(overtimeMultiplier);
  dom.updateOvertimeMultiplierButton.addEventListener("click", () => requestCommonSettingUpdate("overtimeMultiplier"));
  dom.confirmCommonSettingYesButton.addEventListener("click", confirmCommonSettingUpdate);
  dom.confirmCommonSettingNoButton.addEventListener("click", cancelCommonSettingUpdate);

  dom.saveStaffSettingButton.addEventListener("click", saveStaffEditor);
  dom.closeStaffSettingButton.addEventListener("click", () => closeStaffEditor(true));

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
    selectedStaffName = "";
    dom.staffEditArea.hidden = true;
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
    td.colSpan = 17;
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

    tr.appendChild(makeStaffNameCell(staffName));
    tr.appendChild(makeTextCell(employmentType || "未設定"));
    tr.appendChild(makeNumberCell(row.month));
    tr.appendChild(makeNumberCell(row.attendanceDays));
    tr.appendChild(makeNumberCell(row.totalHours));
    tr.appendChild(makeNumberCell(row.overtimeHours));
    tr.appendChild(makeNumberCell(row.week40Over));
    tr.appendChild(makeNumberCell(row.nonWorkHours));
    tr.appendChild(makePaySettingResultCell(setting, employmentType));
    tr.appendChild(makeNumberCell(getStaffOvertimeMultiplier(setting)));
    tr.appendChild(makeMonthlyAverageResultCell(setting, employmentType));
    tr.appendChild(makeMoneyCell(calc.hourlyUnit));
    tr.appendChild(makeMoneyCell(calc.basePay));
    tr.appendChild(makeMoneyCell(calc.overtimePay));
    tr.appendChild(makeMoneyCell(calc.nonWorkDeduction));
    tr.appendChild(makeMoneyCell(calc.totalPay, "strong-money"));
    tr.appendChild(makeTextCell(getSettingStatus(setting, employmentType)));

    dom.payrollBody.appendChild(tr);
  });

  if (selectedStaffName) {
    const selectedStillVisible = filteredRows.some((row) => String(row.staffName || "").trim() === selectedStaffName);
    if (selectedStillVisible) {
      renderStaffEditor(selectedStaffName);
    } else {
      closeStaffEditor(false);
    }
  }

  updateSummary();
}

function makeStaffNameCell(staffName) {
  const td = document.createElement("td");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = staffName || "名称未設定";
  button.title = "このスタッフの給与設定を開く";
  button.addEventListener("click", () => renderStaffEditor(staffName));
  td.appendChild(button);
  return td;
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

function makePaySettingResultCell(setting, employmentType) {
  if (employmentType === "社員") {
    return makeMoneyCell(setting.monthlySalary || 0);
  }
  if (employmentType === "パート") {
    return makeMoneyCell(setting.hourlyWage || 0);
  }
  return makeTextCell("-");
}

function makeMonthlyAverageResultCell(setting, employmentType) {
  const td = document.createElement("td");
  td.className = "number-cell";

  if (employmentType !== "社員") {
    td.textContent = "-";
    return td;
  }

  td.textContent = formatDecimal(getStaffMonthlyAverageHours(setting));
  return td;
}

function getSettingStatus(setting, employmentType) {
  const hasMultiplier = Number(setting && setting.overtimeMultiplier) >= 1;
  const hasMonthlyAverage = employmentType === "社員" && Number(setting && setting.monthlyAverageHours) >= 1;
  const hasSalary = employmentType === "社員" && Number(setting && setting.monthlySalary) > 0;
  const hasWage = employmentType === "パート" && Number(setting && setting.hourlyWage) > 0;

  if (hasSalary || hasWage || hasMultiplier || hasMonthlyAverage) return "個別あり";
  return "共通";
}

function renderStaffEditor(staffName) {
  const key = String(staffName || "").trim();
  if (!key) return;

  const row = payrollRows.find((item) => String(item.staffName || "").trim() === key);
  if (!row) {
    showMessage("対象スタッフが見つかりませんでした。", "error");
    return;
  }

  selectedStaffName = key;
  const employmentType = normalizeEmploymentType(row.employmentType);
  const setting = getPaySetting(key);

  dom.editStaffNameText.textContent = key;
  dom.editEmploymentTypeText.textContent = employmentType || "未設定";

  const isEmployee = employmentType === "社員";
  const isPartTime = employmentType === "パート";

  dom.monthlySalaryLabel.hidden = !isEmployee;
  dom.hourlyWageLabel.hidden = isEmployee;
  dom.staffMonthlyAverageHoursLabel.hidden = !isEmployee;

  dom.editMonthlySalary.value = setting.monthlySalary ? String(setting.monthlySalary) : "";
  dom.editHourlyWage.value = setting.hourlyWage ? String(setting.hourlyWage) : "";
  dom.editOvertimeMultiplier.value = setting.overtimeMultiplier ? formatDecimal(setting.overtimeMultiplier) : "";
  dom.editOvertimeMultiplier.placeholder = `共通 ${formatDecimal(getOvertimeMultiplier())}`;
  dom.editStaffMonthlyAverageHours.value = setting.monthlyAverageHours ? formatDecimal(setting.monthlyAverageHours) : "";
  dom.editStaffMonthlyAverageHours.placeholder = `共通 ${formatDecimal(getMonthlyAverageHours())}`;

  if (isEmployee) {
    dom.staffEditHelpText.textContent = "月給・残業倍率・月平均所定労働時間をスタッフ別に設定できます。空欄の残業倍率と月平均所定労働時間は共通設定を使います。";
  } else if (isPartTime) {
    dom.staffEditHelpText.textContent = "パートは時給と残業倍率を設定できます。月平均所定労働時間は対象外です。";
  } else {
    dom.staffEditHelpText.textContent = "雇用形態が未設定です。必要な項目だけ入力できます。";
  }

  dom.staffEditArea.hidden = false;
  dom.staffEditArea.scrollIntoView({ behavior: "smooth", block: "start" });
  showMessage(`${key} さんの設定フォームを開きました。`, "neutral");
}

function saveStaffEditor() {
  if (!selectedStaffName) {
    showMessage("保存するスタッフを選んでください。", "error");
    return;
  }

  const row = payrollRows.find((item) => String(item.staffName || "").trim() === selectedStaffName);
  if (!row) {
    showMessage("対象スタッフが見つかりませんでした。", "error");
    return;
  }

  const employmentType = normalizeEmploymentType(row.employmentType);
  const current = getPaySetting(selectedStaffName);
  const monthlySalary = normalizeMoneyInput(dom.editMonthlySalary.value);
  const hourlyWage = normalizeMoneyInput(dom.editHourlyWage.value);
  const multiplier = normalizeDecimalInput(dom.editOvertimeMultiplier.value, 1);
  const staffMonthlyHours = normalizeDecimalInput(dom.editStaffMonthlyAverageHours.value, 1);

  if (employmentType === "社員") {
    if (monthlySalary === null) {
      delete current.monthlySalary;
    } else {
      current.monthlySalary = monthlySalary;
    }
    delete current.hourlyWage;
  } else {
    if (hourlyWage === null) {
      delete current.hourlyWage;
    } else {
      current.hourlyWage = hourlyWage;
    }
    delete current.monthlySalary;
  }

  if (multiplier === null) {
    delete current.overtimeMultiplier;
  } else {
    current.overtimeMultiplier = multiplier;
  }

  if (employmentType === "社員") {
    if (staffMonthlyHours === null) {
      delete current.monthlyAverageHours;
    } else {
      current.monthlyAverageHours = staffMonthlyHours;
    }
  } else {
    delete current.monthlyAverageHours;
  }

  paySettings[selectedStaffName] = current;
  savePaySettings();
  renderPayrollTable();
  renderStaffEditor(selectedStaffName);
  showMessage(`${selectedStaffName} さんの給与設定を保存しました。`, "ok");
}

function closeStaffEditor(showClosedMessage) {
  selectedStaffName = "";
  if (dom.staffEditArea) dom.staffEditArea.hidden = true;
  if (showClosedMessage) showMessage("スタッフ別設定を閉じました。", "neutral");
}

function calculatePay(row, setting, employmentType) {
  const totalHours = safeNumber(row.totalHours);
  const overtimeHours = safeNumber(row.overtimeHours);
  const nonWorkHours = safeNumber(row.nonWorkHours);
  const normalHours = Math.max(0, totalHours - overtimeHours);
  const multiplier = getStaffOvertimeMultiplier(setting);

  if (employmentType === "社員") {
    const monthlySalary = safeNumber(setting.monthlySalary);
    const monthlyHours = getStaffMonthlyAverageHours(setting);
    const hourlyUnit = monthlySalary > 0 ? monthlySalary / monthlyHours : 0;
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

function requestCommonSettingUpdate(type) {
  pendingCommonSettingType = type;

  let label = "";
  let nextText = "";
  let currentText = "";

  if (type === "monthlyAverageHours") {
    const value = normalizeDecimalInput(dom.monthlyAverageHours.value, 1);
    label = "共通：社員用 月平均所定労働時間";
    nextText = value === null ? `初期値 ${formatDecimal(DEFAULT_MONTHLY_AVERAGE_HOURS)} 時間` : `${formatDecimal(value)} 時間`;
    currentText = `${formatDecimal(monthlyAverageHours)} 時間`;
  } else if (type === "overtimeMultiplier") {
    const value = normalizeDecimalInput(dom.overtimeMultiplier.value, 1);
    label = "共通残業割増倍率";
    nextText = value === null ? `初期値 ${formatDecimal(DEFAULT_OVERTIME_MULTIPLIER)}` : formatDecimal(value);
    currentText = formatDecimal(overtimeMultiplier);
  } else {
    return;
  }

  dom.commonSettingConfirmText.textContent = `${label}を ${currentText} から ${nextText} に一括で変更いたしますがよろしいですか？`;
  dom.commonSettingConfirmArea.hidden = false;
  dom.confirmCommonSettingYesButton.focus();
}

function confirmCommonSettingUpdate() {
  if (pendingCommonSettingType === "monthlyAverageHours") {
    applyMonthlyAverageHoursUpdate();
  } else if (pendingCommonSettingType === "overtimeMultiplier") {
    applyOvertimeMultiplierUpdate();
  }

  closeCommonSettingConfirm();
}

function cancelCommonSettingUpdate() {
  restoreCommonSettingInputs();
  closeCommonSettingConfirm();
  showMessage("共通設定の変更をキャンセルしました。", "neutral");
}

function closeCommonSettingConfirm() {
  pendingCommonSettingType = "";
  dom.commonSettingConfirmArea.hidden = true;
}

function restoreCommonSettingInputs() {
  dom.monthlyAverageHours.value = formatDecimal(monthlyAverageHours);
  dom.overtimeMultiplier.value = formatDecimal(overtimeMultiplier);
}

function applyMonthlyAverageHoursUpdate() {
  const value = normalizeDecimalInput(dom.monthlyAverageHours.value, 1);

  if (value === null) {
    monthlyAverageHours = DEFAULT_MONTHLY_AVERAGE_HOURS;
    dom.monthlyAverageHours.value = formatDecimal(monthlyAverageHours);
    localStorage.removeItem(MONTHLY_AVERAGE_HOURS_STORAGE_KEY);
    showMessage(`共通の月平均所定労働時間を初期値 ${formatDecimal(monthlyAverageHours)} に戻しました。`, "neutral");
  } else {
    monthlyAverageHours = value;
    dom.monthlyAverageHours.value = formatDecimal(monthlyAverageHours);
    localStorage.setItem(MONTHLY_AVERAGE_HOURS_STORAGE_KEY, String(monthlyAverageHours));
    showMessage(`共通の月平均所定労働時間を ${formatDecimal(monthlyAverageHours)} 時間にしました。`, "ok");
  }

  renderPayrollTable();
  if (selectedStaffName) renderStaffEditor(selectedStaffName);
}

function applyOvertimeMultiplierUpdate() {
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
  if (selectedStaffName) renderStaffEditor(selectedStaffName);
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

function getStaffMonthlyAverageHours(setting) {
  const value = Number(setting && setting.monthlyAverageHours);
  return Number.isFinite(value) && value >= 1 ? value : getMonthlyAverageHours();
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
