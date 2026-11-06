(() => {
  'use strict';

  /* ------------------------------------------------------------------
     Config: edit these to add or swap games and studios.
     Live data is fetched through RoProxy (roblox.com APIs block
     browser requests from other sites). The numbers in index.html are
     a snapshot that stays visible if the proxy can't be reached.
     ------------------------------------------------------------------ */
  const USER_ID = 53919328;
  const GAMES = {
    motorush: { universeId: 4867536568 },
    drift: { universeId: 10770249358 },
  };
  const GROUPS = {
    motorush: 32734353,
    titan: 34291085,
  };
  const PROXY = 'roproxy.com';
  const REFRESH_MS = 60_000;
  const SAVED_ON = '5 Nov 2026';

  // Snapshot from 5 Nov 2026, used until live data arrives.
  const state = {
    games: {
      motorush: { visits: 101134348, playing: 99, favorites: 236433, up: 119785, down: 13037 },
      drift: { visits: 12928, playing: 24, favorites: 76, up: 14, down: 9 },
    },
    groups: { motorush: 135468, titan: 32 },
  };

  // A static build (e.g. the shareable copy, where outside requests are
  // blocked) sets window.WAGED_STATIC = { date, state } before this script.
  const STATIC = window.WAGED_STATIC || null;
  if (STATIC?.state) {
    for (const [k, g] of Object.entries(STATIC.state.games ?? {})) Object.assign(state.games[k] ?? {}, g);
    Object.assign(state.groups, STATIC.state.groups ?? {});
  }

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const fmt = new Intl.NumberFormat('en-US');
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const byUniverse = Object.fromEntries(Object.entries(GAMES).map(([k, g]) => [g.universeId, k]));
  const universeIds = Object.values(GAMES).map((g) => g.universeId).join(',');

  /* ---------------- Number formatting ---------------- */

  // 101,134,348 -> "101M+", 12,928 -> "12.9K+", 76 -> "76". Always rounds down.
  function compact(n) {
    const units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (const [size, suffix] of units) {
      if (n >= size) {
        const x = n / size;
        const digits = x < 100 ? 1 : 0;
        const floored = Math.floor(x * 10 ** digits) / 10 ** digits;
        return `${floored.toFixed(digits).replace(/\.0$/, '')}${suffix}+`;
      }
    }
    return fmt.format(Math.floor(n));
  }

  const FORMATS = {
    num: (n) => fmt.format(Math.round(n)),
    compact: (n) => compact(n),
    pct: (n) => `${Math.round(n)}%`,
  };

  const values = {};

  function setStat(key, text, raw, animate) {
    if (raw !== undefined && raw !== null) values[key] = raw;
    for (const el of $$(`[data-stat="${key}"]`)) {
      if (el.dataset.counting !== undefined) continue;   // a count-up is running; it lands on the latest value
      if (el.textContent === text) continue;
      el.textContent = text;
      if (animate && !reduceMotion) {
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
    }
  }

  function render(animate = false) {
    let visits = 0, playing = 0, favorites = 0;

    for (const [key, g] of Object.entries(state.games)) {
      visits += g.visits;
      playing += g.playing;
      favorites += g.favorites;

      setStat(`${key}.visits`, compact(g.visits), g.visits, animate);
      setStat(`${key}.playing`, fmt.format(g.playing), g.playing, animate);

      const votes = g.up + g.down;
      const rating = votes ? Math.round((g.up / votes) * 100) : null;
      setStat(`${key}.rating`, rating === null ? '–' : `${rating}%`, rating, animate);
    }

    setStat('total.visits', compact(visits), visits, animate);
    setStat('total.playing', fmt.format(playing), playing, animate);
    setStat('total.favorites', compact(favorites), favorites, animate);

    for (const [key, n] of Object.entries(state.groups)) {
      setStat(`group.${key}`, fmt.format(n), n, animate);
    }
  }

  /* ---------------- Count-up ---------------- */

  function countUp(el, delay = 0) {
    const key = el.dataset.stat;
    const format = FORMATS[el.dataset.count] ?? FORMATS.num;
    if (values[key] == null || el.dataset.counting !== undefined) return;
    el.dataset.counting = '';
    const start = performance.now() + delay;
    const duration = 1500;
    const ease = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
    el.textContent = format(0);
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      el.textContent = format(values[key] * ease(t));
      if (t < 1) requestAnimationFrame(tick);
      else delete el.dataset.counting;
    };
    requestAnimationFrame(tick);
  }

  /* ---------------- Scroll reveals ---------------- */

  // Rows in a list come in one after another.
  for (const list of $$('.list')) {
    [...list.children].forEach((li, i) => li.style.setProperty('--d', String(Math.min(i, 6))));
  }

  const revealEls = $$('.block__title, .block__sub, .work, .list > li, .foot');
  const contentCounts = $$('.content [data-count]');

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const reveal = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        reveal.unobserve(e.target);
        e.target.classList.add('in');
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach((el) => reveal.observe(el));

    // Numbers count up once they're properly on screen.
    const counter = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        counter.unobserve(e.target);
        countUp(e.target, 150);
      }
    }, { threshold: 1 });
    contentCounts.forEach((el) => counter.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }
  root.classList.add('js-ready');

  /* ---------------- Screenshots: story bars, slow drift, tilt ---------------- */

  for (const media of $$('.work__media')) {
    const slides = $$('.slides img', media);
    if (slides.length < 2) continue;

    const bars = document.createElement('span');
    bars.className = 'bars';
    bars.setAttribute('aria-hidden', 'true');
    const segs = slides.map(() => bars.appendChild(document.createElement('i')));
    media.append(bars);

    let i = 0;
    const show = (n) => {
      slides[i].classList.remove('is-on');
      i = n;
      slides[i].classList.add('is-on');
      segs.forEach((s, j) => {
        s.classList.toggle('done', j < i || (reduceMotion && j === i));
        s.classList.remove('run');
      });
      if (!reduceMotion) {
        void segs[i].offsetWidth;
        segs[i].classList.add('run');
      }
    };
    // When the current bar fills up, move to the next screenshot (hovering pauses the bar).
    segs.forEach((s) => s.addEventListener('animationend', () => show((i + 1) % slides.length)));
    show(0);
  }

  if (finePointer && !reduceMotion) {
    for (const media of $$('.work__media')) {
      let frame = 0;
      media.addEventListener('pointermove', (e) => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const r = media.getBoundingClientRect();
          media.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
          media.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
        });
      });
      media.addEventListener('pointerleave', () => {
        cancelAnimationFrame(frame);
        media.style.setProperty('--px', '0');
        media.style.setProperty('--py', '0');
      });
    }

    /* Social buttons lean toward the cursor */
    for (const el of $$('.social')) {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.translate = `${(x * 0.3).toFixed(1)}px ${(y * 0.4).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    }
  }

  /* ---------------- Menu underline + scroll progress ---------------- */

  const menuLinks = $$('.menu a, .mbar__links a');
  const sections = [...new Set(menuLinks.map((a) => a.hash.slice(1)))]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const progress = $('.progress');
  let lockUntil = 0;   // after a click, keep that link underlined while the page scrolls there

  function setActive(id) {
    for (const a of menuLinks) {
      if (id && a.hash === `#${id}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  }

  // The current section is the last one whose top has passed 40% of the way down the screen.
  // At the very bottom of the page it's always the last section.
  function updateActive() {
    if (performance.now() < lockUntil) return;
    const line = window.innerHeight * 0.4;
    let current = null;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s.id;
    const atBottom = window.innerHeight + window.scrollY >= root.scrollHeight - 2;
    if (atBottom && sections.length) current = sections[sections.length - 1].id;
    setActive(current);
  }

  function updateProgress() {
    if (!progress) return;
    const max = root.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0})`;
  }

  let scrollFrame = 0;
  const onScroll = () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      updateActive();
      updateProgress();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  for (const a of menuLinks) {
    a.addEventListener('click', () => {
      setActive(a.hash.slice(1));
      lockUntil = performance.now() + 1500;
    });
  }
  // Any scrolling the visitor does themselves takes over from the click.
  const unlock = () => { lockUntil = 0; };
  window.addEventListener('scrollend', unlock);
  for (const type of ['wheel', 'touchstart', 'keydown']) window.addEventListener(type, unlock, { passive: true });

  updateActive();
  updateProgress();

  /* ---------------- Live data ---------------- */

  async function getJSON(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  const stampEl = document.getElementById('stamp');
  let lastLive = null;

  function updateStamp() {
    if (!stampEl) return;
    if (lastLive) {
      const time = lastLive.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      stampEl.textContent = `Numbers live from Roblox, updated ${time}.`;
    } else {
      stampEl.textContent = `Numbers saved on ${SAVED_ON}, from Roblox.`;
    }
  }

  async function refreshStats() {
    const [info, votes, groups] = await Promise.allSettled([
      getJSON(`https://games.${PROXY}/v1/games?universeIds=${universeIds}`),
      // The batched votes endpoint is blocked on RoProxy, so ask per game.
      Promise.all(Object.values(GAMES).map((g) => getJSON(`https://games.${PROXY}/v1/games/${g.universeId}/votes`)))
        .then((data) => ({ data })),
      Promise.all(Object.entries(GROUPS).map(async ([key, id]) => {
        const g = await getJSON(`https://groups.${PROXY}/v1/groups/${id}`);
        return [key, g.memberCount];
      })),
    ]);

    let gotLive = false;
    if (info.status === 'fulfilled') {
      for (const g of info.value.data ?? []) {
        const key = byUniverse[g.id];
        if (!key) continue;
        Object.assign(state.games[key], {
          visits: g.visits ?? state.games[key].visits,
          playing: g.playing ?? state.games[key].playing,
          favorites: g.favoritedCount ?? state.games[key].favorites,
        });
        gotLive = true;
      }
    }
    if (votes.status === 'fulfilled') {
      for (const v of votes.value.data ?? []) {
        const key = byUniverse[v.id];
        if (key) Object.assign(state.games[key], { up: v.upVotes, down: v.downVotes });
      }
    }
    if (groups.status === 'fulfilled') {
      for (const [key, n] of groups.value) if (typeof n === 'number') state.groups[key] = n;
    }

    if (gotLive) lastLive = new Date();
    render(true);
    updateStamp();
  }

  // Swap an <img> to a new URL only once the new image has loaded.
  function swapImage(img, url) {
    if (!img || !url || img.getAttribute('src') === url) return;
    const probe = new Image();
    probe.onload = () => {
      img.src = url;
      img.hidden = false;
      img.classList.remove('is-broken');
    };
    probe.src = url;
  }
  const swapAll = (selector, url) => $$(selector).forEach((img) => swapImage(img, url));

  async function refreshImages() {
    const groupIds = Object.values(GROUPS).join(',');
    await Promise.allSettled([
      getJSON(`https://thumbnails.${PROXY}/v1/users/avatar?userIds=${USER_ID}&size=720x720&format=Png&isCircular=false`)
        .then((j) => {
          const t = j.data?.[0];
          if (t?.state === 'Completed') swapAll('[data-img="avatar"]', t.imageUrl);
        }),

      getJSON(`https://thumbnails.${PROXY}/v1/games/icons?universeIds=${universeIds}&size=512x512&format=Png&isCircular=false`)
        .then((j) => {
          for (const t of j.data ?? []) {
            const key = byUniverse[t.targetId];
            if (key && t.state === 'Completed') swapAll(`[data-img="${key}.icon"]`, t.imageUrl);
          }
        }),

      getJSON(`https://thumbnails.${PROXY}/v1/games/multiget/thumbnails?universeIds=${universeIds}&countPerUniverse=3&defaults=true&size=768x432&format=Png&isCircular=false`)
        .then((j) => {
          for (const u of j.data ?? []) {
            const key = byUniverse[u.universeId];
            const urls = (u.thumbnails ?? []).filter((t) => t.state === 'Completed').map((t) => t.imageUrl);
            if (key) $$(`[data-game="${key}"] .slides img`).forEach((img, i) => swapImage(img, urls[i]));
          }
        }),

      getJSON(`https://thumbnails.${PROXY}/v1/groups/icons?groupIds=${groupIds}&size=150x150&format=Png&isCircular=false`)
        .then((j) => {
          for (const t of j.data ?? []) {
            const key = Object.keys(GROUPS).find((k) => GROUPS[k] === t.targetId);
            if (key && t.state === 'Completed') swapAll(`[data-img="group.${key}"]`, t.imageUrl);
          }
        }),
    ]);
  }

  /* ---------------- Copy Discord username ---------------- */

  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2400);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }

  for (const btn of $$('[data-copy]')) {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      const ok = await copy(text);
      toast(ok ? `Copied “${text}”. Add me on Discord!` : `My Discord is “${text}”`);
    });
  }

  /* ---------------- Go ---------------- */

  render();

  // The profile numbers count up as the page loads.
  if (!reduceMotion) $$('.numbers [data-count]').forEach((el) => countUp(el, 550));

  if (STATIC) {
    if (stampEl) stampEl.textContent = `Numbers from ${STATIC.date}, from Roblox.`;
    return;
  }

  refreshStats();
  refreshImages();

  let refreshTimer = setInterval(refreshStats, REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    clearInterval(refreshTimer);
    if (document.hidden) return;
    if (!lastLive || Date.now() - lastLive.getTime() > REFRESH_MS) refreshStats();
    refreshTimer = setInterval(refreshStats, REFRESH_MS);
  });
})();
