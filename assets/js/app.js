/* =========================================================
   City Config Bootstrap (reusable JS for any city page)
   - If <body data-config="...json"> is present → fetch JSON
   - If fetch fails and data-config exists → show warning, no fallback
   - Else fallback to hardcoded Istanbul config
   - Then init the app with the final CITY_CONFIG
   ========================================================= */

(async function bootstrapCityConfig() {
  const hasDataConfig = !!document.body?.dataset?.config;

  // If already defined elsewhere, use it.
  if (typeof window.CITY_CONFIG !== "undefined" && window.CITY_CONFIG) {
    initApp();
    return;
  }

  // Try to load from data-config if present.
  if (hasDataConfig) {
    try {
      const url = document.body.dataset.config;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
      window.CITY_CONFIG = await res.json();
      initApp();
      return;
    } catch (err) {
      console.error("Failed to load city config from data-config:", err);
      // Friendly message (no silent fallback to Istanbul if data-config exists)
      const gallery = document.getElementById("gallery");
      if (gallery) {
        gallery.hidden = false;
        gallery.innerHTML = `
          <div style="padding:16px; background:#fff3cd; border:1px solid #ffeeba; border-radius:12px;">
            Could not load city data from <code>${document.body.dataset.config}</code>.<br/>
            Please check the path and serve via http(s).
          </div>`;
      }
      return;
    }
  }

  // No data-config → fallback for local dev.
  window.CITY_CONFIG = {
    city: "Istanbul, Turkey",
    images: [
      {
        title: "Hagia Sophia",
        src: "assets/images/turkey/istanbul/hagiaSophia/1.jpg",
        gallery: [
          "assets/images/turkey/istanbul/hagiaSophia/1.jpg",
          "assets/images/turkey/istanbul/hagiaSophia/2.jpg",
          "assets/images/turkey/istanbul/hagiaSophia/3.jpg",
          "assets/images/turkey/istanbul/hagiaSophia/4.jpg"
        ],
        audio: {
          English: "assets/audio/turkey/istanbul/hagia-sophia.mp3",
          Hindi:   "assets/audio/turkey/istanbul/hagia-sophia.mp3",
          Chinese: "assets/audio/turkey/istanbul/hagia-sophia.mp3"
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
          English: "assets/audio/turkey/istanbul/hagia-sophia.mp3",
          Hindi:   "assets/audio/turkey/istanbul/hagia-sophia.mp3",
          Chinese: "assets/audio/turkey/istanbul/hagia-sophia.mp3"
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
          English: "assets/audio/turkey/istanbul/hagia-sophia.mp3",
          Hindi:   "assets/audio/turkey/istanbul/hagia-sophia.mp3",
          Chinese: "assets/audio/turkey/istanbul/hagia-sophia.mp3"
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
          English: "assets/audio/turkey/istanbul/hagia-sophia.mp3",
          Hindi:   "assets/audio/turkey/istanbul/hagia-sophia.mp3",
          Chinese: "assets/audio/turkey/istanbul/hagia-sophia.mp3"
        }
      }
    ]
  };

  initApp();
})();

/* =========================================================
   Main App (uses window.CITY_CONFIG loaded above)
   ========================================================= */
