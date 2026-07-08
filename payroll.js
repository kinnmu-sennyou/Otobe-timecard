const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbykqf1T967tzrQ_A63vHsMfrNp_QBuoaRAfOvchF0MEpZ1ob5xgGXeNbglUvTj-rw8uKg/exec";
const APP_VERSION = "payroll-view-transport-public-manual-20260707-58";

const PAY_SETTING_STORAGE_KEY = "otobe-payroll:paySettings:v35";
const OVERTIME_MULTIPLIER_STORAGE_KEY = "otobe-payroll:overtimeMultiplier";
const MONTHLY_AVERAGE_HOURS_STORAGE_KEY = "otobe-payroll:monthlyAverageHours";
const DEFAULT_OVERTIME_MULTIPLIER = 1.25;
const DEFAULT_MONTHLY_AVERAGE_HOURS = 173.33;
const HEALTH_INSURANCE_RATE_STORAGE_KEY = "otobe-payroll:healthInsuranceRate";
const CARE_INSURANCE_RATE_STORAGE_KEY = "otobe-payroll:careInsuranceRate";
const PENSION_INSURANCE_RATE_STORAGE_KEY = "otobe-payroll:pensionInsuranceRate";
const EMPLOYMENT_INSURANCE_RATE_STORAGE_KEY = "otobe-payroll:employmentInsuranceRate";
const DEFAULT_HEALTH_INSURANCE_RATE = 9.85;
const DEFAULT_CARE_INSURANCE_RATE = 1.62;
const DEFAULT_PENSION_INSURANCE_RATE = 18.3;
const DEFAULT_EMPLOYMENT_INSURANCE_RATE = 0.5;
const TRANSPORT_RATE_STORAGE_KEY = "otobe-payroll:transportRate";
const DEFAULT_TRANSPORT_RATE = 0;
const COMMUTE_METHODS = ["車", "公共交通機関", "徒歩(自転車)"];

