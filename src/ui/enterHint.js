import site from '../content/site.json';

// The "scroll to enter" signifier on the opening room shot. It's a real button,
// so keyboard and screen-reader users can use it too. Desktop shows a small mouse
// with a scrolling dot; touch screens show a pulsing upward chevron.

const isTouch = window.matchMedia('(pointer: coarse)').matches;

export function createEnterHint({ onActivate }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'enter-hint';
  button.inert = true;

  const icon = document.createElement('span');
  icon.className = isTouch ? 'enter-hint__chevron' : 'enter-hint__mouse';
  icon.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.className = 'enter-hint__label';
  label.textContent = isTouch ? site.pressStartTouch : site.pressStart;

  button.append(icon, label);
  button.addEventListener('click', onActivate);
  document.body.appendChild(button);

  return {
    show() {
      button.inert = false;
      button.classList.add('is-visible');
    },
    hide() {
      button.inert = true;
      button.classList.remove('is-visible');
    },
  };
}
