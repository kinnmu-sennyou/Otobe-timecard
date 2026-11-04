/* 管理者用：打刻状況確認への入口だけを追加（既存のapp.jsは変更なし）。 */
(() => {
  'use strict';
  const keyInput = document.getElementById('adminAttendanceEntryKey');
  const button = document.getElementById('adminAttendanceEntryButton');
  const message = document.getElementById('adminAttendanceEntryMessage');
  if (!keyInput || !button || !message) return;
  function update() {
    button.disabled = keyInput.value.trim() !== 'check';
  }
  keyInput.addEventListener('input', update);
  keyInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !button.disabled) {
      event.preventDefault();
      button.click();
    }
  });
  button.addEventListener('click', async () => {
    if (button.disabled || keyInput.value.trim() !== 'check') return;
    button.disabled = true;
    message.textContent = '管理画面を確認中...';
    try {
      // 認証とスタッフ一覧取得は必ずサーバーで検証する。
      const result = await postToScript({ mode: 'adminAttendanceStaffList', adminKey: keyInput.value.trim() });
      if (!result || !result.ok) throw new Error(result?.message || '管理画面の確認に失敗しました');
      sessionStorage.setItem('timecard-admin-attendance-key', keyInput.value.trim());
      keyInput.value = '';
      window.location.assign('./admin-attendance.html');
    } catch (error) {
      message.textContent = error?.message || '管理画面を開けませんでした';
      update();
    }
  });
  update();
})();