let payrollRows = [];
let filteredRows = [];
let isLoading = false;
let currentAdminKey = "";
let selectedStaffName = "";
let selectedPayslipStaffNames = new Set();
let temporaryStaffPayslipNotes = {};
let paySettings = readPaySettings();
let overtimeMultiplier = readNumberSetting(OVERTIME_MULTIPLIER_STORAGE_KEY, DEFAULT_OVERTIME_MULTIPLIER, 1);
let monthlyAverageHours = readNumberSetting(MONTHLY_AVERAGE_HOURS_STORAGE_KEY, DEFAULT_MONTHLY_AVERAGE_HOURS, 1);
let healthInsuranceRate = readNumberSetting(HEALTH_INSURANCE_RATE_STORAGE_KEY, DEFAULT_HEALTH_INSURANCE_RATE, 0);
let careInsuranceRate = readNumberSetting(CARE_INSURANCE_RATE_STORAGE_KEY, DEFAULT_CARE_INSURANCE_RATE, 0);
let pensionInsuranceRate = readNumberSetting(PENSION_INSURANCE_RATE_STORAGE_KEY, DEFAULT_PENSION_INSURANCE_RATE, 0);
let employmentInsuranceRate = readNumberSetting(EMPLOYMENT_INSURANCE_RATE_STORAGE_KEY, DEFAULT_EMPLOYMENT_INSURANCE_RATE, 0);
let transportRate = readNumberSetting(TRANSPORT_RATE_STORAGE_KEY, DEFAULT_TRANSPORT_RATE, 0);
let commonPayslipNote = "";
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
    totalNetPayText: document.getElementById("totalNetPayText"),
    searchInput: document.getElementById("searchInput"),
    monthlyAverageHours: document.getElementById("monthlyAverageHours"),
    overtimeMultiplier: document.getElementById("overtimeMultiplier"),
    updateMonthlyAverageHoursButton: document.getElementById("updateMonthlyAverageHoursButton"),
    updateOvertimeMultiplierButton: document.getElementById("updateOvertimeMultiplierButton"),
    healthInsuranceRate: document.getElementById("healthInsuranceRate"),
    careInsuranceRate: document.getElementById("careInsuranceRate"),
    pensionInsuranceRate: document.getElementById("pensionInsuranceRate"),
    employmentInsuranceRate: document.getElementById("employmentInsuranceRate"),
    commonPayslipNote: document.getElementById("commonPayslipNote"),
    transportRate: document.getElementById("transportRate"),
    updateTransportRateButton: document.getElementById("updateTransportRateButton"),
    updateDeductionRatesButton: document.getElementById("updateDeductionRatesButton"),
    commonSettingConfirmArea: document.getElementById("commonSettingConfirmArea"),
    commonSettingConfirmText: document.getElementById("commonSettingConfirmText"),
    confirmCommonSettingYesButton: document.getElementById("confirmCommonSettingYesButton"),
    confirmCommonSettingNoButton: document.getElementById("confirmCommonSettingNoButton"),
    payrollBody: document.getElementById("payrollBody"),
    selectVisibleStaffButton: document.getElementById("selectVisibleStaffButton"),
    clearSelectedStaffButton: document.getElementById("clearSelectedStaffButton"),
    createSelectedPayslipButton: document.getElementById("createSelectedPayslipButton"),
    selectedPayslipCountText: document.getElementById("selectedPayslipCountText"),
    payslipPrintArea: document.getElementById("payslipPrintArea"),
    staffEditArea: document.getElementById("staffEditArea"),
    editStaffNameText: document.getElementById("editStaffNameText"),
    editEmploymentTypeText: document.getElementById("editEmploymentTypeText"),
    detailTotalPayText: document.getElementById("detailTotalPayText"),
    detailDeductionText: document.getElementById("detailDeductionText"),
    detailNetPayText: document.getElementById("detailNetPayText"),
    detailHourlyUnitText: document.getElementById("detailHourlyUnitText"),
    selectedDetailBody: document.getElementById("selectedDetailBody"),
    monthlySalaryLabel: document.getElementById("monthlySalaryLabel"),
    hourlyWageLabel: document.getElementById("hourlyWageLabel"),
    editMonthlySalary: document.getElementById("editMonthlySalary"),
    editHourlyWage: document.getElementById("editHourlyWage"),
    editOvertimeMultiplier: document.getElementById("editOvertimeMultiplier"),
    staffMonthlyAverageHoursLabel: document.getElementById("staffMonthlyAverageHoursLabel"),
    editStaffMonthlyAverageHours: document.getElementById("editStaffMonthlyAverageHours"),
    editStandardMonthlyRemuneration: document.getElementById("editStandardMonthlyRemuneration"),
    editHealthInsuranceEnabled: document.getElementById("editHealthInsuranceEnabled"),
    editCareInsuranceEnabled: document.getElementById("editCareInsuranceEnabled"),
    editPensionInsuranceEnabled: document.getElementById("editPensionInsuranceEnabled"),
    editEmploymentInsuranceEnabled: document.getElementById("editEmploymentInsuranceEnabled"),
    editIncomeTax: document.getElementById("editIncomeTax"),
    editResidentTax: document.getElementById("editResidentTax"),
    editOtherDeduction: document.getElementById("editOtherDeduction"),
    editStaffPayslipNote: document.getElementById("editStaffPayslipNote"),
    editStaffTransportRate: document.getElementById("editStaffTransportRate"),
    editCommuteDistance: document.getElementById("editCommuteDistance"),
    editCommuteMethod: document.getElementById("editCommuteMethod"),
    editPublicTransportFare: document.getElementById("editPublicTransportFare"),
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
  dom.selectVisibleStaffButton.addEventListener("click", selectVisibleStaffForPayslip);
  dom.clearSelectedStaffButton.addEventListener("click", clearSelectedStaffForPayslip);
  dom.createSelectedPayslipButton.addEventListener("click", createSelectedPayslipPdf);
  dom.editStaffPayslipNote.addEventListener("input", () => {
    if (selectedStaffName) temporaryStaffPayslipNotes[selectedStaffName] = normalizeNoteInput(dom.editStaffPayslipNote.value);
  });
  dom.commonPayslipNote.addEventListener("input", () => {
    commonPayslipNote = normalizeNoteInput(dom.commonPayslipNote.value);
  });

  dom.monthlyAverageHours.value = formatDecimal(monthlyAverageHours);
  dom.updateMonthlyAverageHoursButton.addEventListener("click", () => requestCommonSettingUpdate("monthlyAverageHours"));

  dom.overtimeMultiplier.value = formatDecimal(overtimeMultiplier);
  dom.updateOvertimeMultiplierButton.addEventListener("click", () => requestCommonSettingUpdate("overtimeMultiplier"));

  dom.healthInsuranceRate.value = formatDecimal(healthInsuranceRate);
  dom.careInsuranceRate.value = formatDecimal(careInsuranceRate);
  dom.pensionInsuranceRate.value = formatDecimal(pensionInsuranceRate);
  dom.employmentInsuranceRate.value = formatDecimal(employmentInsuranceRate);
  dom.transportRate.value = formatDecimal(transportRate);
  dom.commonPayslipNote.value = commonPayslipNote;
  dom.updateTransportRateButton.addEventListener("click", () => requestCommonSettingUpdate("transportRate"));
  dom.updateDeductionRatesButton.addEventListener("click", () => requestCommonSettingUpdate("deductionRates"));
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

    currentAdminKey = adminKey;
    payrollRows = sortPayrollRowsByEmployeeNo(Array.isArray(result.rows) ? result.rows : []);
    selectedPayslipStaffNames = new Set();
    await loadPayrollSettingsFromServer(adminKey);
    selectedStaffName = "";
    dom.staffEditArea.hidden = true;
    dom.targetMonthText.textContent = result.targetKey || "-";
    dom.summaryArea.hidden = false;
    dom.controlsArea.hidden = false;
    dom.tableArea.hidden = false;
    renderPayrollTable();
    showMessage(result.message || "給与計算データと保存済み設定を取得しました。", "ok");
  } catch (error) {
    console.error(error);
    showMessage(`取得できませんでした：${error.message}`, "error");
  } finally {
    stopLoading();
  }
}

function sortPayrollRowsByEmployeeNo(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort(comparePayrollRowsByEmployeeNo);
}

function comparePayrollRowsByEmployeeNo(a, b) {
  const noA = normalizeEmployeeNoForSort(a && a.employeeNo);
  const noB = normalizeEmployeeNoForSort(b && b.employeeNo);

  if (noA.hasNo && noB.hasNo && noA.num !== noB.num) return noA.num - noB.num;
  if (noA.hasNo && !noB.hasNo) return -1;
  if (!noA.hasNo && noB.hasNo) return 1;

  const nameA = normalizeName(a && a.staffName).toLowerCase();
  const nameB = normalizeName(b && b.staffName).toLowerCase();
  return nameA.localeCompare(nameB, "ja");
}

function normalizeEmployeeNoForSort(value) {
  const text = String(value || "").trim();
  const digits = text.replace(/\D/g, "");
  if (!digits) return { hasNo: false, num: Number.MAX_SAFE_INTEGER };
  const num = Number(digits);
  return Number.isFinite(num) ? { hasNo: true, num } : { hasNo: false, num: Number.MAX_SAFE_INTEGER };
}

