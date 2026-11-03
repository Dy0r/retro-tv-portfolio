import site from '../content/site.json';
import playlist from '../content/playlist.json';

// Music player, bottom-left: a pixel-styled shell around Spotify's official embed
// (the only way Spotify allows its music on websites). Nothing loads or plays until
// someone clicks it; then it starts on a random song from the playlist, and the
// shuffle button jumps to another random one. When a song ends it moves on to a
// new random song.
// Visitors logged into Spotify in the same browser hear full songs; everyone else
// hears Spotify's 30-second previews. The track list comes from
// src/content/playlist.json (update it with: node scripts/sync-playlist.mjs).
// A small "click to play" signifier sits above it until the first play.

const API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
const EMBED_HEIGHT = 80;
const END_MARGIN_MS = 400; // treat a song as finished this close to its end

function icon(rows) {
  const rects = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') rects.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
  });
  return `<svg viewBox="0 0 9 9" width="18" height="18" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${rects.join('')}</svg>`;
}

const ICONS = {
  note: icon(['   ######', '   ######', '   #    #', '   #    #', '   #    #', ' ###  ###', '#### ####', '#### ####', ' ##   ## ']),
  play: icon(['  #      ', '  ##     ', '  ###    ', '  ####   ', '  #####  ', '  ####   ', '  ###    ', '  ##     ', '  #      ']),
  pause: icon(['         ', ' ##   ## ', ' ##   ## ', ' ##   ## ', ' ##   ## ', ' ##   ## ', ' ##   ## ', ' ##   ## ', '         ']),
  shuffle: icon(['      #  ', '##   ### ', '  # # #  ', '   #     ', '   #     ', '  # # #  ', '##   ### ', '      #  ', '         ']),
  down: icon(['         ', '         ', '#       #', ' #     # ', '  #   #  ', '   # #   ', '    #    ', '         ', '         ']),
  up: icon(['         ', '         ', '    #    ', '   # #   ', '  #   #  ', ' #     # ', '#       #', '         ', '         ']),
};

let apiPromise = null;
function loadSpotifyApi() {
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      window.onSpotifyIframeApiReady = resolve;
      const script = document.createElement('script');
      script.src = API_SRC;
      script.async = true;
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

export function createMusicPlayer() {
  const labels = site.music;
  const tracks = playlist.tracks;

  const root = document.createElement('section');
  root.className = 'music';
  root.dataset.ui = ''; // clicks here don't count as "switch on" in the opening shot
  root.setAttribute('aria-label', labels.regionLabel);
  root.innerHTML = `
    <p class="music__hint" aria-hidden="true"><span></span>${ICONS.down}</p>
    <div class="music__bar">
      <button class="music__play" type="button"><span class="music__icon">${ICONS.note}</span><span class="music__label"></span></button>
      <p class="music__now" aria-live="polite"></p>
      <button class="music__next" type="button" hidden>${ICONS.shuffle}</button>
      <button class="music__fold" type="button" hidden aria-expanded="true">${ICONS.down}</button>
    </div>
    <div class="music__embed" hidden><div></div></div>
  `;
  const $ = (s) => root.querySelector(s);
  const hint = $('.music__hint');
  const playButton = $('.music__play');
  const iconSlot = $('.music__icon');
  const label = $('.music__label');
  const now = $('.music__now');
  const nextButton = $('.music__next');
  const foldButton = $('.music__fold');
  const embed = $('.music__embed');

  hint.querySelector('span').textContent = labels.hint;
  label.textContent = labels.buttonLabel;
  playButton.setAttribute('aria-label', labels.playLabel);
  nextButton.setAttribute('aria-label', labels.nextLabel);
  foldButton.setAttribute('aria-label', labels.closeLabel);
  document.body.appendChild(root);

  let controller = null;
  let starting = false;
  let current = -1;
  let paused = true;
  let advancing = false;

  function randomTrack() {
    if (tracks.length < 2) return 0;
    let i = current;
    while (i === current) i = Math.floor(Math.random() * tracks.length);
    return i;
  }

  function showTrack(i) {
    current = i;
    const t = tracks[i];
    now.textContent = `${t.title} — ${t.artist}`;
  }

  function setPaused(value) {
    paused = value;
    iconSlot.innerHTML = paused ? ICONS.play : ICONS.pause;
    playButton.setAttribute('aria-label', paused ? labels.playLabel : labels.pauseLabel);
    playButton.setAttribute('aria-pressed', String(!paused));
  }

  function playTrack(i) {
    showTrack(i);
    advancing = false;
    controller.loadUri(tracks[i].uri);
    controller.play();
  }

  async function start() {
    starting = true;
    hint.hidden = true;
    root.classList.add('is-started');
    embed.hidden = false;
    nextButton.hidden = false;
    foldButton.hidden = false;
    const i = randomTrack();
    showTrack(i);
    const api = await loadSpotifyApi();
    api.createController(
      embed.firstElementChild,
      { uri: tracks[i].uri, width: '100%', height: EMBED_HEIGHT },
      (ctrl) => {
        controller = ctrl;
        starting = false;
        ctrl.addListener('ready', () => ctrl.play());
        ctrl.addListener('playback_update', (e) => {
          const { isPaused, position, duration } = e.data;
          setPaused(isPaused);
          // Song finished: move on to another random one.
          if (!advancing && duration > 0 && position >= duration - END_MARGIN_MS) {
            advancing = true;
            playTrack(randomTrack());
          }
        });
      },
    );
  }

  playButton.addEventListener('click', () => {
    if (!controller) {
      if (!starting) start();
      return;
    }
    controller.togglePlay();
  });

  nextButton.addEventListener('click', () => {
    if (controller) playTrack(randomTrack());
  });

  // Fold the Spotify embed away (the music keeps playing) or bring it back.
  foldButton.addEventListener('click', () => {
    const open = embed.hidden;
    embed.hidden = !open;
    foldButton.setAttribute('aria-expanded', String(open));
    foldButton.innerHTML = open ? ICONS.down : ICONS.up;
  });

  setPaused(true);
  iconSlot.innerHTML = ICONS.note;

  return {
    // Hidden while the loading screen is up.
    setVisible(on) {
      root.classList.toggle('is-visible', on);
      root.inert = !on;
    },
  };
}
