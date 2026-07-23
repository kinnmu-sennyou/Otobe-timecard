const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbykqf1T967tzrQ_A63vHsMfrNp_QBuoaRAfOvchF0MEpZ1ob5xgGXeNbglUvTj-rw8uKg/exec";
const APP_VERSION = "manual-correction-priority-20260723-21";

const BASE_EMPLOYEES = [
  { name: "手塚　慎之介", no: "022", sheetName: "手塚　慎之介", sheetUrl: "https://docs.google.com/spreadsheets/d/1m4tl85YA7-5f_qj8oxV2WRgyseEx1P_Jzfrb4Kr6YAg/edit?gid=330057484#gid=330057484" },
  { name: "中尾　奏可", no: "049", sheetName: "中尾　奏可", sheetUrl: "https://docs.google.com/spreadsheets/d/1m4tl85YA7-5f_qj8oxV2WRgyseEx1P_Jzfrb4Kr6YAg/edit?gid=1481858578#gid=1481858578" },
  { name: "池田 詩", no: "025", sheetName: "池田 詩", sheetUrl: "https://docs.google.com/spreadsheets/d/1m4tl85YA7-5f_qj8oxV2WRgyseEx1P_Jzfrb4Kr6YAg/edit?gid=291951693#gid=291951693" },
  { name: "山田 英之", no: "015", sheetName: "山田 英之", sheetUrl: "https://docs.google.com/spreadsheets/d/1m4tl85YA7-5f_qj8oxV2WRgyseEx1P_Jzfrb4Kr6YAg/edit?gid=715259581#gid=715259581" },
];

const ACTIONS = ["出勤", "退勤", "現時刻打刻", "途中退社", "有給"];
const BREAK_MODES = ["normal", "half", "none"];
const DEFAULT_EMPLOYEE_KEY = "timecard:defaultEmployeeNo";
const EXTRA_EMPLOYEES_KEY = "timecard:extraEmployees";
const SHEET_BROWSER_MEMO_KEY = "timecard:sheetBrowserMemo";

let EMPLOYEES = [];
let selectedEmployee = null;
let selectedAction = "出勤";
let selectedBreakMode = "normal";
let isSending = false;
let selectedSheetEmployeeNos = new Set();
let hasInitializedSheetSelection = false;

const employeeSearchInput = document.getElementById("employeeSearch");
const employeeSelect = document.getElementById("employeeSelect");
const actionButtons = document.getElementById("actionButtons");
const breakButtons = document.getElementById("breakButtons");
const selectedEmployeeText = document.getElementById("selectedEmployee");
const setDefaultEmployeeButton = document.getElementById("setDefaultEmployeeButton");
const changeDefaultEmployeeButton = document.getElementById("changeDefaultEmployeeButton");
const defaultEmployeeUnregisteredArea = document.getElementById("defaultEmployeeUnregisteredArea");
const defaultEmployeeRegisteredArea = document.getElementById("defaultEmployeeRegisteredArea");
const defaultEmployeeStatus = document.getElementById("defaultEmployeeStatus");
const returnToDefaultEmployeeButton = document.getElementById("returnToDefaultEmployeeButton");
const updateButton = document.getElementById("updateButton");
const editUpdateButton = document.getElementById("editUpdateButton");
const pdfButton = document.getElementById("pdfButton");
const editDate = document.getElementById("editDate");
const editTime = document.getElementById("editTime");
const todayStatus = document.getElementById("todayStatus");
const yesterdayAlert = document.getElementById("yesterdayAlert");
const message = document.getElementById("message");
const updateStatus = document.getElementById("updateStatus");
const pdfLinkArea = document.getElementById("pdfLinkArea");
const sheetTargetMonth = document.getElementById("sheetTargetMonth");
const sheetStaffSearch = document.getElementById("sheetStaffSearch");
const sheetBrowserMemo = document.getElementById("sheetBrowserMemo");
const sheetStaffChecklist = document.getElementById("sheetStaffChecklist");
const selectAllSheetStaffButton = document.getElementById("selectAllSheetStaffButton");
const clearAllSheetStaffButton = document.getElementById("clearAllSheetStaffButton");
const sheetSelectionCount = document.getElementById("sheetSelectionCount");

const addStaffButton = document.getElementById("addStaffButton");
const newEmploymentType = document.getElementById("newEmploymentType");
const newStaffName = document.getElementById("newStaffName");
const newEmployeeNo = document.getElementById("newEmployeeNo");
const newStartTime = document.getElementById("newStartTime");
const newEndTime = document.getElementById("newEndTime");
const newBreakMinutes = document.getElementById("newBreakMinutes");
const newStaffWeeklyScheduleGrid = document.getElementById("newStaffWeeklyScheduleGrid");
const week40OverInput = document.getElementById("week40OverInput");
const scheduleTargetEmployee = document.getElementById("scheduleTargetEmployee");
const weeklyScheduleGrid = document.getElementById("weeklyScheduleGrid");
const weeklyScheduleDisplay = document.getElementById("weeklyScheduleDisplay");
const saveWeeklyScheduleButton = document.getElementById("saveWeeklyScheduleButton");
const weeklyScheduleStatus = document.getElementById("weeklyScheduleStatus");
const weeklyScheduleEditor = document.getElementById("weeklyScheduleEditor");

const retireStaffButton = document.getElementById("retireStaffButton");
const retireTargetEmployee = document.getElementById("retireTargetEmployee");
const retireKeyInput = document.getElementById("retireKeyInput");

const adminOpenKeyInput = document.getElementById("adminOpenKeyInput");
const showAllSheetsButton = document.getElementById("showAllSheetsButton");

init();

async function init() {
  loadEmployees();

  try {
    await refreshEmployeesFromScript(false);
  } catch (error) {
    console.warn("スタッフ一覧の取得に失敗したため、端末内の情報で表示します。", error);
  }

  setupEmployeeSearchEvents();
  setupDefaultEmployeeRegistration();
  setupRestrictedSelectionGuard();
  buildEmployeeSelector("");
  buildActionEvents();
  buildBreakEvents();
  initEditDateTime();
  setupWeeklySchedule();
  setupAddStaffForm();
  setupRetireStaff();
  setupSheetOpenSelection();
  setupAdminSheetOpen();

  updateButton.addEventListener("click", punchNow);
  editUpdateButton.addEventListener("click", punchBySpecifiedDateTime);
  pdfButton.addEventListener("click", openStaffSheet);

  const defaultNo = normalizeEmployeeNo(localStorage.getItem(DEFAULT_EMPLOYEE_KEY));
  const initialEmployee = EMPLOYEES.find((emp) => emp.no === defaultNo) || EMPLOYEES[0];

  if (initialEmployee) {
    selectEmployee(initialEmployee);
    buildEmployeeSelector("");
  }

  renderSheetStaffChecklist();
  selectAction(selectedAction);
  selectBreakMode(selectedBreakMode);
  if (todayStatus) todayStatus.textContent = "選択後、出勤・退勤などを押して更新してください。";
  setUpdateStatus("更新状況：待機中", "neutral");
  showMessage(`読み込みました。版：${APP_VERSION}`, "ok");
}

