/* frozen-labyrinth/app.js — карта, состояние, маркеры, попапы, квест, гайд */
(function () {
  'use strict';

  var ENTITIES = APP.entities;
  var QUEST = APP.quest;
  var GUIDE = APP.guide;
  var I18N = APP.i18n;

  var state = {
    lang: localStorage.getItem('fl-lang') || 'ru',
    filter: 'all',
    questHighlight: false,
    showSpawns: localStorage.getItem('fl-spawns') !== 'off',
    selectedMob: null, // npcId выбранного в списке моба
  };

  function t(key) { return I18N[key][state.lang]; }

  // ============ Карта ============
  var BOUNDS = [[0, 0], [1000, 1000]];
  var map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -1,
    maxZoom: 3,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    zoomControl: true,
    attributionControl: false,
    // жёсткие границы: вид не «отбрасывает» пружиной при зуме/панораме у края
    maxBounds: [[-60, -60], [1060, 1060]],
    maxBoundsViscosity: 1.0,
  });
  L.imageOverlay('labyrinth_map.png', BOUNDS).addTo(map);
  map.fitBounds(BOUNDS);

  // ============ Маркеры ============
  var markers = {}; // id -> L.Marker

  function markerClass(e) {
    if (e.type === 'boss') return 'l2-marker--boss';
    if (e.type === 'npc') return 'l2-marker--npc';
    return e.isAggro ? 'l2-marker--aggro' : 'l2-marker--passive';
  }

  function iconFor(e) {
    var cls = markerClass(e) + ' l2-marker';
    if (state.questHighlight && e.questMob) cls += ' l2-marker--quest-hl';
    return L.divIcon({
      className: 'fl-marker',
      html: '<div class="' + cls + '"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10],
    });
  }

  // ============ Попапы ============
  // Фиксированная ширина и никаких keepInView: карточка не «мигает» длинной
  // версией и карта не дёргается автопаном при каждом открытии.
  var POPUP_OPTS = { maxWidth: 292, minWidth: 260, autoPan: true, keepInView: false, autoPanPadding: [32, 48] };

  // Карточка открывается СВЕРХУ точки, если над ней есть место (≈440px);
  // для точек у верхнего края — СНИЗУ (класс card-flip), чтобы не уезжать
  // за край и не дёргать камеру автопаном.
  var CARD_BUDGET = 440;
  function openCardPopup(ent, latlng) {
    var pt = map.latLngToContainerPoint(latlng);
    var flip = pt.y < CARD_BUDGET;
    L.popup({
      maxWidth: 292, minWidth: 260,
      className: flip ? 'card-flip' : undefined,
      autoPan: !flip, keepInView: false, autoPanPadding: [32, 48],
      offset: [0, flip ? 12 : 0],
    })
      .setLatLng(latlng)
      .setContent(popupHtml(ent))
      .openOn(map);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // уровень 60+ — оранжевый, как элитные мобы в игре
  function lvlHtml(e) {
    if (!e.level) return '';
    var hi = e.level >= 60 ? ' popup-lvl--hi' : '';
    return '<span class="popup-lvl' + hi + '">' + esc(t('level')) + ' <b>' + e.level + '</b></span>';
  }

  function xpHtml(e) {
    if (e.type !== 'mob' || (!e.exp && !e.sp)) return '';
    var html = '<span class="popup-xp">' + esc(t('exp')) + ' <b>' + (e.exp ? e.exp.toLocaleString('ru-RU') : '0') + '</b>';
    if (e.sp) html += ' · ' + esc(t('sp')) + ' <b>' + e.sp + '</b>';
    return html + '</span>';
  }

  function chipsHtml(list) {
    return (list || []).map(function (s) {
      var lang = s[state.lang] != null ? s[state.lang] : s.en;
      return '<span class="chip" title="' + esc(lang) + '">' +
        (s.icon ? '<img src="icons/' + esc(s.icon) + '" alt="">' : '') +
        esc(lang) + '</span>';
    }).join('');
  }

  function colRows(items) {
    if (!items || !items.length) return '<div class="popup-row"><span class="row-empty">' + esc(t('none')) + '</span></div>';
    return items.map(function (it) {
      var lang = it[state.lang] != null ? it[state.lang] : it.en;
      var icon = it.icon
        ? '<img src="icons/' + esc(it.icon) + '" alt="">'
        : '<span class="row-icon-ph"></span>';
      return '<div class="popup-row">' + icon + '<span>' + esc(lang) + '</span></div>';
    }).join('');
  }

  function popupHtml(e) {
    var badges = '';
    if (e.type === 'boss') badges += '<span class="badge badge--boss">' + esc(t('raidBoss')) + '</span>';
    else if (e.type === 'npc') badges += '<span class="badge badge--npc">NPC</span>';
    else if (e.isAggro) badges += '<span class="badge badge--aggro">' + esc(t('aggro')) + '</span>';
    else badges += '<span class="badge badge--passive">' + esc(t('passive')) + '</span>';
    if (e.questMob) badges += '<span class="badge badge--quest" title="' + esc(QUEST.name[state.lang]) + '">' + esc(t('questBadge')) + '</span>';
    if (e.race && e.race[state.lang]) badges += '<span class="badge badge--race">' + esc(e.race[state.lang]) + '</span>';

    // шапка: картинка баннером сверху (или строка, если картинки нет)
    var head;
    if (e.img) {
      head = '<div class="popup-banner"><img src="' + esc(e.img) + '" alt="">' +
        '<div class="popup-banner-name"><span class="popup-name">' + esc(e.name[state.lang]) + '</span>' +
        lvlHtml(e) + '</div></div>';
    } else {
      head = '<div class="popup-headrow"><span class="popup-name">' + esc(e.name[state.lang]) + '</span>' +
        lvlHtml(e) + '</div>';
    }

    var statLine = (e.type === 'mob' && (e.exp || e.sp))
      ? '<div class="popup-statline">' + xpHtml(e) + '</div>' : '';

    var html = '<div class="popup-card">' + head +
      '<div class="popup-badges">' + badges + '</div>' +
      statLine;

    if ((e.weakness && e.weakness.length) || (e.resist && e.resist.length)) {
      html += '<div class="popup-features">';
      if (e.weakness && e.weakness.length) {
        html += '<div class="popup-feature"><h4>' + esc(t('weakness')) + '</h4><div class="chip-row">' + chipsHtml(e.weakness) + '</div></div>';
      }
      if (e.resist && e.resist.length) {
        html += '<div class="popup-feature"><h4>' + esc(t('resist')) + '</h4><div class="chip-row">' + chipsHtml(e.resist) + '</div></div>';
      }
      html += '</div>';
    }

    if (e.type === 'mob') {
      html += '<div class="popup-cols">' +
        '<div class="popup-col"><h4>' + esc(t('drop')) + '</h4>' + colRows(e.drop) + '</div>' +
        '<div class="popup-col"><h4>' + esc(t('spoil')) + '</h4>' + colRows(e.spoil) + '</div>' +
        '</div>';
    }

    if (e.tips) {
      html += '<div class="popup-tip-box">' + esc(e.tips[state.lang]) + '</div>';
    }
    if (e.type === 'mob' && e.spawnPoints && e.spawnPoints.length) {
      html += '<button class="l2-btn popup-spawns-btn js-show-spawns" data-npc="' + e.npcId + '">' +
        esc(t('showSpawnsBtn')) + '</button>';
    }
    html += '</div>';
    return html;
  }

  // ============ Фильтры ============
  function isVisible(e) {
    switch (state.filter) {
      case 'npc': return e.type === 'npc' || e.type === 'boss';
      case 'aggro': return e.isAggro;
      case 'passive': return e.type === 'mob' && !e.isAggro;
      default: return true;
    }
  }

  // ============ Слой спавн-точек (мобы — только точки, все одинаковые) ============
  var spawnLayer = L.layerGroup();

  function rebuildSpawnDots() {
    spawnLayer.clearLayers();
    if (!state.showSpawns) { if (map.hasLayer(spawnLayer)) map.removeLayer(spawnLayer); return; }
    ENTITIES.forEach(function (e) {
      if (!e.spawnPoints || !isVisible(e)) return;
      var kind = e.isAggro ? 'aggro' : 'passive';
      var sel = state.selectedMob === e.npcId;
      var dim = state.selectedMob !== null && !sel;
      var quest = !sel && state.questHighlight && e.questMob;
      var wrapCls = 'spawn-dot-wrap';
      if (sel) wrapCls += ' spawn-dot-wrap--sel';
      else if (dim) wrapCls += ' spawn-dot-wrap--dim';
      else if (quest) wrapCls += ' spawn-dot-wrap--quest';
      var tip = '<b>' + esc(e.name[state.lang]) + '</b> · ' + esc(t('level')) + ' ' + e.level;
      e.spawnPoints.forEach(function (p) {
        var icon = L.divIcon({
          className: wrapCls + ' fl-dot',
          html: '<span class="spawn-dot spawn-dot--' + kind + '" aria-hidden="true"></span>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        L.marker(p, { icon: icon, keyboard: false, riseOnHover: true })
          .bindTooltip(tip, { direction: 'top', className: 'dot-tip', offset: [0, -10] })
          .on('click', function (ev) { openCardPopup(e, ev.latlng); })
          .addTo(spawnLayer);
      });
    });
    if (!map.hasLayer(spawnLayer)) spawnLayer.addTo(map);
  }

  // ============ Выбор моба: подсветка зоны спавна + полёт камеры ============
  function selectMob(npcId, fly) {
    state.selectedMob = state.selectedMob === npcId ? null : npcId;
    if (state.selectedMob !== null && fly !== false) {
      var e = ENTITIES.find(function (x) { return x.npcId === npcId; });
      if (e && e.spawnPoints && e.spawnPoints.length) {
        var bounds = L.latLngBounds(e.spawnPoints.map(function (p) { return p; }));
        map.flyToBounds(bounds.pad(0.25), { maxZoom: 1.5, duration: 0.8 });
      }
    }
    setMobDropdown(false); // выбрали — закрываем список, чтобы видеть карту
    if (isMobile()) setPanel(false); // на мобильном прячем и всю шторку
    rebuildSpawnDots();
    renderMobList();
  }

  function applyFilter() {
    ENTITIES.forEach(function (e) {
      if (e.type === 'mob') return;
      var m = markers[e.id];
      if (!m) return;
      if (isVisible(e)) { if (!map.hasLayer(m)) m.addTo(map); }
      else if (map.hasLayer(m)) map.removeLayer(m);
    });
    rebuildSpawnDots();
  }

  function refreshIcons() {
    ENTITIES.forEach(function (e) {
      var m = markers[e.id];
      if (m) m.setIcon(iconFor(e));
    });
  }

  // ============ Панель / i18n ============
  function renderPanel() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('#langSwitch .l2-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.lang === state.lang);
    });
    document.querySelectorAll('#filters .l2-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.filter === state.filter);
    });
    var qb = document.getElementById('questBtn');
    qb.classList.toggle('is-active', state.questHighlight);
    document.getElementById('spawnsBtn').classList.toggle('is-active', state.showSpawns);
    renderMusicBtn();
    renderLegend(); // легенда внизу слева — тоже на новом языке
    renderQuestModal();
    renderGuideModal();
    // переоткрыть текущий попап на новом языке
    ENTITIES.forEach(function (e) {
      var m = markers[e.id];
      if (m && m.isPopupOpen()) m.setPopupContent(popupHtml(e));
    });
  }

  // ============ Квест ============
  var questModal = document.getElementById('questModal');

  function renderQuestModal() {
    document.getElementById('questTitle').textContent = t('questTitle');
    var body = document.getElementById('questBody');
    var q = QUEST;
    var html = '<div class="quest-meta">' +
      '<span class="qm">' + esc(t('questGiver')) + ': <b>' + esc(q.giver[state.lang]) + '</b></span>' +
      '<span class="qm">' + esc(t('questMinLevel')) + ': <b>' + q.minLevel + '</b></span>' +
      '<span class="qm">' + esc(t('questRepeatable')) + ': <b>✓</b></span>' +
      '</div>';

    html += '<div class="quest-items">' + q.items.map(function (it) {
      return '<div class="quest-item"><img src="icons/' + esc(it.icon) + '" alt="">' + esc(it.name[state.lang]) + '</div>';
    }).join('') + '</div>';

    html += q.steps.map(function (s, i) {
      return '<div class="quest-step">' +
        '<div class="quest-step-title"><span class="num">' + esc(t('questStep')) + ' ' + (i + 1) + '.</span>' + esc(s.title[state.lang]) + '</div>' +
        '<div class="quest-step-desc">' + esc(s.desc[state.lang]) + '</div></div>';
    }).join('');

    if (q.reward) {
      html += '<div class="quest-reward">' + esc(q.reward[state.lang]) + '</div>';
    }

    html += '<button class="l2-btn quest-hl-btn" id="questHighlightBtn">' +
      esc(state.questHighlight ? t('questHideMobs') : t('questShowMobs')) + '</button>';

    body.innerHTML = html;
    document.getElementById('questHighlightBtn').onclick = function () {
      state.questHighlight = !state.questHighlight;
      refreshIcons();
      rebuildSpawnDots();
      renderPanel();
    };
  }

  // ============ Гайд ============
  function renderGuideModal() {
    document.getElementById('guideTitle').textContent = t('guideTitle');
    document.getElementById('guideBody').innerHTML = GUIDE.map(function (b) {
      return '<div class="guide-block"><h3>' + esc(b.title[state.lang]) + '</h3><p>' + esc(b.text[state.lang]) + '</p></div>';
    }).join('');
  }

  // ============ Dev-утилита координат (только консоль) ============
  map.on('click', function (ev) {
    var y = Math.round(ev.latlng.lat);
    var x = Math.round(ev.latlng.lng);
    console.log('[Frozen Labyrinth] coords:', JSON.stringify([y, x]));
  });

  // ============ Список мобов в панели ============
  function renderMobList() {
    var box = document.getElementById('mobList');
    var html = '';
    ENTITIES.forEach(function (e) {
      if (e.type !== 'mob') return;
      var active = state.selectedMob === e.npcId ? ' is-active' : '';
      var thumb = e.img
        ? '<img src="' + esc(e.img) + '" alt="" loading="lazy">'
        : '<span class="mob-item-ph"></span>';
      html += '<div class="mob-item' + active + '" data-npc="' + e.npcId + '">' +
        thumb +
        '<span class="mob-item-name">' + esc(e.name[state.lang]) +
        ' <span class="mob-item-lvl">' + e.level + '</span></span>' +
        '<span class="mob-item-dot' + (e.isAggro ? ' mob-item-dot--aggro' : '') + '"></span>' +
        '</div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('.mob-item').forEach(function (item) {
      item.addEventListener('click', function () {
        selectMob(Number(item.dataset.npc));
      });
    });
  }

  // ============ Выпадающее меню «Мобы локации» ============
  var mobsToggle = document.getElementById('mobsToggle');
  var mobDropdown = document.getElementById('mobDropdown');

  function setMobDropdown(open) {
    mobDropdown.hidden = !open;
    mobsToggle.classList.toggle('is-open', open);
  }
  mobsToggle.addEventListener('click', function (ev) {
    ev.stopPropagation();
    setMobDropdown(mobDropdown.hidden);
  });
  document.addEventListener('click', function (ev) {
    if (!mobDropdown.hidden && !mobDropdown.contains(ev.target) && ev.target !== mobsToggle) {
      setMobDropdown(false);
    }
  });

  // ============ Мобильная панель-шторка ============
  var panel = document.getElementById('panel');
  var panelToggle = document.getElementById('panelToggle');

  function isMobile() { return window.matchMedia('(max-width: 640px)').matches; }

  function setPanel(open) {
    panel.classList.toggle('is-open', open);
    panelToggle.classList.toggle('is-open', open);
  }
  panelToggle.addEventListener('click', function () {
    setPanel(!panel.classList.contains('is-open'));
  });

  // кнопка «Подсветить спавны» в карточке моба
  map.on('popupopen', function (ev) {
    if (isMobile()) setPanel(false); // открыли карточку точки — прячем шторку
    var btn = ev.popup.getElement() && ev.popup.getElement().querySelector('.js-show-spawns');
    if (btn) {
      btn.addEventListener('click', function () {
        map.closePopup();
        selectMob(Number(btn.dataset.npc));
      });
    }
  });

  // ============ Инициализация ============
  ENTITIES.forEach(function (e) {
    if (e.type === 'mob') return; // мобы представлены только спавн-точками
    var m = L.marker(e.coords, { icon: iconFor(e), title: e.name.ru + ' / ' + e.name.en });
    m.on('click', function (ev) { openCardPopup(e, ev.latlng); });
    markers[e.id] = m;
  });

  applyFilter();
  renderPanel();
  renderMobList();

  // события панели
  document.querySelectorAll('#langSwitch .l2-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      state.lang = b.dataset.lang;
      localStorage.setItem('fl-lang', state.lang);
      document.documentElement.lang = state.lang;
      renderPanel();
      rebuildSpawnDots(); // тултипы точек — на новом языке
    });
  });
  document.querySelectorAll('#filters .l2-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      state.filter = b.dataset.filter;
      applyFilter();
      renderPanel();
    });
  });

  document.getElementById('spawnsBtn').addEventListener('click', function () {
    state.showSpawns = !state.showSpawns;
    localStorage.setItem('fl-spawns', state.showSpawns ? 'on' : 'off');
    // выключили слой — сбрасываем выбор, чтобы после включения вернулись ВСЕ точки
    if (!state.showSpawns) state.selectedMob = null;
    rebuildSpawnDots();
    renderMobList();
    renderPanel();
  });

  // модалки взаимоисключающие: одна заменяет другую
  function openExclusive(backdrop) {
    document.getElementById('questModal').hidden = true;
    document.getElementById('guideModal').hidden = true;
    backdrop.hidden = false;
  }
  function bindModal(backdropId, closeId, openBtnId) {
    var backdrop = document.getElementById(backdropId);
    document.getElementById(openBtnId).addEventListener('click', function () {
      // повторный клик по той же кнопке — закрыть
      if (!backdrop.hidden) { backdrop.hidden = true; return; }
      openExclusive(backdrop);
    });
    document.getElementById(closeId).addEventListener('click', function () { backdrop.hidden = true; });
    backdrop.addEventListener('click', function (ev) { if (ev.target === backdrop) backdrop.hidden = true; });
  }
  bindModal('questModal', 'questClose', 'questBtn');
  bindModal('guideModal', 'guideClose', 'guideBtn');
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      document.getElementById('questModal').hidden = true;
      document.getElementById('guideModal').hidden = true;
      setMobDropdown(false);
      setPanel(false);
    }
  });

  // ============ Фоновая музыка: OST Lineage 2 — Snowfield Dawn ============
  var MUSIC_ID = 'gyTFZIjbXlY';
  var musicBtn = document.getElementById('musicToggle');
  var ytPlayer = null;
  var musicOn = localStorage.getItem('fl-music') === 'on';
  var musicStarted = false;

  function renderMusicBtn() {
    if (!musicBtn) return; // при инициализации панели плеер ещё не создан
    musicBtn.classList.toggle('is-active', musicStarted && musicOn);
    musicBtn.setAttribute('aria-pressed', musicStarted && musicOn ? 'true' : 'false');
    musicBtn.title = t('musicHint');
  }

  window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('ytMusic', {
      videoId: MUSIC_ID,
      playerVars: { autoplay: 0, controls: 0, loop: 1, playlist: MUSIC_ID, playsinline: 1 },
      events: {
        onReady: function () { ytPlayer.setVolume(35); },
        onStateChange: function (ev) {
          if (ev.data === YT.PlayerState.PLAYING) musicStarted = true;
          renderMusicBtn();
        },
      },
    });
  };
  (function loadYT() {
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  })();

  musicBtn.addEventListener('click', function () {
    if (!ytPlayer || !ytPlayer.playVideo) return;
    if (musicOn && musicStarted) {
      ytPlayer.pauseVideo();
      musicOn = false;
    } else {
      ytPlayer.playVideo();
      musicOn = true;
    }
    localStorage.setItem('fl-music', musicOn ? 'on' : 'off');
    renderMusicBtn();
  });

  // если музыка была включена — возобновляем после первого клика/тапа (автоплей запрещён)
  document.addEventListener('click', function (ev) {
    if (musicOn && !musicStarted && ytPlayer && ytPlayer.playVideo && ev.target !== musicBtn) {
      ytPlayer.playVideo();
    }
  }, true);

  renderMusicBtn();

  // ============ Легенда ============
  var legend = L.control({ position: 'bottomleft' });
  var legendEl = null;
  function renderLegend() {
    if (!legendEl) return;
    legendEl.innerHTML =
      '<div class="legend-row"><span class="legend-dot" style="background:#4a90d9"></span>' + esc(APP.i18n.filterNpc[state.lang]) + '</div>' +
      '<div class="legend-row"><span class="legend-dot" style="background:#d94a4a"></span>' + esc(APP.i18n.filterAggro[state.lang]) + '</div>' +
      '<div class="legend-row"><span class="legend-dot" style="background:#4ad97e"></span>' + esc(APP.i18n.filterPassive[state.lang]) + '</div>' +
      '<div class="legend-row"><span class="legend-dot" style="background:#b44ae0;border-color:#7fd4ff"></span>' + esc(APP.i18n.raidBoss[state.lang]) + '</div>';
  }
  legend.onAdd = function () {
    legendEl = L.DomUtil.create('div', 'l2-panel legend');
    renderLegend();
    return legendEl;
  };
  legend.addTo(map);

  // dev-хук: доступ к карте из консоли (координаты, программный выбор моба)
  window.__fl = {
    map: map,
    select: function (npcId) { selectMob(npcId); },
    openCard: function (npcId) {
      var e = ENTITIES.find(function (x) { return x.npcId === npcId; });
      if (e && e.spawnPoints && e.spawnPoints.length) {
        var center = e.spawnPoints[Math.floor(e.spawnPoints.length / 2)];
        openCardPopup(e, center);
      }
    },
  };
})();
