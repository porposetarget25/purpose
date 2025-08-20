// --- Simple data-driven config (Turkey/Istanbul sample) ---
const CITY_CONFIG = {
  city: "Istanbul, Turkey",
  images: [
    {
      title: "Hagia Sophia",
      src: "assets/images/turkey/istanbul/hagiaSophia/1.jpg",
      // rolling gallery in the modal:
      gallery: [
        "assets/images/turkey/istanbul/hagiaSophia/1.jpg",
        "assets/images/turkey/istanbul/hagiaSophia/2.jpg",
        "assets/images/turkey/istanbul/hagiaSophia/3.jpg",
        "assets/images/turkey/istanbul/hagiaSophia/4.jpg"
      ],
      audio: {
        English: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Hindi:   "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Chinese: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
      }
    },
    {
      title: "Galata Tower",
      src: "assets/images/turkey/istanbul/galataTower/1.jpg",
      gallery: [
              "assets/images/turkey/istanbul/galataTower/1.jpg",
              "assets/images/turkey/istanbul/galataTower/2.jpg",
              "assets/images/turkey/istanbul/galataTower/3.jpg",
              "assets/images/turkey/istanbul/galataTower/4.jpg"
            ],
      audio: {
        English: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Hindi:   "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Chinese: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
      }
    },
    {
      title: "Grand Bazaar",
      src: "assets/images/turkey/istanbul/grandBazaar/1.jpg",
      gallery: [
                "assets/images/turkey/istanbul/grandBazaar/1.jpg",
                "assets/images/turkey/istanbul/grandBazaar/2.jpg",
                "assets/images/turkey/istanbul/grandBazaar/3.jpg",
                "assets/images/turkey/istanbul/grandBazaar/4.jpg"
                ],
      audio: {
        English: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Hindi:   "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Chinese: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
      }
    },
    {
      title: "Bosphorous Bridge",
      src: "assets/images/turkey/istanbul/bosphorousBridge/1.jpg",
      gallery: [
                  "assets/images/turkey/istanbul/bosphorousBridge/1.jpg",
                  "assets/images/turkey/istanbul/bosphorousBridge/2.jpg",
                  "assets/images/turkey/istanbul/bosphorousBridge/3.jpg",
                  "assets/images/turkey/istanbul/bosphorousBridge/4.jpg"
                ],
      audio: {
        English: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Hindi:   "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
        Chinese: "assets/audio/turkey/istanbul/English_London_Bridge.mp3",
      }
    }
  ]
};

// --- DOM refs (declare ONCE) ---
const mainBtn    = document.getElementById("main-play-button");
const gallery    = document.getElementById("gallery");
const grid       = document.getElementById("image-grid");
const preview    = document.getElementById("preview");
const statusEl   = document.getElementById("status");
const audio      = document.getElementById("audio-player");
const langButtons= document.querySelectorAll(".lang-btn");

// Modal + carousel refs (these exist in istanbulDetails.html)
const modal           = document.getElementById('spot-modal');
const modalTitle      = document.getElementById('modal-title');
const modalStatus     = document.getElementById('modal-status');
const modalLangBtns   = document.getElementById('modal-lang-buttons');
const carousel        = document.getElementById('carousel');
const track           = document.getElementById('carousel-track');
const dotsWrap        = document.getElementById('carousel-dots');

let currentCard     = null;      // currently selected image card (grid)
let currentLangBtn  = null;      // currently pressed bottom language button

// For modal carousel:
let currentModalItem = null;     // the spot item opened in modal
let carouselTimer    = null;
let carouselIndex    = 0;
let carouselImages   = [];

// --- helpers ---
const setStatus     = (txt = "") => { if (statusEl) statusEl.textContent = txt; };
const setIconPlay   = (svg) => { if (svg) svg.innerHTML = '<path d="M8 5v14l11-7z"/>'; };
const setIconPause  = (svg) => { if (svg) svg.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'; };

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
  return CITY_CONFIG.images[idx].audio?.[lang] || null;
}

function selectCard(cardEl) {
  currentCard = cardEl;
  const idx   = Number(cardEl.dataset.index);
  const item  = CITY_CONFIG.images[idx];
  if (preview) {
    preview.src = item.src;
    preview.alt = item.title;
  }
  setStatus(item.title);
  resetLangButtons();
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
  }
}