function initApp() {
  const CITY = window.CITY_CONFIG;
  if (!CITY || !CITY.images || !CITY.images.length) {
    console.warn("CITY_CONFIG is empty; page will remain inert.");
    return;
  }

  // --- DOM refs (declare ONCE) ---
  const mainBtn     = document.getElementById("main-play-button");
  const gallery     = document.getElementById("gallery");
  const grid        = document.getElementById("image-grid");
  const preview     = document.getElementById("preview");
  const statusEl    = document.getElementById("status");
  const audio       = document.getElementById("audio-player");
  const langButtons = document.querySelectorAll(".lang-btn");

  // Optional page loader (add #page-loader in HTML to use)
  const pageLoader = document.getElementById("page-loader");
  const showLoader = (msg = "Loading…") => {
    if (pageLoader) {
      pageLoader.hidden = false;
      pageLoader.querySelector(".loader__text")?.replaceChildren(document.createTextNode(msg));
    }
  };
  const hideLoader = () => { if (pageLoader) pageLoader.hidden = true; };

  // Page-level STOP (optional, may not exist on every page)
  const pageStopBtn = document.getElementById("page-stop-btn");

  // Modal + carousel refs
  const modal           = document.getElementById('spot-modal');
  const modalTitle      = document.getElementById('modal-title');
  const modalStatus     = document.getElementById('modal-status');
  const modalLangBtns   = document.getElementById('modal-lang-buttons');
  const modalStopBtn    = document.getElementById('modal-stop-btn');
  const carousel        = document.getElementById('carousel');
  const track           = document.getElementById('carousel-track');
  const dotsWrap        = document.getElementById('carousel-dots');
  // ✅ NEW: wrapper for Nearby chips
  const nearbyLinksWrap = document.getElementById('nearby-links');

  let currentCard            = null;   // selected image card (grid)
  let currentLangBtn         = null;   // active bottom language button
  let currentModalItem       = null;   // spot item opened in modal
  let currentModalLangBtn    = null;   // active modal language button

  // For modal carousel:
  let carouselTimer = null;
  let carouselIndex = 0;
  let carouselImages = [];

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

  function resetModalButtons() {
    if (!modalLangBtns) return;
    modalLangBtns.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.remove("is-active");
      b.setAttribute("aria-pressed", "false");
      const ic = b.querySelector("svg.icon");
      setIconPlay(ic);
    });
    currentModalLangBtn = null;
    if (modalStatus) modalStatus.textContent = '';
  }

  // Smoothly scroll an element into view on small screens (keeps topbar height in mind)
  function scrollIntoViewIfMobile(el) {
    if (!el) return;
    if (window.matchMedia("(max-width: 900px)").matches) {
      const topbar = document.querySelector(".topbar");
      const offset = topbar ? topbar.offsetHeight + 8 : 0;
      const y = el.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

function countryCodeToFlagEmoji(cc) {
  return cc.toUpperCase()
    .replace(/./g, char =>
      String.fromCodePoint(127397 + char.charCodeAt())
    );
}


  function getAudioSrcFor(lang) {
    if (!currentCard) return null;
    const idx = Number(currentCard.dataset.index);
    return CITY.images[idx].audio?.[lang] || null;
  }

  function selectCard(cardEl) {
    currentCard = cardEl;
    const idx   = Number(cardEl.dataset.index);
    const item  = CITY.images[idx];

    // highlight selected card
    grid?.querySelectorAll('.card').forEach(c => c.classList.remove('is-selected'));
    cardEl.classList.add('is-selected');

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

  // image preloader
  async function preload(src) {
    await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res();
      img.onerror = rej;
      img.src = src;
    });
  }

  // --- build 4-card grid (animated) ---
  async function buildGrid() {
    if (!grid) return;
    grid.innerHTML = "";

    // Preload first preview image to avoid pop-in
    const first = CITY.images[0];
    if (first?.src) { try { await preload(first.src); } catch {} }

    CITY.images.slice(0, 4).forEach((item, i) => {
      const card = document.createElement("article");
      card.className = "card fade-up";
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

    // Animate cards in
    requestAnimationFrame(() => {
      grid.querySelectorAll('.fade-up').forEach((el, idx) => {
        el.style.setProperty('--stagger', `${idx * 40}ms`);
        el.classList.add('is-in');
      });
    });

    const firstCard = grid.querySelector(".card");
    if (firstCard) selectCard(firstCard);
  }

  // --- bottom (page) lang button logic ---
  langButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      if (!audio || !currentCard) return;

      const lang = btn.dataset.lang;
      const src  = getAudioSrcFor(lang);
      if (!src) { setStatus(`Audio not available for ${lang}`); return; }

      const icon = btn.querySelector("svg.icon");

      // toggle if same button
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
        setStatus(`Playing: ${CITY.images[idx].title} (${lang})`);
      }).catch(() => setStatus("Unable to play audio."));
    });
  });

  // Page-level STOP (optional presence)
  if (pageStopBtn) {
    pageStopBtn.addEventListener("click", () => {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      resetLangButtons();
      setStatus("Stopped");
    });
  }

  // --- audio state events (apply to both bottom + modal UIs) ---
  if (audio) {
    audio.addEventListener("ended", () => {
      if (currentLangBtn) {
        setIconPlay(currentLangBtn.querySelector("svg.icon"));
        currentLangBtn.setAttribute("aria-pressed", "false");
        currentLangBtn = null;
      }
      resetModalButtons();
      setStatus("Playback finished");
    });

    audio.addEventListener("pause", () => {
      if (!audio.ended) {
        if (currentLangBtn) {
          setIconPlay(currentLangBtn.querySelector("svg.icon"));
          currentLangBtn.setAttribute("aria-pressed", "false");
        }
        if (currentModalLangBtn) {
          const ic = currentModalLangBtn.querySelector("svg.icon");
          setIconPlay(ic);
          currentModalLangBtn.classList.remove("is-active");
          currentModalLangBtn.setAttribute("aria-pressed","false");
          if (modalStatus) modalStatus.textContent = "Paused";
        }
        setStatus("Paused");
      }
    });
  }

  // --- main button reveal (landing-style behavior) ---
 // --- main button reveal ---
 if (mainBtn) {
   mainBtn.addEventListener("click", () => {
     showLoader("Preparing gallery…");
     mainBtn.setAttribute("aria-expanded", "true");
     mainBtn.style.display = "none";
     if (gallery) gallery.hidden = false;
     Promise.resolve(buildGrid())
       .finally(() => {
         hideLoader();
         scrollIntoViewIfMobile(gallery);   // 👈 auto-jump to gallery on mobile
       });
   });
 } else {
   // direct details page
   if (gallery && grid && grid.children.length === 0) {
     showLoader("Loading gallery…");
     gallery.hidden = false;
     Promise.resolve(buildGrid())
       .finally(() => {
         hideLoader();
         scrollIntoViewIfMobile(gallery);   // 👈 auto-jump to gallery on mobile
       });
   }
 }


  /* ===============================
     MODAL + CAROUSEL IMPLEMENTATION
     =============================== */

  function buildCarousel(images) {
    if (!track || !dotsWrap) return;

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

    carouselImages.forEach((src, i) => {
      const slide = document.createElement('div');
      slide.className = 'carousel__slide';
      const img = document.createElement('img');
      img.src = src;
      img.alt = (modalTitle?.textContent || `Photo ${i+1}`);
      slide.appendChild(img);
      track.appendChild(slide);

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

  // Open modal for a given spot item (preload first slide)
  function openSpotModal(item) {
    currentModalItem = item;
    if (!modal) return;

    if (modalTitle) modalTitle.textContent = item.title || 'Spot';
    const imgs = Array.isArray(item.gallery) && item.gallery.length ? item.gallery : [item.src];
    buildCarousel(imgs);

    // Nearby chips (optional)
    buildNearbyLinks(item);

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    resetModalButtons();
    if (modalStatus) modalStatus.textContent = '';
  }

  // Close modal
function closeModal() {
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  stopAuto();
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  resetModalButtons();
  if (nearbyLinksWrap) nearbyLinksWrap.innerHTML = ""; // 👈 clear chips
}



  // --- Modal audio buttons (play/pause toggle like bottom, per-language) ---
  if (modalLangBtns) {
    modalLangBtns.addEventListener('click', (e) => {
      if (!audio || !currentModalItem) return;
      const btn  = e.target.closest('.lang-btn');
      if (!btn) return;

      const lang = btn.dataset.lang;
      const src  = currentModalItem.audio?.[lang];
      const icon = btn.querySelector("svg.icon");
      if (!src) { if (modalStatus) modalStatus.textContent = `No audio for ${lang}`; return; }

      if (currentModalLangBtn === btn) {
        if (!audio.paused) {
          audio.pause();
          setIconPlay(icon);
          btn.classList.remove("is-active");
          btn.setAttribute("aria-pressed","false");
          if (modalStatus) modalStatus.textContent = "Paused";
        } else {
          audio.play().then(() => {
            setIconPause(icon);
            btn.classList.add("is-active");
            btn.setAttribute("aria-pressed","true");
            if (modalStatus) modalStatus.textContent = `Playing: ${currentModalItem.title} (${lang})`;
          }).catch(()=>{ if (modalStatus) modalStatus.textContent = "Unable to play audio."; });
        }
        return;
      }

      resetModalButtons();
      audio.pause();
      audio.src = src;
      audio.currentTime = 0;
      audio.play().then(() => {
        setIconPause(icon);
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed","true");
        currentModalLangBtn = btn;
        if (modalStatus) modalStatus.textContent = `Playing: ${currentModalItem.title} (${lang})`;
      }).catch(()=>{ if (modalStatus) modalStatus.textContent = "Unable to play audio."; });
    });
  }

  // --- Modal STOP button (⏹) ---
  if (modalStopBtn) {
    modalStopBtn.addEventListener('click', () => {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
      resetModalButtons();
      if (modalStatus) modalStatus.textContent = 'Stopped';
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
      const item = CITY.images[idx];
      if (item) openSpotModal(item);
    });
  }

  // Auto-build grid on details page if needed
  document.addEventListener("DOMContentLoaded", () => {
    if (!mainBtn && gallery && grid && grid.children.length === 0) {
      showLoader("Loading gallery…");
      gallery.hidden = false;
      Promise.resolve(buildGrid()).finally(hideLoader);
    }
  });

  // ---------- Nearby links builder ----------
  function buildNearbyLinks(item) {
    if (!nearbyLinksWrap) return;

    const cityName = (window.CITY_CONFIG?.city || "").split(",")[0]?.trim() || "";
    const place = item.placeQuery || `${item.title}${cityName ? " " + cityName : ""}`;
    const qPlace = encodeURIComponent(place);

    const hasCoords =
      item.coords && typeof item.coords.lat === 'number' && typeof item.coords.lng === 'number';
    const at = hasCoords ? `@${item.coords.lat},${item.coords.lng},16z/` : '';

    const categories = [
      { label: "Restaurants",    query: "restaurants" },
      { label: "Cafes",          query: "cafes" },
      { label: "Street food",    query: "street food" },
      { label: "Souvenir shops", query: "souvenir shops" },
      { label: "Pharmacies",     query: "pharmacies" },
      { label: "ATMs",           query: "ATMs" },
      { label: "Shopping",       query: "shopping" },
      { label: "Get directions", query: "directions" }
    ];

    const html = categories.map(cat => {
      if (cat.query === "directions") {
        const href = hasCoords
          ? `https://www.google.com/maps/dir/${at}`
          : `https://www.google.com/maps/dir/?api=1&destination=${qPlace}`;
        return `<a class="chip chip--link" target="_blank" rel="noopener" href="${href}">${cat.label}</a>`;
      }
      const qType = encodeURIComponent(cat.query);
      const href = hasCoords
        ? `https://www.google.com/maps/search/${qType}/${at}`
        : `https://www.google.com/maps/search/${qType}+near+${qPlace}`;
      return `<a class="chip chip--link" target="_blank" rel="noopener" href="${href}">${cat.label}</a>`;
    }).join("");

    nearbyLinksWrap.innerHTML = html;
  }
}
