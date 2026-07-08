/*
 * swipe.js — pointer/touch gesture handling for a single card element.
 *
 * Binds drag-to-swipe (left = don't know, right = know) and tap-to-flip.
 * Gesture direction is detected on the first move: horizontal-dominant gestures
 * become swipes (handled here), vertical-dominant gestures are left alone so the
 * flipped card back can scroll natively (CSS touch-action: pan-y). This avoids
 * the scroll-vs-swipe conflict after flipping.
 *
 * Exposes: window.Swipe.bind(el, handlers) -> { destroy() }
 *   handlers.onDecision(direction)  direction: 'know' | 'unknown'
 *   handlers.onTap()                fired on a click/tap that isn't a drag
 */
(function (global) {
  'use strict';

  var THRESHOLD = 90;    // px of horizontal travel to count as a committed swipe
  var TAP_SLOP = 10;     // px of movement still considered a tap
  var DECIDE_SLOP = 8;   // px before we decide horizontal vs vertical
  var MAX_ROTATE = 14;   // deg of tilt at full drag

  function bind(el, handlers) {
    handlers = handlers || {};
    var startX = 0, startY = 0, dx = 0, dy = 0;
    var pointerId = null;
    var axis = null;       // null (undecided) | 'h' | 'v'
    var down = false;

    function reset() {
      down = false; axis = null; pointerId = null; dx = 0; dy = 0;
    }

    function onDown(e) {
      if (e.button != null && e.button !== 0) return;
      down = true;
      axis = null;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0; dy = 0;
    }

    function onMove(e) {
      if (!down || (pointerId != null && e.pointerId !== pointerId)) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;

      if (axis === null) {
        if (Math.abs(dx) < DECIDE_SLOP && Math.abs(dy) < DECIDE_SLOP) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          // horizontal swipe — take over the gesture
          axis = 'h';
          el.classList.add('dragging');
          if (el.setPointerCapture && pointerId != null) {
            try { el.setPointerCapture(pointerId); } catch (err) {}
          }
        } else {
          // vertical — let the browser scroll the card back; ignore for swiping
          axis = 'v';
          return;
        }
      }
      if (axis !== 'h') return;

      var rot = Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, dx / 12));
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)';
      if (dx > TAP_SLOP) el.setAttribute('data-hint', 'know');
      else if (dx < -TAP_SLOP) el.setAttribute('data-hint', 'unknown');
      else el.removeAttribute('data-hint');
    }

    function finish(commitDir) {
      el.classList.remove('dragging');
      el.removeAttribute('data-hint');
      if (commitDir) {
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
        global.setTimeout(fire, 350);
      } else {
        el.classList.add('snapping');
        el.style.transform = '';
        global.setTimeout(function () { el.classList.remove('snapping'); }, 200);
      }
    }

    function onUp(e) {
      if (!down || (pointerId != null && e.pointerId !== pointerId)) return;
      var wasAxis = axis;
      var totalMoved = Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP;
      if (el.releasePointerCapture && pointerId != null) {
        try { el.releasePointerCapture(pointerId); } catch (err) {}
      }
      down = false; axis = null; pointerId = null;

      if (wasAxis === 'h') {
        if (Math.abs(dx) >= THRESHOLD) finish(dx > 0 ? 'know' : 'unknown');
        else finish(null);
      } else if (!totalMoved) {
        // a tap → flip
        if (handlers.onTap) handlers.onTap(e);
      }
      // vertical drag (wasAxis === 'v'): do nothing, it was a scroll
    }

    function onCancel(e) {
      if (!down) return;
      var wasAxis = axis;
      down = false; axis = null; pointerId = null;
      if (wasAxis === 'h') finish(null);
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
        reset();
      }
    };
  }

  global.Swipe = { bind: bind, THRESHOLD: THRESHOLD };
})(window);
