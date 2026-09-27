/*==================== STATE & CONFIGURATION ====================*/
const state = {
    timezone: 'local',
    timezoneLabel: 'Local System Time',
    movement: 'sweep', // 'sweep' (60Hz) or 'quartz' (1Hz)
    format24: false,
    hue: Number(localStorage.getItem('chronos-hue')) || 240,
    bevelDistance: Number(localStorage.getItem('chronos-bevel')) || 6,
    audioTickEnabled: false,
    lastTickSecond: -1
};

/*==================== DOM ELEMENTS ====================*/
const hourHand = document.getElementById('clock-hour');
const minutesHand = document.getElementById('clock-minutes');
const secondsHand = document.getElementById('clock-seconds');

const textHour = document.getElementById('text-hour');
const textMinutes = document.getElementById('text-minutes');
const textSeconds = document.getElementById('text-seconds');
const textAmPm = document.getElementById('text-ampm');
const dateDayWeek = document.getElementById('date-day-week');
const dateDay = document.getElementById('date-day');
const dateMonth = document.getElementById('date-month');
const dateYear = document.getElementById('date-year');
const angleTelemetry = document.getElementById('clock-angle-telemetry');
const activeTzLabel = document.getElementById('active-tz-label');

/*==================== WEB AUDIO ESCAPEMENT SYNTHESIZER ====================*/
let audioCtx = null;

function playEscapementTick() {
    if (!state.audioTickEnabled) return;
    try {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.018);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.02);
    } catch (e) {
        // Ignore audio errors if blocked by browser autoplay policy
    }
}

