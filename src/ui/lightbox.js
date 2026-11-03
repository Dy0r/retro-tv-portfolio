import site from '../content/site.json';
import { createFramedDialog } from './framedDialog.js';

// The image enlarger: shows one image big, in the same framed pop-up as the
// resume. X, Esc or a click outside closes it and returns focus to the image
// you clicked. It opens on top of the case study, which stays open underneath.

export function createLightbox() {
  const frame = createFramedDialog({
    className: 'lightbox',
    closeLabel: site.caseStudy.imageCloseLabel,
    onClosed: () => {
      img.removeAttribute('src');
    },
  });
  frame.inner.innerHTML = '<img class="lightbox__img" alt="" /><p class="lightbox__caption"></p>';
  const img = frame.inner.querySelector('.lightbox__img');
  const caption = frame.inner.querySelector('.lightbox__caption');

  return {
    // media: { src (already resolved), alt, caption? }
    open(media) {
      img.src = media.src;
      img.alt = media.alt ?? '';
      caption.textContent = media.caption ?? '';
      caption.hidden = !media.caption;
      frame.dialog.setAttribute('aria-label', media.alt ?? '');
      frame.open();
    },
    close: frame.close,
  };
}
