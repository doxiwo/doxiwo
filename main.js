// --- Constants ---
const STRIKE_ZONE_TOP = 180;
const STRIKE_ZONE_BOTTOM = 260;
const LEAGUES = [
    { name: "STREET LEAGUE", team: "LOCAL NOBODIES", min: 0.0, max: 0.3 },
    { name: "MINOR LEAGUE (A)", team: "WOOD BATS", min: 0.25, max: 0.35 },
    { name: "MINOR LEAGUE (AAA)", team: "FUTURE STARS", min: 0.3, max: 0.45 },
    { name: "MAJOR LEAGUE (MLB)", team: "NY YANKEES", min: 0.4, max: 1.0 }
];

// --- DOM Elements ---
const el = {
    awayRuns: document.getElementById('away-runs'),
    homeRuns: document.getElementById('home-runs'),
    inningHalf: document.getElementById('inning-half'),
    inningNum: document.getElementById('inning-num'),
    strikes: document.getElementById('strikes'),
    balls: document.getElementById('balls'),
    outsDots: document.getElementById('outs-dots'),
    avg: document.getElementById('avg'),
    currentTeam: document.getElementById('current-team'),
    ball: document.getElementById('ball'),
    bat: document.getElementById('bat'),
    swingBtn: document.getElementById('swing-btn'),
    status: document.getElementById('status-message'),
    resultOverlay: document.getElementById('result-overlay'),
    resultText: document.getElementById('result-text'),
    notifOverlay: document.getElementById('notification-overlay'),
    notifTitle: document.getElementById('notif-title'),
    notifBody: document.getElementById('notif-body'),
    notifBtn: document.getElementById('notif-btn'),
    lineScore: document.getElementById('line-score'),
    bases: [document.getElementById('base-1'), document.getElementById('base-2'), document.getElementById('base-3')]
};

// --- Game State ---
let state = {
    strikes: 0, balls: 0, outs: 0,
    awayScore: 0, homeScore: 0,
    inning: 1, isBottom: false,
    runners: [false, false, false],
    isPitching: false, hasSwung: false,
    isGameOver: false,
    pitchStartTime: 0, pitchDuration: 0, isStrikePitch: true,
    careerHits: parseInt(localStorage.getItem('bigManHits')) || 0,
    careerABs: parseInt(localStorage.getItem('bigManABs')) || 0,
    teamIdx: parseInt(localStorage.getItem('bigManTeamIdx')) || 0,
    currentStep: 'IDLE' // IDLE, COUNTDOWN, PITCHING, RESULT
};

// --- Audio Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    if (type === 'pop') { createOsc(440, 110, 0.1, 0.1); }
    else if (type === 'crack') { createWhiteNoise(0.4, 0.05); createOsc(150, 40, 0.5, 0.1); }
    else if (type === 'thud') { createOsc(100, 40, 0.3, 0.2, 'triangle'); }
    else if (type === 'cheer') { createWhiteNoise(0.2, 1.5, true); }
    else if (type === 'bigCheer') { createWhiteNoise(0.4, 3.0, true); }
}
function createOsc(f1, f2, v, d, t = 'sine') {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = t; o.connect(g); g.connect(audioCtx.destination);
    o.frequency.setValueAtTime(f1, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(f2, audioCtx.currentTime + d);
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + d);
    o.start(); o.stop(audioCtx.currentTime + d);
}
function createWhiteNoise(v, d, swell = false) {
    const b = audioCtx.createBuffer(1, audioCtx.sampleRate * d, audioCtx.sampleRate);
    const data = b.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const s = audioCtx.createBufferSource(); s.buffer = b;
    const g = audioCtx.createGain(); const f = audioCtx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1200;
    s.connect(f); f.connect(g); g.connect(audioCtx.destination);
    if (swell) { g.gain.setValueAtTime(0, audioCtx.currentTime); g.gain.linearRampToValueAtTime(v, audioCtx.currentTime + 0.2); g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + d); }
    else { g.gain.setValueAtTime(v, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + d); }
    s.start();
}

// --- Logic ---
function updateUI() {
    el.awayRuns.textContent = state.awayScore;
    el.homeRuns.textContent = state.homeScore;
    el.inningHalf.textContent = state.isBottom ? "BOT" : "TOP";
    el.inningNum.textContent = state.inning;
    el.strikes.textContent = state.strikes;
    el.balls.textContent = state.balls;
    el.avg.textContent = (state.careerABs === 0 ? 0 : state.careerHits / state.careerABs).toFixed(3).substring(1);
    el.currentTeam.textContent = LEAGUES[state.teamIdx].name;
    
    el.outsDots.innerHTML = "";
    for (let i = 0; i < 2; i++) {
        const d = document.createElement('div');
        d.className = 'out-dot' + (i < state.outs ? ' filled' : '');
        el.outsDots.appendChild(d);
    }
    state.runners.forEach((r, i) => el.bases[i].classList.toggle('occupied', r));

    // Update Line Score row cells
    const row = state.isBottom ? document.getElementById('home-row') : document.getElementById('away-row');
    row.cells[state.inning].textContent = state.isBottom ? state.homeScore : state.awayScore;
}

function initScenario() {
    state.currentStep = 'IDLE';
    state.inning = Math.floor(Math.random() * 9) + 1;
    state.isBottom = Math.random() > 0.5;
    state.outs = Math.floor(Math.random() * 3);
    state.strikes = 0; state.balls = 0;
    state.awayScore = Math.floor(Math.random() * (state.inning + 1));
    state.homeScore = Math.floor(Math.random() * (state.inning + 1));
    state.runners = [Math.random() > 0.7, Math.random() > 0.8, Math.random() > 0.9];
    state.isGameOver = false;
    
    // Clear Line Score cells
    for(let i=1; i<=9; i++) {
        document.getElementById('away-row').cells[i].textContent = "-";
        document.getElementById('home-row').cells[i].textContent = "-";
    }
    
    el.resultOverlay.classList.add('hidden');
    updateUI();
    startCountdown();
}