function loadEmployees() {
  const extras = readExtraEmployees();
  const map = new Map();

  [...BASE_EMPLOYEES, ...extras].forEach((emp) => {
    if (!emp || !emp.no || !emp.name) return;
    map.set(String(emp.no).padStart(3, "0"), {
      name: emp.name,
      no: String(emp.no).padStart(3, "0"),
      sheetName: emp.sheetName || emp.name,
      sheetUrl: emp.sheetUrl || "",
    });
  });

  EMPLOYEES = Array.from(map.values());
}


async function refreshEmployeesFromScript(showStatus) {
  const result = await postToScript({
    mode: "listStaff",
    appVersion: APP_VERSION,
  });

  if (!result || !result.ok || !Array.isArray(result.employees)) {
    throw new Error((result && result.message) || "スタッフ一覧を取得できませんでした。");
  }

  EMPLOYEES = result.employees.map((emp) => ({
    name: emp.name,
    no: normalizeEmployeeNo(emp.no),
    sheetName: emp.sheetName || emp.name,
    sheetUrl: emp.sheetUrl || "",
  }));

  localStorage.setItem(EXTRA_EMPLOYEES_KEY, JSON.stringify(EMPLOYEES));
  renderSheetStaffChecklist();

  if (showStatus) {
    showMessage(result.message || "スタッフ一覧を更新しました。", "ok");
  }
}

