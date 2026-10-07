/* 인물탐험대 — 화면과 학습 흐름 (콘텐츠는 data/*.js) */
(function () {
  'use strict';

  var KOREA = window.PEOPLE_KOREA || [];
  var WORLD = window.PEOPLE_WORLD || [];
  var ALL = KOREA.concat(WORLD);
  var BY_ID = {};
  ALL.forEach(function (p) { BY_ID[p.id] = p; });

  var FIELDS = ['과학·발명', '문화·예술', '나라와 사회', '배움과 생각', '나눔과 인권'];
  var FIELD_ICON = { '과학·발명': '🔬', '문화·예술': '🎨', '나라와 사회': '🏛️', '배움과 생각': '📚', '나눔과 인권': '🤝' };
  var FIELD_IMG = { '과학·발명': 'field-science', '문화·예술': 'field-arts', '나라와 사회': 'field-society', '배움과 생각': 'field-learning', '나눔과 인권': 'field-sharing' };
  var STEP_IMG = { '이야기': 'step-story', '퀴즈': 'step-quiz', '미션': 'step-mission', '도장': 'step-stamp' };
  var SCENE_TITLES = ['어떤 사람이었을까?', '어떤 어려움을 만났을까?', '무엇을 했을까?', '오늘 우리는 무엇을 생각해볼까?'];
  var SCENE_NUM = ['①', '②', '③', '④'];
  var TYPE_LABEL = { '실존': '실제 인물', '신화': '옛이야기 속 인물', '문학': '문학 속 인물' };
  var REGION_LABEL = { korea: '한국', world: '세계' };
  var STORE_KEY = 'inmul-tamheomdae-v1';
  var PAGE_SIZE = 20;

  var app = document.getElementById('app');
  var srStatus = document.getElementById('srStatus');
  var soundBtn = document.getElementById('soundToggle');

  function isReady(p) { return !!p && p.status !== '준비 중'; }
  function listOf(region) { return region === 'world' ? WORLD : KOREA; }

  /* ---------- 저장 ----------
     한 기기를 여러 학생이 함께 쓰도록 '탐험대원 번호'마다 기록을 따로 둔다(이름은 받지 않는다).
     번호 없이 쓰는 '기본' 대원은 예전 저장 키를 그대로 써서 기존 기록이 이어진다. */
  var DEVICE_KEY = STORE_KEY + '-device';
  var MAX_MEMBER = 30;
  var profile = '기본';
  function profileKey(pf) { return pf === '기본' ? STORE_KEY : STORE_KEY + '-p' + pf; }
  function profileLabel(pf) { return pf === '기본' ? '번호 없는 대원' : pf + '번 대원'; }
  function defaultData() { return { version: 1, completed: {}, last: null, sound: false, region: 'korea', fontSize: 'm', rate: 0.9 }; }
  var data = defaultData();
  var storageOk = true;
  function readProfile(pf) {
    var d = defaultData();
    try {
      var raw = window.localStorage.getItem(profileKey(pf));
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') d = Object.assign(d, parsed);
      }
    } catch (e) { storageOk = false; }
    if (!d.completed || typeof d.completed !== 'object') d.completed = {};
    return d;
  }
  function load() {
    try {
      var dv = JSON.parse(window.localStorage.getItem(DEVICE_KEY) || 'null');
      if (dv && dv.profile && (dv.profile === '기본' || (+dv.profile >= 1 && +dv.profile <= MAX_MEMBER))) profile = String(dv.profile);
    } catch (e) { storageOk = false; }
    data = readProfile(profile);
  }
  function save() {
    try { window.localStorage.setItem(profileKey(profile), JSON.stringify(data)); storageOk = true; }
    catch (e) { storageOk = false; }
  }
  function switchProfile(pf) {
    profile = pf;
    try { window.localStorage.setItem(DEVICE_KEY, JSON.stringify({ profile: pf })); } catch (e) { storageOk = false; }
    data = readProfile(pf);
    applySettings();
  }
  /* 글자 크기·효과음처럼 대원마다 다른 설정을 화면에 반영 */
  function applySettings() {
    document.documentElement.setAttribute('data-font', data.fontSize || 'm');
    updateSoundBtn();
  }

  /* 기록 코드: 다른 기기로 도장을 옮길 때 쓰는 짧은 문자열 (개인정보 없음) */
  function makeRecordCode() {
    var c = {};
    Object.keys(data.completed).forEach(function (id) {
      var r = data.completed[id];
      c[id] = [r.date, r.mission === 'done' ? 1 : (r.mission === 'later' ? 2 : 0)];
    });
    return 'IMT1.' + btoa(unescape(encodeURIComponent(JSON.stringify(c))));
  }
  /* 코드를 읽어 현재 대원의 기록에 합친다. 새로 더한 도장 수를 돌려주고, 잘못된 코드면 -1 */
  function applyRecordCode(code) {
    var c;
    try {
      code = String(code || '').trim();
      if (code.indexOf('IMT1.') !== 0) return -1;
      c = JSON.parse(decodeURIComponent(escape(atob(code.slice(5)))));
      if (!c || typeof c !== 'object') return -1;
    } catch (e) { return -1; }
    var added = 0;
    Object.keys(c).forEach(function (id) {
      var v = c[id];
      if (!BY_ID[id] || !Array.isArray(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v[0])) return;
      var mission = v[1] === 1 ? 'done' : (v[1] === 2 ? 'later' : null);
      var cur = data.completed[id];
      if (!cur) { data.completed[id] = { date: v[0], mission: mission }; added++; return; }
      if (v[0] < cur.date) cur.date = v[0];          // 먼저 받은 날짜를 남긴다
      if (mission === 'done') cur.mission = 'done';   // '해봤어요'는 되돌리지 않는다
    });
    save();
    return added;
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function prettyDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? m[1] + '. ' + Number(m[2]) + '. ' + Number(m[3]) + '.' : '';
  }
  function setLast(id, step, n) { data.last = { id: id, step: step, n: n || 1 }; save(); }

  /* 도장은 사람마다 한 번만 지급한다. 새로 지급했으면 true. */
  function awardStamp(id) {
    if (data.completed[id]) return false;
    data.completed[id] = { date: today(), mission: null };
    save();
    return true;
  }

  /* ---------- 유틸 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function initial(name) { return esc(String(name).replace(/[()]/g, '').charAt(0)); }
  function announce(msg) { srStatus.textContent = ''; setTimeout(function () { srStatus.textContent = msg; }, 30); }
  function go(path) { location.hash = '#/' + path; }
  /* 아직 도장이 없는 인물 중에서 날짜로 정해지는 추천 (같은 날에는 같은 인물, 한국·세계 번갈아) */
  function todaysPicks(list, n) {
    var left = list.filter(function (p) { return !data.completed[p.id]; });
    var seed = Number(today().replace(/-/g, ''));
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var k = left.filter(function (p) { return p.region === 'korea'; });
    var w = left.filter(function (p) { return p.region === 'world'; });
    [k, w].forEach(function (a) {
      for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    });
    var out = [];
    while (out.length < n && (k.length || w.length)) {
      if (k.length) out.push(k.shift());
      if (out.length < n && w.length) out.push(w.shift());
    }
    return out;
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  /* 그림은 꾸밈용이다. 파일이 없거나 못 읽으면 조용히 빠지고, 그 자리의 글자·이모지가 그대로 남는다. */
  function img(src, alt, cls) {
    return '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '"' + (cls ? ' class="' + cls + '"' : '') +
      ' loading="lazy" decoding="async" onerror="this.remove()">';
  }
  function iconImg(name, fallback, cls) {
    return '<span class="icon-slot ' + (cls || '') + '" data-fallback="' + esc(fallback) + '">' +
      '<img src="images/icons/' + name + '.png" alt="" loading="lazy" onerror="this.parentNode.textContent=this.parentNode.getAttribute(\'data-fallback\')"></span>';
  }
  function fieldIcon(field, cls) { return FIELD_IMG[field] ? iconImg(FIELD_IMG[field], FIELD_ICON[field], cls) : '⭐'; }
  function coverFigure(p, big) {
    if (!p.cover) return '';
    return '<figure class="cover' + (big ? ' big' : '') + '">' + img(p.cover.src, p.cover.alt) +
      '<figcaption>🎨 ' + (p.cover.kind === '상상 그림' ? '상상해서 그린 그림이에요' : esc(p.cover.kind)) + '</figcaption></figure>';
  }
  function sceneFigure(p, n) {
    var s = p.sceneImages && p.sceneImages[n - 1];
    if (!s) return '';
    return '<figure class="cover scene-img">' + img(s.src, s.alt) + '<figcaption>🎨 상상해서 그린 그림이에요</figcaption></figure>';
  }
  function avatar(p) {
    return '<span class="avatar" aria-hidden="true">' + initial(p.name) +
      '<span class="f-icon">' + fieldIcon(p.field) + '</span></span>';
  }
  function statusBadge(p) {
    if (data.completed[p.id]) return '<span class="badge done">✓ 도장 받음</span>';
    if (isReady(p)) return '<span class="badge ready">▶ 탐험 가능</span>';
    return '<span class="badge wait">… 준비 중</span>';
  }
  function typeBadge(p) {
    return p.type === '실존' ? '' : '<span class="badge type">' + esc(TYPE_LABEL[p.type]) + '</span>';
  }
  function stepsBar(now) {
    var steps = ['이야기', '퀴즈', '미션', '도장'];
    var idx = steps.indexOf(now);
    return '<ol class="steps" aria-label="탐험 단계">' + steps.map(function (s, i) {
      var cls = i < idx ? 'done' : (i === idx ? 'now' : '');
      var mark = i < idx ? '✓ ' : (i === idx ? '▶ ' : '');
      return '<li class="' + cls + '"' + (i === idx ? ' aria-current="step"' : '') + '>' + iconImg(STEP_IMG[s], '', 'step-icon') + mark + s + '</li>';
    }).join('') + '</ol>';
  }

  /* ---------- 효과음 (기본 꺼짐) ---------- */
  var audioCtx = null;
  function beep(kind) {
    if (!data.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var notes = kind === 'stamp' ? [523, 659, 784] : kind === 'good' ? [659, 880] : [440];
      notes.forEach(function (f, i) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = f; o.type = 'sine';
        var t = audioCtx.currentTime + i * 0.12;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t); o.stop(t + 0.2);
      });
    } catch (e) { /* 소리를 못 내도 학습에는 지장 없음 */ }
  }
  function updateSoundBtn() {
    soundBtn.setAttribute('aria-pressed', data.sound ? 'true' : 'false');
    soundBtn.textContent = data.sound ? '🔊 효과음 켜짐' : '🔇 효과음 꺼짐';
  }
  soundBtn.addEventListener('click', function () {
    data.sound = !data.sound; save(); updateSoundBtn();
    announce(data.sound ? '효과음을 켰어요.' : '효과음을 껐어요.');
    beep('good');
  });

  /* ---------- 읽어주기 (Web Speech API) ---------- */
  var speech = { supported: false, voice: null, reason: '' };
  var NO_SPEECH_MSG = '이 기기에서는 읽어주기를 쓸 수 없어요. 눈으로 읽어 보아요.';
  function initSpeech() {
    var forceOff = /[?&]nospeech\b/.test(location.search);
    if (forceOff || !('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
      speech.supported = false; speech.reason = NO_SPEECH_MSG; return;
    }
    speech.supported = true;
    function pickVoice() {
      var voices = window.speechSynthesis.getVoices() || [];
      if (!voices.length) return;
      speech.voice = voices.filter(function (v) { return /^ko(-|_|$)/i.test(v.lang); })[0] || null;
      if (!speech.voice) {
        speech.supported = false;
        speech.reason = '이 기기에는 한국어 목소리가 없어서 읽어주기를 쓸 수 없어요. 눈으로 읽어 보아요.';
      }
      refreshTts();
    }
    pickVoice();
    if (window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
  }
  var currentSpeech = '';
  function speak(text) {
    if (!speech.supported) return;
    try {
      window.speechSynthesis.cancel();
      var u = new window.SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      if (speech.voice) u.voice = speech.voice;
      u.rate = data.rate || 0.9;
      u.onstart = function () { setTtsStatus('읽고 있어요…'); };
      u.onend = function () { setTtsStatus('다 읽었어요.'); };
      u.onerror = function (e) {
        if (e && (e.error === 'interrupted' || e.error === 'canceled')) return;
        speech.supported = false; speech.reason = NO_SPEECH_MSG; refreshTts();
      };
      currentSpeech = text;
      window.speechSynthesis.speak(u);
    } catch (e) {
      speech.supported = false; speech.reason = NO_SPEECH_MSG; refreshTts();
    }
  }
  function stopSpeech(silent) {
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) { /* 무시 */ }
    if (!silent) setTtsStatus('멈췄어요.');
  }
  function setTtsStatus(msg) { var el = document.getElementById('ttsStatus'); if (el) el.textContent = msg; }
  function ttsControls() {
    var dis = speech.supported ? '' : ' disabled';
    return '<div class="tts" id="ttsBox">' +
      '<button type="button" data-action="tts-play"' + dis + '>🔊 읽어주기</button>' +
      '<button type="button" data-action="tts-stop"' + dis + '>⏹ 멈추기</button>' +
      '<button type="button" data-action="tts-replay"' + dis + '>🔁 다시 듣기</button>' +
      (speech.supported ? '<span class="tts-status" id="ttsStatus" aria-live="polite"></span>'
        : '<span class="tts-note" id="ttsNote" role="note">' + esc(speech.reason) + '</span>') +
      '</div>';
  }
  /* 글자 크기 · 읽기 속도 (대원마다 저장) */
  function readingTools() {
    var sizes = [['m', '가', '보통 글자'], ['l', '가+', '큰 글자'], ['xl', '가++', '아주 큰 글자']];
    return '<div class="reading-tools">' +
      '<div class="tool-group" role="group" aria-label="글자 크기">' + sizes.map(function (s) {
        return '<button type="button" class="tool-btn" data-action="font" data-size="' + s[0] + '" aria-pressed="' + ((data.fontSize || 'm') === s[0]) + '" aria-label="' + s[2] + '">' + s[1] + '</button>';
      }).join('') + '</div>' +
      (speech.supported ? '<div class="tool-group" role="group" aria-label="읽기 속도">' +
        '<button type="button" class="tool-btn" data-action="rate" data-rate="0.9" aria-pressed="' + ((data.rate || 0.9) >= 0.85) + '">🐇 보통 속도</button>' +
        '<button type="button" class="tool-btn" data-action="rate" data-rate="0.7" aria-pressed="' + ((data.rate || 0.9) < 0.85) + '">🐢 천천히</button></div>' : '') +
      '</div>';
  }
  function refreshTts() {
    var box = document.getElementById('ttsBox');
    if (box) box.outerHTML = ttsControls();
  }

  /* ---------- 화면: 처음 ---------- */
  function viewHome() {
    var readyK = KOREA.filter(isReady), readyW = WORLD.filter(isReady);
    var last = data.last && BY_ID[data.last.id] && isReady(BY_ID[data.last.id]) ? data.last : null;
    var html = '<section class="hero">' + img('images/ui/mascot-default.png', '', 'hero-mascot') +
      '<div><h1 tabindex="-1">인물탐험대</h1>' +
      '<p>훌륭한 사람들의 이야기를 탐험하고 도장을 모아요!</p>' +
      '<p class="member-line">🧑‍🚀 지금 탐험대원: <strong>' + esc(profileLabel(profile)) + '</strong> · <a href="#/profile">대원 바꾸기</a></p></div></section>';

    if (last) {
      var lp = BY_ID[last.id];
      var where = last.step === 'story' ? '이야기 ' + last.n + '/4' : last.step === 'quiz' ? '퀴즈 ' + last.n + '/3' : '실천 미션';
      html += '<div class="panel soft-yellow"><div class="btn-row between">' +
        '<div><strong>이어서 탐험하기</strong><br><span class="muted">' + esc(lp.name) + ' · ' + where + '</span></div>' +
        '<a class="btn btn-yellow btn-big" href="#/person/' + lp.id + '/' + last.step + (last.step === 'mission' ? '' : '/' + last.n) + '">▶ 이어서 탐험하기</a>' +
        '</div></div>';
    }

    html += '<div class="start-grid">' +
      '<a class="start-card korea" href="#/map/korea">' + img('images/ui/start-korea.webp', '', 'start-img') +
      '<span class="icon" aria-hidden="true">🏯</span><span class="title">한국 인물 탐험</span>' +
      '<span>지금 탐험할 수 있는 인물 ' + readyK.length + '명</span></a>' +
      '<a class="start-card world" href="#/map/world">' + img('images/ui/start-world.webp', '', 'start-img') +
      '<span class="icon" aria-hidden="true">🌏</span><span class="title">세계 인물 탐험</span>' +
      '<span>지금 탐험할 수 있는 인물 ' + readyW.length + '명</span></a>' +
      '</div>';

    var picks = todaysPicks(readyK.concat(readyW), 6);
    if (picks.length) {
      html += '<section class="panel" aria-labelledby="quickTitle"><h2 id="quickTitle">오늘의 추천 인물</h2>' +
        '<p class="muted small">이름을 누르면 바로 탐험을 시작해요. 추천은 날마다 바뀌어요.</p>' +
        '<ul class="quick-list">' + picks.map(function (p) {
          return '<li><a class="btn" href="#/person/' + p.id + '">' + fieldIcon(p.field, 'chip-icon') + ' ' + esc(p.name) + '</a></li>';
        }).join('') + '</ul></section>';
    }

    if (!storageOk) html += '<p class="notice">이 브라우저에서는 기록을 저장할 수 없어요. 탐험은 할 수 있지만, 창을 닫으면 도장이 사라져요.</p>';
    return html;
  }

  /* ---------- 화면: 탐험 지도 ---------- */
  var mapUi = { field: '전체', query: '', readyOnly: false, notDoneOnly: false, shown: PAGE_SIZE };
  function viewMap(region) {
    if (region !== 'korea' && region !== 'world') region = 'korea';
    if (data.region !== region) { data.region = region; save(); }
    var list = listOf(region);
    var readyN = list.filter(isReady).length;
    var doneN = list.filter(function (p) { return data.completed[p.id]; }).length;
    return '<h1 tabindex="-1">' + REGION_LABEL[region] + ' 인물 탐험 지도</h1>' +
      '<div class="tabs" role="group" aria-label="한국 또는 세계 고르기">' +
      '<button type="button" data-action="region" data-region="korea" aria-pressed="' + (region === 'korea') + '">🏯 한국 인물</button>' +
      '<button type="button" data-action="region" data-region="world" aria-pressed="' + (region === 'world') + '">🌏 세계 인물</button>' +
      '</div>' +
      '<p class="muted">전체 ' + list.length + '명 · 지금 탐험 가능 ' + readyN + '명 · 받은 도장 ' + doneN + '개</p>' +
      '<div class="filters panel soft-blue">' +
      '<div class="search-box"><label for="search">🔍 이름으로 찾기</label>' +
      '<input id="search" type="search" autocomplete="off" placeholder="예: 세종" value="' + esc(mapUi.query) + '"></div>' +
      '<div><div id="fieldLabel" style="font-weight:700;margin-bottom:4px">분야로 찾기</div>' +
      '<div class="chips" role="group" aria-labelledby="fieldLabel">' +
      ['전체'].concat(FIELDS).map(function (f) {
        return '<button type="button" data-action="field" data-field="' + esc(f) + '" aria-pressed="' + (mapUi.field === f) + '">' +
          (FIELD_IMG[f] ? fieldIcon(f, 'chip-icon') + ' ' : '') + esc(f) + '</button>';
      }).join('') + '</div></div>' +
      (readyN < list.length ? '<label class="check-row"><input type="checkbox" id="readyOnly"' + (mapUi.readyOnly ? ' checked' : '') + '> 지금 탐험할 수 있는 인물만 보기</label>' :
        '<label class="check-row"><input type="checkbox" id="notDoneOnly"' + (mapUi.notDoneOnly ? ' checked' : '') + '> 아직 도장이 없는 인물만 보기</label>') +
      '</div>' +
      '<div id="results"></div>';
  }
  function filteredList(region) {
    var q = mapUi.query.trim().replace(/\s+/g, '');
    var list = listOf(region).filter(function (p) {
      if (mapUi.field !== '전체' && p.field !== mapUi.field) return false;
      if (mapUi.readyOnly && !isReady(p)) return false;
      if (mapUi.notDoneOnly && data.completed[p.id]) return false;
      if (q && p.name.replace(/\s+/g, '').indexOf(q) === -1) return false;
      return true;
    });
    // 탐험 가능한 인물을 앞에 (명단 순서는 유지)
    return list.filter(isReady).concat(list.filter(function (p) { return !isReady(p); }));
  }
  function renderResults() {
    var box = document.getElementById('results');
    if (!box) return;
    var list = filteredList(data.region);
    var shown = list.slice(0, mapUi.shown);
    var html = '<p class="result-info" role="status">' + list.length + '명을 찾았어요.</p>';
    if (!list.length) {
      html += '<p class="notice">찾는 인물이 없어요. 다른 이름이나 분야로 찾아보아요.</p>';
    } else {
      html += '<ul class="card-grid">' + shown.map(function (p) {
        var cls = data.completed[p.id] ? 'done' : (isReady(p) ? 'ready' : '');
        return '<li><a class="person-card btn ' + cls + '" href="#/person/' + p.id + '">' +
          (p.cover ? img(p.cover.src.replace('cover.webp', 'thumb.webp'), '', 'card-cover') : '') +
          '<span class="top">' + avatar(p) + '<span><span class="name">' + esc(p.name) + '</span><br>' +
          '<span class="field">' + esc(p.field) + '</span></span></span>' +
          '<span class="summary">' + esc(p.summary) + '</span>' +
          '<span class="btn-row" style="gap:6px">' + statusBadge(p) + typeBadge(p) + '</span>' +
          '</a></li>';
      }).join('') + '</ul>';
      if (list.length > shown.length) {
        html += '<div class="btn-row" style="justify-content:center"><button type="button" class="btn-primary" data-action="more">인물 더 보기 (' + (list.length - shown.length) + '명 남음)</button></div>';
      }
    }
    box.innerHTML = html;
  }

  /* ---------- 화면: 인물 소개 ---------- */
  function personHeader(p, h1) {
    var tag = h1 ? 'h1 tabindex="-1"' : 'h2';
    var close = h1 ? 'h1' : 'h2';
    return '<div class="person-head">' + avatar(p) + '<div><' + tag + '>' + esc(p.name) + '</' + close + '>' +
      '<div class="btn-row" style="gap:6px;margin-top:4px"><span class="badge ready">' + esc(TYPE_LABEL[p.type]) + '</span>' +
      '<span class="badge review">' + esc(REGION_LABEL[p.region]) + ' · ' + esc(p.field) + '</span></div></div></div>';
  }
  function viewPersonIntro(p) {
    setLast(p.id, 'story', 1);
    var html = '<p><a href="#/map/' + p.region + '">← ' + REGION_LABEL[p.region] + ' 탐험 지도로</a></p>' +
      '<section class="panel">' + personHeader(p, true) + coverFigure(p, true) +
      '<dl class="meta-list"><dt>시대</dt><dd>' + esc(p.era) + '</dd><dt>지역</dt><dd>' + esc(p.place) + '</dd></dl>' +
      '<p style="margin-top:12px">' + esc(p.summary) + '</p>' +
      '<h2 class="h3" style="font-size:1.2rem">대표 업적</h2><ul class="ach-list">' +
      p.achievements.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>';
    if (p.type !== '실존') {
      html += '<p class="notice" style="margin-top:12px">' + esc(p.name) + '은(는) ' + esc(TYPE_LABEL[p.type]) + '이에요. 실제 역사와 구별해서 읽어요.</p>';
    }
    html += '</section>';
    if (data.completed[p.id]) {
      html += '<p class="panel soft-green">✓ 이미 도장을 받았어요 (' + prettyDate(data.completed[p.id].date) + '). 다시 탐험해도 좋아요!</p>';
    }
    html += '<div class="btn-row"><a class="btn btn-primary btn-big" href="#/person/' + p.id + '/story/1">📖 이야기 시작하기</a></div>';
    return stepsBar('이야기') + html;
  }
  function viewPersonWaiting(p) {
    return '<p><a href="#/map/' + p.region + '">← ' + REGION_LABEL[p.region] + ' 탐험 지도로</a></p>' +
      '<section class="panel">' + personHeader(p, true) + coverFigure(p, true) +
      '<dl class="meta-list"><dt>시대</dt><dd>' + esc(p.era) + '</dd><dt>지역</dt><dd>' + esc(p.place) + '</dd></dl>' +
      '<p style="margin-top:12px">' + esc(p.summary) + '</p>' +
      (p.type !== '실존' ? '<p class="notice">' + esc(p.name) + '은(는) ' + esc(TYPE_LABEL[p.type]) + '이에요. 실제 역사와 구별해서 읽어요.</p>' : '') +
      '</section>' +
      '<div class="panel soft-yellow">' + img('images/ui/preparing.webp', '', 'side-img') + '<h2>🛠️ 아직 이야기를 준비하고 있어요</h2>' +
      '<p>이 인물의 이야기와 퀴즈는 선생님들이 꼼꼼히 확인한 뒤에 열릴 거예요.</p>' +
      '<p>지금은 다른 인물을 먼저 탐험해 볼까요?</p>' +
      '<div class="btn-row"><a class="btn btn-primary" href="#/map/' + p.region + '">탐험할 수 있는 인물 보기</a></div></div>';
  }

  /* ---------- 화면: 이야기 ---------- */
  function sceneHtml(p, n) {
    var used = {};
    var words = (p.glossary || []).slice().sort(function (a, b) { return b.word.length - a.word.length; });
    return p.scenes[n - 1].map(function (sentence) {
      var tokens = [];
      var text = sentence;
      words.forEach(function (g) {
        if (used[g.word]) return;
        var i = text.indexOf(g.word);
        if (i === -1) return;
        used[g.word] = true;
        var key = '\u0000' + tokens.length + '\u0000';
        tokens.push('<button type="button" class="word" data-action="word" data-word="' + esc(g.word) + '" aria-expanded="false" aria-controls="wordBox">' + esc(g.word) + '</button>');
        text = text.slice(0, i) + key + text.slice(i + g.word.length);
      });
      var out = esc(text).replace(/\u0000(\d+)\u0000/g, function (_, k) { return tokens[Number(k)]; });
      return '<p class="sentence">' + out + '</p>';
    }).join('');
  }
  function viewStory(p, n) {
    n = Math.min(4, Math.max(1, n || 1));
    setLast(p.id, 'story', n);
    var hasWords = p.scenes[n - 1].some(function (s) { return (p.glossary || []).some(function (g) { return s.indexOf(g.word) !== -1; }); });
    var html = stepsBar('이야기') +
      '<div class="panel" style="padding:14px 20px">' + personHeader(p, false) +
      '<p class="small muted" style="margin:8px 0 0">' + esc(p.era) + ' · ' + esc(p.place) + '</p></div>' +
      '<section class="scene" aria-labelledby="sceneTitle">' +
      '<div class="scene-progress">장면 ' + n + ' / 4</div>' +
      '<h1 id="sceneTitle" tabindex="-1">' + SCENE_NUM[n - 1] + ' ' + SCENE_TITLES[n - 1] + '</h1>' +
      sceneFigure(p, n) +
      ttsControls() +
      '<div class="scene-text" id="sceneText">' + sceneHtml(p, n) + '</div>' +
      (hasWords ? '<p class="small muted" style="margin:0">💡 밑줄 친 낱말을 누르면 쉬운 뜻이 나와요.</p>' : '') +
      '<div class="word-box" id="wordBox" hidden role="region" aria-live="polite" aria-label="낱말 뜻"></div>' +
      '<details class="reading-more"><summary>🔧 글자 크기 · 읽기 속도</summary>' + readingTools() + '</details>' +
      '</section>' +
      '<div class="btn-row between">' +
      (n > 1 ? '<a class="btn" href="#/person/' + p.id + '/story/' + (n - 1) + '">◀ 앞 장면</a>' : '<a class="btn" href="#/person/' + p.id + '">◀ 인물 소개</a>') +
      (n < 4 ? '<a class="btn btn-primary btn-big" href="#/person/' + p.id + '/story/' + (n + 1) + '">다음 장면 ▶</a>'
        : '<a class="btn btn-green btn-big" href="#/person/' + p.id + '/quiz/1">퀴즈 풀러 가기 ▶</a>') +
      '</div>';
    return html;
  }

  /* ---------- 화면: 퀴즈 ---------- */
  var quizState = null;
  function getQuizState(p, n) {
    var key = p.id + ':' + n;
    if (!quizState || quizState.key !== key) {
      var q = p.quiz[n - 1];
      var order = q.type === 'ox' ? [0, 1] : shuffle(q.options.map(function (_, i) { return i; }));
      quizState = { key: key, order: order, wrong: [], solved: false };
    }
    return quizState;
  }
  function viewQuiz(p, n) {
    n = Math.min(3, Math.max(1, n || 1));
    setLast(p.id, 'quiz', n);
    var q = p.quiz[n - 1];
    var st = getQuizState(p, n);
    var finished = st.solved;
    var html = stepsBar('퀴즈') +
      '<section class="panel" aria-labelledby="quizTitle">' +
      '<div class="scene-progress">' + esc(p.name) + ' 퀴즈 · ' + n + ' / 3</div>' +
      '<h1 id="quizTitle" class="quiz-q" tabindex="-1">' + (q.type === 'ox' ? '⭕❌ ' : '') + esc(q.question) + '</h1>' +
      '<ul class="options' + (q.type === 'ox' ? ' ox' : '') + '">' +
      st.order.map(function (oi, pos) {
        var isWrong = st.wrong.indexOf(oi) !== -1;
        var isRight = finished && oi === q.answer;
        var cls = isRight ? ' right' : (isWrong ? ' wrong' : '');
        var mark = isRight ? '<span class="mark">✓ 정답</span>' : (isWrong ? '<span class="mark">✗ 다시 생각해요</span>' : '');
        var label = q.type === 'ox' ? q.options[oi] : (pos + 1) + '. ' + q.options[oi];
        var dis = (finished || isWrong) ? ' disabled' : '';
        return '<li><button type="button" class="option' + cls + '" data-action="answer" data-opt="' + oi + '"' + dis + '>' + esc(label) + mark + '</button></li>';
      }).join('') + '</ul>' +
      '<div id="feedback">' + feedbackHtml(q, st) + '</div>' +
      '</section>' +
      '<div class="btn-row between">' +
      (n > 1 ? '<a class="btn" href="#/person/' + p.id + '/quiz/' + (n - 1) + '">◀ 앞 문제</a>' : '<a class="btn" href="#/person/' + p.id + '/story/4">◀ 이야기 다시 보기</a>') +
      (finished ? (n < 3 ? '<button type="button" class="btn-primary btn-big" data-action="next-q">다음 문제 ▶</button>'
        : '<button type="button" class="btn-green btn-big" data-action="finish-quiz">실천 미션 하러 가기 ▶</button>') : '') +
      '</div>';
    return html;
  }
  function feedbackHtml(q, st) {
    if (st.solved) return '<div class="feedback good" tabindex="-1">' + img('images/ui/mascot-cheer.png', '', 'fb-mascot') +
      '<div><strong>🎉 맞았어요!</strong>' + esc(q.explanation) + '</div></div>';
    if (st.wrong.length) {
      var hint = q.hints[Math.min(st.wrong.length, q.hints.length) - 1];
      return '<div class="feedback hint" tabindex="-1">' + img('images/ui/mascot-think.png', '', 'fb-mascot') +
        '<div><strong>🤔 다시 생각해 볼까요?</strong>힌트: ' + esc(hint) + '</div></div>';
    }
    return '';
  }
  function answer(p, n, oi) {
    var q = p.quiz[n - 1];
    var st = getQuizState(p, n);
    if (st.solved) return;
    if (oi === q.answer) {
      st.solved = true; beep('good'); announce('맞았어요! ' + q.explanation);
    } else {
      // 고른 오답은 잠그고 힌트를 한 단계 쉽게 보여 준다. 남은 선택지 중에서 스스로 다시 고른다.
      if (st.wrong.indexOf(oi) === -1) st.wrong.push(oi);
      beep('try');
      announce('다시 생각해 볼까요? 힌트: ' + q.hints[Math.min(st.wrong.length, q.hints.length) - 1]);
    }
    render(true);
    var fb = document.querySelector('#feedback .feedback');
    if (fb) fb.focus();
  }

  /* ---------- 화면: 미션 & 도장 ---------- */
  var lastStampNew = false;
  function viewMission(p) {
    if (!data.completed[p.id]) {
      return stepsBar('미션') + '<section class="panel"><h1 tabindex="-1">먼저 퀴즈를 풀어요</h1>' +
        '<p>' + esc(p.name) + ' 퀴즈 3문제를 마치면 실천 미션을 할 수 있어요.</p>' +
        '<a class="btn btn-primary" href="#/person/' + p.id + '/quiz/1">퀴즈 풀러 가기</a></section>';
    }
    setLast(p.id, 'mission', 1);
    return stepsBar('미션') +
      '<section aria-labelledby="missionTitle"><h1 id="missionTitle" tabindex="-1">🌱 오늘의 실천 미션</h1>' +
      '<div class="mission-card"><p class="muted" style="margin:0">' + esc(p.name) + '에게 배운 점을 실천해 볼까요?</p>' +
      '<p class="mission-text">' + esc(p.mission) + '</p>' +
      '<p class="small muted" style="margin:0">지금 못 해도 괜찮아요. 나중에 해도 도장은 받을 수 있어요.</p></div>' +
      '<div class="btn-row"><button type="button" class="btn-green btn-big" data-action="mission" data-val="done">✓ 해봤어요</button>' +
      '<button type="button" class="btn-yellow btn-big" data-action="mission" data-val="later">⏰ 나중에 해볼래요</button></div></section>';
  }
  function stampHtml(p, small) {
    var c = data.completed[p.id];
    return '<div class="stamp' + (small ? ' small' : '') + '" role="img" aria-label="' + esc(p.name) + ' 탐험 완료 도장, ' + prettyDate(c && c.date) + '">' +
      '<span class="s-name">' + esc(p.name) + '</span><span class="s-label">탐험 완료</span>' +
      '<span class="s-date">' + prettyDate(c && c.date) + '</span></div>';
  }
  function viewStamp(p) {
    if (!data.completed[p.id]) { return viewMission(p); }
    data.last = null; save();
    var isNew = lastStampNew; lastStampNew = false;
    var m = data.completed[p.id].mission;
    var region = listOf(p.region);
    var doneN = region.filter(function (x) { return data.completed[x.id]; }).length;
    var rel = related(p, 3);
    return stepsBar('도장') +
      '<section class="panel stamp-wrap" aria-labelledby="stampTitle">' +
      '<h1 id="stampTitle" tabindex="-1">' + (isNew ? '🎉 탐험 도장을 받았어요!' : '📒 이미 받은 도장이에요') + '</h1>' +
      '<div class="stamp-scene">' + stampHtml(p, false).replace('class="stamp"', 'class="stamp' + (isNew ? ' animate' : '') + '"') +
      img('images/ui/mascot-stamp.png', '', 'stamp-mascot') + '</div>' +
      '<p>' + (isNew ? esc(p.name) + ' 탐험을 마쳤어요. 정말 멋져요!' : '다시 탐험해 주어서 고마워요. 도장은 하나만 찍혀요.') + '</p>' +
      '<p class="muted">' + (m === 'done' ? '✓ 실천 미션도 해봤어요.' : '⏰ 실천 미션은 탐험 수첩에서 나중에 체크할 수 있어요.') + '</p>' +
      '<p class="muted">' + REGION_LABEL[p.region] + ' 탐험 도장: ' + doneN + '개</p>' +
      '</section>' +
      (rel.length ? '<section class="panel" aria-labelledby="relTitle"><h2 id="relTitle">🧭 함께 탐험하면 좋은 인물</h2>' +
        '<p class="muted small">' + esc(p.field) + ' 분야에서 고른 인물이에요.</p>' +
        '<ul class="card-grid rel-grid">' + rel.map(miniCard).join('') + '</ul></section>' : '') +
      '<div class="btn-row">' +
      '<a class="btn" href="#/notebook">📒 탐험 수첩 보기</a>' +
      '<a class="btn" href="#/map/' + p.region + '">🗺️ 탐험 지도</a></div>';
  }

  /* 같은 분야에서 아직 도장이 없는 인물을 고른다. 다른 지역(한국↔세계) 인물을 먼저 섞어 시야를 넓힌다. */
  function related(p, n) {
    var pool = ALL.filter(function (x) { return x.id !== p.id && x.field === p.field && isReady(x) && !data.completed[x.id]; });
    var seed = 0;
    for (var i = 0; i < p.id.length; i++) seed = (seed * 31 + p.id.charCodeAt(i)) % 233280;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    pool.sort(function () { return rnd() - 0.5; });
    var other = pool.filter(function (x) { return x.region !== p.region; });
    var same = pool.filter(function (x) { return x.region === p.region; });
    var out = [];
    while (out.length < n && (same.length || other.length)) {
      if (same.length) out.push(same.shift());
      if (out.length < n && other.length) out.push(other.shift());
    }
    return out;
  }
  function miniCard(p) {
    return '<li><a class="person-card btn ready" href="#/person/' + p.id + '">' +
      (p.cover ? img(p.cover.src.replace('cover.webp', 'thumb.webp'), '', 'card-cover') : '') +
      '<span class="top">' + avatar(p) + '<span><span class="name">' + esc(p.name) + '</span><br>' +
      '<span class="field">' + esc(REGION_LABEL[p.region]) + ' · ' + esc(p.field) + '</span></span></span>' +
      '<span class="summary">' + esc(p.summary) + '</span></a></li>';
  }

  /* ---------- 화면: 탐험대원 고르기 ---------- */
  function viewProfile() {
    function count(pf) {
      var d = pf === profile ? data : readProfile(pf);
      return Object.keys(d.completed).length;
    }
    var nums = [];
    for (var i = 1; i <= MAX_MEMBER; i++) nums.push(String(i));
    return '<h1 tabindex="-1">🧑‍🚀 탐험대원 고르기</h1>' +
      '<p>한 기기를 여러 친구가 함께 쓸 때, 자기 <strong>번호</strong>를 고르면 도장이 따로 모여요. 이름은 적지 않아요.</p>' +
      '<p class="muted">지금: <strong>' + esc(profileLabel(profile)) + '</strong></p>' +
      '<ul class="member-grid">' + nums.map(function (n) {
        var c = count(n);
        return '<li><button type="button" class="member-btn" data-action="profile" data-pf="' + n + '" aria-pressed="' + (profile === n) + '">' +
          '<span class="m-num">' + n + '</span><span class="m-stamp">' + (c ? '도장 ' + c : '&nbsp;') + '</span></button></li>';
      }).join('') + '</ul>' +
      '<div class="btn-row" style="margin-top:16px"><button type="button" data-action="profile" data-pf="기본" aria-pressed="' + (profile === '기본') + '">번호 없이 탐험하기 (도장 ' + count('기본') + ')</button></div>';
  }

  /* ---------- 화면: 탐험 수첩 ---------- */
  function viewNotebook() {
    function prog(region) {
      var list = listOf(region);
      var ready = list.filter(isReady).length;
      var done = list.filter(function (p) { return data.completed[p.id]; }).length;
      var pct = ready ? Math.round(done / ready * 100) : 0;
      return '<div class="panel ' + (region === 'korea' ? 'soft-blue' : 'soft-green') + '">' +
        '<h2>' + (region === 'korea' ? '🏯' : '🌏') + ' ' + REGION_LABEL[region] + ' 탐험</h2>' +
        '<p style="margin:0"><strong>도장 ' + done + '개</strong> / 지금 탐험할 수 있는 인물 ' + ready + '명</p>' +
        '<div class="progress-bar" role="progressbar" aria-label="' + REGION_LABEL[region] + ' 탐험 진행" aria-valuemin="0" aria-valuemax="' + ready + '" aria-valuenow="' + done + '"><span style="width:' + pct + '%"></span></div>' +
        (ready < list.length ? '<p class="small muted" style="margin:0">전체 명단 ' + list.length + '명 (나머지는 준비 중이에요)</p>' : '') + '</div>';
    }
    var done = ALL.filter(function (p) { return data.completed[p.id]; })
      .sort(function (a, b) { return data.completed[a.id].date < data.completed[b.id].date ? -1 : 1; });
    var html = '<h1 tabindex="-1">📒 나의 탐험 수첩</h1>' +
      '<p class="member-line">🧑‍🚀 <strong>' + esc(profileLabel(profile)) + '</strong>의 수첩 · <a href="#/profile">대원 바꾸기</a></p>' +
      '<div class="progress-grid">' + prog('korea') + prog('world') + '</div>' +
      '<h2>받은 도장</h2>';
    if (!done.length) {
      html += '<div class="empty-state">' + img('images/ui/empty-notebook.webp', '', 'side-img') +
        '<p class="notice">아직 받은 도장이 없어요. 인물을 탐험하고 첫 도장을 받아 보아요!</p></div>' +
        '<div class="btn-row"><a class="btn btn-primary" href="#/map/korea">한국 인물 탐험</a><a class="btn btn-green" href="#/map/world">세계 인물 탐험</a></div>';
    } else {
      html += '<ul class="stamp-grid">' + done.map(function (p) {
        var m = data.completed[p.id].mission;
        return '<li class="stamp-item">' + stampHtml(p, true) +
          '<div class="mission-state">' + (m === 'done' ? '✓ 미션 해봤어요' : '⏰ 미션 나중에 하기') + '</div>' +
          (m !== 'done' ? '<button type="button" class="btn-green" data-action="mission-check" data-id="' + p.id + '">미션 해봤어요</button>' : '') +
          '<div class="btn-row"><a class="btn" href="#/person/' + p.id + '/story/1">📖 다시 읽기</a>' +
          '<a class="btn" href="#/person/' + p.id + '/quiz/1">❓ 퀴즈 다시 풀기</a></div></li>';
      }).join('') + '</ul>';
    }
    html += '<section class="panel" style="margin-top:28px"><h2>📦 기록 옮기기</h2>' +
      '<p>탐험 기록은 <strong>이 기기의 이 브라우저</strong>에만 저장돼요. 다른 기기에서 이어 하려면 <strong>기록 코드</strong>를 만들어 옮겨요. (선생님이나 보호자와 함께 해요.)</p>' +
      '<div class="btn-row"><button type="button" data-action="make-code">기록 코드 만들기</button></div>' +
      '<div id="codeOut" hidden><label for="codeText" class="small">아래 코드를 복사해서 다른 기기의 “기록 코드 넣기”에 붙여 넣어요.</label>' +
      '<textarea id="codeText" class="code-box" rows="3" readonly></textarea>' +
      '<div class="btn-row"><button type="button" data-action="copy-code">📋 코드 복사하기</button></div></div>' +
      '<h3 style="margin-top:16px">기록 코드 넣기</h3>' +
      '<label for="codeIn" class="small">받은 코드를 붙여 넣으면 지금 대원의 수첩에 도장이 합쳐져요. 이미 있는 도장은 그대로예요.</label>' +
      '<textarea id="codeIn" class="code-box" rows="3" placeholder="IMT1. 로 시작하는 코드"></textarea>' +
      '<div class="btn-row"><button type="button" class="btn-primary" data-action="apply-code">기록 합치기</button></div>' +
      '<p id="codeMsg" role="status" class="small"></p></section>' +
      '<section class="panel"><h2>기록 지우기</h2>' +
      '<p class="small">' + esc(profileLabel(profile)) + '의 기록만 지워져요. 다른 번호 대원의 기록은 그대로예요.</p>' +
      '<button type="button" data-action="reset">🗑️ 탐험 기록 모두 지우기</button></section>';
    return html;
  }

  /* ---------- 화면: 선생님·보호자 안내 ---------- */
  function countBy(list, key) {
    var c = {};
    list.forEach(function (p) { c[p[key]] = (c[p[key]] || 0) + 1; });
    return Object.keys(c).map(function (k) { return esc(k) + ' ' + c[k] + '명'; }).join(', ');
  }
  function viewGuide() {
    var ready = ALL.filter(isReady);
    var inSong = KOREA.filter(function (p) { return p.inSong === 'yes'; });
    var check = KOREA.filter(function (p) { return p.inSong === 'check'; });
    var added = KOREA.filter(function (p) { return p.inSong === 'no'; });
    var excluded = window.SONG_EXCLUDED || [];
    return '<div class="guide"><h1 tabindex="-1">선생님·보호자 안내</h1>' +
      '<section class="panel"><h2>앱 소개</h2>' +
      '<p>‘인물탐험대’는 초등학교 2학년이 혼자 인물 이야기를 읽고(듣고), 퀴즈를 풀고, 작은 실천 미션을 해 보는 학습 앱입니다. ' +
      '이름과 업적을 외우기보다 인물이 만난 <strong>어려움과 선택</strong>을 이해하고, “나는 무엇을 해볼 수 있을까?”를 생각하도록 구성했습니다.</p>' +
      '<p>학습 흐름: 인물 선택 → 이야기 4장면 → 퀴즈 3문제 → 실천 미션 → 탐험 도장 (인물당 약 5~7분)</p>' +
      '<p><strong>현재 학습 가능 인물: ' + ready.length + '명</strong> / 전체 ' + ALL.length + '명' +
      (ready.length < ALL.length ? '. 나머지 ' + (ALL.length - ready.length) + '명은 명단과 한 줄 소개만 있고 ‘준비 중’으로 표시됩니다. 미완성 인물에 다른 인물의 내용을 복사해 넣지 않았습니다.' : '.') +
      '</p></section>' +

      '<section class="panel"><h2>인물 선정 기준</h2><ul>' +
      '<li>어린이가 배울 점(어려움을 대하는 태도, 다른 사람을 위한 선택)이 분명한 인물을 우선했습니다.</li>' +
      '<li>한 사람을 완벽한 영웅으로 그리지 않고, 실패·한계·논쟁이 있는 부분도 연령에 맞게 함께 다룹니다.</li>' +
      '<li>사실은 단정형으로, 전해지는 이야기는 “~라고 전해져요”로 구분합니다. 인물의 대사나 어린 시절 일화를 지어내지 않았습니다.</li>' +
      '<li>전쟁·죽음·투옥·차별은 숨기지 않되 잔인한 묘사 없이 짧고 정확하게 씁니다.</li>' +
      '<li>실존 인물의 얼굴은 그리지 않습니다. 인물 그림은 업적과 관련된 물건·장면을 AI로 그린 <strong>상상 그림</strong>이며, 그림마다 “상상해서 그린 그림이에요”라고 표시합니다. 카드에는 이름 첫 글자와 분야 아이콘을 씁니다.</li>' +
      '<li>그림은 꾸밈용이라, 그림 파일이 없거나 열리지 않아도 모든 학습을 할 수 있습니다.</li>' +
      '</ul></section>' +

      '<section class="panel"><h2>인물 유형 구분</h2><ul>' +
      '<li><strong>실제 인물</strong>: 역사 기록으로 확인되는 인물. 건국 이야기처럼 전설이 섞인 경우 소개 글에 따로 밝힙니다.</li>' +
      '<li><strong>옛이야기 속 인물(신화)</strong>: 예) 단군 — “우리나라의 옛 건국 이야기 속 인물”로 소개합니다.</li>' +
      '<li><strong>문학 속 인물</strong>: 예) 홍길동 — 소설 『홍길동전』의 주인공으로 소개합니다.</li></ul></section>' +

      '<section class="panel"><h2>동요 ‘한국을 빛낸 100명의 위인들’과의 차이</h2>' +
      '<p>한국 인물 명단은 이 동요를 출발점으로 삼았지만 그대로 옮기지 않았습니다.</p><ul>' +
      '<li>동요는 여러 차례 개사되어 <strong>판본마다 등장인물이 다르고</strong>, 여러 사람을 묶어 부르는 구절(사육신 등)과 노래 속 인물이 함께 있어 정확히 100명이라고 보기 어렵습니다.</li>' +
      '<li>가사는 앱에 싣지 않았습니다.</li>' +
      '<li>동요에 나오는 인물로 표시: ' + inSong.length + '명 · 판본 확인 필요: ' + check.length + '명 (' + check.map(function (p) { return esc(p.name); }).join(', ') + ')</li>' +
      '<li>앱에서 보완한 인물: ' + added.length + '명 — 여성 인물, 근현대 과학·예술·나눔 분야를 고려해 추가했습니다.</li>' +
      '</ul><h3>동요에 나오지만 이 앱의 인물 카드에서 제외한 경우</h3><ul>' +
      excluded.map(function (e) { return '<li><strong>' + esc(e.name) + '</strong>: ' + esc(e.reason) + '</li>'; }).join('') +
      '</ul><p class="small muted">동요 수록 여부 표시는 앱 제작 시 확인한 대표 판본 기준이며, 판본에 따라 다를 수 있어 검토가 필요합니다.</p></section>' +

      '<section class="panel"><h2>세계 인물 명단</h2>' +
      '<p>세계 인물에는 공식적으로 정해진 하나의 명단이 없습니다. 이 명단은 <strong>앱의 교육용 선정 명단</strong>이며, 다양한 나라·시대·성별·분야를 고려했습니다.</p>' +
      '<ul><li>대륙: ' + countBy(WORLD, 'area') + '</li><li>성별: ' + countBy(WORLD, 'gender') + '</li><li>분야: ' + countBy(WORLD, 'field') + '</li></ul>' +
      '<p class="notice small">현재 명단은 유럽·북아메리카 인물의 비중이 높고 남아메리카·오세아니아 인물이 적습니다. 다음 개정에서 보완할 과제입니다.</p></section>' +

      '<section class="panel"><h2>콘텐츠 검토 상태</h2><ul>' +
      '<li><strong>검토 완료</strong>: 교사·전문가가 참고 자료와 대조해 확인한 내용</li>' +
      '<li><strong>검토 필요</strong>: 학습할 수 있도록 작성했지만 아직 사람이 직접 출처와 대조하지 않은 내용</li>' +
      '<li><strong>준비 중</strong>: 명단과 한 줄 소개만 있는 인물(학습 불가)</li></ul>' +
      '<p>현재 학습 가능한 인물은 모두 AI가 작성한 초안이며 <strong>‘검토 필요’</strong> 상태입니다. 수업에 쓰기 전에 아래 참고 자료와 대조해 주세요.</p>' +
      ['korea', 'world'].map(function (region) {
        var rows = ready.filter(function (p) { return p.region === region; });
        return '<details><summary>' + REGION_LABEL[region] + ' 인물 검토표 (' + rows.length + '명) 펼치기</summary>' +
          '<div class="table-wrap"><table><thead><tr><th>인물</th><th>상태</th><th>확인 메모</th><th>참고 자료</th></tr></thead><tbody>' +
          rows.map(function (p) {
            return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.status) + '</td><td class="small">' + esc(p.reviewNote || '') + '</td><td class="small"><ul style="margin:0;padding-left:1em">' +
              (p.sources || []).map(function (s) { return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + '</a></li>'; }).join('') +
              '</ul></td></tr>';
          }).join('') + '</tbody></table></div></details>';
      }).join('') + '</section>' +

      '<section class="panel"><h2>학습 기록과 개인정보</h2><ul>' +
      '<li>회원가입이 없고, 이름·학교·연락처 등 학생 개인정보를 묻거나 저장하지 않습니다.</li>' +
      '<li>학습 기록(받은 도장, 미션 상태, 마지막 위치, 효과음 설정)은 <strong>현재 기기의 브라우저 저장소(localStorage)</strong>에만 저장됩니다.</li>' +
      '<li>기기나 브라우저를 바꾸면 기록이 자동으로 옮겨지지 않습니다. 브라우저의 사이트 데이터를 지우면 기록도 사라집니다.</li>' +
      '<li>여러 학생이 한 기기를 함께 쓸 때는 <strong>탐험대원 번호(1~' + MAX_MEMBER + '번)</strong>를 고르게 해 주세요. 번호마다 기록이 따로 저장되며, 이름은 받지 않습니다. (처음 화면·탐험 수첩의 “대원 바꾸기”)</li>' +
      '<li>다른 기기로 기록을 옮기려면 탐험 수첩의 <strong>기록 코드</strong>를 만들어 새 기기에 붙여 넣습니다. 코드에는 도장 받은 인물과 날짜만 들어 있습니다.</li>' +
      '<li>학교 서버나 웹 호스팅(http/https)으로 열면, 한 번 본 화면과 그림이 기기에 저장되어 인터넷이 끊겨도 이어서 쓸 수 있습니다.</li>' +
      '<li>광고, 결제, 채팅, 순위 경쟁 기능이 없습니다.</li></ul></section>' +

      '<section class="panel"><h2>사용 환경</h2><ul>' +
      '<li>‘읽어주기’는 브라우저의 음성 합성 기능을 씁니다. 한국어 목소리가 없는 기기에서는 버튼이 꺼지고 “눈으로 읽어 보아요” 안내가 나오며, 읽기로 모든 학습을 할 수 있습니다.</li>' +
      '<li>효과음은 기본으로 꺼져 있고 화면 위쪽 버튼으로 켜고 끌 수 있습니다.</li>' +
      '<li>시간 제한 문제, 깜빡이는 효과, 벌점이 없습니다. 퀴즈를 틀리면 고른 오답을 잠그고 점점 쉬운 힌트를 주어, 남은 선택지 중에서 스스로 다시 고르게 합니다. 맞히면 왜 맞는지 해설을 보여 줍니다.</li>' +
      '</ul></section></div>';
  }

  /* ---------- 라우터 ---------- */
  function parts() {
    return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(function (s) {
      try { return decodeURIComponent(s); } catch (e) { return s; }
    });
  }
  function navKey(seg) { return seg[0] === 'map' || seg[0] === 'person' ? 'map' : (seg[0] === 'profile' ? 'notebook' : (seg[0] || 'home')); }

  function render(keepScroll) {
    var seg = parts();
    var html, after = null;
    stopSpeech(true);
    if (seg[0] === 'map') {
      html = viewMap(seg[1]);
      after = renderResults;
    } else if (seg[0] === 'person') {
      var p = BY_ID[seg[1]];
      if (!p) html = '<h1 tabindex="-1">인물을 찾을 수 없어요</h1><a class="btn btn-primary" href="#/map/korea">탐험 지도로</a>';
      else if (!isReady(p)) html = viewPersonWaiting(p);
      else if (seg[2] === 'story') html = viewStory(p, parseInt(seg[3], 10));
      else if (seg[2] === 'quiz') html = viewQuiz(p, parseInt(seg[3], 10));
      else if (seg[2] === 'mission') html = viewMission(p);
      else if (seg[2] === 'stamp') html = viewStamp(p);
      else html = viewPersonIntro(p);
    } else if (seg[0] === 'notebook') {
      html = viewNotebook();
    } else if (seg[0] === 'guide') {
      html = viewGuide();
    } else if (seg[0] === 'profile') {
      html = viewProfile();
    } else {
      html = viewHome();
    }
    app.innerHTML = html;
    if (after) after();
    var key = navKey(seg);
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === key) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var h1 = app.querySelector('h1');
    document.title = (h1 ? h1.textContent.replace(/^[^\w가-힣]+/, '') + ' - ' : '') + '인물탐험대';
    if (keepScroll !== true) {
      window.scrollTo(0, 0);
      if (h1) h1.focus({ preventScroll: true });
    }
  }

  /* ---------- 이벤트 ---------- */
  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]');
    if (!t || t.disabled) return;
    var seg = parts();
    var p = BY_ID[seg[1]];
    var action = t.getAttribute('data-action');

    switch (action) {
      case 'region':
        mapUi.shown = PAGE_SIZE;
        go('map/' + t.getAttribute('data-region'));
        break;
      case 'field':
        mapUi.field = t.getAttribute('data-field');
        mapUi.shown = PAGE_SIZE;
        app.querySelectorAll('[data-action="field"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === t)); });
        renderResults();
        break;
      case 'more':
        mapUi.shown += PAGE_SIZE;
        renderResults();
        var cards = app.querySelectorAll('.card-grid a');
        if (cards[mapUi.shown - PAGE_SIZE]) cards[mapUi.shown - PAGE_SIZE].focus();
        break;
      case 'word': {
        var box = document.getElementById('wordBox');
        var w = t.getAttribute('data-word');
        var open = t.getAttribute('aria-expanded') === 'true';
        app.querySelectorAll('.word').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
        if (open) { box.hidden = true; break; }
        var g = (p.glossary || []).filter(function (x) { return x.word === w; })[0];
        if (!g) break;
        t.setAttribute('aria-expanded', 'true');
        box.innerHTML = '<div><strong>📌 ' + esc(g.word) + '</strong><br>' + esc(g.meaning) + '</div>' +
          '<button type="button" data-action="word-close">닫기</button>';
        box.hidden = false;
        box.setAttribute('data-from', w);
        break;
      }
      case 'word-close':
        closeWordBox(true);
        break;
      case 'tts-play':
      case 'tts-replay': {
        var txt = document.getElementById('sceneText');
        var title = document.getElementById('sceneTitle');
        if (txt) speak((title ? title.textContent.replace(/^[①②③④]\s*/, '') + ' ' : '') + txt.textContent);
        break;
      }
      case 'tts-stop':
        stopSpeech(false);
        break;
      case 'answer':
        answer(p, parseInt(seg[3], 10) || 1, parseInt(t.getAttribute('data-opt'), 10));
        break;
      case 'next-q':
        go('person/' + p.id + '/quiz/' + ((parseInt(seg[3], 10) || 1) + 1));
        break;
      case 'finish-quiz':
        lastStampNew = awardStamp(p.id);
        if (lastStampNew) beep('stamp');
        go('person/' + p.id + '/mission');
        break;
      case 'mission': {
        var c = data.completed[p.id];
        var val = t.getAttribute('data-val');
        // 이미 '해봤어요'인 미션은 다시 탐험할 때 '나중에'로 되돌리지 않는다.
        if (c && !(c.mission === 'done' && val === 'later')) { c.mission = val; save(); }
        go('person/' + p.id + '/stamp');
        break;
      }
      case 'mission-check': {
        var id = t.getAttribute('data-id');
        if (data.completed[id]) { data.completed[id].mission = 'done'; save(); }
        announce('미션을 해봤어요로 바꾸었어요. 잘했어요!');
        render(true);
        break;
      }
      case 'reset':
        if (window.confirm(profileLabel(profile) + '의 탐험 기록과 도장을 모두 지울까요?') &&
            window.confirm('정말 지울까요? 지운 기록은 되돌릴 수 없어요.')) {
          var keep = { sound: data.sound, fontSize: data.fontSize, rate: data.rate };
          data = Object.assign(defaultData(), keep); save();
          announce('탐험 기록을 모두 지웠어요.');
          render();
        }
        break;
      case 'profile':
        switchProfile(t.getAttribute('data-pf'));
        announce(profileLabel(profile) + '(으)로 바꾸었어요.');
        go('');
        break;
      case 'font':
        data.fontSize = t.getAttribute('data-size'); save(); applySettings();
        app.querySelectorAll('[data-action="font"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === t)); });
        break;
      case 'rate':
        data.rate = parseFloat(t.getAttribute('data-rate')); save();
        app.querySelectorAll('[data-action="rate"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === t)); });
        announce(data.rate < 0.85 ? '천천히 읽어 줄게요.' : '보통 속도로 읽어 줄게요.');
        break;
      case 'make-code': {
        var out = document.getElementById('codeOut');
        document.getElementById('codeText').value = makeRecordCode();
        out.hidden = false;
        document.getElementById('codeText').select();
        break;
      }
      case 'copy-code': {
        var ta = document.getElementById('codeText');
        var msg = document.getElementById('codeMsg');
        var done = function () { msg.textContent = '✓ 코드를 복사했어요.'; };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(ta.value).then(done, function () { ta.select(); msg.textContent = '코드를 길게 눌러 직접 복사해 주세요.'; });
        } else { ta.select(); try { document.execCommand('copy'); done(); } catch (err) { msg.textContent = '코드를 길게 눌러 직접 복사해 주세요.'; } }
        break;
      }
      case 'apply-code': {
        var n = applyRecordCode(document.getElementById('codeIn').value);
        if (n < 0) { document.getElementById('codeMsg').textContent = '코드를 읽지 못했어요. IMT1. 로 시작하는 코드를 모두 붙여 넣었는지 확인해요.'; break; }
        announce('도장 ' + n + '개를 합쳤어요.');
        render(true);
        document.getElementById('codeMsg').textContent = '✓ 새 도장 ' + n + '개를 합쳤어요.';
        break;
      }
    }
  });

  app.addEventListener('input', function (e) {
    if (e.target.id === 'search') { mapUi.query = e.target.value; mapUi.shown = PAGE_SIZE; renderResults(); }
  });
  app.addEventListener('change', function (e) {
    if (e.target.id === 'readyOnly') { mapUi.readyOnly = e.target.checked; mapUi.shown = PAGE_SIZE; renderResults(); }
    if (e.target.id === 'notDoneOnly') { mapUi.notDoneOnly = e.target.checked; mapUi.shown = PAGE_SIZE; renderResults(); }
  });
  function closeWordBox(returnFocus) {
    var box = document.getElementById('wordBox');
    if (!box || box.hidden) return false;
    var from = box.getAttribute('data-from');
    box.hidden = true;
    app.querySelectorAll('.word').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    if (returnFocus) {
      var btn = app.querySelector('.word[data-word="' + (window.CSS && CSS.escape ? CSS.escape(from) : from) + '"]');
      if (btn) btn.focus();
    }
    return true;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeWordBox(true);
  });

  window.addEventListener('hashchange', function () { render(); });

  /* 테스트에서 상태를 확인할 수 있게 최소한만 노출 */
  window.InmulApp = {
    get data() { return data; },
    get profile() { return profile; },
    get speechSupported() { return speech.supported; },
    storeKey: STORE_KEY
  };

  load();
  applySettings();
  initSpeech();
  render();

  /* 학교 서버 등 http(s)로 열었을 때만: 한 번 본 화면과 그림을 저장해 와이파이가 끊겨도 동작 */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* 없어도 앱은 동작 */ });
  }
})();
