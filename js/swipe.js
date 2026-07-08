/*
 * swipe.js — pointer/touch gesture handling for a single card element.
 *
 * Binds drag-to-swipe (left = don't know, right = know) and tap-to-flip on the
 * given element. Zero dependencies; works with mouse, touch and stylus via the
 * Pointer Events API.
 *
 * Exposes: window.Swipe.bind(el, handlers) -> { destroy() }
 *   handlers.onDecision(direction)  direction: 'know' | 'unknown'
 *   handlers.onTap()                fired on a click/tap that isn't a drag
 */
(function (global) {
  'use strict';

  var THRESHOLD = 90;     // px of horizontal travel to count as a swipe
  var TAP_SLOP = 10;      // px of movement still considered a tap
  var MAX_ROTATE = 14;    // deg of tilt at full drag

  function bind(el, handlers) {
    handlers = handlers || {};
    var startX = 0, startY = 0, dx = 0, dy = 0;
    var dragging = false;
    var pointerId = null;

    function onDown(e) {
      // only primary button / first touch
      if (e.button != null && e.button !== 0) return;
      dragging = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0; dy = 0;
      el.classList.add('dragging');
      if (el.setPointerCapture && pointerId != null) {
        try { el.setPointerCapture(pointerId); } catch (err) {}
      }
    }

    function onMove(e) {
      if (!dragging || (pointerId != null && e.pointerId !== pointerId)) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;
      var rot = Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, dx / 12));
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)';
      // tint hint via data attribute the CSS can react to
      if (dx > TAP_SLOP) el.setAttribute('data-hint', 'know');
      else if (dx < -TAP_SLOP) el.setAttribute('data-hint', 'unknown');
      else el.removeAttribute('data-hint');
    }

    function finish(commitDir) {
      el.classList.remove('dragging');
      el.removeAttribute('data-hint');
      if (commitDir) {
        // fling the card off-screen in the swipe direction, then notify
        var offX = (commitDir === 'know' ? 1 : -1) * (global.innerWidth || 500);
        el.classList.add('flinging');
        el.style.transform = 'translate(' + offX + 'px,' + dy + 'px) rotate(' +
          (commitDir === 'know' ? MAX_ROTATE : -MAX_ROTATE) + 'deg)';
        el.style.opacity = '0';
        var done = false;
        var fire = function () {
          if (done) return; done = true;
          if (handlers.onDecision) handlers.onDecision(commitDir);
        };
        el.addEventListener('transitionend', fire, { once: true });
        // safety fallback if transitionend doesn't fire
        global.setTimeout(fire, 350);
      } else {
        // snap back
        el.classList.add('snapping');
        el.style.transform = '';
        global.setTimeout(function () { el.classList.remove('snapping'); }, 200);
      }
    }

    function onUp(e) {
      if (!dragging || (pointerId != null && e.pointerId !== pointerId)) return;
      dragging = false;
      if (el.releasePointerCapture && pointerId != null) {
        try { el.releasePointerCapture(pointerId); } catch (err) {}
      }
      pointerId = null;

      var movedFar = Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP;
      if (Math.abs(dx) >= THRESHOLD) {
        finish(dx > 0 ? 'know' : 'unknown');
      } else if (!movedFar) {
        // treat as a tap → flip
        el.classList.add('snapping');
        el.style.transform = '';
        global.setTimeout(function () { el.classList.remove('snapping'); }, 150);
        if (handlers.onTap) handlers.onTap(e);
      } else {
        finish(null);
      }
    }

    function onCancel() {
      if (!dragging) return;
      dragging = false;
      pointerId = null;
      finish(null);
    }

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);

    return {
      destroy: function () {
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onCancel);
      }
    };
  }

  global.Swipe = { bind: bind, THRESHOLD: THRESHOLD };
})(window);
