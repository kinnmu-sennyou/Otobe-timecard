const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbykqf1T967tzrQ_A63vHsMfrNp_QBuoaRAfOvchF0MEpZ1ob5xgGXeNbglUvTj-rw8uKg/exec";
const APP_VERSION = "weekly-attendance-overview-v4-20260729-43";

const DAY_DEFS = [
  { key: "mon", label: "月曜日", aliases: ["mon", "monday", "月", "月曜", "月曜日"] },
  { key: "tue", label: "火曜日", aliases: ["tue", "tuesday", "火", "火曜", "火曜日"] },
  { key: "wed", label: "水曜日", aliases: ["wed", "wednesday", "水", "水曜", "水曜日"] },
  { key: "thu", label: "木曜日", aliases: ["thu", "thursday", "木", "木曜", "木曜日"] },
  { key: "fri", label: "金曜日", aliases: ["fri", "friday", "金", "金曜", "金曜日"] },
  { key: "sat", label: "土曜日", aliases: ["sat", "saturday", "土", "土曜", "土曜日"] },
  { key: "sun", label: "日曜日", aliases: ["sun", "sunday", "日", "日曜", "日曜日"] },
];

const statusElement = document.getElementById("overviewStatus");
const boardElement = document.getElementById("scheduleBoard");
const refreshButton = document.getElementById("refreshButton");
const staffCountElement = document.getElementById("staffCount");
const generatedAtElement = document.getElementById("generatedAt");
const scrollToTopButton = document.getElementById("scrollToTopButton");
const scrollToBottomButton = document.getElementById("scrollToBottomButton");

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initOverview);
} else {
  initOverview();
}