function readExtraEmployees() {
  try {
    const raw = localStorage.getItem(EXTRA_EMPLOYEES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("追加スタッフ情報を読み込めませんでした。", error);
    return [];
  }
}

function saveExtraEmployee(emp) {
  const extras = readExtraEmployees();
  const exists = extras.some((item) => String(item.no).padStart(3, "0") === emp.no);

  if (!exists) {
    extras.push(emp);
    localStorage.setItem(EXTRA_EMPLOYEES_KEY, JSON.stringify(extras));
  }
}

function removeExtraEmployee(employeeNo) {
  const targetNo = normalizeEmployeeNo(employeeNo);
  const extras = readExtraEmployees().filter((item) => normalizeEmployeeNo(item.no) !== targetNo);
  localStorage.setItem(EXTRA_EMPLOYEES_KEY, JSON.stringify(extras));
}

function setupEmployeeSearchEvents() {
  if (employeeSearchInput) {
    employeeSearchInput.addEventListener("input", () => {
      buildEmployeeSelector(employeeSearchInput.value);
    });
  }

  if (employeeSelect) {
    employeeSelect.addEventListener("change", () => {
      const emp = EMPLOYEES.find((item) => item.no === employeeSelect.value);
      if (emp) {
        selectEmployee(emp);
      }
    });
  }
}

function buildEmployeeSelector(query) {
  if (!employeeSelect) return;

  const searchText = String(query || "").trim();
  const normalizedQuery = normalizeName(searchText).toLowerCase();
  const numericQuery = searchText.replace(/\D/g, "");
  const isSearching = Boolean(normalizedQuery || numericQuery);
  const currentNo = selectedEmployee ? selectedEmployee.no : normalizeEmployeeNo(localStorage.getItem(DEFAULT_EMPLOYEE_KEY));

  let candidates = [];

  if (isSearching) {
    candidates = EMPLOYEES.filter((emp) => {
      const nameText = normalizeName(emp.name).toLowerCase();
      const noText = normalizeEmployeeNo(emp.no);
      return nameText.includes(normalizedQuery) || (numericQuery && noText.includes(numericQuery));
    });
  } else {
    const current = EMPLOYEES.find((emp) => emp.no === currentNo) || EMPLOYEES[0];
    candidates = current ? [current] : [];
  }

  employeeSelect.innerHTML = "";

  if (!candidates.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "該当スタッフがいません";
    employeeSelect.appendChild(option);
    employeeSelect.disabled = true;
    return;
  }

  employeeSelect.disabled = isSending;

  candidates.forEach((emp) => {
    const option = document.createElement("option");
    option.value = emp.no;
    option.textContent = `${emp.no} ${emp.name}`;
    employeeSelect.appendChild(option);
  });

  const selectedNo = selectedEmployee ? selectedEmployee.no : candidates[0].no;
  const nextNo = candidates.some((emp) => emp.no === selectedNo) ? selectedNo : candidates[0].no;
  employeeSelect.value = nextNo;

  // 検索で候補が絞られた時、selectの候補表示だけ変わってもchangeが発火しない場合があります。
  // そのため、表示中の候補が現在の選択スタッフと違う場合はここで選択中表示も同期します。
  if (isSearching) {
    const displayedEmp = candidates.find((emp) => emp.no === employeeSelect.value);
    if (displayedEmp && (!selectedEmployee || selectedEmployee.no !== displayedEmp.no)) {
      selectEmployee(displayedEmp);
    }
  }
}


function setupDefaultEmployeeRegistration() {
  if (setDefaultEmployeeButton) {
    setDefaultEmployeeButton.addEventListener("click", registerSelectedEmployeeAsDefault);
  }
  if (changeDefaultEmployeeButton) {
    changeDefaultEmployeeButton.addEventListener("click", changeDefaultEmployee);
  }
  if (returnToDefaultEmployeeButton) {
    returnToDefaultEmployeeButton.addEventListener("click", returnToDefaultEmployeeSelection);
  }
  updateDefaultEmployeeRegistrationUi();
}

function registerSelectedEmployeeAsDefault() {
  if (!selectedEmployee) {
    showMessage("先にデフォルト登録するスタッフを選んでください。", "error");
    return;
  }

  localStorage.setItem(DEFAULT_EMPLOYEE_KEY, selectedEmployee.no);
  updateDefaultEmployeeRegistrationUi();
  updateSelectedEmployeeAccessLock();
  showMessage(`${selectedEmployee.name}を、このブラウザの初期スタッフに登録しました。`, "ok");
}

function changeDefaultEmployee() {
  if (!selectedEmployee) {
    showMessage("変更先のスタッフを選んでください。", "error");
    return;
  }

  const defaultNo = normalizeEmployeeNo(localStorage.getItem(DEFAULT_EMPLOYEE_KEY));
  const defaultEmployee = EMPLOYEES.find((emp) => emp.no === defaultNo);

  if (defaultEmployee && defaultEmployee.no === selectedEmployee.no) {
    showMessage("現在選択中のスタッフは、すでにデフォルト登録済みです。", "neutral");
    return;
  }

  const currentText = defaultEmployee ? `${defaultEmployee.no} ${defaultEmployee.name}` : "未登録";
  const nextText = `${selectedEmployee.no} ${selectedEmployee.name}`;
  const ok = window.confirm(`デフォルトスタッフを
${currentText}
から
${nextText}
へ変更しますか？`);
  if (!ok) return;

  localStorage.setItem(DEFAULT_EMPLOYEE_KEY, selectedEmployee.no);
  updateDefaultEmployeeRegistrationUi();
  updateSelectedEmployeeAccessLock();
  showMessage(`${selectedEmployee.name}を、このブラウザの初期スタッフに変更しました。`, "ok");
}

function returnToDefaultEmployeeSelection() {
  const defaultNo = getDefaultEmployeeNo();
  const defaultEmployee = EMPLOYEES.find((emp) => emp.no === defaultNo);

  if (!defaultEmployee) {
    showMessage("デフォルト登録スタッフが見つかりません。先にデフォルト登録してください。", "error");
    updateDefaultEmployeeRegistrationUi();
    return;
  }

  if (employeeSearchInput) employeeSearchInput.value = "";
  selectEmployee(defaultEmployee);
  buildEmployeeSelector("");
  showMessage(`${defaultEmployee.name}の選択に戻しました。`, "ok");
}

function updateDefaultEmployeeRegistrationUi() {
  const defaultNo = normalizeEmployeeNo(localStorage.getItem(DEFAULT_EMPLOYEE_KEY));
  const defaultEmployee = EMPLOYEES.find((emp) => emp.no === defaultNo);
  const isSelectedDefault = Boolean(selectedEmployee && defaultEmployee && selectedEmployee.no === defaultEmployee.no);

  if (defaultEmployeeUnregisteredArea) {
    defaultEmployeeUnregisteredArea.hidden = Boolean(defaultEmployee);
  }

  if (defaultEmployeeRegisteredArea) {
    defaultEmployeeRegisteredArea.hidden = !defaultEmployee;
  }

  if (setDefaultEmployeeButton) {
    setDefaultEmployeeButton.disabled = !selectedEmployee || isSending;
  }

  if (defaultEmployeeStatus) {
    defaultEmployeeStatus.textContent = defaultEmployee
      ? `デフォルト登録済み：${defaultEmployee.no} ${defaultEmployee.name}`
      : "";
  }

  if (changeDefaultEmployeeButton) {
    changeDefaultEmployeeButton.disabled = !selectedEmployee || isSelectedDefault || isSending;
    changeDefaultEmployeeButton.title = isSelectedDefault
      ? "現在選択中のスタッフがデフォルト登録されています"
      : "選択中スタッフへデフォルトを変更します";
  }

  if (returnToDefaultEmployeeButton) {
    returnToDefaultEmployeeButton.hidden = !defaultEmployee;
    returnToDefaultEmployeeButton.disabled = !defaultEmployee || isSelectedDefault || isSending;
    returnToDefaultEmployeeButton.title = isSelectedDefault
      ? "現在、デフォルト登録スタッフを選択中です"
      : "デフォルト登録スタッフの選択に戻します";
  }
}


function getDefaultEmployeeNo() {
  return normalizeEmployeeNo(localStorage.getItem(DEFAULT_EMPLOYEE_KEY));
}

function isSelectedEmployeeDefault() {
  const defaultNo = getDefaultEmployeeNo();
  return Boolean(selectedEmployee && defaultNo && selectedEmployee.no === defaultNo);
}

function isRestrictedSelection() {
  const defaultNo = getDefaultEmployeeNo();
  return Boolean(defaultNo && selectedEmployee && selectedEmployee.no !== defaultNo);
}

function isAllowedWhileRestricted(target) {
  if (!target || !target.closest) return false;
  return Boolean(target.closest([
    "#employeeSearch",
    "#employeeSelect",
    "#defaultEmployeeUnregisteredArea",
    "#defaultEmployeeRegisteredArea",
    "#returnToDefaultEmployeeButton",
    ".sheet-area",
    ".add-staff-area",
    ".admin-sheet-area",
    ".retire-staff-area"
  ].join(",")));
}

function setupRestrictedSelectionGuard() {
  const guard = (event) => {
    if (!isRestrictedSelection() || isAllowedWhileRestricted(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    showMessage("このスタッフは勤務日時の確認のみです。打刻・修正・勤務時間変更はデフォルト登録スタッフを選択してください。", "error");
  };

  ["click", "input", "change", "submit"].forEach((type) => {
    document.addEventListener(type, guard, true);
  });

  document.addEventListener("keydown", (event) => {
    if (!isRestrictedSelection() || isAllowedWhileRestricted(event.target)) return;
    if (["Tab", "Shift", "Escape"].includes(event.key)) return;
    guard(event);
  }, true);
}

function updateSelectedEmployeeAccessLock() {
  const locked = isRestrictedSelection();
  document.body.classList.toggle("non-default-staff-selected", locked);

  const allowedSelectors = [
    "#employeeSearch",
    "#employeeSelect",
    "#setDefaultEmployeeButton",
    "#changeDefaultEmployeeButton",
    "#returnToDefaultEmployeeButton",
    ".sheet-area button",
    ".sheet-area input",
    ".sheet-area select",
    ".sheet-area textarea",
    ".add-staff-area button",
    ".add-staff-area input",
    ".add-staff-area select",
    ".admin-sheet-area button",
    ".admin-sheet-area input",
    ".retire-staff-area button",
    ".retire-staff-area input"
  ];

  document.querySelectorAll("button, input, select, textarea").forEach((control) => {
    const allowed = allowedSelectors.some((selector) => control.matches(selector));
    if (locked && !allowed) {
      control.disabled = true;
      control.setAttribute("data-selection-locked", "true");
    } else if (control.hasAttribute("data-selection-locked")) {
      control.removeAttribute("data-selection-locked");
      control.disabled = false;
    }
  });

  if (employeeSearchInput) employeeSearchInput.disabled = Boolean(isSending);
  if (employeeSelect) employeeSelect.disabled = Boolean(isSending || !employeeSelect.options.length || !employeeSelect.value);
  updateSheetOpenSelectionState();

  updateDefaultEmployeeRegistrationUi();
  if (adminOpenKeyInput) adminOpenKeyInput.disabled = Boolean(isSending);
  updateShowAllSheetsButtonState();
  if (retireKeyInput) retireKeyInput.disabled = Boolean(isSending);
  updateRetireButtonState();

  if (locked) {
    if (todayStatus) todayStatus.textContent = "デフォルト登録スタッフ以外を選択中です。勤務日時確認・管理機能のみ使用できます。";
    setUpdateStatus("操作制限中：打刻する場合はデフォルト登録スタッフを選択してください。", "error");
  }

  // 通信終了後にこの関数が呼ばれても、打刻の成功・失敗表示を
  // 「更新状況：待機中」で上書きしないようにします。
  // スタッフを選び直した時の待機表示は selectEmployee() 側で行います。
}

function buildActionEvents() {
  actionButtons.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => selectAction(button.dataset.action));
  });
}

function selectEmployee(emp) {
  selectedEmployee = emp;
  selectedEmployeeText.textContent = `${emp.no} ${emp.name}`;

  if (retireTargetEmployee) {
    retireTargetEmployee.textContent = `${emp.no} ${emp.name}`;
  }
  updateDefaultEmployeeRegistrationUi();
  updateSelectedEmployeeAccessLock();
  pdfLinkArea.innerHTML = "";
  setUpdateStatus("更新状況：待機中", "neutral");

  if (todayStatus) todayStatus.textContent = `${emp.name} を選択中です。`;
  showMessage(`${emp.name}を選択しました。`, "ok");
  checkYesterdayPunchAlert(emp);
  resetWeeklyScheduleView(emp);
  updateSelectedEmployeeAccessLock();
}

