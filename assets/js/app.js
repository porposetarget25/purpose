// --- Simple data-driven config (Turkey/Istanbul sample) ---
const CITY_CONFIG = {
  city: "Istanbul, Turkey",
  images: [
    {
      title: "Hagia Sophia",
      src: "assets/images/turkey/istanbul/hagia-sophia.jpg",
      audio: {
        English: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Hindi:   "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Chinese: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
      }
    },
    {
      title: "Galata Tower",
      src: "assets/images/turkey/istanbul/galata-tower.jpg",
      audio: {
        English: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Hindi:   "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Chinese: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
      }
    },
    {
      title: "Grand Bazaar",
      src: "assets/images/turkey/istanbul/grand-bazaar.jpg",
      audio: {
        English: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Hindi:   "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Chinese: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
      }
    },
    {
      title: "Bosphorous Bridge",
      src: "assets/images/turkey/istanbul/bosphorus-bridge.jpg",
      audio: {
        English: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Hindi:   "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Chinese: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
      }
    }
  ]
};

// --- DOM refs ---
const mainBtn = document.getElementById("main-play-button");
const gallery = document.getElementById("gallery");
const grid = document.getElementById("image-grid");
const preview = document.getElementById("preview");
const statusEl = document.getElementById("status");
const audio = document.getElementById("audio-player");
const langButtons = document.querySelectorAll(".lang-btn");

let currentCard = null;     // currently selected image card
let currentLangBtn = null;  // currently pressed language button

// --- helpers ---
const setStatus = (txt = "") => { statusEl.textContent = txt; };
const setIconPlay = (svg) => { svg.innerHTML = '<path d="M8 5v14l11-7z"/>'; };
const setIconPause = (svg) => { svg.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'; };

function resetLangButtons() {
  langButtons.forEach(btn => {
    btn.setAttribute("aria-pressed", "false");
    setIconPlay(btn.querySelector("svg.icon"));
  });
  currentLangBtn = null;
}

function getAudioSrcFor(lang) {
  if (!currentCard) return null;
  const idx = Number(currentCard.dataset.index);
  return CITY_CONFIG.images[idx].audio[lang] || null;
}

function selectCard(cardEl) {
  currentCard = cardEl;
  const idx = Number(cardEl.dataset.index);
  const item = CITY_CONFIG.images[idx];
  preview.src = item.src;
  preview.alt = item.title;
  setStatus(item.title);
  resetLangButtons();
  audio.pause();
  audio.removeAttribute("src");
}

// --- build 4-card grid ---
function buildGrid() {
  CITY_CONFIG.images.slice(0, 4).forEach((item, i) => {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;
    card.dataset.index = i;

    const img = document.createElement("img");
    img.src = item.src;
    img.alt = item.title;
    img.loading = "lazy";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = item.title;

    card.appendChild(img);
    card.appendChild(title);

    // click/keyboard select
    const select = () => selectCard(card);
    card.addEventListener("click", select);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select();
      }
    });

    grid.appendChild(card);
  });

  // Select first by default
  const firstCard = grid.querySelector(".card");
  if (firstCard) selectCard(firstCard);
}

// --- lang button logic ---
langButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (!currentCard) return;

    const lang = btn.dataset.lang;
    const src = getAudioSrcFor(lang);
    if (!src) {
      setStatus(`Audio not available for ${lang}`);
      return;
    }

    const icon = btn.querySelector("svg.icon");

    // same button toggles pause/resume
    if (currentLangBtn === btn) {
      if (!audio.paused) {
        audio.pause();
        setIconPlay(icon);
        btn.setAttribute("aria-pressed", "false");
        setStatus("Paused");
      } else {
        audio.play().then(() => {
          setIconPause(icon);
          btn.setAttribute("aria-pressed", "true");
          setStatus(`Playing: ${lang}`);
        }).catch(() => setStatus("Unable to play audio."));
      }
      return;
    }

    // switching language/source
    resetLangButtons();
    audio.src = src;
    audio.currentTime = 0;
    audio.play().then(() => {
      setIconPause(icon);
      btn.setAttribute("aria-pressed", "true");
      currentLangBtn = btn;
      const idx = Number(currentCard.dataset.index);
      setStatus(`Playing: ${CITY_CONFIG.images[idx].title} (${lang})`);
    }).catch(() => setStatus("Unable to play audio."));
  });
});

// --- audio state events ---
audio.addEventListener("ended", () => {
  if (currentLangBtn) {
    setIconPlay(currentLangBtn.querySelector("svg.icon"));
    currentLangBtn.setAttribute("aria-pressed", "false");
    currentLangBtn = null;
  }
  setStatus("Playback finished");
});

audio.addEventListener("pause", () => {
  if (!audio.ended && currentLangBtn) {
    setIconPlay(currentLangBtn.querySelector("svg.icon"));
    currentLangBtn.setAttribute("aria-pressed", "false");
    setStatus("Paused");
  }
});

// --- main button reveal ---
mainBtn.addEventListener("click", () => {
  mainBtn.setAttribute("aria-expanded", "true");
  mainBtn.style.display = "none";
  gallery.hidden = false;
  buildGrid();
});

// (optional) auto-init if JS loads after DOM
document.addEventListener("DOMContentLoaded", () => {/* no-op */});