function renderPayrollTable() {
  const query = normalizeName(dom.searchInput.value).toLowerCase();

  filteredRows = sortPayrollRowsByEmployeeNo(payrollRows.filter((row) => {
    const staffName = normalizeName(row.staffName).toLowerCase();
    return !query || staffName.includes(query);
  }));

  dom.payrollBody.innerHTML = "";

  if (!filteredRows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.className = "empty-cell";
    td.textContent = payrollRows.length ? "該当スタッフがいません。" : "給与計算データがありません。";
    tr.appendChild(td);
    dom.payrollBody.appendChild(tr);
    updateSummary();
    updatePayslipSelectionControls();
    return;
  }

  filteredRows.forEach((row) => {
    const staffName = String(row.staffName || "").trim();
    const employmentType = normalizeEmploymentType(row.employmentType);
    const tr = document.createElement("tr");

    tr.appendChild(makePayslipSelectionCell(staffName));
    tr.appendChild(makeStaffNameCell(staffName));
    tr.appendChild(makeTextCell(employmentType || "未設定"));
    tr.appendChild(makeNumberCell(row.attendanceDays));
    tr.appendChild(makeNumberCell(row.totalHours));
    tr.appendChild(makeNumberCell(row.overtimeHours));
    tr.appendChild(makeNumberCell(row.nonWorkHours));
    tr.appendChild(makeNumberCell(row.week40Over));

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
  updatePayslipSelectionControls();
}

function makePayslipSelectionCell(staffName) {
  const td = document.createElement("td");
  td.className = "select-cell";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = selectedPayslipStaffNames.has(staffName);
  checkbox.setAttribute("aria-label", `${staffName} さんを給与明細PDFの対象にする`);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selectedPayslipStaffNames.add(staffName);
    } else {
      selectedPayslipStaffNames.delete(staffName);
    }
    updatePayslipSelectionControls();
  });
  td.appendChild(checkbox);
  return td;
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

  const hasDeductions = hasDeductionSetting(setting);
  const hasTransport = hasTransportSetting(setting);
  if (hasSalary || hasWage || hasMultiplier || hasMonthlyAverage || hasDeductions || hasTransport) return "個別あり";
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
  dom.editOvertimeMultiplier.value = setting.overtimeMultiplier ? formatDecimal(setting.overtimeMultiplier) : "0";
  dom.editOvertimeMultiplier.placeholder = "";
  dom.editStaffMonthlyAverageHours.value = setting.monthlyAverageHours ? formatDecimal(setting.monthlyAverageHours) : "0";
  dom.editStaffMonthlyAverageHours.placeholder = "";
  dom.editStandardMonthlyRemuneration.value = setting.standardMonthlyRemuneration ? String(setting.standardMonthlyRemuneration) : "";
  dom.editHealthInsuranceEnabled.value = setting.healthInsuranceEnabled ? "on" : "off";
  dom.editCareInsuranceEnabled.value = setting.careInsuranceEnabled ? "on" : "off";
  dom.editPensionInsuranceEnabled.value = setting.pensionInsuranceEnabled ? "on" : "off";
  dom.editEmploymentInsuranceEnabled.value = setting.employmentInsuranceEnabled ? "on" : "off";
  dom.editIncomeTax.value = setting.incomeTax ? String(setting.incomeTax) : "";
  dom.editResidentTax.value = setting.residentTax ? String(setting.residentTax) : "";
  dom.editOtherDeduction.value = setting.otherDeduction ? String(setting.otherDeduction) : "";
  dom.editStaffTransportRate.value = setting.transportRate !== undefined && setting.transportRate !== null ? formatDecimal(setting.transportRate) : "";
  dom.editCommuteDistance.value = setting.commuteDistance !== undefined && setting.commuteDistance !== null ? formatDecimal(setting.commuteDistance) : "";
  dom.editCommuteMethod.value = normalizeCommuteMethod(setting.commuteMethod) || "";
  dom.editPublicTransportFare.value = setting.publicTransportFare !== undefined && setting.publicTransportFare !== null ? String(Math.round(safeNumber(setting.publicTransportFare))) : "";
  dom.editStaffPayslipNote.value = String(temporaryStaffPayslipNotes[key] || "");

  if (isEmployee) {
    dom.staffEditHelpText.textContent = "月給・残業倍率・月平均所定労働時間をスタッフ別に設定できます。0のまま保存すると共通設定を使います。";
  } else if (isPartTime) {
    dom.staffEditHelpText.textContent = "パートは時給と残業倍率を設定できます。残業倍率を0のまま保存すると共通設定を使います。月平均所定労働時間は対象外です。";
  } else {
    dom.staffEditHelpText.textContent = "雇用形態が未設定です。必要な項目だけ入力できます。残業倍率を0のまま保存すると共通設定を使います。";
  }

  renderSelectedStaffDetail(row, setting, employmentType);

  dom.staffEditArea.hidden = false;
  dom.staffEditArea.scrollIntoView({ behavior: "smooth", block: "start" });
  showMessage(`${key} さんの設定フォームを開きました。`, "neutral");
}


function renderSelectedStaffDetail(row, setting, employmentType) {
  const calc = calculatePay(row, setting, employmentType);
  dom.detailTotalPayText.textContent = formatYen(calc.totalPay);
  dom.detailDeductionText.textContent = formatYen(calc.deductions.totalDeduction);
  dom.detailNetPayText.textContent = formatYen(calc.netPay);
  dom.detailHourlyUnitText.textContent = formatYen(calc.hourlyUnit);

  const detailRows = [
    ["月給 / 時給", employmentType === "社員" ? formatYen(setting.monthlySalary || 0) : employmentType === "パート" ? formatYen(setting.hourlyWage || 0) : "-"],
    ["残業倍率", formatDecimal(getStaffOvertimeMultiplier(setting))],
    ["月平均所定", employmentType === "社員" ? `${formatDecimal(getStaffMonthlyAverageHours(setting))}時間` : "-"],
    ["通常分", formatYen(calc.basePay)],
    ["残業代", formatYen(calc.overtimePay)],
    ["通勤手当", formatYen(calc.transportAllowance)],
    ["通勤手段", getCommuteMethodLabel(setting)],
    ["通勤距離", `${formatDecimal(safeNumber(setting.commuteDistance))}km`],
    ["交通費利率", `${formatDecimal(getStaffTransportRate(setting))}円/km`],
    ["公共交通機関 交通費", formatYen(setting.publicTransportFare || 0)],
    ["不就労控除", formatYen(calc.nonWorkDeduction)],
    ["健康保険", formatYen(calc.deductions.healthInsurance)],
    ["介護保険", formatYen(calc.deductions.careInsurance)],
    ["厚生年金", formatYen(calc.deductions.pensionInsurance)],
    ["雇用保険", formatYen(calc.deductions.employmentInsurance)],
    ["所得税", formatYen(calc.deductions.incomeTax)],
    ["住民税", formatYen(calc.deductions.residentTax)],
    ["その他控除", formatYen(calc.deductions.otherDeduction)],
  ];

  dom.selectedDetailBody.innerHTML = "";
  detailRows.forEach(([label, value]) => {
    const tr = document.createElement("tr");
    tr.appendChild(makeTextCell(label));
    const valueCell = makeTextCell(value);
    valueCell.className = "money-cell";
    tr.appendChild(valueCell);
    dom.selectedDetailBody.appendChild(tr);
  });
}