/*==================== TIMEZONE DATE HELPER ====================*/
function getZonedTimeParts(timeZone) {
    const now = new Date();
    const ms = now.getMilliseconds();

    if (!timeZone || timeZone === 'local') {
        return {
            year: now.getFullYear(),
            month: now.getMonth(),
            day: now.getDate(),
            weekday: now.toLocaleDateString('en-US', { weekday: 'short' }),
            hours: now.getHours(),
            minutes: now.getMinutes(),
            seconds: now.getSeconds(),
            milliseconds: ms
        };
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const map = {};
    for (const part of parts) {
        map[part.type] = part.value;
    }

    let hours = parseInt(map.hour, 10);
    if (hours === 24) hours = 0;

    return {
        year: parseInt(map.year, 10),
        month: parseInt(map.month, 10) - 1,
        day: parseInt(map.day, 10),
        weekday: map.weekday || '',
        hours,
        minutes: parseInt(map.minute, 10),
        seconds: parseInt(map.second, 10),
        milliseconds: ms
    };
}

/*==================== PRIMARY ANALOG & DIGITAL CLOCK LOOP ====================*/
const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function updateClock() {
    const parts = getZonedTimeParts(state.timezone);
    const { year, month, day, weekday, hours, minutes, seconds, milliseconds } = parts;

    // Trigger escapement tick once per integer second if enabled
    if (seconds !== state.lastTickSecond) {
        state.lastTickSecond = seconds;
        playEscapementTick();
    }

    // Calculate angular positions
    const subSecond = state.movement === 'sweep' ? milliseconds / 1000 : 0;
    const preciseSeconds = seconds + subSecond;
    const preciseMinutes = minutes + preciseSeconds / 60;
    const preciseHours = (hours % 12) + preciseMinutes / 60;

    const hhDeg = preciseHours * 30;
    const mmDeg = preciseMinutes * 6;
    const ssDeg = preciseSeconds * 6;

    if (hourHand) hourHand.style.transform = `rotateZ(${hhDeg.toFixed(2)}deg)`;
    if (minutesHand) minutesHand.style.transform = `rotateZ(${mmDeg.toFixed(2)}deg)`;
    if (secondsHand) secondsHand.style.transform = `rotateZ(${ssDeg.toFixed(2)}deg)`;

    if (angleTelemetry) {
        const hPad = String(Math.round(hhDeg) % 360).padStart(3, '0');
        const mPad = String(Math.round(mmDeg) % 360).padStart(3, '0');
        const sPad = String(Math.round(ssDeg) % 360).padStart(3, '0');
        angleTelemetry.textContent = `H: ${hPad}° · M: ${mPad}° · S: ${sPad}°`;
    }

    // Digital readout formatting
    let displayHour = hours;
    let ampm = '';

    if (state.format24) {
        ampm = '24H';
    } else {
        ampm = hours >= 12 ? 'PM' : 'AM';
        displayHour = hours % 12;
        if (displayHour === 0) displayHour = 12;
    }

    const formattedH = String(displayHour).padStart(2, '0');
    const formattedM = String(minutes).padStart(2, '0');
    const formattedS = String(seconds).padStart(2, '0');

    if (textHour) textHour.textContent = `${formattedH}:`;
    if (textMinutes) textMinutes.textContent = formattedM;
    if (textSeconds) textSeconds.textContent = `:${formattedS}`;
    if (textAmPm) textAmPm.textContent = ampm;

    if (dateDayWeek) dateDayWeek.textContent = `${weekday}, `;
    if (dateDay) dateDay.textContent = day;
    if (dateMonth) dateMonth.textContent = `${monthsShort[month]},`;
    if (dateYear) dateYear.textContent = year;

    requestAnimationFrame(updateClock);
}

/*==================== WORLD HOROLOGY STRIP ====================*/
const worldCities = [
    { tz: 'Europe/Zurich', timeEl: 'time-zurich', offsetEl: 'offset-zurich', statusEl: 'status-zurich' },
    { tz: 'Asia/Tokyo', timeEl: 'time-tokyo', offsetEl: 'offset-tokyo', statusEl: 'status-tokyo' },
    { tz: 'America/New_York', timeEl: 'time-ny', offsetEl: 'offset-ny', statusEl: 'status-ny' },
    { tz: 'Europe/London', timeEl: 'time-london', offsetEl: 'offset-london', statusEl: 'status-london' }
];

function updateWorldClocks() {
    worldCities.forEach((city) => {
        const parts = getZonedTimeParts(city.tz);
        const hh = String(parts.hours).padStart(2, '0');
        const mm = String(parts.minutes).padStart(2, '0');
        const ss = String(parts.seconds).padStart(2, '0');

        const timeNode = document.getElementById(city.timeEl);
        if (timeNode) {
            timeNode.textContent = `${hh}:${mm}:${ss}`;
        }

        const statusNode = document.getElementById(city.statusEl);
        if (statusNode) {
            const isDaytime = parts.hours >= 8 && parts.hours < 18;
            statusNode.textContent = isDaytime ? 'Daylight Hours (08:00–18:00)' : 'Night Hours';
        }
    });
}

setInterval(updateWorldClocks, 1000);
updateWorldClocks();

/*==================== DARK / LIGHT THEME MANAGEMENT ====================*/
const themeButton = document.getElementById('theme-button');
const clockThemeTrigger = document.querySelector('.clock__theme');
const headerThemeBtn = document.getElementById('header-theme-btn');
const headerThemeLabel = document.getElementById('header-theme-label');

const darkThemeClass = 'dark-theme';
const iconSunClass = 'bxs-sun';

function isDarkModeActive() {
    return document.body.classList.contains(darkThemeClass);
}

function syncThemeUI() {
    const isDark = isDarkModeActive();
    if (themeButton) {
        themeButton.classList.toggle(iconSunClass, isDark);
    }
    if (headerThemeLabel) {
        headerThemeLabel.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    }
    localStorage.setItem('selected-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('selected-icon', isDark ? 'bxs-moon' : 'bxs-sun');
    updateLiveCSSTokens();
}

function toggleTheme() {
    document.body.classList.toggle(darkThemeClass);
    syncThemeUI();
}

// Restore saved theme preference
const savedTheme = localStorage.getItem('selected-theme');
if (savedTheme === 'dark') {
    document.body.classList.add(darkThemeClass);
}
if (clockThemeTrigger) {
    clockThemeTrigger.addEventListener('click', toggleTheme);
}
if (headerThemeBtn) {
    headerThemeBtn.addEventListener('click', toggleTheme);
}

/*==================== LIVE TOKEN CALIBRATION & CSS EXPORTER ====================*/
const liveCssCode = document.getElementById('live-css-code');
const tokenSummaryMeta = document.getElementById('token-summary-meta');
const inquiryPresetInput = document.getElementById('inquiry-preset');
const bevelSlider = document.getElementById('bevel-slider');
const bevelValueLabel = document.getElementById('bevel-value-label');

function updateLiveCSSTokens() {
    const hue = state.hue;
    const bevel = state.bevelDistance;
    const blur = Math.round(bevel * 2.66);
    const isDark = isDarkModeActive();
    const movLabel = state.movement === 'sweep' ? '60Hz Sweep' : '1Hz Quartz';

    document.documentElement.style.setProperty('--hue-color', String(hue));
    document.documentElement.style.setProperty('--bevel-distance', `${bevel}px`);
    document.documentElement.style.setProperty('--bevel-blur', `${blur}px`);

    if (bevelValueLabel) {
        bevelValueLabel.textContent = `${bevel}px offset · ${blur}px blur`;
    }
    if (bevelSlider && Number(bevelSlider.value) !== bevel) {
        bevelSlider.value = String(bevel);
    }

    const themeName = isDark ? 'Dark' : 'Light';
    if (tokenSummaryMeta) {
        tokenSummaryMeta.textContent = `Hue: ${hue}° · Bevel: ${bevel}px · Theme: ${themeName}`;
    }
    if (inquiryPresetInput) {
        inquiryPresetInput.value = `Hue ${hue}° · ${bevel}px Bevel · ${movLabel} · ${themeName}`;
    }

    const cssSnippet = isDark
        ? `:root {\n  --hue-color: ${hue};\n  --bevel-distance: ${bevel}px;\n  --bevel-blur: ${blur}px;\n  --first-color: hsl(${hue}, 68%, 62%);\n  --title-color: hsl(${hue}, 14%, 95%);\n  --text-color: hsl(${hue}, 10%, 76%);\n  --body-color: hsl(${hue}, 12%, 11%);\n}`
        : `:root {\n  --hue-color: ${hue};\n  --bevel-distance: ${bevel}px;\n  --bevel-blur: ${blur}px;\n  --first-color: hsl(${hue}, 58%, 48%);\n  --title-color: hsl(${hue}, 24%, 12%);\n  --text-color: hsl(${hue}, 10%, 32%);\n  --body-color: hsl(${hue}, 14%, 95%);\n}`;

    if (liveCssCode) {
        liveCssCode.textContent = cssSnippet;
    }
}

/*==================== INTERACTIVE CALIBRATION CONTROLS ====================*/
// Timezone buttons in Hero
const tzButtons = document.querySelectorAll('[data-tz]');
const worldCards = document.querySelectorAll('[data-world-tz]');

function setActiveTimezone(tz, customLabel) {
    state.timezone = tz;
    const labels = {
        'local': 'Local System Time',
        'Europe/Zurich': 'Zurich · CET/CEST',
        'Asia/Tokyo': 'Tokyo · JST',
        'America/New_York': 'New York · EST/EDT',
        'Europe/London': 'London · GMT/BST'
    };
    state.timezoneLabel = customLabel || labels[tz] || tz;
    if (activeTzLabel) {
        activeTzLabel.textContent = state.timezoneLabel;
    }

    tzButtons.forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-tz') === tz);
    });
    worldCards.forEach((card) => {
        card.classList.toggle('is-selected', card.getAttribute('data-world-tz') === tz);
    });
}

tzButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const tz = btn.getAttribute('data-tz');
        setActiveTimezone(tz);
    });
});

worldCards.forEach((card) => {
    card.addEventListener('click', () => {
        const tz = card.getAttribute('data-world-tz');
        const label = card.getAttribute('data-world-label');
        setActiveTimezone(tz, label);
        const heroSection = document.getElementById('horology-lab');
        if (heroSection) {
            heroSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Movement mode buttons (60Hz Sweep vs 1Hz Quartz)
const movementButtons = document.querySelectorAll('[data-movement]');
movementButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        state.movement = btn.getAttribute('data-movement');
        movementButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        updateLiveCSSTokens();
    });
});

// 12H / 24H format buttons
const formatButtons = document.querySelectorAll('[data-format]');
formatButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        state.format24 = btn.getAttribute('data-format') === '24';
        formatButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
    });
});

// Accent Hue swatches
const hueButtons = document.querySelectorAll('[data-hue]');
hueButtons.forEach((btn) => {
    if (Number(btn.getAttribute('data-hue')) === state.hue) {
        hueButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
    }
    btn.addEventListener('click', () => {
        const newHue = Number(btn.getAttribute('data-hue'));
        state.hue = newHue;
        localStorage.setItem('chronos-hue', String(newHue));
        hueButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        updateLiveCSSTokens();
    });
});

// Bevel Distance Slider
if (bevelSlider) {
    bevelSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        state.bevelDistance = val;
        localStorage.setItem('chronos-bevel', String(val));
        updateLiveCSSTokens();
    });
}

