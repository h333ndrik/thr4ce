'use strict';
/* H4 cursor, ported from h4moshlab. Behavior: always upright (0deg),
   hover over clickable elements scales to 112%, mouse press applies a
   subtle dip. Touch devices keep the system cursor. */
(() => {
  if (window.matchMedia('(hover:none), (pointer:coarse)').matches) return;
  const el = document.createElement('div');
  el.className = 'h4-cursor is-hidden';
  const img = document.createElement('img');
  img.src = 'h4-cursor.svg';
  img.alt = '';
  img.draggable = false;
  el.append(img);
  document.body.append(el);
  document.documentElement.classList.add('h4-cursor-ready');

  const CLICKABLE = 'button, a, label, input, select, summary, [role=button]';
  let raf = 0, x = -100, y = -100;
  let visible = false, clickable = false, clicking = false;
  let paintedVisible = false, paintedClickable = false, paintedClicking = false;

  const paint = () => {
    raf = 0;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (visible !== paintedVisible) {
      el.classList.toggle('is-hidden', !visible);
      paintedVisible = visible;
    }
    if (clickable !== paintedClickable) {
      el.classList.toggle('is-clickable', clickable);
      paintedClickable = clickable;
    }
    if (clicking !== paintedClicking) {
      el.classList.toggle('is-clicking', clicking);
      paintedClicking = clicking;
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(paint);
  };
  const hide = () => {
    visible = false;
    clickable = false;
    clicking = false;
    el.classList.add('is-hidden');
    paintedVisible = false;
    if (!raf) raf = requestAnimationFrame(paint);
  };
  const keepInTopLayer = () => {
    const host = document.querySelector('dialog[open]') || document.body;
    if (el.parentElement !== host) host.append(el);
  };

  document.addEventListener('mousemove', event => {
    x = event.clientX;
    y = event.clientY;
    visible = true;
    clickable = Boolean(event.target.closest?.(CLICKABLE));
    schedule();
  }, {passive: true});
  document.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse') return;
    clicking = true;
    schedule();
  }, {passive: true});
  document.addEventListener('pointerup', () => {
    clicking = false;
    schedule();
  }, {passive: true});
  document.addEventListener('pointercancel', () => {
    clicking = false;
    schedule();
  }, {passive: true});
  document.documentElement.addEventListener('mouseleave', hide, {passive: true});
  window.addEventListener('blur', hide);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hide();
  });
  document.addEventListener('toggle', event => {
    if (!event.target.matches?.('dialog')) return;
    requestAnimationFrame(() => {
      keepInTopLayer();
      schedule();
    });
  }, true);
})();
