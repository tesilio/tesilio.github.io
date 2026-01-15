/**
 * Theme Toggle
 * - OS 설정 자동 감지 (prefers-color-scheme)
 * - 수동 토글 지원
 * - localStorage에 사용자 선택 저장
 */
(function() {
  'use strict';

  var THEME_KEY = 'theme';
  var DARK = 'dark';
  var LIGHT = 'light';

  /**
   * 현재 테마 가져오기
   */
  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || LIGHT;
  }

  /**
   * 테마 설정
   */
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  /**
   * 테마 토글
   */
  function toggleTheme() {
    var currentTheme = getCurrentTheme();
    var newTheme = currentTheme === DARK ? LIGHT : DARK;
    setTheme(newTheme);
  }

  /**
   * OS 테마 변경 감지
   */
  function watchOSTheme() {
    var mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    mediaQuery.addEventListener('change', function(e) {
      // 사용자가 수동으로 설정한 경우 OS 설정 무시
      if (!localStorage.getItem(THEME_KEY)) {
        setTheme(e.matches ? DARK : LIGHT);
      }
    });
  }

  /**
   * 토글 버튼 이벤트 바인딩
   */
  function bindToggleButton() {
    var toggleBtn = document.querySelector('.theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleTheme);
    }
  }

  /**
   * 초기화
   */
  function init() {
    bindToggleButton();
    watchOSTheme();
  }

  // DOM 로드 후 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