// --- build 4-card grid ---
function buildGrid() {
  if (!grid) return;
  grid.innerHTML = "";
  CITY_CONFIG.images.slice(0, 4).forEach((item, i) => {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex  = 0;
    card.dataset.index = i;

    const img = document.createElement("img");
    img.src   = item.src;
    img.alt   = item.title;
    img.loading = "lazy";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = item.title;

    card.appendChild(img);
    card.appendChild(title);

    // click/keyboard select (for bottom preview flow)
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

// --- bottom (page) lang button logic ---
langButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (!audio) return;
    if (!currentCard) return;

    const lang = btn.dataset.lang;
    const src  = getAudioSrcFor(lang);
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
if (audio) {
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
}

// --- main button reveal (landing-style behavior) ---
if (mainBtn) {
  mainBtn.addEventListener("click", () => {
    mainBtn.setAttribute("aria-expanded", "true");
    mainBtn.style.display = "none";
    if (gallery) gallery.hidden = false;
    buildGrid();
  });
} else {
  // If there's no main button (e.g., direct details page), auto-build the grid
  if (gallery && grid && grid.children.length === 0) {
    gallery.hidden = false;
    buildGrid();
  }
}

/* ===============================
   MODAL + CAROUSEL IMPLEMENTATION
   =============================== */

// Build carousel slides + dots from an array of image URLs
function buildCarousel(images) {
  if (!track || !dotsWrap) return;

  // reset
  track.innerHTML = '';
  dotsWrap.innerHTML = '';
  carouselIndex = 0;
  carouselImages = Array.isArray(images) && images.length ? images : [];

  if (carouselImages.length === 0) {
    const slide = document.createElement('div');
    slide.className = 'carousel__slide';
    slide.innerHTML = '<div style="color:#fff;padding:30px">No images available</div>';
    track.appendChild(slide);
    return;
  }

  // slides
  carouselImages.forEach((src, i) => {
    const slide = document.createElement('div');
    slide.className = 'carousel__slide';
    const img = document.createElement('img');
    img.src = src;
    img.alt = (modalTitle?.textContent || `Photo ${i+1}`);
    slide.appendChild(img);
    track.appendChild(slide);

    // dot
    const dot = document.createElement('button');
    dot.className = 'carousel__dot' + (i === 0 ? ' is-active' : '');
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  });

  updateTransform();
  startAuto();
}

function updateDots() {
  dotsWrap.querySelectorAll('.carousel__dot').forEach((d, i) => {
    d.classList.toggle('is-active', i === carouselIndex);
  });
}

function updateTransform() {
  if (!track) return;
  const offset = -carouselIndex * 100;
  track.style.transform = `translateX(${offset}%)`;
  updateDots();
}

function next() {
  if (!carouselImages.length) return;
  carouselIndex = (carouselIndex + 1) % carouselImages.length;
  updateTransform();
}
function prev() {
  if (!carouselImages.length) return;
  carouselIndex = (carouselIndex - 1 + carouselImages.length) % carouselImages.length;
  updateTransform();
}
function goTo(i) {
  if (!carouselImages.length) return;
  carouselIndex = i % carouselImages.length;
  updateTransform();
}

function startAuto() {
  stopAuto();
  if (carouselImages.length > 1) {
    carouselTimer = setInterval(next, 3500);
  }
}
function stopAuto() {
  if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }
}

// nav buttons
carousel?.querySelector('[data-next]')?.addEventListener('click', () => { next(); startAuto(); });
carousel?.querySelector('[data-prev]')?.addEventListener('click', () => { prev(); startAuto(); });

// pause on hover (desktop)
carousel?.addEventListener('mouseenter', stopAuto);
carousel?.addEventListener('mouseleave', startAuto);

// swipe (mobile)
let startX = null;
track?.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; stopAuto(); }, { passive:true });
track?.addEventListener('touchend',   (e) => {
  if (startX == null) return;
  const dx = e.changedTouches[0].clientX - startX;
  if (Math.abs(dx) > 40) (dx < 0 ? next() : prev());
  startX = null; startAuto();
});

// Open modal for a given spot item
function openSpotModal(item) {
  currentModalItem = item;
  if (!modal) return;

  if (modalTitle) modalTitle.textContent = item.title || 'Spot';

  // Build carousel from item.gallery or fallback to single src
  const imgs = Array.isArray(item.gallery) && item.gallery.length ? item.gallery : [item.src];
  buildCarousel(imgs);

  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  // Reset modal audio UI
  modalLangBtns?.querySelectorAll('.lang-btn').forEach(b => b.setAttribute('aria-pressed','false'));
  if (modalStatus) modalStatus.textContent = '';
}

// Close modal
function closeModal() {
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  stopAuto();
  if (modalStatus) modalStatus.textContent = '';
}

// Modal audio buttons (play the clicked language for currentModalItem)
if (modalLangBtns) {
  modalLangBtns.addEventListener('click', (e) => {
    if (!audio || !currentModalItem) return;
    const btn  = e.target.closest('.lang-btn');
    if (!btn) return;
    const lang = btn.dataset.lang;
    const src  = currentModalItem.audio?.[lang];

    if (!src) {
      if (modalStatus) modalStatus.textContent = `No audio for ${lang}`;
      return;
    }

    // Visually toggle
    modalLangBtns.querySelectorAll('.lang-btn').forEach(b => b.setAttribute('aria-pressed','false'));
    btn.setAttribute('aria-pressed','true');

    // Play
    audio.pause();
    audio.src = src;
    audio.currentTime = 0;
    audio.play().then(() => {
      if (modalStatus) modalStatus.textContent = `Playing: ${currentModalItem.title} (${lang})`;
    }).catch(() => {
      if (modalStatus) modalStatus.textContent = `Unable to play audio.`;
    });
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

// GRID -> open modal on click (use dataset.index to find the item)
if (grid) {
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const idx  = Number(card.dataset.index);
    const item = CITY_CONFIG.images[idx];
    if (item) openSpotModal(item);
  });
}

// If the page loads without the main button (details page), ensure grid exists
document.addEventListener("DOMContentLoaded", () => {
  if (!mainBtn && gallery && grid && grid.children.length === 0) {
    gallery.hidden = false;
    buildGrid();
  }
});
