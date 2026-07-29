const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbykqf1T967tzrQ_A63vHsMfrNp_QBuoaRAfOvchF0MEpZ1ob5xgGXeNbglUvTj-rw8uKg/exec";
const APP_VERSION = "parking-warehouse-cleanup-20260729-47";

const DAY_DEFS = [
  { key: "mon", label: "月曜日", shortLabel: "月", jsDay: 1 },
  { key: "tue", label: "火曜日", shortLabel: "火", jsDay: 2 },
  { key: "wed", label: "水曜日", shortLabel: "水", jsDay: 3 },
  { key: "thu", label: "木曜日", shortLabel: "木", jsDay: 4 },
  { key: "fri", label: "金曜日", shortLabel: "金", jsDay: 5 },
  { key: "sat", label: "土曜日", shortLabel: "土", jsDay: 6 },
  { key: "sun", label: "日曜日", shortLabel: "日", jsDay: 0 },
];

let parkingData = { employees: [], days: {}, conflicts: [] };
let selectedDayKey = getTodayDayKey();

const message = document.getElementById("message");
const dayTabs = document.getElementById("dayTabs");
const staffTotalBadge = document.getElementById("staffTotalBadge");
const selectedDayTitle = document.getElementById("selectedDayTitle");
const selectedDayCounts = document.getElementById("selectedDayCounts");
const conflictArea = document.getElementById("conflictArea");
const eastParkingGrid = document.getElementById("eastParkingGrid");
const westParkingGrid = document.getElementById("westParkingGrid");
const warehouseUnderList = document.getElementById("warehouseUnderList");
const walkingList = document.getElementById("walkingList");
const publicTransportList = document.getElementById("publicTransportList");
const unregisteredList = document.getElementById("unregisteredList");
const warehouseUnderCount = document.getElementById("warehouseUnderCount");
const walkingCount = document.getElementById("walkingCount");
const publicTransportCount = document.getElementById("publicTransportCount");
const unregisteredCount = document.getElementById("unregisteredCount");
const weeklyParkingBody = document.getElementById("weeklyParkingBody");
const generatedAt = document.getElementById("generatedAt");
const dataVersion = document.getElementById("dataVersion");
const scrollToTopButton = document.getElementById("scrollToTopButton");
const scrollToBottomButton = document.getElementById("scrollToBottomButton");

init();

function init() {
  buildDayTabs();
  setupPageNavigation();
  loadParkingUsage();
}

function getTodayDayKey() {
  const today = new Date().getDay();
  const found = DAY_DEFS.find((day) => day.jsDay === today);
  return found ? found.key : "mon";
}

function buildDayTabs() {
  dayTabs.innerHTML = "";
  DAY_DEFS.forEach((day) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-tab";
    button.dataset.day = day.key;
    button.setAttribute("role", "tab");
    button.innerHTML = `${day.shortLabel}<span>0名</span>`;
    button.addEventListener("click", () => {
      selectedDayKey = day.key;
      renderAll();
    });
    dayTabs.appendChild(button);
  });
}

async function loadParkingUsage() {
  setMessage("登録内容を読み込み中...", "loading");
  try {
    const result = await postToScript({ mode: "getParkingUsage", appVersion: APP_VERSION });
    if (!result || !result.ok) throw new Error((result && result.message) || "駐車場使用状況を取得できませんでした。");
    parkingData = {
      employees: Array.isArray(result.employees) ? result.employees : [],
      days: result.days && typeof result.days === "object" ? result.days : {},
      conflicts: Array.isArray(result.conflicts) ? result.conflicts : [],
    };
    staffTotalBadge.textContent = `${parkingData.employees.length}名`;
    generatedAt.textContent = `最終取得：${result.generatedAt || "-"}`;
    dataVersion.textContent = `データ版：${result.version || "-"}`;
    renderAll();
    setMessage(result.message || "駐車場使用状況を取得しました。", "ok");
  } catch (error) {
    console.error(error);
    setMessage(`取得できませんでした：${error.message}`, "error");
  }
}

function renderAll() {
  renderDayTabs();
  renderSelectedDay();
  renderWeeklyTable();
}

function getDayData(dayKey) {
  const raw = parkingData.days[dayKey] || {};
  return {
    parking: Array.isArray(raw.parking) ? raw.parking : [],
    warehouseUnder: Array.isArray(raw.warehouseUnder) ? raw.warehouseUnder : [],
    walking: Array.isArray(raw.walking) ? raw.walking : [],
    publicTransport: Array.isArray(raw.publicTransport) ? raw.publicTransport : [],
    unregistered: Array.isArray(raw.unregistered) ? raw.unregistered : [],
  };
}

