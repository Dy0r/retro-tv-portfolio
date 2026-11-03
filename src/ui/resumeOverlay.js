import site from '../content/site.json';

// The resume overlay: a modal <dialog> with a chunky stepped-corner frame in the
// menu's style, a pixel X to close, and the PDF shown in the browser's own viewer
// (real, selectable text). The PDF only loads the first time it's opened, and only
// after the frame has finished opening, so loading it never stutters the animation.
// Closes on the X, Esc, or a click outside the frame. A native modal dialog keeps
// keyboard focus inside it while open and hands focus back when it closes.

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const CLOSE_FALLBACK_MS = 600;

// A 7x7 pixel X, drawn as squares so it matches the pixel UI.
function pixelX() {
  const cells = [];
  for (let i = 0; i < 7; i++) {
    cells.push(`<rect x="${i}" y="${i}" width="1" height="1"/>`);
    if (i !== 3) cells.push(`<rect x="${6 - i}" y="${i}" width="1" height="1"/>`);
  }
  return `<svg viewBox="0 0 7 7" width="21" height="21" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${cells.join('')}</svg>`;
}

// `onOpened` fires once the frame is fully open; `onClosing` as it starts to close.
export function createResumeOverlay({ onOpened, onClosing, onClose }) {
  const { posterTitle, file, closeLabel, openLabel } = site.resume;

  const dialog = document.createElement('dialog');
  dialog.className = 'resume';
  dialog.setAttribute('aria-labelledby', 'resume-title');
  dialog.innerHTML = `
    <div class="resume__glow">
      <div class="resume__frame">
        <div class="resume__inner">
          <h2 class="sr-only" id="resume-title"></h2>
          <iframe class="resume__doc"></iframe>
          <p class="resume__footer"><a class="resume__open" target="_blank" rel="noopener"></a></p>
        </div>
      </div>
      <button class="resume__close" type="button" autofocus>${pixelX()}</button>
    </div>
  `;
  dialog.querySelector('#resume-title').textContent = posterTitle;
  const doc = dialog.querySelector('.resume__doc');
  doc.title = posterTitle;
  const link = dialog.querySelector('.resume__open');
  link.href = file;
  link.textContent = openLabel;
  const closeButton = dialog.querySelector('.resume__close');
  closeButton.setAttribute('aria-label', closeLabel);
  document.body.appendChild(dialog);

  let closing = false;

  function close() {
    if (!dialog.open || closing) return;
    closing = true;
    onClosing?.();
    dialog.classList.remove('is-open');
    const finish = () => {
      if (!closing) return;
      closing = false;
      dialog.close();
      onClose();
    };
    if (reducedMotion.matches) return finish();
    dialog.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, CLOSE_FALLBACK_MS);
  }

  closeButton.addEventListener('click', close);
  // Esc: run our own close so it animates and the camera returns.
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  // The dialog fills the screen; a click that lands on it directly is outside the frame.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  return {
    open() {
      if (dialog.open) return;
      dialog.showModal();
      void dialog.offsetWidth; // let the closed styles apply before animating in
      dialog.classList.add('is-open');
      let opened = false;
      const finish = () => {
        if (opened || !dialog.open || closing) return;
        opened = true;
        if (!doc.src) doc.src = `${file}#view=FitH&navpanes=0`;
        onOpened?.();
      };
      if (reducedMotion.matches) return finish();
      dialog.addEventListener('transitionend', finish, { once: true });
      setTimeout(finish, CLOSE_FALLBACK_MS);
    },
    close,
  };
}

// Keyboard route to the resume: a button that stays hidden until it gets focus
// (press Tab), then appears top-right. Mouse and touch users click the poster.
export function createResumeButton({ onActivate }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'resume-launch';
  button.textContent = site.resume.posterTitle;
  button.addEventListener('click', onActivate);
  document.body.appendChild(button);
  return button;
}
