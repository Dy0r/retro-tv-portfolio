import site from '../content/site.json';
import { assetUrl } from '../assetUrl.js';
import { createFramedDialog } from './framedDialog.js';

// The resume overlay: the shared framed pop-up (see framedDialog.js) showing the
// PDF in the browser's own viewer (real, selectable text), plus a link to open it
// in a new tab for phones that can't show PDFs inline. The PDF only loads the
// first time it's opened, and only after the frame has finished opening, so
// loading it never stutters the animation.

// `onOpened` fires once the frame is fully open; `onClosing` as it starts to close.
export function createResumeOverlay({ onOpened, onClosing, onClose }) {
  const { posterTitle, file, closeLabel, openLabel } = site.resume;
  let doc = null;

  const frame = createFramedDialog({
    className: 'resume',
    labelledBy: 'resume-title',
    closeLabel,
    onOpened: () => {
      if (!doc.src) doc.src = `${assetUrl(file)}#view=FitH&navpanes=0`;
      onOpened?.();
    },
    onClosing,
    onClosed: onClose,
  });

  frame.inner.innerHTML = `
    <h2 class="sr-only" id="resume-title"></h2>
    <iframe class="resume__doc"></iframe>
    <p class="resume__footer"><a class="resume__open" target="_blank" rel="noopener"></a></p>
  `;
  frame.inner.querySelector('#resume-title').textContent = posterTitle;
  doc = frame.inner.querySelector('.resume__doc');
  doc.title = posterTitle;
  const link = frame.inner.querySelector('.resume__open');
  link.href = assetUrl(file);
  link.textContent = openLabel;

  return {
    open: frame.open,
    close: frame.close,
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