function selectAction(action) {
  selectedAction = ACTIONS.includes(action) ? action : "出勤";

  actionButtons.querySelectorAll("[data-action]").forEach((button) => {
    button.classList.toggle("active", button.dataset.action === selectedAction);
  });

  if (selectedEmployee) {
    if (todayStatus) todayStatus.textContent = `${selectedEmployee.name}：${selectedAction}を選択中です。`;
  }
}

function buildBreakEvents() {
  if (!breakButtons) return;

  breakButtons.querySelectorAll("[data-break-mode]").forEach((button) => {
    button.addEventListener("click", () => selectBreakMode(button.dataset.breakMode));
  });
}

function selectBreakMode(mode) {
  selectedBreakMode = BREAK_MODES.includes(mode) ? mode : "normal";

  if (!breakButtons) return;

  breakButtons.querySelectorAll("[data-break-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.breakMode === selectedBreakMode);
  });
}

function getSelectedBreakMode() {
  return BREAK_MODES.includes(selectedBreakMode) ? selectedBreakMode : "normal";
}

function getWeek40OverValue() {
  if (!week40OverInput) return "";
  return String(week40OverInput.value || "").trim();
}

function setYesterdayAlertVisible(visible) {
  if (!yesterdayAlert) return;
  yesterdayAlert.hidden = !visible;
}

function getYesterdayDateKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return formatDateInput(date);
}

async function checkYesterdayPunchAlert(emp) {
  if (!emp || !isEndpointSet()) {
    setYesterdayAlertVisible(false);
    return;
  }

  const checkedNo = emp.no;

  try {
    const result = await postToScript({
      mode: "yesterdayAlert",
      name: emp.name,
      employeeNo: emp.no,
      sheetName: emp.sheetName,
      date: getYesterdayDateKey(),
      appVersion: APP_VERSION,
    });

    if (!selectedEmployee || selectedEmployee.no !== checkedNo) return;

    if (result && result.ok) {
      setYesterdayAlertVisible(Boolean(result.showAlert));
    } else {
      setYesterdayAlertVisible(false);
    }
  } catch (error) {
    console.warn("昨日の打刻忘れ確認に失敗しました。", error);
    if (selectedEmployee && selectedEmployee.no === checkedNo) {
      setYesterdayAlertVisible(false);
    }
  }
}

function initEditDateTime() {
  const now = new Date();
  editDate.value = formatDateInput(now);
  editTime.value = formatTimeInput(roundDownToQuarter(now));
}

async function punchNow() {
  if (isRestrictedSelection()) {
    showMessage("デフォルト登録スタッフ以外は打刻できません。", "error");
    return;
  }
  if (!canSend()) {
    setUpdateStatus("反映失敗：スタッフ選択・打刻内容・接続設定を確認してください。", "error");
    return;
  }

  startSending(updateButton, `${selectedAction}を更新中...`);
  setUpdateStatus(`${selectedEmployee.name}：${selectedAction}を更新中...`, "loading");
  pdfLinkArea.innerHTML = "";

  try {
    const result = await postToScript({
      mode: "punch",
      action: selectedAction,
      name: selectedEmployee.name,
      employeeNo: selectedEmployee.no,
      sheetName: selectedEmployee.sheetName,
      breakMode: getSelectedBreakMode(),
      week40Over: getWeek40OverValue(),
      timestamp: new Date().toISOString(),
      appVersion: APP_VERSION,
      userAgent: navigator.userAgent,
    });

    handleResult(result, `${selectedEmployee.name}：${selectedAction}を更新しました。`);
    setUpdateStatus(`反映完了：${selectedEmployee.name}：${selectedAction}`, "ok");
    if (todayStatus) todayStatus.textContent = `${selectedEmployee.name}：${selectedAction}を反映しました。`;
    initEditDateTime();
    checkYesterdayPunchAlert(selectedEmployee);
  } catch (error) {
    setUpdateStatus(`反映失敗：${error.message}`, "error");
    handleError(error);
  } finally {
    stopSending(updateButton);
  }
}

async function punchBySpecifiedDateTime() {
  if (isRestrictedSelection()) {
    showMessage("デフォルト登録スタッフ以外は打刻修正できません。", "error");
    return;
  }
  if (!canSend()) {
    setUpdateStatus("修正反映失敗：スタッフ選択・打刻内容・接続設定を確認してください。", "error");
    return;
  }

  if (!editDate.value) {
    showMessage("日付を指定してね。", "error");
    setUpdateStatus("修正反映失敗：日付を指定してください。", "error");
    return;
  }

  if (selectedAction !== "有給" && !editTime.value) {
    showMessage("時刻を指定してね。", "error");
    setUpdateStatus("修正反映失敗：時刻を指定してください。", "error");
    return;
  }

  startSending(editUpdateButton, "修正更新中...");
  setUpdateStatus(`${selectedEmployee.name}：${editDate.value} の ${selectedAction}を修正更新中...`, "loading");
  pdfLinkArea.innerHTML = "";

  try {
    const result = await postToScript({
      mode: "correction",
      action: selectedAction,
      name: selectedEmployee.name,
      employeeNo: selectedEmployee.no,
      sheetName: selectedEmployee.sheetName,
      date: editDate.value,
      time: selectedAction === "有給" ? "00:00" : editTime.value,
      breakMode: getSelectedBreakMode(),
      week40Over: getWeek40OverValue(),
      appVersion: APP_VERSION,
      userAgent: navigator.userAgent,
    });

    handleResult(result, `${selectedEmployee.name}：${editDate.value} の ${selectedAction}を修正更新しました。`);
    setUpdateStatus(`修正反映完了：${selectedEmployee.name}：${editDate.value} の ${selectedAction}`, "ok");
    if (todayStatus) todayStatus.textContent = `${selectedEmployee.name}：${editDate.value} の ${selectedAction}を反映しました。`;
    checkYesterdayPunchAlert(selectedEmployee);
  } catch (error) {
    setUpdateStatus(`修正反映失敗：${error.message}`, "error");
    handleError(error);
  } finally {
    stopSending(editUpdateButton);
  }
}

function setupSheetOpenSelection() {
  if (selectAllSheetStaffButton) {
    selectAllSheetStaffButton.addEventListener("click", selectAllSheetStaff);
  }

  if (clearAllSheetStaffButton) {
    clearAllSheetStaffButton.addEventListener("click", clearAllSheetStaff);
  }

  if (sheetTargetMonth) {
    sheetTargetMonth.addEventListener("change", updateSheetOpenSelectionState);
  }

  if (sheetStaffSearch) {
    sheetStaffSearch.addEventListener("input", renderSheetStaffChecklist);
  }

  if (sheetBrowserMemo) {
    try {
      sheetBrowserMemo.value = localStorage.getItem(SHEET_BROWSER_MEMO_KEY) || "";
    } catch (error) {
      console.warn("ブラウザメモを読み込めませんでした。", error);
    }

    sheetBrowserMemo.addEventListener("input", () => {
      try {
        localStorage.setItem(SHEET_BROWSER_MEMO_KEY, sheetBrowserMemo.value);
      } catch (error) {
        console.warn("ブラウザメモを保存できませんでした。", error);
      }
    });
  }
}