function startCountdown() {
    state.currentStep = 'COUNTDOWN';
    let count = 3;
    const timer = setInterval(() => {
        if (state.isGameOver) { clearInterval(timer); return; }
        el.status.textContent = `NEXT PITCH IN ${count}s...`;
        count--;
        if (count < 0) { clearInterval(timer); pitch(); }
    }, 1000);
}

function pitch() {
    state.currentStep = 'PITCHING';
    state.isPitching = true; state.hasSwung = false; el.swingBtn.disabled = false;
    el.status.textContent = "PITCHING!"; playSound('pop');

    state.pitchDuration = 700 + Math.random() * 800; // 0.7s - 1.5s
    state.isStrikePitch = Math.random() < 0.75;
    const startOff = (Math.random() - 0.5) * 40;
    const endOff = state.isStrikePitch ? (Math.random() - 0.5) * 60 : (Math.random() > 0.5 ? 80 : -80);

    el.ball.style.setProperty('--duration', `${state.pitchDuration}ms`);
    el.ball.style.setProperty('--start-offset', `${startOff}px`);
    el.ball.style.setProperty('--end-offset', `${endOff}px`);
    
    el.ball.classList.remove('pitching'); void el.ball.offsetWidth; el.ball.classList.add('pitching');
    state.pitchStartTime = Date.now();

    setTimeout(() => { if (state.isPitching && !state.hasSwung) resolvePitch(false); }, state.pitchDuration);
}

function swing() {
    if (!state.isPitching || state.hasSwung) return;
    state.hasSwung = true; el.swingBtn.disabled = true;
    el.bat.classList.add('swinging'); setTimeout(() => el.bat.classList.remove('swinging'), 300);

    const progress = (Date.now() - state.pitchStartTime) / state.pitchDuration;
    const ballTop = -30 + (390 * progress);

    if (ballTop >= STRIKE_ZONE_TOP && ballTop <= STRIKE_ZONE_BOTTOM) resolvePitch(true, ballTop);
    else resolvePitch(true, -1); // Whiff
}

function resolvePitch(swung, ballTop) {
    state.isPitching = false; state.currentStep = 'RESULT';
    let result = ""; let sound = "thud"; let isHit = false; let isAB = false;

    if (!swung) {
        if (state.isStrikePitch) { result = "STRIKE! (LOOKING)"; }
        else { result = "BALL!"; state.balls++; }
    } else {
        if (ballTop === -1) { result = "STRIKE! (WHIFF)"; }
        else {
            const accuracy = Math.abs(ballTop - ((STRIKE_ZONE_TOP + STRIKE_ZONE_BOTTOM)/2));
            if (accuracy < 10) { result = "HOME RUN!!!"; sound = "bigCheer"; isHit = true; isAB = true; }
            else if (accuracy < 38) { result = "HIT!!"; sound = "cheer"; isHit = true; isAB = true; }
            else { result = "FOUL BALL"; sound = "pop"; }
        }
    }

    if (result.includes("STRIKE")) { state.strikes++; if (state.strikes >= 3) { result = "OUT!!"; isAB = true; } }
    if (state.balls >= 4) { result = "WALK!"; isHit = true; isAB = false; }

    displayResult(result, sound);
    if (isAB || isHit) updateCareer(isHit, isAB);

    setTimeout(() => {
        if (isAB || isHit) checkCareerMove() ? null : initScenario();
        else {
            if (result === "OUT!!") initScenario();
            else {
                if (state.strikes >= 3 || state.balls >= 4) { state.strikes = 0; state.balls = 0; }
                el.resultOverlay.classList.add('hidden');
                updateUI();
                startCountdown();
            }
        }
    }, 1500);
}

function displayResult(text, sound) {
    el.resultText.textContent = text;
    el.resultOverlay.classList.remove('hidden');
    playSound('crack'); // Always bat sound if swung? No, only on hit/foul
    if (sound) playSound(sound);
    updateUI();
}

function updateCareer(isHit, isAB) {
    if (isHit) state.careerHits++;
    if (isAB) state.careerABs++;
    localStorage.setItem('bigManHits', state.careerHits);
    localStorage.setItem('bigManABs', state.careerABs);
}

function checkCareerMove() {
    const avg = state.careerHits / state.careerABs;
    let moved = false;
    if (avg > LEAGUES[state.teamIdx].max && state.teamIdx < LEAGUES.length - 1) {
        showNotif("PROMOTION!", `OFFER: ${LEAGUES[state.teamIdx+1].team}!`, () => { state.teamIdx++; saveCareer(); initScenario(); });
        moved = true;
    } else if (avg < LEAGUES[state.teamIdx].min && state.teamIdx > 0) {
        showNotif("DEMOTION", `BACK TO ${LEAGUES[state.teamIdx-1].team}`, () => { state.teamIdx--; saveCareer(); initScenario(); });
        moved = true;
    }
    return moved;
}

function saveCareer() {
    localStorage.setItem('bigManTeamIdx', state.teamIdx);
}

function showNotif(title, body, cb) {
    el.notifTitle.textContent = title; el.notifBody.textContent = body;
    el.notifBtn.onclick = () => { el.notifOverlay.classList.add('hidden'); cb(); };
    el.notifOverlay.classList.remove('hidden');
}

el.swingBtn.addEventListener('click', swing);
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !el.swingBtn.disabled) swing(); });
initScenario();