function renderDayTabs() {
  dayTabs.querySelectorAll(".day-tab").forEach((button) => {
    const data = getDayData(button.dataset.day);
    const count = data.parking.length + data.warehouseUnder.length + data.walking.length + data.publicTransport.length + data.unregistered.length;
    const countNode = button.querySelector("span");
    if (countNode) countNode.textContent = `${count}名`;
    const active = button.dataset.day === selectedDayKey;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function renderSelectedDay() {
  const dayDef = DAY_DEFS.find((day) => day.key === selectedDayKey) || DAY_DEFS[0];
  const data = getDayData(selectedDayKey);
  selectedDayTitle.textContent = dayDef.label;
  selectedDayCounts.textContent = `通常駐車場 ${data.parking.length}名 / 乙部在庫倉庫下 ${data.warehouseUnder.length}名 / 徒歩 ${data.walking.length}名 / 公共交通機関 ${data.publicTransport.length}名`;
  renderParkingMap(data.parking);
  renderNameList(warehouseUnderList, warehouseUnderCount, data.warehouseUnder);
  renderNameList(walkingList, walkingCount, data.walking);
  renderNameList(publicTransportList, publicTransportCount, data.publicTransport);
  renderNameList(unregisteredList, unregisteredCount, data.unregistered);
  renderConflicts();
}

function renderParkingMap(entries) {
  const byNumber = {};
  entries.forEach((entry) => {
    const number = normalizeParkingNumber(entry.parkingNumber);
    if (!number) return;
    if (!byNumber[number]) byNumber[number] = [];
    byNumber[number].push(entry);
  });

  eastParkingGrid.innerHTML = "";
  for (let index = 0; index < 10; index += 1) {
    const row = document.createElement("div");
    row.className = "east-parking-row";
    row.appendChild(createParkingSpace(String(23 + index), byNumber[String(23 + index)] || []));
    row.appendChild(createParkingSpace(String(12 + index), byNumber[String(12 + index)] || []));
    eastParkingGrid.appendChild(row);
  }
  const finalRow = document.createElement("div");
  finalRow.className = "east-parking-row";
  finalRow.appendChild(createParkingPlaceholder("K"));
  finalRow.appendChild(createParkingSpace("22", byNumber["22"] || []));
  eastParkingGrid.appendChild(finalRow);

  westParkingGrid.innerHTML = "";
  for (let number = 1; number <= 11; number += 1) {
    westParkingGrid.appendChild(createParkingSpace(String(number), byNumber[String(number)] || []));
  }
}

function createParkingSpace(number, entries) {
  const space = document.createElement("div");
  space.className = "parking-space";
  if (entries.length) space.classList.add("is-occupied");
  if (entries.length > 1) space.classList.add("has-conflict");

  const numberNode = document.createElement("span");
  numberNode.className = "parking-space-number";
  numberNode.textContent = number;

  const namesNode = document.createElement("span");
  namesNode.className = "parking-space-names";
  namesNode.textContent = entries.map((entry) => getFamilyName(entry.name || entry.staffName)).join("・");
  namesNode.title = entries.map((entry) => entry.name || entry.staffName || "").filter(Boolean).join(" / ");

  space.append(numberNode, namesNode);
  return space;
}

function createParkingPlaceholder(label) {
  const space = document.createElement("div");
  space.className = "parking-space placeholder";
  const numberNode = document.createElement("span");
  numberNode.className = "parking-space-number";
  numberNode.textContent = label;
  const namesNode = document.createElement("span");
  namesNode.className = "parking-space-names";
  namesNode.textContent = "";
  space.append(numberNode, namesNode);
  return space;
}

function renderNameList(container, countNode, entries) {
  container.innerHTML = "";
  countNode.textContent = `${entries.length}名`;
  if (!entries.length) {
    const empty = document.createElement("span");
    empty.className = "empty-text";
    empty.textContent = "該当スタッフはいません";
    container.appendChild(empty);
    return;
  }
  entries
    .slice()
    .sort((a, b) => Number(a.employeeNo || a.no) - Number(b.employeeNo || b.no))
    .forEach((entry) => {
      const chip = document.createElement("span");
      chip.className = "name-chip";
      chip.textContent = entry.name || entry.staffName || "名称未設定";
      container.appendChild(chip);
    });
}

function renderConflicts() {
  const conflicts = parkingData.conflicts.filter((item) => item.dayKey === selectedDayKey);
  if (!conflicts.length) {
    conflictArea.hidden = true;
    conflictArea.innerHTML = "";
    return;
  }
  conflictArea.hidden = false;
  conflictArea.innerHTML = `<strong>駐車場番号の重複があります。</strong><br>${conflicts.map((item) => {
    const names = (item.staff || []).map((staff) => staff.name || staff.staffName).filter(Boolean).join("・");
    return `${item.parkingNumber}番：${names}`;
  }).join("<br>")}`;
}

function renderWeeklyTable() {
  weeklyParkingBody.innerHTML = "";
  const usedNumbers = new Set();
  DAY_DEFS.forEach((day) => {
    getDayData(day.key).parking.forEach((entry) => {
      const number = normalizeParkingNumber(entry.parkingNumber);
      if (number) usedNumbers.add(Number(number));
    });
  });
  const numbers = Array.from(usedNumbers).sort((a, b) => a - b);
  if (!numbers.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.className = "empty-row";
    cell.textContent = "通常の駐車場番号はまだ登録されていません。";
    row.appendChild(cell);
    weeklyParkingBody.appendChild(row);
  }

  numbers.forEach((number) => {
    const row = document.createElement("tr");
    const numberCell = document.createElement("td");
    numberCell.textContent = String(number);
    row.appendChild(numberCell);
    DAY_DEFS.forEach((day) => {
      const entries = getDayData(day.key).parking.filter((entry) => Number(entry.parkingNumber) === number);
      const cell = document.createElement("td");
      if (entries.length) cell.classList.add("is-used");
      if (entries.length > 1) cell.classList.add("has-conflict");
      cell.textContent = entries.map((entry) => getFamilyName(entry.name || entry.staffName)).join("・");
      cell.title = entries.map((entry) => entry.name || entry.staffName || "").filter(Boolean).join(" / ");
      row.appendChild(cell);
    });
    weeklyParkingBody.appendChild(row);
  });

  const warehouseRow = document.createElement("tr");
  warehouseRow.className = "warehouse-weekly-row";
  const warehouseLabel = document.createElement("td");
  warehouseLabel.textContent = "倉庫下";
  warehouseLabel.title = "乙部在庫倉庫下";
  warehouseRow.appendChild(warehouseLabel);
  DAY_DEFS.forEach((day) => {
    const entries = getDayData(day.key).warehouseUnder;
    const cell = document.createElement("td");
    if (entries.length) cell.classList.add("is-warehouse-used");
    const names = entries.map((entry) => getFamilyName(entry.name || entry.staffName));
    cell.textContent = entries.length ? `${entries.length}名 ${names.join("・")}` : "";
    cell.title = entries.map((entry) => entry.name || entry.staffName || "").filter(Boolean).join(" / ");
    warehouseRow.appendChild(cell);
  });
  weeklyParkingBody.appendChild(warehouseRow);
}

function normalizeParkingNumber(value) {
  const text = normalizeParkingNumberInput(value);
  const number = Number(text);
  return text && number >= 1 && number <= 32 ? String(number) : "";
}

function normalizeParkingNumberInput(value) {
  return String(value || "")
    .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xFEE0))
    .replace(/\D/g, "")
    .slice(0, 2);
}

function getFamilyName(name) {
  const normalized = String(name || "").trim().replace(/[\s　]+/g, " ");
  return normalized.split(" ")[0] || normalized;
}

function setMessage(text, type) {
  message.textContent = text || "";
  message.className = `message ${type || "ok"}`;
}

function setupPageNavigation() {
  scrollToTopButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  scrollToBottomButton.addEventListener("click", () => {
    const bottom = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    window.scrollTo({ top: bottom, behavior: "smooth" });
  });
}

function postToScript(payload) {
  return new Promise((resolve, reject) => {
    const callbackName = `parkingCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Apps Scriptから応答がありませんでした。デプロイURLと公開設定を確認してください。"));
    }, 30000);

    function cleanup() {
      window.clearTimeout(timer);
      if (script.parentNode) script.parentNode.removeChild(script);
      try { delete window[callbackName]; } catch (error) { window[callbackName] = undefined; }
    }

    window[callbackName] = (result) => {
      cleanup();
      resolve(result);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Apps Scriptへの接続に失敗しました。"));
    };

    const query = new URLSearchParams({ callback: callbackName, payload: JSON.stringify(payload) });
    script.src = `${ENDPOINT_URL}?${query.toString()}`;
    document.body.appendChild(script);
  });
}