function getFilteredSheetEmployees() {
  const query = String(sheetStaffSearch && sheetStaffSearch.value || "").trim();
  if (!query) return [...EMPLOYEES];

  // カンマ区切りで複数の名前・社員番号を同時検索できます。
  // 例：022,049 / 手塚,049 / 022、049
  const searchTerms = query
    .split(/[,，、\n]+/)
    .map((term) => String(term || "").trim())
    .filter(Boolean);

  if (!searchTerms.length) return [...EMPLOYEES];

  return EMPLOYEES.filter((emp) => {
    const normalizedName = normalizeName(emp.name).toLowerCase();
    const employeeNo = normalizeEmployeeNo(emp.no);

    return searchTerms.some((term) => {
      const normalizedNameTerm = normalizeName(term).toLowerCase();
      const numberTerm = term.replace(/\D/g, "");
      return normalizedName.includes(normalizedNameTerm) || Boolean(numberTerm && employeeNo.includes(numberTerm));
    });
  });
}

function renderSheetStaffChecklist() {
  if (!sheetStaffChecklist) return;

  const validEmployeeNos = new Set(EMPLOYEES.map((emp) => emp.no));
  selectedSheetEmployeeNos = new Set(
    Array.from(selectedSheetEmployeeNos).filter((employeeNo) => validEmployeeNos.has(employeeNo))
  );

  if (!hasInitializedSheetSelection && selectedEmployee) {
    selectedSheetEmployeeNos.add(selectedEmployee.no);
    hasInitializedSheetSelection = true;
  }

  sheetStaffChecklist.innerHTML = "";

  const filteredEmployees = getFilteredSheetEmployees();

  if (!filteredEmployees.length) {
    const empty = document.createElement("div");
    empty.className = "sheet-staff-empty";
    empty.textContent = EMPLOYEES.length ? "検索に該当するスタッフがいません" : "対象スタッフがいません";
    sheetStaffChecklist.appendChild(empty);
    updateSheetOpenSelectionState();
    return;
  }

  filteredEmployees
    .sort((a, b) => Number(a.no || 0) - Number(b.no || 0))
    .forEach((emp) => {
      const label = document.createElement("label");
      label.className = "sheet-staff-choice";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = emp.no;
      checkbox.checked = selectedSheetEmployeeNos.has(emp.no);
      checkbox.setAttribute("aria-label", `${emp.name}の勤務表を対象にする`);

      const text = document.createElement("span");
      text.className = "sheet-staff-choice-text";
      text.textContent = `${emp.no} ${emp.name}`;
      text.title = `${emp.no} ${emp.name}`;

      label.classList.toggle("is-checked", checkbox.checked);

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selectedSheetEmployeeNos.add(emp.no);
        } else {
          selectedSheetEmployeeNos.delete(emp.no);
        }
        label.classList.toggle("is-checked", checkbox.checked);
        updateSheetOpenSelectionState();
      });

      label.appendChild(checkbox);
      label.appendChild(text);
      sheetStaffChecklist.appendChild(label);
    });

  updateSheetOpenSelectionState();
}

function selectAllSheetStaff() {
  getFilteredSheetEmployees().forEach((emp) => selectedSheetEmployeeNos.add(emp.no));
  hasInitializedSheetSelection = true;
  renderSheetStaffChecklist();
}

function clearAllSheetStaff() {
  getFilteredSheetEmployees().forEach((emp) => selectedSheetEmployeeNos.delete(emp.no));
  hasInitializedSheetSelection = true;
  renderSheetStaffChecklist();
}

function updateSheetOpenSelectionState() {
  const filteredEmployees = getFilteredSheetEmployees();
  const validSelectedCount = EMPLOYEES.filter((emp) => selectedSheetEmployeeNos.has(emp.no)).length;
  const filteredSelectedCount = filteredEmployees.filter((emp) => selectedSheetEmployeeNos.has(emp.no)).length;
  const isFiltering = Boolean(String(sheetStaffSearch && sheetStaffSearch.value || "").trim());

  if (sheetSelectionCount) {
    sheetSelectionCount.textContent = `選択 ${validSelectedCount}名`;
  }

  if (pdfButton) {
    pdfButton.disabled = Boolean(isSending || validSelectedCount === 0);
  }

  if (selectAllSheetStaffButton) {
    selectAllSheetStaffButton.textContent = isFiltering ? "表示中を選択" : "全選択";
    selectAllSheetStaffButton.disabled = Boolean(
      isSending || !filteredEmployees.length || filteredSelectedCount === filteredEmployees.length
    );
  }

  if (clearAllSheetStaffButton) {
    clearAllSheetStaffButton.textContent = isFiltering ? "表示中を解除" : "全選択解除";
    clearAllSheetStaffButton.disabled = Boolean(isSending || filteredSelectedCount === 0);
  }

  if (sheetTargetMonth) {
    sheetTargetMonth.disabled = Boolean(isSending);
  }

  if (sheetStaffSearch) {
    sheetStaffSearch.disabled = Boolean(isSending);
  }

  if (sheetBrowserMemo) {
    sheetBrowserMemo.disabled = Boolean(isSending);
  }

  if (sheetStaffChecklist) {
    sheetStaffChecklist.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.disabled = Boolean(isSending);
    });
  }
}

function getSheetTargetDate() {
  const date = new Date();
  date.setDate(1);

  if (sheetTargetMonth && sheetTargetMonth.value === "previous") {
    date.setMonth(date.getMonth() - 1);
  }

  return formatDateInput(date);
}

function getSheetTargetMonthLabel() {
  return sheetTargetMonth && sheetTargetMonth.value === "previous" ? "先月分" : "当月分";
}

async function openStaffSheet() {
  if (isSending) {
    showMessage("今処理中だから、少し待ってね。", "loading");
    return;
  }

  const selectedEmployees = EMPLOYEES.filter((emp) => selectedSheetEmployeeNos.has(emp.no));

  if (!selectedEmployees.length) {
    showMessage("スプレッドシートを開くスタッフにチェックを入れてね。", "error");
    updateSheetOpenSelectionState();
    return;
  }

  const targetDate = getSheetTargetDate();
  const monthLabel = getSheetTargetMonthLabel();

  startSending(pdfButton, `${monthLabel}の勤務表を準備中...`);

  try {
    const result = await postToScript({
      mode: "openSelectedSheets",
      employeeNos: selectedEmployees.map((emp) => emp.no),
      date: targetDate,
      appVersion: APP_VERSION,
    });

    const missingCount = Array.isArray(result.missingStaffNames) ? result.missingStaffNames.length : 0;
    const successText = missingCount
      ? `${monthLabel}：${result.shownCount}名分を表示します（シートなし ${missingCount}名）`
      : `${monthLabel}：${result.shownCount}名分のシートだけ表示して開きます。`;

    handleResult(result, successText);

    if (result.sheetUrl) {
      window.location.href = result.sheetUrl;
    }
  } catch (error) {
    handleError(error);
  } finally {
    stopSending(pdfButton);
  }
}

