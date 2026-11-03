'use strict';
/* H4 cursor, ported from h4moshlab. Behavior: always upright (0deg),
   hover over clickable elements scales to 112%, mouse press applies a
   subtle dip. Touch devices keep the system cursor. */
(() => {
  if (window.matchMedia('(hover:none), (pointer:coarse)').matches) return;
  const el = document.createElement('div');
  el.className = 'h4-cursor';
  const img = document.createElement('img');
  img.src = 'h4-cursor.svg';
  img.alt = '';
  img.draggable = false;
  el.append(img);
  document.body.append(el);
  document.documentElement.classList.add('h4-cursor-ready');

  const CLICKABLE = 'button, a, label, input, select, summary, [role=button]';
  let raf = 0, x = -100, y = -100;
  const paint = () => {
    raf = 0;
    el.style.transform = `translate(${x}px, ${y}px)`;
  };
  document.addEventListener('pointermove', event => {
    x = event.clientX; y = event.clientY;
    if (!raf) raf = requestAnimationFrame(paint);
    el.classList.toggle('is-clickable', Boolean(event.target.closest?.(CLICKABLE)));
  }, {passive: true});
  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') el.classList.add('is-clicking');
  }, {passive: true});
  document.addEventListener('pointerup', () => el.classList.remove('is-clicking'), {passive: true});
  document.addEventListener('pointercancel', () => el.classList.remove('is-clicking'), {passive: true});
})();