// Audio Escapement Tick Toggle
const audioTickBtn = document.getElementById('audio-tick-btn');
const audioTickStatus = document.getElementById('audio-tick-status');
if (audioTickBtn) {
    audioTickBtn.addEventListener('click', () => {
        state.audioTickEnabled = !state.audioTickEnabled;
        audioTickBtn.setAttribute('aria-pressed', String(state.audioTickEnabled));
        audioTickBtn.classList.toggle('is-active', state.audioTickEnabled);
        if (audioTickStatus) {
            audioTickStatus.textContent = `Escapement Audio: ${state.audioTickEnabled ? 'On' : 'Off'}`;
        }
        if (state.audioTickEnabled) {
            playEscapementTick();
        }
    });
}

/*==================== SPLIT-SECOND REFERENCE CHRONOGRAPH ====================*/
const chronoDisplay = document.getElementById('chrono-display');
const chronoStartBtn = document.getElementById('chrono-start-btn');
const chronoLapBtn = document.getElementById('chrono-lap-btn');
const chronoResetBtn = document.getElementById('chrono-reset-btn');
const chronoCopyBtn = document.getElementById('chrono-copy-btn');
const chronoLapsList = document.getElementById('chrono-laps-list');
const chronoLapCount = document.getElementById('chrono-lap-count');

let chronoRunning = false;
let chronoStartTime = 0;
let chronoElapsed = 0;
let chronoRafId = null;
let chronoLaps = [];

function formatChronoMs(ms) {
    const totalCentiseconds = Math.floor(ms / 10);
    const cs = String(totalCentiseconds % 100).padStart(2, '0');
    const totalSeconds = Math.floor(totalCentiseconds / 100);
    const secs = String(totalSeconds % 60).padStart(2, '0');
    const totalMinutes = Math.floor(totalSeconds / 60);
    const mins = String(totalMinutes % 60).padStart(2, '0');
    const hrs = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    return `${hrs}:${mins}:${secs}.${cs}`;
}

function tickChronograph() {
    if (!chronoRunning) return;
    const now = performance.now();
    const currentTotal = chronoElapsed + (now - chronoStartTime);
    if (chronoDisplay) {
        chronoDisplay.textContent = formatChronoMs(currentTotal);
    }
    chronoRafId = requestAnimationFrame(tickChronograph);
}

function renderChronoLaps() {
    if (!chronoLapsList) return;
    if (chronoLapCount) {
        chronoLapCount.textContent = `${chronoLaps.length} ${chronoLaps.length === 1 ? 'lap' : 'laps'} recorded`;
    }
    if (chronoLaps.length === 0) {
        chronoLapsList.innerHTML = '<div class="chronograph__empty">Press "Start Chronograph" and "Record Split Lap" to capture interval telemetry.</div>';
        return;
    }
    chronoLapsList.innerHTML = chronoLaps
        .map((lap, idx) => `<div class="chronograph__lap-item"><span>Lap ${String(idx + 1).padStart(2, '0')}</span><span>+${lap.delta}</span><span>${lap.total}</span></div>`)
        .reverse()
        .join('');
}

if (chronoStartBtn) {
    chronoStartBtn.addEventListener('click', () => {
        if (!chronoRunning) {
            chronoRunning = true;
            chronoStartTime = performance.now();
            chronoStartBtn.textContent = 'Pause Chronograph';
            if (chronoLapBtn) chronoLapBtn.disabled = false;
            if (chronoResetBtn) chronoResetBtn.disabled = false;
            chronoRafId = requestAnimationFrame(tickChronograph);
        } else {
            chronoRunning = false;
            chronoElapsed += performance.now() - chronoStartTime;
            if (chronoRafId) cancelAnimationFrame(chronoRafId);
            chronoStartBtn.textContent = 'Resume Chronograph';
        }
    });
}

if (chronoLapBtn) {
    chronoLapBtn.addEventListener('click', () => {
        const currentTotal = chronoRunning
            ? chronoElapsed + (performance.now() - chronoStartTime)
            : chronoElapsed;
        const prevTotalMs = chronoLaps.length > 0 ? chronoLaps[chronoLaps.length - 1].rawMs : 0;
        const deltaMs = currentTotal - prevTotalMs;
        chronoLaps.push({
            rawMs: currentTotal,
            delta: formatChronoMs(deltaMs),
            total: formatChronoMs(currentTotal)
        });
        if (chronoCopyBtn) chronoCopyBtn.disabled = false;
        renderChronoLaps();
    });
}