function selectVisibleStaffForPayslip() {
  filteredRows.forEach((row) => {
    const staffName = String(row.staffName || "").trim();
    if (staffName) selectedPayslipStaffNames.add(staffName);
  });
  renderPayrollTable();
  showMessage(`表示中スタッフ ${filteredRows.length}名を給与明細PDFの対象にしました。`, "ok");
}

function clearSelectedStaffForPayslip() {
  selectedPayslipStaffNames = new Set();
  renderPayrollTable();
  showMessage("給与明細PDFの選択を解除しました。", "neutral");
}

function updatePayslipSelectionControls() {
  if (!dom.selectedPayslipCountText) return;
  const count = selectedPayslipStaffNames.size;
  dom.selectedPayslipCountText.textContent = `選択中 ${count}名`;
  if (dom.createSelectedPayslipButton) dom.createSelectedPayslipButton.disabled = count === 0;
  if (dom.clearSelectedStaffButton) dom.clearSelectedStaffButton.disabled = count === 0;
}

function createSelectedPayslipPdf() {
  const selectedRows = sortPayrollRowsByEmployeeNo(payrollRows.filter((row) => selectedPayslipStaffNames.has(String(row.staffName || "").trim())));

  if (!selectedRows.length) {
    showMessage("給与明細PDFを作るスタッフを選択してください。", "error");
    return;
  }

  dom.payslipPrintArea.innerHTML = "";
  selectedRows.forEach((row) => {
    dom.payslipPrintArea.appendChild(buildPayslipPage(row));
  });

  showMessage(`選択中 ${selectedRows.length}名分の給与明細を作成しました。印刷画面でPDF保存してください。`, "ok");
  window.setTimeout(() => window.print(), 150);
}

function buildPayslipPage(row) {
  const staffName = String(row.staffName || "").trim();
  const employmentType = normalizeEmploymentType(row.employmentType);
  const setting = getPaySetting(staffName);
  const calc = calculatePay(row, setting, employmentType);
  const page = document.createElement("section");
  page.className = "payslip-page";

  const title = document.createElement("h1");
  title.className = "payslip-title";
  title.textContent = "給与明細書";
  page.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "payslip-meta";
  appendMeta(meta, "対象月", dom.targetMonthText.textContent || "-");
  appendMeta(meta, "氏名", staffName || "-");
  appendMeta(meta, "雇用形態", employmentType || "未設定");
  appendMeta(meta, "作成日", formatDateForPayslip(new Date()));
  page.appendChild(meta);

  const totalBox = document.createElement("div");
  totalBox.className = "payslip-total-box";
  appendTotalCard(totalBox, "支給合計", formatYen(calc.totalPay));
  appendTotalCard(totalBox, "控除合計", formatYen(calc.deductions.totalDeduction));
  appendTotalCard(totalBox, "差引支給額", formatYen(calc.netPay));
  page.appendChild(totalBox);

  appendPayslipSection(page, "1. 勤怠項目（計算の根拠）", [
    ["出勤日数", `${formatNumber(row.attendanceDays)}日`],
    ["労働時間数", `${formatNumber(row.totalHours)}時間`],
    ["残業時間数", `${formatNumber(row.overtimeHours)}時間`],
    ["有給消化数", "-"],
  ]);

  appendPayslipSection(page, "2. 支給項目（給与等の金額）", [
    ["基本給", formatYen(calc.basePay)],
    ["各種手当", formatYen(0)],
    ["通勤手当", formatYen(calc.transportAllowance)],
    ["時間外手当", formatYen(calc.overtimePay)],
    ["総支給額", formatYen(calc.totalPay)],
  ], true);

  const socialInsuranceTotal =
    calc.deductions.healthInsurance +
    calc.deductions.careInsurance +
    calc.deductions.pensionInsurance +
    calc.deductions.employmentInsurance;

  appendPayslipSection(page, "3. 控除項目（天引きされる税金・保険料）", [
    ["社会保険料", formatYen(socialInsuranceTotal)],
    ["源泉所得税", formatYen(calc.deductions.incomeTax)],
    ["住民税", formatYen(calc.deductions.residentTax)],
    ["その他", formatYen(calc.deductions.otherDeduction)],
    ["控除計", formatYen(calc.deductions.totalDeduction)],
  ], true);

  appendPayslipSection(page, "4. 差引支給額（手取り額）", [
    ["差引支給額", formatYen(calc.netPay)],
  ], true);

  const remarks = [];
  const staffNote = normalizeNoteInput(temporaryStaffPayslipNotes[staffName] || "");
  const commonNote = normalizeNoteInput((dom.commonPayslipNote && dom.commonPayslipNote.value) || commonPayslipNote || "");
  if (staffNote) remarks.push(["個別備考", staffNote]);
  if (commonNote) remarks.push(["共通備考", commonNote]);
  if (remarks.length) {
    appendPayslipSection(page, "5. 備考", remarks, false);
  }

  const note = document.createElement("p");
  note.className = "payslip-note";
  note.textContent = "この明細は給与計算ビューの設定内容をもとに作成しています。各種手当・有給消化数は現在の入力項目がないため、必要に応じて別途確認してください。通勤手当は、車は交通費利率・通勤距離・出勤日数から計算し、公共交通機関はスタッフ別の手動入力金額を使っています。";
  page.appendChild(note);

  return page;
}