function initOverview() {
  refreshButton.addEventListener("click", loadOverview);

  if (scrollToTopButton) {
    scrollToTopButton.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (scrollToBottomButton) {
    scrollToBottomButton.addEventListener("click", () => {
      const bottom = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      window.scrollTo({ top: bottom, behavior: "smooth" });
    });
  }

  renderEmptyBoard();
  loadOverview();
}

async function loadOverview() {
  refreshButton.disabled = true;
  setStatus("勤務予定を読み込んでいます。", "loading");

  try {
    const result = await postToScript({
      mode: "getWeeklyAttendanceOverview",
      appVersion: APP_VERSION,
    });

    if (!result || !result.ok || !Array.isArray(result.employees)) {
      throw new Error((result && result.message) || "週間出勤状況を取得できませんでした。");
    }

    const renderResult = renderBoard(result);
    staffCountElement.textContent = `${result.employees.length}名`;

    const versionText = result.version ? ` / データ版：${result.version}` : "";
    generatedAtElement.textContent = result.generatedAt
      ? `更新日時：${result.generatedAt}${versionText}`
      : versionText.replace(/^ \/ /, "");

    if (renderResult.totalShifts === 0 && result.employees.length > 0) {
      setStatus(
        `スタッフ${result.employees.length}名は取得できましたが、勤務時刻を読み取れませんでした。Apps Scriptを最新版へ差し替えて再デプロイしてください。`,
        "error"
      );
    } else {
      const countSummary = DAY_DEFS
        .map((day) => `${day.label.slice(0, 1)}${renderResult.dayCounts[day.key] || 0}名`)
        .join(" / ");
      setStatus(`${result.message || "週間出勤状況を更新しました。"} ${countSummary}`, "ok");
    }
  } catch (error) {
    console.error(error);
    renderEmptyBoard();
    staffCountElement.textContent = "0名";
    generatedAtElement.textContent = "";
    setStatus(`取得できませんでした：${error.message}`, "error");
  } finally {
    refreshButton.disabled = false;
  }
}

function renderEmptyBoard() {
  boardElement.innerHTML = "";
  boardElement.appendChild(buildTimelineHeader());
  DAY_DEFS.forEach((day) => {
    boardElement.appendChild(buildDayRow(day, []));
  });
}

function renderBoard(result) {
  const employees = Array.isArray(result && result.employees) ? result.employees : [];
  const serverTimeline = result && typeof result.timeline === "object" ? result.timeline : null;
  const dayCounts = {};
  let totalShifts = 0;

  boardElement.innerHTML = "";
  boardElement.appendChild(buildTimelineHeader());

  DAY_DEFS.forEach((day) => {
    let shifts = [];

    if (serverTimeline) {
      const timelineRows = getValueByAliases(serverTimeline, day.aliases);
      if (Array.isArray(timelineRows)) {
        shifts = timelineRows.map(normalizeServerShift).filter(Boolean);
      }
    }

    if (!shifts.length) {
      shifts = employees.map((employee) => buildShift(employee, day)).filter(Boolean);
    }

    shifts.sort((a, b) => {
      return a.startMinutes - b.startMinutes ||
        a.endMinutes - b.endMinutes ||
        a.employeeNo.localeCompare(b.employeeNo, "ja");
    });

    dayCounts[day.key] = shifts.length;
    totalShifts += shifts.length;
    boardElement.appendChild(buildDayRow(day, shifts));
  });

  return { dayCounts, totalShifts };
}

function buildTimelineHeader() {
  const header = document.createElement("div");
  header.className = "timeline-header";

  const corner = document.createElement("div");
  corner.className = "corner-label";
  corner.textContent = "曜日";
  header.appendChild(corner);

  const hourGrid = document.createElement("div");
  hourGrid.className = "hour-grid";

  for (let hour = 0; hour < 24; hour += 1) {
    const cell = document.createElement("div");
    cell.className = "hour-cell";
    cell.textContent = `${hour}:00`;
    hourGrid.appendChild(cell);
  }

  header.appendChild(hourGrid);
  return header;
}

function buildDayRow(day, shifts) {
  const row = document.createElement("section");
  row.className = "day-row";
  row.setAttribute("aria-label", `${day.label}の出勤状況`);

  const label = document.createElement("div");
  label.className = "day-label";
  label.textContent = day.label;
  row.appendChild(label);

  const canvas = document.createElement("div");
  canvas.className = "day-canvas";

  const placed = assignLanes(shifts);
  const laneCount = placed.reduce((max, shift) => Math.max(max, shift.lane + 1), 0);
  canvas.style.height = `${Math.max(1, laneCount) * 38 + 10}px`;

  if (!placed.length) {
    const empty = document.createElement("span");
    empty.className = "empty-day";
    empty.textContent = "出勤予定なし";
    canvas.appendChild(empty);
  }

  placed.forEach((shift) => {
    const bar = document.createElement("div");
    bar.className = "shift-bar";
    bar.style.left = `${(shift.startMinutes / 1440) * 100}%`;
    bar.style.width = `${((shift.endMinutes - shift.startMinutes) / 1440) * 100}%`;
    bar.style.top = `${shift.lane * 38 + 5}px`;
    bar.title = `${shift.fullName} ${shift.startTime}～${shift.endTime}`;
    bar.setAttribute("aria-label", `${shift.fullName}、${shift.startTime}から${shift.endTime}`);

    const name = document.createElement("span");
    name.className = "shift-name";
    name.textContent = shift.familyName;
    bar.appendChild(name);

    const time = document.createElement("span");
    time.className = "shift-time";
    time.textContent = `${shift.startTime}-${shift.endTime}`;
    bar.appendChild(time);

    canvas.appendChild(bar);
  });

  row.appendChild(canvas);
  return row;
}

function normalizeServerShift(value) {
  if (!value || typeof value !== "object") return null;

  const startValue = firstDefined(value.startTime, value.start, value.from, value.begin);
  const endValue = firstDefined(value.endTime, value.end, value.to, value.finish);
  const startMinutes = timeToMinutes(startValue);
  let endMinutes = timeToMinutes(endValue);

  if (startMinutes === null || endMinutes === null) return null;
  if (endMinutes <= startMinutes) endMinutes = 1440;

  return buildNormalizedShift({
    employeeNo: firstDefined(value.employeeNo, value.no, value.staffNo),
    name: firstDefined(value.name, value.staffName, value.fullName),
    startValue,
    endValue,
    startMinutes,
    endMinutes,
  });
}

function buildShift(employee, dayDef) {
  if (!employee || typeof employee !== "object") return null;

  const dayValue = resolveDayValue(employee, dayDef);
  if (isOffValue(dayValue)) return null;

  let startValue = "";
  let endValue = "";

  if (dayValue && typeof dayValue === "object" && !Array.isArray(dayValue)) {
    if (isTruthyOffFlag(firstDefined(dayValue.isOff, dayValue.off, dayValue.holiday, dayValue.closed))) {
      return null;
    }

    startValue = firstDefined(
      dayValue.startTime,
      dayValue.start,
      dayValue.from,
      dayValue.begin,
      dayValue.time,
      dayValue.value
    );
    endValue = firstDefined(dayValue.endTime, dayValue.end, dayValue.to, dayValue.finish);
  } else {
    startValue = dayValue;
  }

  startValue = firstDefined(
    startValue,
    employee.startTime,
    employee.defaultStartTime,
    employee.workStartTime,
    employee.start
  );

  endValue = firstDefined(
    endValue,
    employee.endTime,
    employee.defaultEndTime,
    employee.workEndTime,
    employee.finishTime,
    employee.end
  );

  const startMinutes = timeToMinutes(startValue);
  let endMinutes = timeToMinutes(endValue);
  if (startMinutes === null || endMinutes === null) return null;
  if (endMinutes <= startMinutes) endMinutes = 1440;

  return buildNormalizedShift({
    employeeNo: firstDefined(employee.employeeNo, employee.no, employee.staffNo),
    name: firstDefined(employee.name, employee.staffName, employee.fullName),
    startValue,
    endValue,
    startMinutes,
    endMinutes,
  });
}

function resolveDayValue(employee, dayDef) {
  const sources = [
    employee.schedule,
    employee.weeklySchedule,
    employee.days,
    employee.shifts,
    employee.workSchedule,
    employee,
  ];

  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const value = getValueByAliases(source, dayDef.aliases);
    if (value !== undefined && value !== null && value !== "") return value;
  }

  return null;
}

