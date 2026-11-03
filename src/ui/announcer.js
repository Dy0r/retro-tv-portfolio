// A screen-reader-only live region. Whatever is announced gets read out politely,
// e.g. the project now selected on the TV.

export function createAnnouncer() {
  const region = document.createElement('div');
  region.className = 'sr-only';
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.appendChild(region);

  return {
    announce(text) {
      region.textContent = text;
    },
  };
}
