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
  });
  L.imageOverlay('labyrinth_map.png', BOUNDS).addTo(map);
  map.fitBounds(BOUNDS);
  map.setMaxBounds([[-120, -120], [1120, 1120]]);

  // ============ Маркеры ============
  var markers = {}; // id -> L.Marker

  function markerClass(e) {
    if (e.type === 'portal') return 'l2-marker--portal';
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

  // HP-полоска в стиле клиента: зелёная → жёлтая → красная по величине; босс — ледяная
  function hpHtml(e) {
    if (e.type !== 'mob' && e.type !== 'boss') return '';
    var max = e.type === 'boss' ? 80000 : 2200;
    var pct = Math.max(5, Math.min(100, Math.round(e.hp / max * 100)));
    var tone = pct > 60 ? 'hp-hi' : pct > 30 ? 'hp-mid' : 'hp-low';
    if (e.type === 'boss') tone = 'hp-boss';
    return '<div class="hp-line">' +
      '<span class="hp-bar"><i class="' + tone + '" style="width:' + pct + '%"></i></span>' +
      '<b class="hp-val">' + e.hp.toLocaleString('ru-RU') + '</b></div>';
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
    if (e.type === 'portal') {
      return '<div class="popup-portal">' + esc(e.name[state.lang]) + '</div>';
    }

    var badges = '';
    if (e.type === 'boss') badges += '<span class="badge badge--boss">' + esc(t('raidBoss')) + '</span>';
    else if (e.type === 'npc') badges += '<span class="badge badge--npc">NPC</span>';
    else if (e.isAggro) badges += '<span class="badge badge--aggro">' + esc(t('aggro')) + '</span>';
    else badges += '<span class="badge badge--passive">' + esc(t('passive')) + '</span>';
    if (e.questMob) badges += '<span class="badge badge--quest" title="' + esc(QUEST.name[state.lang]) + '">' + esc(t('questBadge')) + '</span>';

    var ava = e.img
      ? '<div class="popup-ava"><img src="' + esc(e.img) + '" alt=""></div>'
      : '';

    var race = e.race && e.race[state.lang]
      ? '<span class="popup-race">' + esc(e.race[state.lang]) + '</span>' : '';

    var xpLine = '';
    if (e.type === 'mob' && (e.exp || e.sp)) {
      xpLine = '<div class="popup-xp">' + esc(t('exp')) + ' <b>' + (e.exp ? e.exp.toLocaleString('ru-RU') : '0') + '</b>';
      if (e.sp) xpLine += ' · ' + esc(t('sp')) + ' <b>' + e.sp + '</b>';
      xpLine += '</div>';
    }

    var html = '<div class="popup-card">' +
      '<div class="popup-top">' + ava +
      '<div class="popup-titlebox">' +
      '<span class="popup-name">' + esc(e.name[state.lang]) + '</span>' +
      '<div class="popup-sub">' + lvlHtml(e) + race + '</div>' +
      '<div class="popup-badges">' + badges + '</div>' +
      hpHtml(e) +
      xpLine +
      '</div></div>';

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
          className: wrapCls,
          html: '<span class="spawn-dot spawn-dot--' + kind + '" role="button" tabindex="-1" aria-label="' +
            esc(e.name[state.lang]) + '"></span>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        L.marker(p, { icon: icon, keyboard: false, riseOnHover: true })
          .bindTooltip(tip, { direction: 'top', className: 'dot-tip', offset: [0, -10] })
          .bindPopup(function () { return popupHtml(e); },
            { maxWidth: 300, minWidth: 230, keepInView: true, autoPanPadding: [24, 24] })
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
    rebuildSpawnDots();
    renderMobList();
  }

  function applyFilter() {
    var visible = 0;
    ENTITIES.forEach(function (e) {
      if (e.type === 'mob') {
        if (isVisible(e) && e.spawnPoints && e.spawnPoints.length) visible++;
        return;
      }
      var m = markers[e.id];
      if (!m) return;
      if (isVisible(e)) { if (!map.hasLayer(m)) m.addTo(map); visible++; }
      else if (map.hasLayer(m)) map.removeLayer(m);
    });
    document.getElementById('markerCount').textContent = visible;
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

  // кнопка «Подсветить спавны» в карточке моба
  map.on('popupopen', function (ev) {
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
    m.bindPopup(function () { return popupHtml(e); },
      { maxWidth: 300, minWidth: 230, keepInView: true, autoPanPadding: [24, 24] });
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
    rebuildSpawnDots();
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
    }
  });

  // Легенда
  var legend = L.control({ position: 'bottomleft' });
  legend.onAdd = function () {
    var div = L.DomUtil.create('div', 'l2-panel legend');
    div.innerHTML =
      '<div class="legend-row"><span class="legend-dot" style="background:#4a90d9"></span>' + esc(APP.i18n.filterNpc[state.lang]) + '</div>' +
      '<div class="legend-row"><span class="legend-dot" style="background:#d94a4a"></span>' + esc(APP.i18n.filterAggro[state.lang]) + '</div>' +
      '<div class="legend-row"><span class="legend-dot" style="background:#4ad97e"></span>' + esc(APP.i18n.filterPassive[state.lang]) + '</div>' +
      '<div class="legend-row"><span class="legend-dot" style="background:#b44ae0;border-color:#7fd4ff"></span>' + esc(APP.i18n.raidBoss[state.lang]) + '</div>' +
      '<div class="legend-row"><span class="legend-dot spawn-dot-demo"></span>' + esc(APP.i18n.spawnsBtn[state.lang]) + '</div>';
    return div;
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
        L.popup({ maxWidth: 300, minWidth: 230, keepInView: true, autoPanPadding: [24, 24] })
          .setLatLng(center)
          .setContent(popupHtml(e))
          .openOn(map);
      }
    },
  };
})();
