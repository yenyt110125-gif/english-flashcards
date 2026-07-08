/*
 * srs.js — Spaced-repetition engine + local progress store.
 *
 * Progress lives in the browser's localStorage, keyed by the *normalized word*
 * so the same word shared across articles shares one learning state.
 * Nothing here talks to the network; deck content (the "textbook") is separate
 * and loaded from /decks. See CLAUDE.md for the deck schema.
 *
 * Exposes a single global: window.SRS
 */
(function (global) {
  'use strict';

  var PREFIX = 'srs:v1:';
  var DEFAULT_EASE = 2.5;
  var MIN_EASE = 1.3;
  var MASTER_INTERVAL = 21; // days: at/after this interval a word "graduates"
  var MASTER_REPS = 5;      // or this many successful reps in a row

  // ---- date helpers (YYYY-MM-DD, local time) -----------------------------
  function today() {
    var d = new Date();
    return toKey(d);
  }
  function toKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function addDays(dateStr, n) {
    var parts = dateStr.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + n);
    return toKey(d);
  }
  function isOnOrBefore(a, b) {
    return a <= b; // ISO date strings compare lexicographically
  }

  // ---- word normalization -------------------------------------------------
  function norm(word) {
    return String(word == null ? '' : word).trim().toLowerCase();
  }

  // ---- storage ------------------------------------------------------------
  function defaultProgress() {
    return {
      reps: 0,
      ease: DEFAULT_EASE,
      intervalDays: 0,
      due: today(),       // new words are due immediately
      mastered: false,
      seen: false,        // has the user ever graded this word?
      updated: today()
    };
  }

  function get(word) {
    var key = PREFIX + norm(word);
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return defaultProgress();
      var parsed = JSON.parse(raw);
      // fill any missing fields from defaults (forward compatibility)
      var base = defaultProgress();
      for (var k in base) {
        if (!(k in parsed)) parsed[k] = base[k];
      }
      return parsed;
    } catch (e) {
      return defaultProgress();
    }
  }

  function set(word, progress) {
    var key = PREFIX + norm(word);
    try {
      global.localStorage.setItem(key, JSON.stringify(progress));
    } catch (e) {
      // storage full or blocked (e.g. private mode) — fail quietly
    }
  }

  function remove(word) {
    try {
      global.localStorage.removeItem(PREFIX + norm(word));
    } catch (e) {}
  }

  // ---- SM-2 (simplified, two outcomes) -----------------------------------
  // grade: 'good' (right swipe / knew it) | 'again' (left swipe / didn't know)
  function review(word, grade) {
    var p = get(word);
    p.seen = true;

    if (grade === 'again') {
      p.reps = 0;
      p.intervalDays = 0;
      p.ease = Math.max(MIN_EASE, p.ease - 0.2);
      p.mastered = false;
      p.due = today(); // stays in today's queue; app re-queues it this session
    } else { // 'good'
      p.reps += 1;
      if (p.reps === 1) {
        p.intervalDays = 1;
      } else if (p.reps === 2) {
        p.intervalDays = 6;
      } else {
        p.intervalDays = Math.max(1, Math.round(p.intervalDays * p.ease));
      }
      p.ease = p.ease + 0.1; // reward: knowing it makes future gaps larger
      p.due = addDays(today(), p.intervalDays);
      if (p.intervalDays >= MASTER_INTERVAL || p.reps >= MASTER_REPS) {
        p.mastered = true;
      }
    }
    p.updated = today();
    set(word, p);
    return p;
  }

  // A word is due if not mastered and its due date is today or earlier.
  function isDue(word) {
    var p = get(word);
    if (p.mastered) return false;
    return isOnOrBefore(p.due, today());
  }

  function isMastered(word) {
    return get(word).mastered === true;
  }

  // ---- export / import (manual backup — no cloud sync) --------------------
  function exportData() {
    var out = {};
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var key = global.localStorage.key(i);
        if (key && key.indexOf(PREFIX) === 0) {
          out[key] = JSON.parse(global.localStorage.getItem(key));
        }
      }
    } catch (e) {}
    return {
      type: 'english-flashcards-progress',
      version: 1,
      exportedAt: today(),
      progress: out
    };
  }

  function exportJSON() {
    return JSON.stringify(exportData(), null, 2);
  }

  // Merge imported progress into current store. Returns number of entries applied.
  function importJSON(text) {
    var data = JSON.parse(text);
    var progress = data && data.progress ? data.progress : data;
    if (!progress || typeof progress !== 'object') {
      throw new Error('Unrecognized backup file');
    }
    var count = 0;
    for (var key in progress) {
      if (!Object.prototype.hasOwnProperty.call(progress, key)) continue;
      var fullKey = key.indexOf(PREFIX) === 0 ? key : PREFIX + norm(key);
      try {
        global.localStorage.setItem(fullKey, JSON.stringify(progress[key]));
        count++;
      } catch (e) {}
    }
    return count;
  }

  function clearAll() {
    var keys = [];
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var key = global.localStorage.key(i);
        if (key && key.indexOf(PREFIX) === 0) keys.push(key);
      }
      keys.forEach(function (k) { global.localStorage.removeItem(k); });
    } catch (e) {}
    return keys.length;
  }

  global.SRS = {
    norm: norm,
    today: today,
    get: get,
    set: set,
    remove: remove,
    review: review,
    isDue: isDue,
    isMastered: isMastered,
    exportJSON: exportJSON,
    importJSON: importJSON,
    clearAll: clearAll,
    MASTER_INTERVAL: MASTER_INTERVAL,
    MASTER_REPS: MASTER_REPS
  };
})(window);
