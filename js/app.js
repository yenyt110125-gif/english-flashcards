/*
 * app.js — main flow: load decks, build the review queue, render cards,
 * wire swipe/tap/speak, and the settings (export/import/mastered) panel.
 *
 * Depends on window.SRS (srs.js) and window.Swipe (swipe.js), loaded first.
 */
(function () {
  'use strict';

  var state = {
    decks: [],          // [{id,title,cards:[...]}]
    cards: [],          // deduped by normalized word: {word,ipa,pos,definition,example,synonyms,deckIds:[]}
    byWord: {},         // norm(word) -> card
    filter: 'all',      // 'all' | deckId
    queue: [],          // cards to review this session
    swiper: null
  };

  // ---- DOM refs -----------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  var cardArea, emptyState, statRemaining, statMastered, deckSelect, settingsPanel;

  // ---- data loading -------------------------------------------------------
  function loadJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('Failed to load ' + url + ' (' + r.status + ')');
      return r.json();
    });
  }

  function loadAll() {
    return loadJSON('./decks/index.json').then(function (index) {
      var list = (index && index.decks) || [];
      // load oldest first so newer decks overwrite shared-word content
      list.sort(function (a, b) {
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      });
      return Promise.all(list.map(function (d) {
        return loadJSON('./decks/' + d.file).then(function (deck) {
          deck.id = deck.id || d.id;
          deck.title = deck.title || d.title;
          return deck;
        }).catch(function (e) {
          console.warn(e);
          return null;
        });
      }));
    }).then(function (decks) {
      state.decks = decks.filter(Boolean);
      buildCards();
    });
  }

  function buildCards() {
    state.byWord = {};
    state.cards = [];
    state.decks.forEach(function (deck) {
      (deck.cards || []).forEach(function (raw) {
        var key = SRS.norm(raw.word);
        if (!key) return;
        var existing = state.byWord[key];
        if (existing) {
          // newest deck wins for content; merge deck membership
          Object.assign(existing, {
            ipa: raw.ipa || existing.ipa,
            pos: raw.pos || existing.pos,
            definition: raw.definition || existing.definition,
            sourceSentence: raw.sourceSentence || existing.sourceSentence,
            examples: raw.examples || existing.examples,
            example: raw.example || existing.example,
            synonyms: raw.synonyms || existing.synonyms
          });
          if (existing.deckIds.indexOf(deck.id) === -1) existing.deckIds.push(deck.id);
        } else {
          var card = {
            word: raw.word,
            key: key,
            ipa: raw.ipa || '',
            pos: raw.pos || '',
            definition: raw.definition || '',
            sourceSentence: raw.sourceSentence || '',
            examples: raw.examples || null,
            example: raw.example || '',
            synonyms: raw.synonyms || [],
            deckIds: [deck.id]
          };
          state.byWord[key] = card;
          state.cards.push(card);
        }
      });
    });
  }

  // ---- filtering & queue --------------------------------------------------
  function filteredCards() {
    if (state.filter === 'all') return state.cards.slice();
    return state.cards.filter(function (c) {
      return c.deckIds.indexOf(state.filter) !== -1;
    });
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function buildQueue(includeAllNotMastered) {
    var pool = filteredCards().filter(function (c) {
      if (includeAllNotMastered) return !SRS.isMastered(c.word);
      return SRS.isDue(c.word);
    });
    state.queue = shuffle(pool);
  }

  // ---- rendering ----------------------------------------------------------
  function updateStats() {
    var filtered = filteredCards();
    var mastered = filtered.filter(function (c) { return SRS.isMastered(c.word); }).length;
    statRemaining.textContent = String(state.queue.length);
    statMastered.textContent = mastered + ' / ' + filtered.length;
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  function buildCardElement(card) {
    var el = document.createElement('div');
    el.className = 'card';

    // back: definition, original sentence from the article, then example sentences
    var back = ['<div class="definition">' + esc(card.definition) + '</div>'];
    if (card.sourceSentence) {
      back.push('<div class="block"><div class="section-label">From the article</div>' +
        '<div class="sentence orig">' + highlight(card.sourceSentence, card.word) + '</div></div>');
    }
    var exs = card.examples || (card.example ? [card.example] : []);
    if (exs.length) {
      back.push('<div class="block"><div class="section-label">Examples</div>' +
        '<div class="examples">' +
        exs.map(function (s) { return '<div class="sentence example">' + highlight(s, card.word) + '</div>'; }).join('') +
        '</div></div>');
    }
    if (card.synonyms && card.synonyms.length) {
      back.push('<div class="synonyms">≈ ' + card.synonyms.map(esc).join(' · ') + '</div>');
    }

    el.innerHTML =
      '<div class="card-inner">' +
        '<div class="card-face card-front">' +
          (card.pos ? '<div class="pos">' + esc(card.pos) + '</div>' : '') +
          '<div class="word">' + esc(card.word) + '</div>' +
          '<div class="ipa-row">' +
            (card.ipa ? '<span class="ipa">' + esc(card.ipa) + '</span>' : '') +
            '<button class="speak-btn" type="button" aria-label="Pronounce">🔊</button>' +
          '</div>' +
          '<div class="tap-hint">Tap to flip &nbsp;·&nbsp; swipe ← unfamiliar &nbsp;·&nbsp; known →</div>' +
        '</div>' +
        '<div class="card-face card-back">' + back.join('') + '</div>' +
      '</div>' +
      '<div class="badge badge-know">KNOWN ✓</div>' +
      '<div class="badge badge-unknown">UNFAMILIAR ✕</div>';

    // speak button: don't let it start a drag or flip
    var sb = el.querySelector('.speak-btn');
    sb.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    sb.addEventListener('click', function (e) {
      e.stopPropagation();
      speak(card.word);
    });

    return el;
  }

  function render() {
    if (state.swiper) { state.swiper.destroy(); state.swiper = null; }
    cardArea.innerHTML = '';

    if (!state.queue.length) {
      showEmpty();
      updateStats();
      return;
    }
    emptyState.hidden = true;
    setControlsEnabled(true);

    var card = state.queue[0];
    var el = buildCardElement(card);
    cardArea.appendChild(el);

    state.swiper = Swipe.bind(el, {
      onDecision: function (dir) { afterDecision(dir); },
      onTap: function () { el.classList.toggle('flipped'); }
    });

    // auto-speak on new card? keep off to avoid surprise audio; user taps 🔊
    updateStats();
  }

  function currentCardEl() { return cardArea.querySelector('.card'); }

  // Fling the visible card off-screen, then commit (used by the buttons).
  function flingAndDecide(dir) {
    var el = currentCardEl();
    if (!el) return;
    setControlsEnabled(false);
    var offX = (dir === 'know' ? 1 : -1) * (window.innerWidth || 500);
    el.classList.add('flinging');
    el.style.transform = 'translate(' + offX + 'px,0) rotate(' + (dir === 'know' ? 14 : -14) + 'deg)';
    el.style.opacity = '0';
    var done = false;
    var fire = function () { if (done) return; done = true; afterDecision(dir); };
    el.addEventListener('transitionend', fire, { once: true });
    setTimeout(fire, 350);
  }

  function afterDecision(dir) {
    var card = state.queue.shift();
    if (card) {
      var grade = dir === 'know' ? 'good' : 'again';
      SRS.review(card.word, grade);
      if (grade === 'again') {
        state.queue.push(card); // re-show later this session
      }
    }
    render();
  }

  function showEmpty() {
    setControlsEnabled(false);
    var anyLeft = filteredCards().some(function (c) { return !SRS.isMastered(c.word); });
    emptyState.hidden = false;
    emptyState.innerHTML = anyLeft
      ? '<div class="empty-emoji">🎉</div>' +
        '<h2>All done for now</h2>' +
        '<p>No cards are due. You can study ahead with words you haven\'t mastered yet.</p>' +
        '<button id="restudy" class="btn btn-primary" type="button">Study ahead</button>'
      : '<div class="empty-emoji">🏆</div>' +
        '<h2>All mastered!</h2>' +
        '<p>You\'ve learned every word here. Feed a new article to Claude to add more cards.</p>';
    var rb = $('restudy');
    if (rb) rb.addEventListener('click', function () {
      buildQueue(true);
      render();
    });
  }

  function setControlsEnabled(on) { /* no on-screen controls; kept as a no-op */ }

  // ---- settings: export / import / mastered -------------------------------
  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function doExport() {
    download('flashcards-progress-' + SRS.today() + '.json', SRS.exportJSON());
  }

  function doImport(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var n = SRS.importJSON(String(reader.result));
        alert('Imported ' + n + ' entries.');
        buildQueue(false);
        render();
      } catch (e) {
        alert('Import failed: ' + e.message);
      }
    };
    reader.readAsText(file);
  }

  function renderMasteredList() {
    var box = $('mastered-list');
    if (!box) return;
    var mastered = state.cards.filter(function (c) { return SRS.isMastered(c.word); });
    if (!mastered.length) {
      box.innerHTML = '<p class="muted">No mastered words yet.</p>';
      return;
    }
    box.innerHTML = mastered.map(function (c) {
      return '<div class="mastered-row"><span>' + esc(c.word) + '</span>' +
        '<button class="link-btn" data-word="' + esc(c.word) + '">Reset</button></div>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.link-btn'), function (b) {
      b.addEventListener('click', function () {
        SRS.remove(b.getAttribute('data-word'));
        renderMasteredList();
        updateStats();
      });
    });
  }

  function openSettings() {
    renderMasteredList();
    settingsPanel.hidden = false;
  }
  function closeSettings() { settingsPanel.hidden = true; }

  // ---- deck selector ------------------------------------------------------
  function populateDeckSelect() {
    var opts = ['<option value="all">All articles</option>'];
    state.decks.forEach(function (d) {
      opts.push('<option value="' + esc(d.id) + '">' + esc(d.title || d.id) + '</option>');
    });
    deckSelect.innerHTML = opts.join('');
    deckSelect.value = state.filter;
  }

  // ---- utils --------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Escape a sentence and bold the target word (tolerant of inflections/phrases).
  function highlight(text, word) {
    var safe = esc(text);
    if (!word) return safe;
    var tokens = String(word).trim().split(/\s+/).map(function (t) {
      var stem = (t.length > 4 && /e$/i.test(t)) ? t.slice(0, -1) : t; // drop trailing 'e' to catch -ing forms
      return stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*';
    });
    try {
      var re = new RegExp('(\\b' + tokens.join('\\s+') + ')', 'ig');
      return safe.replace(re, '<strong>$1</strong>');
    } catch (e) { return safe; }
  }

  // ---- wire up ------------------------------------------------------------
  function init() {
    cardArea = $('card-area');
    emptyState = $('empty-state');
    statRemaining = $('stat-remaining');
    statMastered = $('stat-mastered');
    deckSelect = $('deck-select');
    settingsPanel = $('settings-panel');

    deckSelect.addEventListener('change', function () {
      state.filter = deckSelect.value;
      buildQueue(false);
      render();
    });

    $('btn-settings').addEventListener('click', openSettings);
    $('btn-close-settings').addEventListener('click', closeSettings);
    $('btn-export').addEventListener('click', doExport);
    $('import-file').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) doImport(e.target.files[0]);
      e.target.value = '';
    });
    $('btn-clear').addEventListener('click', function () {
      if (confirm('Clear all learning progress on this device? This cannot be undone (export a backup first).')) {
        SRS.clearAll();
        buildQueue(false);
        renderMasteredList();
        render();
      }
    });

    // keyboard shortcuts (desktop testing): ← don't know, → know, space flip
    document.addEventListener('keydown', function (e) {
      if (!settingsPanel.hidden) return;
      if (e.key === 'ArrowRight') flingAndDecide('know');
      else if (e.key === 'ArrowLeft') flingAndDecide('unknown');
      else if (e.key === ' ') {
        e.preventDefault();
        var el = currentCardEl();
        if (el) el.classList.toggle('flipped');
      }
    });

    loadAll().then(function () {
      populateDeckSelect();
      buildQueue(false);
      render();
    }).catch(function (e) {
      cardArea.innerHTML = '<div class="load-error">Failed to load: ' + esc(e.message) +
        '<br><small>Open via an http server (not directly with file://).</small></div>';
      console.error(e);
    });

    // register service worker for offline / installable app, and auto-reload
    // once a newer version takes control (so code + data never fall out of sync)
    if ('serviceWorker' in navigator) {
      var hadController = !!navigator.serviceWorker.controller;
      var refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (refreshing) return;
        if (!hadController) { hadController = true; return; } // first install: don't reload
        refreshing = true;
        window.location.reload();
      });
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').catch(function () {});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
