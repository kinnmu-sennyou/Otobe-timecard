/* 管理者用：打刻状況確認。既存の勤怠UIと完全に独立した閲覧専用ページ。 */
(() => {
  'use strict';
  const ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbykqf1T967tzrQ_A63vHsMfrNp_QBuoaRAfOvchF0MEpZ1ob5xgGXeNbglUvTj-rw8uKg/exec';
  const ADMIN_KEY_NAME = 'timecard-admin-attendance-key';
  const adminKey = sessionStorage.getItem(ADMIN_KEY_NAME);
  if (adminKey !== 'check') {
    window.location.replace('./index.html');
    return;
  }
  const byId = (id) => document.getElementById(id);
  const elements = {
    staffList: byId('adminStaffList'), search: byId('staffSearch'), status: byId('adminStatus'),
    selected: byId('selectedStaffName'), registration: byId('registrationDetails'),
    monthWrap: byId('monthlySummaries'), history: byId('historyBody'),
    historyCount: byId('historyCount'), actionFilter: byId('actionFilter'),
    sort: byId('sortOrder'), logout: byId('logoutAdmin'),
    dateBasis: byId('historyDateBasis'), dateWheels: byId('historyDateWheels'),
    dateSummary: byId('historyDateSummary'), dateReset: byId('resetHistoryDate'),
    wheel: {
      year: byId('wheelYear'), month: byId('wheelMonth'), day: byId('wheelDay'),
      hour: byId('wheelHour'), minute: byId('wheelMinute')
    }
  };
  let staff = [];
  let history = [];
  let chosenNo = '';
  let loadSequence = 0;
  const WHEEL_ROW_HEIGHT = 30;
  const DATE_PARTS = ['year', 'month', 'day', 'hour', 'minute'];
  const wheelValues = { year: [], month: [], day: [], hour: [], minute: [] };
  const wheelSelection = { year: 'all', month: 'all', day: 'all', hour: 'all', minute: 'all' };
  function request(payload) {
    return new Promise((resolve, reject) => {
      const callback = `timecardAdminCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timer = window.setTimeout(() => { cleanup(); reject(new Error('取得がタイムアウトしました。')); }, 60000);
      function cleanup() {
        window.clearTimeout(timer);
        delete window[callback];
        script.remove();
      }
      window[callback] = (result) => {
        cleanup();
        if (!result || !result.ok) reject(new Error(result?.message || '取得できませんでした'));
        else resolve(result);
      };
      script.onerror = () => { cleanup(); reject(new Error('サーバーに接続できませんでした。')); };
      const params = new URLSearchParams({ callback, payload: JSON.stringify({ ...payload, adminKey }), _: String(Date.now()) });
      script.src = `${ENDPOINT_URL}?${params}`;
      document.body.appendChild(script);
    });
  }
  function setStatus(text, error = false) {
    elements.status.textContent = text;
    elements.status.classList.toggle('error', error);
  }
  function mk(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = String(text);
    return el;
  }
  function timeMinutes(n) {
    if (n === null || n === undefined || n === '' || !Number.isFinite(Number(n))) return '—';
    const x = Math.round(Number(n));
    return `${Math.floor(Math.abs(x) / 60)}:${String(Math.abs(x) % 60).padStart(2, '0')}`;
  }
  function hours(h) {
    return h === null || h === undefined || h === '' || !Number.isFinite(Number(h))
      ? '—' : timeMinutes(Math.round(Number(h) * 60));
  }
  function empty(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function renderStaffButtons() {
    empty(elements.staffList);
    const q = elements.search.value.trim().toLowerCase();
    const visible = staff.filter(s => !q || `${s.no} ${s.name}`.toLowerCase().includes(q));
    visible.forEach(s => {
      const b = mk('button', 'staff-pill' + (s.no === chosenNo ? ' active' : ''), `${s.name}`);
      b.type = 'button';
      b.title = `社員番号 ${s.no} / ${s.status}`;
      b.addEventListener('click', () => loadStaff(s.no));
      elements.staffList.appendChild(b);
    });
    if (!visible.length) elements.staffList.appendChild(mk('p', 'muted', '該当スタッフが見つかりません。'));
  }
  function renderRegistration(s) {
    empty(elements.registration);
    const rows = [
      ['スタッフ', `${s.name}（社員番号 ${s.no}）`],
      ['雇用形態', s.employmentType || '—'],
      ['在籍状況', s.status || '—'],
      ['出勤', s.startTime || '—'],
      ['退勤', s.endTime || '—'],
      ['休憩時間', timeMinutes(s.breakMinutes)],
      ['勤務時間', timeMinutes(s.standardWorkMinutes)]
    ];
    rows.forEach(([label, val]) => {
      const item = mk('div', 'registration-item');
      item.append(mk('dt', '', label), mk('dd', '', val));
      elements.registration.appendChild(item);
    });
  }
  function summaryLine(name, value) {
    const wrap = mk('div', 'summary-value');
    wrap.append(mk('span', 'metric-label', name), mk('strong', '', value));
    return wrap;
  }
  function renderMonths(months) {
    empty(elements.monthWrap);
    if (!months.length) {
      elements.monthWrap.appendChild(mk('p', 'muted', '現存する月別勤務表がありません。'));
      return;
    }
    months.forEach(m => {
      const card = mk('article', 'month-card');
      const heading = mk('h3', '', `${m.key.replace('-', '年')}月`);
      const grid = mk('div', 'summary-grid');
      const sign = Number(m.signedBreakDiffMinutes || 0);
      const breakNote = `${m.changedBreakDays}回（差異合計 ${sign > 0 ? '+' : ''}${sign}分 / 差異絶対値合計 ${m.absoluteBreakDiffMinutes}分）`;
      grid.append(
        summaryLine('総休憩時間変更回数', breakNote),
        summaryLine('総勤務時間変更回数', `${m.changedWorkDays}回（休憩の差は除外）`),
        summaryLine('総残業時間', hours(m.totalOvertimeHours)),
        summaryLine('総有給時間', `${hours(m.totalPaidHours)}（${m.paidDays}日・現行予定換算）`),
        summaryLine('総勤怠時間（実働）', hours(m.totalWorkHours))
      );
      card.append(heading, grid);
      if (m.noBreakEvidenceDays) {
        card.appendChild(mk('p', 'muted small', `退勤記録に休憩時間の証跡がない日：${m.noBreakEvidenceDays}日`));
      }
      elements.monthWrap.appendChild(card);
    });
  }
  function setSelectOptions(select, values, label, mapper) {
    const prior = select.value;
    empty(select);
    select.appendChild(new Option(label, 'all'));
    values.forEach(v => select.appendChild(new Option(mapper ? mapper(v) : v, v)));
    select.value = values.includes(prior) ? prior : 'all';
  }
  // 日時を1つのホイールで指定。処理日時と打刻対象日を切り替えられる。
  // 日時フィルターは読み取り済みの履歴に対する画面内の絞り込みのみ。
  function wheelOptionText(part, value) {
    if (value === 'all') return '全';
    return part === 'year' ? String(value) : String(value).padStart(2, '0');
  }
  function markWheelSelection(part) {
    const parent = elements.wheel[part];
    parent.querySelectorAll('[role="option"]').forEach(el => {
      const active = el.dataset.value === wheelSelection[part];
      el.classList.toggle('active', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }
  function setWheelSelection(part, value, smooth = false) {
    const list = wheelValues[part];
    const index = Math.max(0, list.indexOf(value));
    wheelSelection[part] = list[index] || 'all';
    markWheelSelection(part);
    // 指定値にスナップ。PCホイール・スマホのタッチスクロールはブラウザ標準。
    elements.wheel[part].scrollTo({ top: index * WHEEL_ROW_HEIGHT, behavior: smooth ? 'smooth' : 'instant' });
    renderHistory();
  }
  function drawWheel(part, values) {
    const list = elements.wheel[part];
    const options = ['all', ...values.map(String)];
    wheelValues[part] = options;
    empty(list);
    list.appendChild(mk('div', 'date-wheel-spacer'));
    options.forEach(value => {
      const option = mk('div', 'date-wheel-option', wheelOptionText(part, value));
      option.dataset.value = value;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.addEventListener('click', () => setWheelSelection(part, value, true));
      list.appendChild(option);
    });
    list.appendChild(mk('div', 'date-wheel-spacer'));
    wheelSelection[part] = 'all';
    list.scrollTop = 0;
    markWheelSelection(part);
  }
  function resetDateWheel() {
    DATE_PARTS.forEach(part => setWheelSelection(part, 'all'));
    renderHistory();
  }
  function prepareDateWheels() {
    const years = new Set([new Date().getFullYear()]);
    history.forEach(row => {
      [row.timestamp, row.date].forEach(raw => {
        const match = String(raw || '').match(/^(\d{4})-/);
        if (match) years.add(Number(match[1]));
      });
    });
    const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => i + from);
    drawWheel('year', [...years].sort((a, b) => b - a));
    drawWheel('month', range(1, 12));
    drawWheel('day', range(1, 31));
    drawWheel('hour', range(0, 23));
    drawWheel('minute', range(0, 59));
    renderDateSummary();
  }
  function timestampParts(row) {
    const raw = elements.dateBasis.value === 'date' ? row.date : row.timestamp;
    const match = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!match) return null;
    return { year: String(Number(match[1])), month: String(Number(match[2])), day: String(Number(match[3])),
      hour: match[4] === undefined ? null : String(Number(match[4])),
      minute: match[5] === undefined ? null : String(Number(match[5])) };
  }
  function isMatchingDate(row) {
    const selected = DATE_PARTS.filter(part => wheelSelection[part] !== 'all' && (elements.dateBasis.value !== 'date' || (part !== 'hour' && part !== 'minute')));
    if (!selected.length) return true;
    const parsed = timestampParts(row);
    return parsed && selected.every(part => parsed[part] === wheelSelection[part]);
  }
  function renderDateSummary() {
    const isTarget = elements.dateBasis.value === 'date';
    elements.dateWheels.classList.toggle('date-only', isTarget);
    const selected = DATE_PARTS.filter(part => wheelSelection[part] !== 'all' && (!isTarget || (part !== 'hour' && part !== 'minute')));
    if (!selected.length) {
      elements.dateSummary.textContent = '全期間の履歴を表示';
      return;
    }
    const unit = { year: '年', month: '月', day: '日', hour: '時', minute: '分' };
    elements.dateSummary.textContent = `${isTarget ? '打刻の対象日' : '処理日時'}：${selected.map(part => `${wheelOptionText(part, wheelSelection[part])}${unit[part]}`).join(' / ')} で絞り込み中`;
  }
  // 記録の種別コードは内部データにだけ保持し、管理画面には内部処理方式を表示しない。
  function publicActionLabel(row) {
    const action = String(row.action || '不明');
    const kind = String(row.kind || '');
    return row.source === 'current' && kind === '通常'
      ? `${action}（通常）` : action.replace(/（修正）/g, '');
  }
  function publicResultLabel(row) {
    const raw = String(row.result || '—');
    if (row.kind === 'akugyo-auto' || row.kind === 'akugyo-leave-paid' || /自動|悪行|akugyo|auto/i.test(raw)) {
      return row.action === '有給' ? '有給を記録' : '記録完了';
    }
    return raw.replace(/（修正）/g, '');
  }
  function publicDetailLabel(row) {
    const raw = String(row.detail || '');
    // 念のため内部処理の文字列が追加されても、画面に露出させない。
    return raw.replace(/（修正）/g, '').replace(/(?:悪行)?自動(?:打刻|有給登録)?|akugyo[-_a-z0-9]*|auto[-_a-z0-9]*/gi, '').trim();
  }
  DATE_PARTS.forEach(part => {
    const list = elements.wheel[part];
    list.addEventListener('scroll', () => {
      const i = Math.min(wheelValues[part].length - 1, Math.max(0, Math.round(list.scrollTop / WHEEL_ROW_HEIGHT)));
      const selected = wheelValues[part][i];
      if (selected && selected !== wheelSelection[part]) {
        wheelSelection[part] = selected;
        markWheelSelection(part);
        renderHistory();
      }
    }, { passive: true });
    list.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = Math.max(0, wheelValues[part].indexOf(wheelSelection[part]));
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? wheelValues[part].length - 1
        : Math.max(0, Math.min(wheelValues[part].length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
      setWheelSelection(part, wheelValues[part][next], false);
    });
  });
  elements.dateReset.addEventListener('click', resetDateWheel);
  elements.dateBasis.addEventListener('change', renderHistory);
  function renderHistory() {
    empty(elements.history);
    const action = elements.actionFilter.value;
    renderDateSummary();
    const rows = history.filter(row => {
      if (action !== 'all' && row.action !== action) return false;
      if (!isMatchingDate(row)) return false;
      return true;
    }).sort((a,b) => {
      const dir = elements.sort.value === 'old' ? 1 : -1;
      const c = String(a.timestamp).localeCompare(String(b.timestamp));
      return dir * (c || Number(a.order || 0) - Number(b.order || 0));
    });
    rows.forEach(row => {
      const tr = mk('tr', '');
      tr.appendChild(mk('td', 'stamp', row.timestamp || '不明'));
      tr.appendChild(mk('td', 'action', publicActionLabel(row)));
      const desc = mk('td', 'result');
      const sourceLabel = row.source === 'log' ? '処理ログ' : '現存記録';
      desc.append(mk('span', 'source-tag', sourceLabel), document.createTextNode(` 対象日 ${row.date || '—'} / ${publicResultLabel(row)}`));
      const detail = publicDetailLabel(row);
      if (detail) desc.appendChild(mk('div', 'muted small', detail));
      tr.appendChild(desc);
      elements.history.appendChild(tr);
    });
    if (!rows.length) {
      const tr = mk('tr', '');
      const td = mk('td', 'muted', '条件に一致する履歴はありません。');
      td.colSpan = 3;
      tr.appendChild(td);
      elements.history.appendChild(tr);
    }
    elements.historyCount.textContent = `表示 ${rows.length}件 / 読込 ${history.length}件`;
  }
  async function loadStaff(employeeNo) {
    const token = ++loadSequence;
    chosenNo = employeeNo;
    renderStaffButtons();
    // 別スタッフの情報を読み込み中に誤表示しないよう、旧内容は必ず先に消す。
    empty(elements.registration);
    empty(elements.monthWrap);
    empty(elements.history);
    history = [];
    elements.historyCount.textContent = '読み込み中...';
    elements.actionFilter.value = 'all';
    elements.sort.value = 'new';
    resetDateWheel();
    elements.selected.textContent = '読み込み中...';
    setStatus('選択スタッフの現存する打刻記録と月別勤務表を取得中...');
    try {
      const result = await request({ mode: 'adminAttendanceStaffDetail', employeeNo });
      if (token !== loadSequence) return;
      renderRegistration(result.staff);
      renderMonths(result.monthly || []);
      history = result.history || [];
      prepareDateWheels();
      setSelectOptions(elements.actionFilter, [...new Set(history.map(r => r.action).filter(Boolean))].sort(), 'すべて');
      elements.selected.textContent = `${result.staff.name}（社員番号 ${result.staff.no}）`;
      setStatus(`取得完了：現存記録 ${result.currentDataCount}件 / 処理ログ ${result.logCount}件。`);
      renderHistory();
    } catch (error) {
      if (token === loadSequence) {
        setStatus(error?.message || 'データの取得に失敗しました。', true);
        elements.selected.textContent = '取得できませんでした';
      }
    }
  }
  async function initialize() {
    setStatus('登録スタッフの一覧を読み込み中...');
    try {
      const response = await request({ mode: 'adminAttendanceStaffList' });
      staff = Array.isArray(response.staff) ? response.staff : [];
      renderStaffButtons();
      setStatus(`スタッフ ${staff.length}名。確認するスタッフを選択してください。`);
    } catch (error) {
      setStatus(error?.message || 'スタッフ一覧を読み込めませんでした。', true);
    }
  }
  elements.logout.addEventListener('click', () => {
    sessionStorage.removeItem(ADMIN_KEY_NAME);
    window.location.assign('./index.html');
  });
  elements.search.addEventListener('input', renderStaffButtons);
  [elements.actionFilter, elements.sort].forEach(x => x.addEventListener('change', renderHistory));
  prepareDateWheels();
  initialize();
})();
