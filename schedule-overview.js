const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbykqf1T967tzrQ_A63vHsMfrNp_QBuoaRAfOvchF0MEpZ1ob5xgGXeNbglUvTj-rw8uKg/exec";
const APP_VERSION = "weekly-attendance-tools-20260729-40";
const DAY_DEFS = [
  { key: "mon", label: "\u6708\u66dc\u65e5" },
  { key: "tue", label: "\u706b\u66dc\u65e5" },
  { key: "wed", label: "\u6c34\u66dc\u65e5" },
  { key: "thu", label: "\u6728\u66dc\u65e5" },
  { key: "fri", label: "\u91d1\u66dc\u65e5" },
  { key: "sat", label: "\u571f\u66dc\u65e5" },
  { key: "sun", label: "\u65e5\u66dc\u65e5" },
];

const statusElement = document.getElementById("overviewStatus");
const boardElement = document.getElementById("scheduleBoard");
const refreshButton = document.getElementById("refreshButton");
const staffCountElement = document.getElementById("staffCount");
const generatedAtElement = document.getElementById("generatedAt");
const scrollToTopButton = document.getElementById("scrollToTopButton");

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initOverview);
} else {
  initOverview();
}

function initOverview() {
  refreshButton.addEventListener("click", loadOverview);
  scrollToTopButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  renderEmptyBoard();
  loadOverview();
}

async function loadOverview() {
  refreshButton.disabled = true;
  setStatus("\u52e4\u52d9\u4e88\u5b9a\u3092\u8aad\u307f\u8fbc\u3093\u3067\u3044\u307e\u3059\u3002", "loading");

  try {
    const result = await postToScript({
      mode: "getWeeklyAttendanceOverview",
      appVersion: APP_VERSION,
    });

    if (!result || !result.ok || !Array.isArray(result.employees)) {
      throw new Error((result && result.message) || "\u9031\u9593\u51fa\u52e4\u72b6\u6cc1\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002");
    }

    renderBoard(result.employees);
    staffCountElement.textContent = `${result.employees.length}\u540d`;
    generatedAtElement.textContent = result.generatedAt ? `\u66f4\u65b0\u65e5\u6642\uff1a${result.generatedAt}` : "";
    setStatus(result.message || "\u9031\u9593\u51fa\u52e4\u72b6\u6cc1\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f\u3002", "ok");
  } catch (error) {
    console.error(error);
    renderEmptyBoard();
    staffCountElement.textContent = "0\u540d";
    generatedAtElement.textContent = "";
    setStatus(`\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\uff1a${error.message}`, "error");
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

function renderBoard(employees) {
  boardElement.innerHTML = "";
  boardElement.appendChild(buildTimelineHeader());

  DAY_DEFS.forEach((day) => {
    const shifts = employees
      .map((employee) => buildShift(employee, day.key))
      .filter(Boolean)
      .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes || a.employeeNo.localeCompare(b.employeeNo));

    boardElement.appendChild(buildDayRow(day, shifts));
  });
}

function buildTimelineHeader() {
  const header = document.createElement("div");
  header.className = "timeline-header";

  const corner = document.createElement("div");
  corner.className = "corner-label";
  corner.textContent = "\u66dc\u65e5";
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
  row.setAttribute("aria-label", `${day.label}\u306e\u51fa\u52e4\u72b6\u6cc1`);

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
    empty.textContent = "\u51fa\u52e4\u4e88\u5b9a\u306a\u3057";
    canvas.appendChild(empty);
  }

  placed.forEach((shift) => {
    const bar = document.createElement("div");
    bar.className = "shift-bar";
    bar.style.left = `${(shift.startMinutes / 1440) * 100}%`;
    bar.style.width = `${((shift.endMinutes - shift.startMinutes) / 1440) * 100}%`;
    bar.style.top = `${shift.lane * 38 + 5}px`;
    bar.title = `${shift.fullName} ${shift.startTime}\uff5e${shift.endTime}`;
    bar.setAttribute("aria-label", `${shift.fullName}\u3001${shift.startTime}\u304b\u3089${shift.endTime}`);

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

function buildShift(employee, dayKey) {
  const day = employee && employee.schedule ? employee.schedule[dayKey] : null;
  if (!day || day.isOff) return null;

  const startMinutes = timeToMinutes(day.startTime);
  let endMinutes = timeToMinutes(day.endTime);
  if (startMinutes === null || endMinutes === null) return null;

  if (endMinutes <= startMinutes) endMinutes = 1440;
  const clampedStart = Math.max(0, Math.min(1439, startMinutes));
  const clampedEnd = Math.max(clampedStart + 1, Math.min(1440, endMinutes));

  return {
    employeeNo: String(employee.employeeNo || ""),
    fullName: String(employee.name || "").trim(),
    familyName: getFamilyName(employee.name),
    startTime: normalizeTimeText(day.startTime),
    endTime: normalizeTimeText(day.endTime),
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
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 24 || minute < 0 || minute > 59) return null;
  if (hour === 24 && minute !== 0) return null;
  return hour * 60 + minute;
}

function normalizeTimeText(value) {
  const minutes = timeToMinutes(value);
  if (minutes === null) return String(value || "");
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getFamilyName(value) {
  const fullName = String(value || "").trim();
  if (!fullName) return "\u672a\u8a2d\u5b9a";
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
      reject(new Error("Apps Script\u304b\u3089\u5fdc\u7b54\u304c\u3042\u308a\u307e\u305b\u3093\u3067\u3057\u305f\u3002"));
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
      reject(new Error("Apps Script\u3092\u8aad\u307f\u8fbc\u3081\u307e\u305b\u3093\u3067\u3057\u305f\u3002"));
    };

    script.src = `${ENDPOINT_URL}?${params.toString()}`;
    document.body.appendChild(script);
  });
}