function setupAdminSheetOpen() {
  if (!showAllSheetsButton) return;

  showAllSheetsButton.addEventListener("click", showAllSheetsForAdmin);

  if (adminOpenKeyInput) {
    adminOpenKeyInput.addEventListener("input", updateShowAllSheetsButtonState);
    updateShowAllSheetsButtonState();
  }
}

function updateShowAllSheetsButtonState() {
  if (!showAllSheetsButton || !adminOpenKeyInput) return;

  showAllSheetsButton.disabled = adminOpenKeyInput.value.trim() !== "open" || isSending;
}

async function showAllSheetsForAdmin() {
  if (isSending) {
    showMessage("今処理中だから、少し待ってね。", "loading");
    return;
  }

  const adminKey = adminOpenKeyInput ? adminOpenKeyInput.value.trim() : "";

  if (adminKey !== "open") {
    showMessage("全シート表示をするには、合言葉 open を入力してね。", "error");
    updateShowAllSheetsButtonState();
    return;
  }

  const ok = window.confirm("全シートを表示します。管理者作業用に戻してよろしいですか？");

  if (!ok) return;

  startSending(showAllSheetsButton, "全シート表示中...");

  try {
    const result = await postToScript({
      mode: "showAllSheets",
      adminKey,
      appVersion: APP_VERSION,
    });

    handleResult(result, "全シートを表示しました。");

    if (adminOpenKeyInput) {
      adminOpenKeyInput.value = "";
      updateShowAllSheetsButtonState();
    }
  } catch (error) {
    handleError(error);
  } finally {
    stopSending(showAllSheetsButton);
  }
}


function setupWeeklySchedule() {
  setupWeeklyScheduleGrid(weeklyScheduleGrid);
  setupWeeklyScheduleGrid(newStaffWeeklyScheduleGrid);
  renderScheduleGrid(newStaffWeeklyScheduleGrid, getDefaultWeeklySchedule());

  if (saveWeeklyScheduleButton) saveWeeklyScheduleButton.addEventListener("click", saveWeeklySchedule);
}

function setupWeeklyScheduleGrid(grid) {
  if (!grid) return;
  grid.querySelectorAll(".weekly-schedule-row").forEach((row) => {
    const off = row.querySelector(".schedule-off");
    const time = row.querySelector(".schedule-time");
    if (!off || !time) return;
    off.addEventListener("change", () => {
      time.disabled = off.checked || isSending;
      row.classList.toggle("is-off", off.checked);
    });
  });
}

function getDefaultWeeklySchedule() {
  return {
    mon: { isOff: false, startTime: "08:00" }, tue: { isOff: false, startTime: "08:00" },
    wed: { isOff: false, startTime: "08:00" }, thu: { isOff: false, startTime: "08:00" },
    fri: { isOff: false, startTime: "08:00" }, sat: { isOff: true, startTime: "" },
    sun: { isOff: true, startTime: "" },
  };
}

function renderWeeklySchedule(schedule) { renderScheduleGrid(weeklyScheduleGrid, schedule); }

function renderScheduleGrid(grid, schedule) {
  if (!grid) return;
  const merged = { ...getDefaultWeeklySchedule(), ...(schedule || {}) };
  grid.querySelectorAll(".weekly-schedule-row").forEach((row) => {
    const item = merged[row.dataset.day] || {};
    const off = row.querySelector(".schedule-off");
    const time = row.querySelector(".schedule-time");
    if (!off || !time) return;
    off.checked = Boolean(item.isOff);
    time.value = item.startTime || "08:00";
    time.disabled = off.checked || isSending;
    row.classList.toggle("is-off", off.checked);
  });
}

function resetWeeklyScheduleView(emp) {
  if (scheduleTargetEmployee) scheduleTargetEmployee.textContent = emp ? `${emp.no} ${emp.name}` : "未選択";
  if (weeklyScheduleDisplay) {
    weeklyScheduleDisplay.hidden = false;
    weeklyScheduleDisplay.textContent = emp ? "勤務予定を読み込み中..." : "スタッフを選択してください";
  }
  if (weeklyScheduleStatus) weeklyScheduleStatus.textContent = emp ? "登録済み予定を自動で読み込んでいます。" : "スタッフを選択してください。";
  renderWeeklySchedule(getDefaultWeeklySchedule());
  if (emp) loadSelectedWeeklySchedule(emp);
}

async function fetchWeeklySchedule(emp) {
  const result = await postToScript({ mode: "getWeeklySchedule", employeeNo: emp.no, name: emp.name, appVersion: APP_VERSION });
  if (!result || !result.ok) throw new Error((result && result.message) || "勤務予定を取得できませんでした。");
  return result.schedule || {};
}

async function loadSelectedWeeklySchedule(emp) {
  if (!emp) return;
  const checkedNo = emp.no;

  try {
    const schedule = await fetchWeeklySchedule(emp);
    if (!selectedEmployee || selectedEmployee.no !== checkedNo) return;

    const displaySchedule = Object.keys(schedule).length ? schedule : getDefaultWeeklySchedule();
    renderWeeklyScheduleDisplay(displaySchedule);
    renderWeeklySchedule(displaySchedule);

    if (weeklyScheduleStatus) {
      weeklyScheduleStatus.textContent = Object.keys(schedule).length
        ? "登録済み勤務予定を読み込みました。"
        : "勤務予定はまだ未登録です。初期値を変更して保存できます。";
    }
  } catch (error) {
    if (!selectedEmployee || selectedEmployee.no !== checkedNo) return;
    if (weeklyScheduleDisplay) weeklyScheduleDisplay.textContent = "勤務予定を取得できませんでした";
    if (weeklyScheduleStatus) weeklyScheduleStatus.textContent = `表示に失敗しました：${error.message}`;
    console.error(error);
  }
}

function renderWeeklyScheduleDisplay(schedule) {
  if (!weeklyScheduleDisplay) return;

  const labels = { mon:"月", tue:"火", wed:"水", thu:"木", fri:"金", sat:"土", sun:"日" };
  const merged = { ...getDefaultWeeklySchedule(), ...(schedule || {}) };
  weeklyScheduleDisplay.innerHTML = "";

  Object.keys(labels).forEach((day) => {
    const item = merged[day] || {};
    const chip = document.createElement("span");
    chip.className = `weekly-schedule-chip${item.isOff ? " is-off" : ""}`;

    const dayEl = document.createElement("strong");
    dayEl.textContent = labels[day];

    const valueEl = document.createElement("span");
    valueEl.textContent = item.isOff ? "休み" : `${normalizeScheduleTimeForDisplay(item.startTime) || "未設定"}～`;

    chip.appendChild(dayEl);
    chip.appendChild(valueEl);
    weeklyScheduleDisplay.appendChild(chip);
  });

  weeklyScheduleDisplay.hidden = false;
}

