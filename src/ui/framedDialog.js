// The site's framed pop-up: a modal <dialog> over the dimmed scene with a chunky
// teal frame (stepped pixel corners) and a pixel X in the top-right corner.
// Used by the resume, the project case study and the image enlarger, so they all
// look and behave the same: X, Esc, or a click outside the frame closes it.
// A native modal dialog keeps keyboard focus inside while open and gives focus
// back to whatever opened it when it closes.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
// Fires 'open' and 'close' whenever any framed pop-up opens or closes (for sounds).
export const dialogEvents = new EventTarget();
const FALLBACK_MS = 600; // in case a transition can't run (e.g. hidden tab)

// A 7x7 pixel X, drawn as squares so it matches the pixel UI.
function pixelX() {
  const cells = [];
  for (let i = 0; i < 7; i++) {
    cells.push(`<rect x="${i}" y="${i}" width="1" height="1"/>`);
    if (i !== 3) cells.push(`<rect x="${6 - i}" y="${i}" width="1" height="1"/>`);
  }
  return `<svg viewBox="0 0 7 7" width="21" height="21" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${cells.join('')}</svg>`;
}

// Calls `done` once the dialog's own fade finishes (or after a fallback delay).
function afterFade(dialog, done) {
  if (reducedMotion.matches) return done();
  let called = false;
  const finish = () => {
    if (called) return;
    called = true;
    dialog.removeEventListener('transitionend', onEnd);
    done();
  };
  const onEnd = (e) => {
    if (e.target === dialog) finish();
  };
  dialog.addEventListener('transitionend', onEnd);
  setTimeout(finish, FALLBACK_MS);
}

// onOpened: frame fully open. onClosing: starts closing. onClosed: fully gone.
export function createFramedDialog({ className, labelledBy, closeLabel, focusClose = true, onOpened, onClosing, onClosed }) {
  const dialog = document.createElement('dialog');
  dialog.className = `framed ${className}`;
  if (labelledBy) dialog.setAttribute('aria-labelledby', labelledBy);
  dialog.innerHTML = `
    <div class="framed__glow">
      <div class="framed__frame"><div class="framed__inner"></div></div>
      <button class="framed__close" type="button">${pixelX()}</button>
    </div>
  `;
  const inner = dialog.querySelector('.framed__inner');
  const closeButton = dialog.querySelector('.framed__close');
  closeButton.setAttribute('aria-label', closeLabel);
  closeButton.autofocus = focusClose;
  document.body.appendChild(dialog);

  let closing = false;

  function close() {
    if (!dialog.open || closing) return;
    closing = true;
    dialogEvents.dispatchEvent(new Event('close'));
    onClosing?.();
    dialog.classList.remove('is-open');
    afterFade(dialog, () => {
      closing = false;
      dialog.close();
      onClosed?.();
    });
  }

  closeButton.addEventListener('click', close);
  // Esc: run our own close so it animates and the callbacks fire.
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  // The dialog fills the screen; a click that lands on it directly is outside the frame.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  return {
    dialog,
    inner,
    closeButton,
    get isOpen() {
      return dialog.open && !closing;
    },
    open() {
      if (dialog.open) return;
      dialog.showModal();
      dialogEvents.dispatchEvent(new Event('open'));
      void dialog.offsetWidth; // let the closed styles apply before animating in
      dialog.classList.add('is-open');
      afterFade(dialog, () => {
        if (dialog.open && !closing) onOpened?.();
      });
    },
    close,
  };
}