function appendMeta(parent, label, value) {
  const item = document.createElement("div");
  item.textContent = `${label}：${value}`;
  parent.appendChild(item);
}

function appendTotalCard(parent, label, value) {
  const card = document.createElement("div");
  card.className = "payslip-total-card";
  const span = document.createElement("span");
  span.textContent = label;
  const strong = document.createElement("strong");
  strong.textContent = value;
  card.appendChild(span);
  card.appendChild(strong);
  parent.appendChild(card);
}

function appendPayslipSection(parent, titleText, rows, moneySecondColumn) {
  const title = document.createElement("div");
  title.className = "payslip-section-title";
  title.textContent = titleText;
  parent.appendChild(title);

  const table = document.createElement("table");
  table.className = "payslip-table";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["項目", moneySecondColumn ? "金額" : "内容"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach(([label, value]) => {
    const tr = document.createElement("tr");
    const labelCell = document.createElement("td");
    labelCell.textContent = label;
    const valueCell = document.createElement("td");
    valueCell.textContent = value;
    if (moneySecondColumn) valueCell.className = "payslip-money";
    tr.appendChild(labelCell);
    tr.appendChild(valueCell);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  parent.appendChild(table);
}

function formatDateForPayslip(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function saveStaffEditor() {
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
  const standardMonthlyRemuneration = normalizeMoneyInput(dom.editStandardMonthlyRemuneration.value);
  const incomeTax = normalizeMoneyInput(dom.editIncomeTax.value);
  const residentTax = normalizeMoneyInput(dom.editResidentTax.value);
  const otherDeduction = normalizeMoneyInput(dom.editOtherDeduction.value);
  const staffTransportRate = normalizeDecimalInput(dom.editStaffTransportRate.value, 0);
  const commuteDistance = normalizeDecimalInput(dom.editCommuteDistance.value, 0);
  const commuteMethod = normalizeCommuteMethod(dom.editCommuteMethod.value);
  const publicTransportFare = normalizeMoneyInput(dom.editPublicTransportFare.value);

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

  setOrDeleteMoneySetting(current, "standardMonthlyRemuneration", standardMonthlyRemuneration);
  current.healthInsuranceEnabled = dom.editHealthInsuranceEnabled.value === "on";
  current.careInsuranceEnabled = dom.editCareInsuranceEnabled.value === "on";
  current.pensionInsuranceEnabled = dom.editPensionInsuranceEnabled.value === "on";
  current.employmentInsuranceEnabled = dom.editEmploymentInsuranceEnabled.value === "on";
  setOrDeleteMoneySetting(current, "incomeTax", incomeTax);
  setOrDeleteMoneySetting(current, "residentTax", residentTax);
  setOrDeleteMoneySetting(current, "otherDeduction", otherDeduction);

  if (staffTransportRate === null) {
    delete current.transportRate;
  } else {
    current.transportRate = staffTransportRate;
  }

  if (commuteDistance === null) {
    delete current.commuteDistance;
  } else {
    current.commuteDistance = commuteDistance;
  }

  if (commuteMethod) {
    current.commuteMethod = commuteMethod;
  } else {
    delete current.commuteMethod;
  }

  if (publicTransportFare === null) {
    delete current.publicTransportFare;
  } else {
    current.publicTransportFare = publicTransportFare;
  }

  temporaryStaffPayslipNotes[selectedStaffName] = normalizeNoteInput(dom.editStaffPayslipNote.value);

  paySettings[selectedStaffName] = current;
  savePaySettings();

  try {
    await saveStaffSettingToServer(selectedStaffName, current);
  } catch (error) {
    console.error(error);
    showMessage(`端末には保存しましたが、給与設定専用スプレッドシートへの共有保存に失敗しました：${error.message}`, "error");
    renderPayrollTable();
    renderStaffEditor(selectedStaffName);
    return;
  }

  renderPayrollTable();
  renderStaffEditor(selectedStaffName);
  showMessage(`${selectedStaffName} さんの給与設定を給与設定専用スプレッドシートへ保存しました。`, "ok");
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
  const transportAllowance = calculateTransportAllowance(row, setting);

  if (employmentType === "社員") {
    const monthlySalary = safeNumber(setting.monthlySalary);
    const monthlyHours = getStaffMonthlyAverageHours(setting);
    const hourlyUnit = monthlySalary > 0 ? monthlySalary / monthlyHours : 0;
    const basePay = monthlySalary;
    const overtimePay = hourlyUnit * overtimeHours * multiplier;
    const nonWorkDeduction = hourlyUnit * nonWorkHours;
    const totalPay = basePay + overtimePay + transportAllowance - nonWorkDeduction;
    const deductions = calculateDeductions(setting, totalPay);
    const netPay = totalPay - deductions.totalDeduction;

    return roundPay({ hourlyUnit, basePay, overtimePay, transportAllowance, nonWorkDeduction, totalPay, deductions, netPay });
  }

  const hourlyWage = safeNumber(setting.hourlyWage);
  const hourlyUnit = hourlyWage;
  const basePay = hourlyWage * normalHours;
  const overtimePay = hourlyWage * overtimeHours * multiplier;
  const nonWorkDeduction = 0;
  const totalPay = basePay + overtimePay + transportAllowance;
  const deductions = calculateDeductions(setting, totalPay);
  const netPay = totalPay - deductions.totalDeduction;

  return roundPay({ hourlyUnit, basePay, overtimePay, transportAllowance, nonWorkDeduction, totalPay, deductions, netPay });
}

function roundPay(calc) {
  const deductions = calc.deductions || makeEmptyDeductions();
  return {
    hourlyUnit: Math.round(safeNumber(calc.hourlyUnit)),
    basePay: Math.round(safeNumber(calc.basePay)),
    overtimePay: Math.round(safeNumber(calc.overtimePay)),
    transportAllowance: Math.round(safeNumber(calc.transportAllowance)),
    nonWorkDeduction: Math.round(safeNumber(calc.nonWorkDeduction)),
    totalPay: Math.round(safeNumber(calc.totalPay)),
    deductions: {
      healthInsurance: Math.round(safeNumber(deductions.healthInsurance)),
      careInsurance: Math.round(safeNumber(deductions.careInsurance)),
      pensionInsurance: Math.round(safeNumber(deductions.pensionInsurance)),
      employmentInsurance: Math.round(safeNumber(deductions.employmentInsurance)),
      incomeTax: Math.round(safeNumber(deductions.incomeTax)),
      residentTax: Math.round(safeNumber(deductions.residentTax)),
      otherDeduction: Math.round(safeNumber(deductions.otherDeduction)),
      totalDeduction: Math.round(safeNumber(deductions.totalDeduction)),
    },
    netPay: Math.round(safeNumber(calc.netPay)),
  };
}

function updateSummary() {
  let totalPay = 0;
  let totalNetPay = 0;

  filteredRows.forEach((row) => {
    const staffName = String(row.staffName || "").trim();
    const setting = getPaySetting(staffName);
    const employmentType = normalizeEmploymentType(row.employmentType);
    const calc = calculatePay(row, setting, employmentType);
    totalPay += calc.totalPay;
    totalNetPay += calc.netPay;
  });

  dom.staffCountText.textContent = `${filteredRows.length}名`;
  dom.totalPayText.textContent = formatYen(totalPay);
  dom.totalNetPayText.textContent = formatYen(totalNetPay);
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
  } else if (type === "transportRate") {
    const value = normalizeDecimalInput(dom.transportRate.value, 0);
    label = "共通：交通費利率";
    nextText = value === null ? `初期値 ${formatDecimal(DEFAULT_TRANSPORT_RATE)} 円/km` : `${formatDecimal(value)} 円/km`;
    currentText = `${formatDecimal(transportRate)} 円/km`;
  } else if (type === "deductionRates") {
    label = "控除共通料率・PDF全体備考";
    const nextNote = normalizeNoteInput(dom.commonPayslipNote.value);
    currentText = `健保 ${formatDecimal(healthInsuranceRate)}% / 介護 ${formatDecimal(careInsuranceRate)}% / 厚年 ${formatDecimal(pensionInsuranceRate)}% / 雇用 ${formatDecimal(employmentInsuranceRate)}% / 備考 ${commonPayslipNote ? "あり" : "なし"}`;
    nextText = `健保 ${formatDecimalInputOrDefault(dom.healthInsuranceRate.value, DEFAULT_HEALTH_INSURANCE_RATE)}% / 介護 ${formatDecimalInputOrDefault(dom.careInsuranceRate.value, DEFAULT_CARE_INSURANCE_RATE)}% / 厚年 ${formatDecimalInputOrDefault(dom.pensionInsuranceRate.value, DEFAULT_PENSION_INSURANCE_RATE)}% / 雇用 ${formatDecimalInputOrDefault(dom.employmentInsuranceRate.value, DEFAULT_EMPLOYMENT_INSURANCE_RATE)}% / 備考 ${nextNote ? "あり" : "なし"}`;
  } else {
    return;
  }

  dom.commonSettingConfirmText.textContent = `${label}を ${currentText} から ${nextText} に一括で変更いたしますがよろしいですか？`;
  dom.commonSettingConfirmArea.hidden = false;
  dom.confirmCommonSettingYesButton.focus();
}

async function confirmCommonSettingUpdate() {
  if (pendingCommonSettingType === "monthlyAverageHours") {
    await applyMonthlyAverageHoursUpdate();
  } else if (pendingCommonSettingType === "overtimeMultiplier") {
    await applyOvertimeMultiplierUpdate();
  } else if (pendingCommonSettingType === "transportRate") {
    await applyTransportRateUpdate();
  } else if (pendingCommonSettingType === "deductionRates") {
    await applyDeductionRatesUpdate();
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
  dom.healthInsuranceRate.value = formatDecimal(healthInsuranceRate);
  dom.careInsuranceRate.value = formatDecimal(careInsuranceRate);
  dom.pensionInsuranceRate.value = formatDecimal(pensionInsuranceRate);
  dom.employmentInsuranceRate.value = formatDecimal(employmentInsuranceRate);
  dom.transportRate.value = formatDecimal(transportRate);
  if (dom.commonPayslipNote) dom.commonPayslipNote.value = commonPayslipNote;
}

async function applyMonthlyAverageHoursUpdate() {
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

  try {
    await saveCommonSettingsToServer();
  } catch (error) {
    console.error(error);
    showMessage(`端末には保存しましたが、給与設定専用スプレッドシートへの共有保存に失敗しました：${error.message}`, "error");
  }

  renderPayrollTable();
  if (selectedStaffName) renderStaffEditor(selectedStaffName);
}

async function applyOvertimeMultiplierUpdate() {
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

  try {
    await saveCommonSettingsToServer();
  } catch (error) {
    console.error(error);
    showMessage(`端末には保存しましたが、給与設定専用スプレッドシートへの共有保存に失敗しました：${error.message}`, "error");
  }

  renderPayrollTable();
  if (selectedStaffName) renderStaffEditor(selectedStaffName);
}

async function applyTransportRateUpdate() {
  const value = normalizeDecimalInput(dom.transportRate.value, 0);

  if (value === null) {
    transportRate = DEFAULT_TRANSPORT_RATE;
    dom.transportRate.value = formatDecimal(transportRate);
    localStorage.removeItem(TRANSPORT_RATE_STORAGE_KEY);
    showMessage(`共通の交通費利率を初期値 ${formatDecimal(transportRate)} 円/kmに戻しました。`, "neutral");
  } else {
    transportRate = value;
    dom.transportRate.value = formatDecimal(transportRate);
    localStorage.setItem(TRANSPORT_RATE_STORAGE_KEY, String(transportRate));
    showMessage(`共通の交通費利率を ${formatDecimal(transportRate)} 円/kmにしました。`, "ok");
  }

  try {
    await saveCommonSettingsToServer();
  } catch (error) {
    console.error(error);
    showMessage(`端末には保存しましたが、給与設定専用スプレッドシートへの共有保存に失敗しました：${error.message}`, "error");
  }

  renderPayrollTable();
  if (selectedStaffName) renderStaffEditor(selectedStaffName);
}

async function applyDeductionRatesUpdate() {
  healthInsuranceRate = readRateInput(dom.healthInsuranceRate.value, DEFAULT_HEALTH_INSURANCE_RATE);
  careInsuranceRate = readRateInput(dom.careInsuranceRate.value, DEFAULT_CARE_INSURANCE_RATE);
  pensionInsuranceRate = readRateInput(dom.pensionInsuranceRate.value, DEFAULT_PENSION_INSURANCE_RATE);
  employmentInsuranceRate = readRateInput(dom.employmentInsuranceRate.value, DEFAULT_EMPLOYMENT_INSURANCE_RATE);
  commonPayslipNote = normalizeNoteInput(dom.commonPayslipNote.value);

  dom.healthInsuranceRate.value = formatDecimal(healthInsuranceRate);
  dom.careInsuranceRate.value = formatDecimal(careInsuranceRate);
  dom.pensionInsuranceRate.value = formatDecimal(pensionInsuranceRate);
  dom.employmentInsuranceRate.value = formatDecimal(employmentInsuranceRate);
  dom.transportRate.value = formatDecimal(transportRate);
  dom.commonPayslipNote.value = commonPayslipNote;

  localStorage.setItem(HEALTH_INSURANCE_RATE_STORAGE_KEY, String(healthInsuranceRate));
  localStorage.setItem(CARE_INSURANCE_RATE_STORAGE_KEY, String(careInsuranceRate));
  localStorage.setItem(PENSION_INSURANCE_RATE_STORAGE_KEY, String(pensionInsuranceRate));
  localStorage.setItem(EMPLOYMENT_INSURANCE_RATE_STORAGE_KEY, String(employmentInsuranceRate));

  try {
    await saveCommonSettingsToServer();
    showMessage("控除共通料率を給与設定専用スプレッドシートへ保存しました。全体備考はPDF作成時だけ反映します。", "ok");
  } catch (error) {
    console.error(error);
    showMessage(`端末には保存しましたが、給与設定専用スプレッドシートへの共有保存に失敗しました：${error.message}`, "error");
  }

  renderPayrollTable();
  if (selectedStaffName) renderStaffEditor(selectedStaffName);
}


async function loadPayrollSettingsFromServer(adminKey) {
  try {
    const result = await postToScript({
      mode: "getPayrollSettings",
      adminKey,
      appVersion: APP_VERSION,
    });

    if (!result || !result.ok) {
      throw new Error((result && result.message) || "給与設定専用スプレッドシートから保存済み給与設定を取得できませんでした。");
    }

    applyRemotePayrollSettings(result.settings || {});
    savePaySettings();
    saveCommonSettingsToLocal();
  } catch (error) {
    console.error(error);
    showMessage(`保存済み設定の取得に失敗しました。端末保存分で表示します：${error.message}`, "error");
  }
}

function applyRemotePayrollSettings(settings) {
  const common = settings && settings.common && typeof settings.common === "object" ? settings.common : {};
  const staff = settings && settings.staff && typeof settings.staff === "object" ? settings.staff : {};

  paySettings = staff;
  monthlyAverageHours = normalizeRemoteNumber(common.monthlyAverageHours, DEFAULT_MONTHLY_AVERAGE_HOURS, 1);
  overtimeMultiplier = normalizeRemoteNumber(common.overtimeMultiplier, DEFAULT_OVERTIME_MULTIPLIER, 1);
  healthInsuranceRate = normalizeRemoteNumber(common.healthInsuranceRate, DEFAULT_HEALTH_INSURANCE_RATE, 0);
  careInsuranceRate = normalizeRemoteNumber(common.careInsuranceRate, DEFAULT_CARE_INSURANCE_RATE, 0);
  pensionInsuranceRate = normalizeRemoteNumber(common.pensionInsuranceRate, DEFAULT_PENSION_INSURANCE_RATE, 0);
  employmentInsuranceRate = normalizeRemoteNumber(common.employmentInsuranceRate, DEFAULT_EMPLOYMENT_INSURANCE_RATE, 0);
  transportRate = normalizeRemoteNumber(common.transportRate, DEFAULT_TRANSPORT_RATE, 0);
  commonPayslipNote = normalizeNoteInput(common.commonPayslipNote || "");

  restoreCommonSettingInputs();
}

function normalizeRemoteNumber(value, fallback, min) {
  const num = Number(value);
  return Number.isFinite(num) && num >= min ? num : fallback;
}

function makeCommonSettingsPayload() {
  return {
    monthlyAverageHours,
    overtimeMultiplier,
    healthInsuranceRate,
    careInsuranceRate,
    pensionInsuranceRate,
    employmentInsuranceRate,
    transportRate,
    commonPayslipNote,
  };
}

async function saveStaffSettingToServer(staffName, setting) {
  if (!currentAdminKey) {
    throw new Error("合言葉を入れて給与計算データを表示してから保存してください。");
  }

  const result = await postToScript({
    mode: "savePayrollStaffSetting",
    adminKey: currentAdminKey,
    staffName,
    setting,
    appVersion: APP_VERSION,
  });

  if (!result || !result.ok) {
    throw new Error((result && result.message) || "スタッフ別設定を共有保存できませんでした。");
  }
}

async function saveCommonSettingsToServer() {
  saveCommonSettingsToLocal();

  if (!currentAdminKey) {
    throw new Error("合言葉を入れて給与計算データを表示してから保存してください。");
  }

  const result = await postToScript({
    mode: "savePayrollCommonSettings",
    adminKey: currentAdminKey,
    common: makeCommonSettingsPayload(),
    appVersion: APP_VERSION,
  });

  if (!result || !result.ok) {
    throw new Error((result && result.message) || "共通設定を共有保存できませんでした。");
  }
}

function saveCommonSettingsToLocal() {
  localStorage.setItem(MONTHLY_AVERAGE_HOURS_STORAGE_KEY, String(monthlyAverageHours));
  localStorage.setItem(OVERTIME_MULTIPLIER_STORAGE_KEY, String(overtimeMultiplier));
  localStorage.setItem(HEALTH_INSURANCE_RATE_STORAGE_KEY, String(healthInsuranceRate));
  localStorage.setItem(CARE_INSURANCE_RATE_STORAGE_KEY, String(careInsuranceRate));
  localStorage.setItem(PENSION_INSURANCE_RATE_STORAGE_KEY, String(pensionInsuranceRate));
  localStorage.setItem(EMPLOYMENT_INSURANCE_RATE_STORAGE_KEY, String(employmentInsuranceRate));
  localStorage.setItem(TRANSPORT_RATE_STORAGE_KEY, String(transportRate));
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

function getTransportRate() {
  const value = Number(transportRate || DEFAULT_TRANSPORT_RATE);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_TRANSPORT_RATE;
}

function getStaffTransportRate(setting) {
  const value = Number(setting && setting.transportRate);
  return Number.isFinite(value) && value >= 0 ? value : getTransportRate();
}

function normalizeCommuteMethod(value) {
  const text = String(value || "").trim();
  return COMMUTE_METHODS.includes(text) ? text : "";
}

function getCommuteMethodLabel(setting) {
  return normalizeCommuteMethod(setting && setting.commuteMethod) || "未設定";
}

function calculateTransportAllowance(row, setting) {
  const method = normalizeCommuteMethod(setting && setting.commuteMethod);
  if (!method || method === "徒歩(自転車)") return 0;

  if (method === "公共交通機関") {
    return safeNumber(setting && setting.publicTransportFare);
  }

  const distance = safeNumber(setting && setting.commuteDistance);
  const rate = getStaffTransportRate(setting);
  const days = safeNumber(row && row.attendanceDays);
  return distance * rate * days;
}

function calculateDeductions(setting, totalPay) {
  const standardMonthlyRemuneration = safeNumber(setting && setting.standardMonthlyRemuneration);
  const healthInsurance = setting && setting.healthInsuranceEnabled ? standardMonthlyRemuneration * healthInsuranceRate / 100 / 2 : 0;
  const careInsurance = setting && setting.careInsuranceEnabled ? standardMonthlyRemuneration * careInsuranceRate / 100 / 2 : 0;
  const pensionInsurance = setting && setting.pensionInsuranceEnabled ? standardMonthlyRemuneration * pensionInsuranceRate / 100 / 2 : 0;
  const employmentInsurance = setting && setting.employmentInsuranceEnabled ? safeNumber(totalPay) * employmentInsuranceRate / 100 : 0;
  const incomeTax = safeNumber(setting && setting.incomeTax);
  const residentTax = safeNumber(setting && setting.residentTax);
  const otherDeduction = safeNumber(setting && setting.otherDeduction);
  const totalDeduction = healthInsurance + careInsurance + pensionInsurance + employmentInsurance + incomeTax + residentTax + otherDeduction;

  return {
    healthInsurance,
    careInsurance,
    pensionInsurance,
    employmentInsurance,
    incomeTax,
    residentTax,
    otherDeduction,
    totalDeduction,
  };
}

function makeEmptyDeductions() {
  return {
    healthInsurance: 0,
    careInsurance: 0,
    pensionInsurance: 0,
    employmentInsurance: 0,
    incomeTax: 0,
    residentTax: 0,
    otherDeduction: 0,
    totalDeduction: 0,
  };
}

function hasDeductionSetting(setting) {
  if (!setting || typeof setting !== "object") return false;
  return Boolean(
    safeNumber(setting.standardMonthlyRemuneration) > 0 ||
    setting.healthInsuranceEnabled ||
    setting.careInsuranceEnabled ||
    setting.pensionInsuranceEnabled ||
    setting.employmentInsuranceEnabled ||
    safeNumber(setting.incomeTax) > 0 ||
    safeNumber(setting.residentTax) > 0 ||
    safeNumber(setting.otherDeduction) > 0
  );
}

function hasTransportSetting(setting) {
  if (!setting || typeof setting !== "object") return false;
  return Boolean(
    safeNumber(setting.transportRate) > 0 ||
    safeNumber(setting.commuteDistance) > 0 ||
    safeNumber(setting.publicTransportFare) > 0 ||
    normalizeCommuteMethod(setting.commuteMethod)
  );
}

function setOrDeleteMoneySetting(target, key, value) {
  if (value === null) {
    delete target[key];
  } else {
    target[key] = value;
  }
}

function setOrDeleteTextSetting(target, key, value) {
  const text = normalizeNoteInput(value);
  if (!text) {
    delete target[key];
  } else {
    target[key] = text;
  }
}

function normalizeNoteInput(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function readRateInput(value, fallback) {
  const parsed = normalizeDecimalInput(value, 0);
  return parsed === null ? fallback : parsed;
}

function formatDecimalInputOrDefault(value, fallback) {
  return formatDecimal(readRateInput(value, fallback));
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