if (chronoResetBtn) {
    chronoResetBtn.addEventListener('click', () => {
        chronoRunning = false;
        if (chronoRafId) cancelAnimationFrame(chronoRafId);
        chronoElapsed = 0;
        chronoLaps = [];
        if (chronoDisplay) chronoDisplay.textContent = '00:00:00.00';
        if (chronoStartBtn) chronoStartBtn.textContent = 'Start Chronograph';
        if (chronoLapBtn) chronoLapBtn.disabled = true;
        if (chronoResetBtn) chronoResetBtn.disabled = true;
        if (chronoCopyBtn) chronoCopyBtn.disabled = true;
        renderChronoLaps();
    });
}

if (chronoCopyBtn) {
    chronoCopyBtn.addEventListener('click', () => {
        if (chronoLaps.length === 0) return;
        const text = chronoLaps
            .map((l, i) => `Lap ${i + 1}: +${l.delta} (Total: ${l.total})`)
            .join('\n');
        navigator.clipboard.writeText(text).then(() => {
            const orig = chronoCopyBtn.textContent;
            chronoCopyBtn.textContent = 'Copied Laps';
            setTimeout(() => {
                chronoCopyBtn.textContent = orig;
            }, 1600);
        });
    });
}

/*==================== DEPLOYMENT CASE STUDY FILTER ====================*/
const caseFilterButtons = document.querySelectorAll('[data-case-filter]');
const caseCards = document.querySelectorAll('[data-case-category]');

caseFilterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const category = btn.getAttribute('data-case-filter');
        caseFilterButtons.forEach((b) => b.classList.toggle('is-active', b === btn));

        caseCards.forEach((card) => {
            const cardCat = card.getAttribute('data-case-category');
            const shouldShow = category === 'all' || cardCat === category;
            card.style.display = shouldShow ? 'flex' : 'none';
        });
    });
});

/*==================== COPY & DOWNLOAD CSS TOKENS ====================*/
const copyCodeBtn = document.getElementById('copy-code-btn');
const copyHeroTokensBtn = document.getElementById('copy-hero-tokens-btn');
const downloadCssBtn = document.getElementById('download-css-btn');

function copyActiveCssToClipboard(triggerButton, feedbackText) {
    if (!liveCssCode) return;
    navigator.clipboard.writeText(liveCssCode.textContent).then(() => {
        const originalLabel = triggerButton.textContent;
        triggerButton.textContent = feedbackText;
        setTimeout(() => {
            triggerButton.textContent = originalLabel;
        }, 1800);
    });
}

if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => copyActiveCssToClipboard(copyCodeBtn, 'Copied!'));
}
if (copyHeroTokensBtn) {
    copyHeroTokensBtn.addEventListener('click', () => copyActiveCssToClipboard(copyHeroTokensBtn, 'CSS Variables Copied!'));
}

if (downloadCssBtn) {
    downloadCssBtn.addEventListener('click', () => {
        if (!liveCssCode) return;
        const blob = new Blob([liveCssCode.textContent], { type: 'text/css;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chronos-tokens-hue-${state.hue}.css`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

/*==================== VALIDATED ENGINEERING INQUIRY FORM ====================*/
const inquiryForm = document.getElementById('engineering-inquiry-form');
const inquiryFeedback = document.getElementById('inquiry-feedback');

if (inquiryForm) {
    inquiryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nameVal = document.getElementById('inquiry-name').value.trim();
        const emailVal = document.getElementById('inquiry-email').value.trim();
        const platformVal = document.getElementById('inquiry-platform').value;
        const presetVal = document.getElementById('inquiry-preset').value;
        const notesVal = document.getElementById('inquiry-notes').value.trim();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!nameVal || !emailVal || !notesVal) {
            inquiryFeedback.className = 'form-feedback is-visible is-error';
            inquiryFeedback.textContent = 'Please complete your name, work email, and project scope specifications before submitting.';
            return;
        }

        if (!emailRegex.test(emailVal)) {
            inquiryFeedback.className = 'form-feedback is-visible is-error';
            inquiryFeedback.textContent = 'Please enter a valid work email address (e.g., name@domain.com).';
            return;
        }

        const refId = `CHR-${Math.floor(1000 + Math.random() * 9000)}`;
        inquiryFeedback.className = 'form-feedback is-visible is-success';
        inquiryFeedback.textContent = `Specification Brief #${refId} confirmed for ${nameVal} (${platformVal} · ${presetVal}). Our Zurich engineering team has logged your calibration tokens.`;
        inquiryForm.reset();
        updateLiveCSSTokens();
    });
}

/*==================== INITIALIZE ====================*/
syncThemeUI();
updateLiveCSSTokens();
requestAnimationFrame(updateClock);