function getValueByAliases(source, aliases) {
  if (!source || typeof source !== "object") return undefined;

  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(source, alias)) return source[alias];
  }

  const sourceKeys = Object.keys(source);
  for (const key of sourceKeys) {
    const normalizedKey = String(key).trim().toLowerCase();
    if (aliases.some((alias) => normalizedKey === String(alias).trim().toLowerCase())) {
      return source[key];
    }
  }

  return undefined;
}

function buildNormalizedShift(data) {
  const clampedStart = Math.max(0, Math.min(1439, data.startMinutes));
  const clampedEnd = Math.max(clampedStart + 1, Math.min(1440, data.endMinutes));
  const fullName = String(data.name || "").trim() || "名称未設定";

  return {
    employeeNo: String(data.employeeNo || ""),
    fullName,
    familyName: getFamilyName(fullName),
    startTime: minutesToTime(clampedStart),
    endTime: minutesToTime(clampedEnd),
    startMinutes: clampedStart,
    endMinutes: clampedEnd,
  };
}

function assignLanes(shifts) {
  const laneEnds = [];

  return shifts.map((shift) => {
    let lane = laneEnds.findIndex((endMinutes) => endMinutes <= shift.startMinutes);

    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(shift.endMinutes);
    } else {
      laneEnds[lane] = shift.endMinutes;
    }

    return { ...shift, lane };
  });
}

function timeToMinutes(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 60 + value.getMinutes();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value < 1) return Math.round(value * 1440);
    if (value >= 0 && value <= 24) return Math.round(value * 60);
  }

  const normalized = normalizeTimeSource(value);
  if (!normalized) return null;
  if (/^(休み|休日|off|closed)$/i.test(normalized)) return null;

  const direct = normalized.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
  const japanese = normalized.match(/^(\d{1,2})時(?:(\d{1,2})分?)?$/);
  const iso = normalized.match(/[T\s](\d{1,2}):(\d{2})(?::\d{2})?/);
  const match = direct || japanese || iso;

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) return null;
  if (hour === 24 && minute !== 0) return null;

  return hour * 60 + minute;
}

function normalizeTimeSource(value) {
  return String(value === null || value === undefined ? "" : value)
    .trim()
    .replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xfee0))
    .replace(/[：﹕∶]/g, ":")
    .replace(/[～〜]/g, "-")
    .replace(/\s+/g, "");
}

function minutesToTime(minutes) {
  const safeMinutes = Math.max(0, Math.min(1440, Number(minutes) || 0));
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isOffValue(value) {
  if (value === null || value === undefined || value === "") return false;

  if (typeof value === "object" && !Array.isArray(value)) {
    return isTruthyOffFlag(firstDefined(value.isOff, value.off, value.holiday, value.closed));
  }

  const normalized = normalizeTimeSource(value).toLowerCase();
  return ["休み", "休日", "公休", "off", "closed"].includes(normalized);
}

function isTruthyOffFlag(value) {
  if (value === true || value === 1) return true;
  const normalized = String(value === null || value === undefined ? "" : value).trim().toLowerCase();
  return ["true", "1", "yes", "on", "休み", "休日", "公休", "off", "closed"].includes(normalized);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function getFamilyName(value) {
  const fullName = String(value || "").trim();
  if (!fullName) return "未設定";
  return fullName.split(/[\s\u3000]+/)[0] || fullName;
}

function setStatus(text, type) {
  statusElement.textContent = text;
  statusElement.className = `overview-status ${type || ""}`.trim();
}

function postToScript(payload) {
  return new Promise((resolve, reject) => {
    const callbackName = `weeklyOverviewCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Apps Scriptから応答がありませんでした。"));
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
      reject(new Error("Apps Scriptを読み込めませんでした。"));
    };

    script.src = `${ENDPOINT_URL}?${params.toString()}`;
    document.body.appendChild(script);
  });
}