function normalizeScheduleTimeForDisplay(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }

  const text = String(value === null || value === undefined ? "" : value).trim();
  if (!text) return "";

  const direct = text.match(/^(\d{1,2}):(\d{2})$/);
  if (direct) return `${String(Number(direct[1])).padStart(2, "0")}:${direct[2]}`;

  const dateText = text.match(/(?:^|\s)(\d{1,2}):(\d{2}):(\d{2})(?:\s|$)/);
  if (dateText) return `${String(Number(dateText[1])).padStart(2, "0")}:${dateText[2]}`;

  return text;
}

function collectWeeklySchedule(grid = weeklyScheduleGrid) {
  const schedule = {};
  if (!grid) return schedule;
  grid.querySelectorAll(".weekly-schedule-row").forEach((row) => {
    const off = row.querySelector(".schedule-off"); const time = row.querySelector(".schedule-time");
    schedule[row.dataset.day] = { isOff: Boolean(off && off.checked), startTime: off && off.checked ? "" : String(time && time.value || "08:00") };
  });
  return schedule;
}

async function saveWeeklySchedule() {
  if (isRestrictedSelection()) {
    showMessage("デフォルト登録スタッフ以外の勤務時間は変更できません。", "error");
    return;
  }
  if (isSending) return;
  if (!selectedEmployee) { showMessage("先にスタッフを選んでね。", "error"); return; }
  const schedule = collectWeeklySchedule();
  const invalidDay = Object.keys(schedule).find((day) => !schedule[day].isOff && !schedule[day].startTime);
  if (invalidDay) { showMessage("出勤日にする曜日は出勤時間を入力してね。", "error"); return; }
  startSending(saveWeeklyScheduleButton, "勤務予定を更新中...");
  try {
    const result = await postToScript({ mode: "saveWeeklySchedule", employeeNo: selectedEmployee.no, name: selectedEmployee.name, schedule, appVersion: APP_VERSION });
    handleResult(result, `${selectedEmployee.name}の勤務予定を更新しました。`);
    renderWeeklySchedule(result.schedule || schedule); renderWeeklyScheduleDisplay(result.schedule || schedule);
    if (weeklyScheduleStatus) weeklyScheduleStatus.textContent = "更新後の勤務予定を表示しています。";
  } catch (error) { handleError(error); }
  finally { stopSending(saveWeeklyScheduleButton); }
}

function setupAddStaffForm() {
  if (!addStaffButton) return;

  addStaffButton.addEventListener("click", addStaff);
}


function setupRetireStaff() {
  if (!retireStaffButton) return;

  retireStaffButton.addEventListener("click", retireSelectedStaff);

  if (retireKeyInput) {
    retireKeyInput.addEventListener("input", updateRetireButtonState);
    updateRetireButtonState();
  }
}

function updateRetireButtonState() {
  if (!retireStaffButton || !retireKeyInput) return;

  retireStaffButton.disabled = retireKeyInput.value.trim() !== "otobe" || isSending;
}

async function retireSelectedStaff() {
  if (isSending) {
    showMessage("今処理中だから、少し待ってね。", "loading");
    return;
  }

  if (!selectedEmployee) {
    showMessage("退職処理するスタッフを選んでね。", "error");
    return;
  }

  const retireKey = retireKeyInput ? retireKeyInput.value.trim() : "";

  if (retireKey !== "otobe") {
    showMessage("退職処理をするには、合言葉 otobe を入力してね。", "error");
    updateRetireButtonState();
    return;
  }

  const ok = window.confirm(`${selectedEmployee.name} を退職扱いにします。過去データは消さず、スタッフボタンから非表示にします。よろしいですか？`);

  if (!ok) return;

  startSending(retireStaffButton, "退職処理中...");

  try {
    const result = await postToScript({
      mode: "retireStaff",
      name: selectedEmployee.name,
      employeeNo: selectedEmployee.no,
      sheetName: selectedEmployee.sheetName,
      hideSheet: true,
      retireKey,
      appVersion: APP_VERSION,
    });

    handleResult(result, `${selectedEmployee.name}を退職扱いにしました。`);

    const retiredNo = selectedEmployee.no;
    removeExtraEmployee(retiredNo);
    if (normalizeEmployeeNo(localStorage.getItem(DEFAULT_EMPLOYEE_KEY)) === retiredNo) {
      localStorage.removeItem(DEFAULT_EMPLOYEE_KEY);
    }
    await refreshEmployeesFromScript(true);

    if (retireKeyInput) {
      retireKeyInput.value = "";
      updateRetireButtonState();
    }

    if (!EMPLOYEES.length) {
      selectedEmployee = null;
      selectedEmployeeText.textContent = "未選択";
      if (retireTargetEmployee) retireTargetEmployee.textContent = "未選択";
      buildEmployeeSelector("");
      if (todayStatus) todayStatus.textContent = "在籍スタッフがいません。";
      setYesterdayAlertVisible(false);
      return;
    }

    buildEmployeeSelector("");
    selectEmployee(EMPLOYEES[0]);
    buildEmployeeSelector("");
  } catch (error) {
    handleError(error);
  } finally {
    stopSending(retireStaffButton);
  }
}

async function addStaff() {
  if (isSending) {
    showMessage("今処理中だから、少し待ってね。", "loading");
    return;
  }

  const employmentType = newEmploymentType.value;
  const name = newStaffName.value.trim();
  const employeeNo = normalizeEmployeeNo(newEmployeeNo.value);
  const startTime = newStartTime.value;
  const endTime = newEndTime.value;
  const breakMinutes = normalizeBreakMinutes(newBreakMinutes ? newBreakMinutes.value : "60");
  const weeklySchedule = collectWeeklySchedule(newStaffWeeklyScheduleGrid);

  if (!employmentType) {
    showMessage("雇用形態を選んでね。", "error");
    return;
  }

  if (!name) {
    showMessage("スタッフ名を入力してね。", "error");
    return;
  }

  if (!employeeNo || employeeNo === "000") {
    showMessage("社員番号を入力してね。", "error");
    return;
  }

  if (!startTime || !endTime) {
    showMessage("出勤時間と退勤時間を入力してね。", "error");
    return;
  }

  if (breakMinutes === null) {
    showMessage("休憩時間は0以上の分数で入力してね。", "error");
    return;
  }

  const invalidScheduleDay = Object.keys(weeklySchedule).find((day) => !weeklySchedule[day].isOff && !weeklySchedule[day].startTime);
  if (invalidScheduleDay) {
    showMessage("初回の曜日別勤務設定で、出勤日にする曜日の出勤時間を入力してね。", "error");
    return;
  }

  if (EMPLOYEES.some((emp) => emp.no === employeeNo || normalizeName(emp.name) === normalizeName(name))) {
    showMessage("同じ社員番号または名前のスタッフが既に画面にあります。", "error");
    return;
  }

  startSending(addStaffButton, "新規スタッフ登録中...");

  try {
    const result = await postToScript({
      mode: "addStaff",
      employmentType,
      name,
      employeeNo,
      startTime,
      endTime,
      breakMinutes,
      weeklySchedule,
      appVersion: APP_VERSION,
      userAgent: navigator.userAgent,
    });

    handleResult(result, `${name}を登録しました。`);

    const newEmp = {
      name: result.staffName || name,
      no: result.employeeNo || employeeNo,
      sheetName: result.sheetName || name,
      sheetUrl: "",
    };

    saveExtraEmployee(newEmp);

    try {
      await refreshEmployeesFromScript(false);
    } catch (error) {
      loadEmployees();
    }

    buildEmployeeSelector("");
    selectEmployee(EMPLOYEES.find((emp) => emp.no === newEmp.no) || newEmp);
    buildEmployeeSelector("");

    newStaffName.value = "";
    newEmployeeNo.value = "";
    newStartTime.value = "08:00";
    newEndTime.value = "17:00";
    if (newBreakMinutes) newBreakMinutes.value = "60";
    renderScheduleGrid(newStaffWeeklyScheduleGrid, getDefaultWeeklySchedule());

    if (todayStatus) todayStatus.textContent = `${newEmp.name} を新規登録しました。`;
  } catch (error) {
    handleError(error);
  } finally {
    stopSending(addStaffButton);
  }
}

