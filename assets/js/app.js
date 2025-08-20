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

// ===== Modal helpers =====
const modal = document.getElementById('spot-modal');
const modalTitle = document.getElementById('modal-title');
const modalImg = document.getElementById('modal-image');
const modalStatus = document.getElementById('modal-status');
const modalLangButtons = document.getElementById('modal-lang-buttons');

// Reuse your existing "play audio" function if you have one,
// or keep this simple handler that expects data attributes.
function playAudioFor(lang, title) {
  // Example: build a path like assets/audio/turkey/istanbul/<lang>.mp3
  // If you already set src elsewhere, keep your implementation.
  // This is just a fallback to avoid breaking anything.
  if (!audio) return;
  // Update status text (modal)
  if (modalStatus) modalStatus.textContent = `Playing ${lang} for ${title}…`;
  audio.play().catch(() => {});
}

function openModal({ title, img }) {
  if (modalTitle) modalTitle.textContent = title || '';
  if (modalImg)   modalImg.src = img || '';
  modal.hidden = false;
  document.body.style.overflow = 'hidden'; // prevent background scroll
  // Reset button states in modal
  modalLangButtons?.querySelectorAll('.lang-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
  if (modalStatus) modalStatus.textContent = '';
}

// Clicks on cards -> open modal
const gridEl = document.getElementById('image-grid');
if (gridEl) {
  gridEl.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const title = card.querySelector('.title')?.textContent?.trim() || card.getAttribute('data-title') || 'Spot';
    const img = card.querySelector('img')?.src || card.getAttribute('data-img') || '';
    openModal({ title, img });
  });
}

// Modal audio buttons
if (modalLangButtons) {
  modalLangButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-btn');
    if (!btn) return;
    const lang = btn.dataset.lang;
    const title = modalTitle?.textContent || 'Spot';
    // toggle pressed UI
    modalLangButtons.querySelectorAll('.lang-btn').forEach(b => b.setAttribute('aria-pressed','false'));
    btn.setAttribute('aria-pressed','true');
    playAudioFor(lang, title);
  });
}

// Close modal (backdrop or ✕)
if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target.dataset.close === 'true') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (!modal.hidden && e.key === 'Escape') closeModal();
  });
}

// (optional) auto-init if JS loads after DOM
document.addEventListener("DOMContentLoaded", () => {/* no-op */});
