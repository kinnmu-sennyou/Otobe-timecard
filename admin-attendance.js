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
    historyCount: byId('historyCount'), monthFilter: byId('monthFilter'),
    sourceFilter: byId('sourceFilter'), actionFilter: byId('actionFilter'),
    sort: byId('sortOrder'), textFilter: byId('historySearch'), logout: byId('logoutAdmin')
  };
  let staff = [];
  let history = [];
  let chosenNo = '';
  let loadSequence = 0;
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
      const dt = mk('dt', '', label);
      const dd = mk('dd', '', val);
      elements.registration.append(dt, dd);
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
  function renderHistory() {
    empty(elements.history);
    const month = elements.monthFilter.value, source = elements.sourceFilter.value;
    const action = elements.actionFilter.value, q = elements.textFilter.value.trim().toLowerCase();
    const rows = history.filter(row => {
      if (month !== 'all' && !String(row.date || '').startsWith(month)) return false;
      if (source !== 'all' && row.source !== source) return false;
      if (action !== 'all' && row.action !== action) return false;
      if (q && ![row.timestamp, row.date, row.action, row.kind, row.result, row.detail].join(' ').toLowerCase().includes(q)) return false;
      return true;
    }).sort((a,b) => {
      const dir = elements.sort.value === 'old' ? 1 : -1;
      const c = String(a.timestamp).localeCompare(String(b.timestamp));
      return dir * (c || Number(a.order || 0) - Number(b.order || 0));
    });
    rows.forEach(row => {
      const tr = mk('tr', '');
      tr.appendChild(mk('td', 'stamp', row.timestamp || '不明'));
      tr.appendChild(mk('td', 'action', `${row.action || '不明'}${row.kind && row.source === 'current' ? `（${row.kind}）` : ''}`));
      const desc = mk('td', 'result');
      const sourceLabel = row.source === 'log' ? '処理ログ' : '現存記録';
      desc.append(mk('span', 'source-tag', sourceLabel), document.createTextNode(` 対象日 ${row.date || '—'} / ${row.result || '—'}`));
      if (row.detail) desc.appendChild(mk('div', 'muted small', row.detail));
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
    elements.monthFilter.value = 'all';
    elements.sourceFilter.value = 'all';
    elements.actionFilter.value = 'all';
    elements.sort.value = 'new';
    elements.textFilter.value = '';
    elements.selected.textContent = '読み込み中...';
    setStatus('選択スタッフの現存する打刻記録と月別勤務表を取得中...');
    try {
      const result = await request({ mode: 'adminAttendanceStaffDetail', employeeNo });
      if (token !== loadSequence) return;
      renderRegistration(result.staff);
      renderMonths(result.monthly || []);
      history = result.history || [];
      setSelectOptions(elements.monthFilter, [...new Set(history.map(r => String(r.date || '').slice(0, 7)).filter(v => /^\d{4}-\d{2}$/.test(v)))].sort().reverse(), '全月');
      setSelectOptions(elements.actionFilter, [...new Set(history.map(r => r.action).filter(Boolean))].sort(), '打刻の種類：すべて');
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
  [elements.monthFilter, elements.sourceFilter, elements.actionFilter, elements.sort].forEach(x => x.addEventListener('change', renderHistory));
  elements.textFilter.addEventListener('input', renderHistory);
  initialize();
})();