function canSend() {
  if (isSending) {
    showMessage("今処理中だから、少し待ってね。", "loading");
    return false;
  }

  if (!selectedEmployee) {
    showMessage("先にスタッフを選んでね。", "error");
    return false;
  }

  if (!selectedAction) {
    showMessage("出勤・退勤・現時刻打刻・途中退社・有給のどれかを選んでね。", "error");
    return false;
  }

  if (!isEndpointSet()) {
    showMessage("app.jsにApps ScriptのURLを設定してね。", "error");
    return false;
  }

  return true;
}

function startSending(button, text) {
  isSending = true;
  setControlsDisabled(true);
  setButtonLoading(button, true);
  showMessage(text, "loading");
}

function stopSending(button) {
  setButtonLoading(button, false);
  isSending = false;
  setControlsDisabled(false);
  updateRetireButtonState();
  updateShowAllSheetsButtonState();
  buildEmployeeSelector(employeeSearchInput ? employeeSearchInput.value : "");
  updateSheetOpenSelectionState();
  updateSelectedEmployeeAccessLock();
}

function setControlsDisabled(disabled) {
  if (employeeSearchInput) employeeSearchInput.disabled = disabled;
  if (employeeSelect) employeeSelect.disabled = disabled || !employeeSelect.options.length || !employeeSelect.value;
  actionButtons.querySelectorAll("button").forEach((button) => { button.disabled = disabled; });
  if (breakButtons) breakButtons.querySelectorAll("button").forEach((button) => { button.disabled = disabled; });
  updateButton.disabled = disabled;
  editUpdateButton.disabled = disabled;
  editDate.disabled = disabled;
  editTime.disabled = disabled;

  if (addStaffButton) addStaffButton.disabled = disabled;
  if (retireStaffButton) retireStaffButton.disabled = disabled || (retireKeyInput && retireKeyInput.value.trim() !== "otobe");
  if (retireKeyInput) retireKeyInput.disabled = disabled;
  if (newEmploymentType) newEmploymentType.disabled = disabled;
  if (newStaffName) newStaffName.disabled = disabled;
  if (newEmployeeNo) newEmployeeNo.disabled = disabled;
  if (newStartTime) newStartTime.disabled = disabled;
  if (newEndTime) newEndTime.disabled = disabled;
  if (newBreakMinutes) newBreakMinutes.disabled = disabled;
  if (week40OverInput) week40OverInput.disabled = disabled;
  if (saveWeeklyScheduleButton) saveWeeklyScheduleButton.disabled = disabled || !selectedEmployee;
  updateDefaultEmployeeRegistrationUi();
  [weeklyScheduleGrid, newStaffWeeklyScheduleGrid].forEach((grid) => {
    if (!grid) return;
    grid.querySelectorAll(".weekly-schedule-row").forEach((row) => {
    const off = row.querySelector(".schedule-off");
    const time = row.querySelector(".schedule-time");
    if (off) off.disabled = disabled;
      if (time) time.disabled = disabled || Boolean(off && off.checked);
    });
  });
  if (adminOpenKeyInput) adminOpenKeyInput.disabled = disabled;
  if (showAllSheetsButton) showAllSheetsButton.disabled = disabled || (adminOpenKeyInput && adminOpenKeyInput.value.trim() !== "open");
  updateSheetOpenSelectionState();
  updateSelectedEmployeeAccessLock();
}

function setButtonLoading(button, isLoading) {
  if (!button) return;
  button.classList.toggle("is-loading", isLoading);
}

function postToScript(payload) {
  return new Promise((resolve, reject) => {
    const callbackName = `timecardCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Apps Scriptから応答がありませんでした。デプロイURLと公開設定を確認してね。"));
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

    const safePayload = { ...payload };
    delete safePayload.userAgent;

    const params = new URLSearchParams();
    params.set("callback", callbackName);
    params.set("payload", JSON.stringify(safePayload));
    params.set("_", String(Date.now()));

    script.onerror = () => {
      cleanup();
      reject(new Error("Apps Scriptを読み込めませんでした。ウェブアプリURLか公開設定を確認してね。"));
    };

    script.src = `${ENDPOINT_URL}?${params.toString()}`;
    document.body.appendChild(script);
  });
}

function handleResult(result, successMessage) {
  if (!result || !result.ok) {
    throw new Error((result && result.message) || "更新に失敗しました。");
  }

  // Apps Scriptから返る詳細ログ文は長いため、画面には短い成功文だけ表示します。
  showMessage(successMessage || "処理が完了しました。", "ok");
}

function handleError(error) {
  console.error(error);
  showMessage(`処理できませんでした：${error.message}`, "error");
}

function isEndpointSet() {
  return ENDPOINT_URL && !ENDPOINT_URL.includes("ここに");
}

function setUpdateStatus(text, status) {
  if (!updateStatus) return;

  updateStatus.textContent = text;
  updateStatus.className = `update-status ${status || "neutral"}`.trim();
  updateStatus.classList.remove("flash");
  void updateStatus.offsetWidth;
  updateStatus.classList.add("flash");
}

function showMessage(text, status) {
  message.textContent = text;
  message.className = `message ${status || ""}`.trim();
  message.classList.remove("flash");
  void message.offsetWidth;
  message.classList.add("flash");
}

function roundDownToQuarter(date) {
  const copied = new Date(date);
  const minutes = copied.getMinutes();
  copied.setMinutes(Math.floor(minutes / 15) * 15, 0, 0);
  return copied;
}

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTimeInput(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function normalizeEmployeeNo(value) {
  const text = String(value || "").trim().replace(/\.0$/, "");
  return text ? text.padStart(3, "0") : "";
}

function normalizeBreakMinutes(value) {
  const text = String(value ?? "").trim();

  if (text === "") return null;

  const num = Number(text);

  if (!Number.isFinite(num) || num < 0) return null;

  return Math.round(num);
}

function normalizeName(value) {
  return String(value || "").replace(/\s/g, "");
}
