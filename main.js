// --- Constants ---
const STRIKE_ZONE_TOP = 180;
const STRIKE_ZONE_BOTTOM = 260;
const LEAGUES = [
    { name: "STREET LEAGUE", team: "LOCAL NOBODIES", min: 0.0, max: 0.32, minABs: 15 },
    { name: "MINOR LEAGUE (A)", team: "WOOD BATS", min: 0.28, max: 0.38, minABs: 30 },
    { name: "MINOR LEAGUE (AAA)", team: "FUTURE STARS", min: 0.32, max: 0.42, minABs: 50 },
    { name: "MAJOR LEAGUE (MLB)", team: "NY YANKEES", min: 0.38, max: 1.0, minABs: 100 }
];

// --- DOM Elements ---
const el = {
    awayRuns: document.getElementById('away-runs'),
    homeRuns: document.getElementById('home-runs'),
    awayHits: document.getElementById('away-hits'),
    homeHits: document.getElementById('home-hits'),
    inningHalf: document.getElementById('inning-half'),
    inningNum: document.getElementById('inning-num'),
    strikes: document.getElementById('strikes'),
    balls: document.getElementById('balls'),
    outsDots: document.getElementById('outs-dots'),
    avg: document.getElementById('avg'),
    careerHitsSpan: document.getElementById('career-hits'),
    careerABsSpan: document.getElementById('career-abs'),
    currentTeam: document.getElementById('current-team'),
    abSession: document.getElementById('ab-session'),
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
    restartBtn: document.getElementById('restart-btn'),
    awayRow: document.getElementById('away-row'),
    homeRow: document.getElementById('home-row'),
    bases: [document.getElementById('base-1'), document.getElementById('base-2'), document.getElementById('base-3')]
};

// --- Game State ---
let state = {
    strikes: 0, balls: 0, outs: 0,
    awayScore: 0, homeScore: 0,
    awayHitsCount: 0, homeHitsCount: 0,
    inning: 1, isBottom: false,
    runners: [false, false, false],
    isPitching: false, hasSwung: false,
    isGameOver: false,
    pitchStartTime: 0, pitchDuration: 0, isStrikePitch: true,
    careerHits: parseInt(localStorage.getItem('bigManHits')) || 0,
    careerABs: parseInt(localStorage.getItem('bigManABs')) || 0,
    teamIdx: parseInt(localStorage.getItem('bigManTeamIdx')) || 0,
    sessionABCount: 0,
    lineScore: { away: [0,0,0,0,0,0,0,0,0], home: [0,0,0,0,0,0,0,0,0] }
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
    el.awayHits.textContent = state.awayHitsCount;
    el.homeHits.textContent = state.homeHitsCount;
    el.inningHalf.textContent = state.isBottom ? "BOT" : "TOP";
    el.inningNum.textContent = state.inning;
    el.strikes.textContent = state.strikes;
    el.balls.textContent = state.balls;
    el.abSession.textContent = Math.min(state.sessionABCount + 1, 3);
    
    el.careerHitsSpan.textContent = state.careerHits;
    el.careerABsSpan.textContent = state.careerABs;
    const avg = state.careerABs === 0 ? 0 : state.careerHits / state.careerABs;
    el.avg.textContent = avg.toFixed(3).substring(1);
    el.currentTeam.textContent = LEAGUES[state.teamIdx].team;
    
    el.outsDots.innerHTML = "";
    for (let i = 0; i < 2; i++) {
        const d = document.createElement('div');
        d.className = 'out-dot' + (i < state.outs ? ' filled' : '');
        el.outsDots.appendChild(d);
    }
    state.runners.forEach((r, i) => el.bases[i].classList.toggle('occupied', r));

    for (let i = 1; i <= 9; i++) {
        el.awayRow.cells[i].textContent = (i <= state.inning) ? state.lineScore.away[i-1] : "-";
        el.homeRow.cells[i].textContent = (i < state.inning || (i === state.inning && state.isBottom)) ? state.lineScore.home[i-1] : "-";
    }
}

function startNewGame() {
    state.sessionABCount = 0;
    state.homeScore = 0;
    state.homeHitsCount = 0;
    state.lineScore.home = Array(9).fill(0);
    // Away team setup
    state.lineScore.away = Array(9).fill(0).map(() => Math.floor(Math.random() * 2));
    state.awayScore = state.lineScore.away.reduce((a,b) => a+b, 0);
    state.awayHitsCount = Math.floor(state.awayScore * 1.5) + Math.floor(Math.random() * 3);
    initScenario(1);
}

function initScenario(tier) {
    state.isPitching = false; state.hasSwung = false; state.isGameOver = false;
    state.strikes = 0; state.balls = 0; state.outs = Math.floor(Math.random() * 3);
    
    if (tier === 1) state.inning = Math.floor(Math.random() * 3) + 1;
    else if (tier === 2) state.inning = Math.floor(Math.random() * 3) + 4;
    else state.inning = Math.floor(Math.random() * 3) + 7;
    
    state.isBottom = true; // Player is always Home for simpler logic
    state.runners = [Math.random() > 0.7, Math.random() > 0.8, Math.random() > 0.9];
    
    el.resultOverlay.classList.add('hidden');
    el.swingBtn.disabled = true;
    updateUI();
    startCountdown();
}

function startCountdown() {
    let count = 3;
    const timer = setInterval(() => {
        if (state.isGameOver) { clearInterval(timer); return; }
        el.status.textContent = `PITCH IN ${count}s...`;
        count--;
        if (count < 0) { clearInterval(timer); pitch(); }
    }, 1000);
}

function pitch() {
    state.isPitching = true; state.hasSwung = false; el.swingBtn.disabled = false;
    el.status.textContent = "PITCHING!"; playSound('pop');

    // HARD MODE
    state.pitchDuration = 350 + Math.random() * 400; 
    state.isStrikePitch = Math.random() < 0.6; 
    const startOff = (Math.random() - 0.5) * 45;
    const endOff = state.isStrikePitch ? (Math.random() - 0.5) * 40 : (Math.random() > 0.5 ? 75 : -75);

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
    else resolvePitch(true, -1);
}

function resolvePitch(swung, ballTop) {
    state.isPitching = false;
    let result = ""; let sound = "thud"; 
    let isHitResult = false; 
    let isABResult = false; 

    if (!swung) {
        if (state.isStrikePitch) { result = "STRIKE!"; }
        else { result = "BALL!"; state.balls++; }
    } else {
        if (ballTop === -1) { result = "STRIKE!"; }
        else {
            const accuracy = Math.abs(ballTop - ((STRIKE_ZONE_TOP + STRIKE_ZONE_BOTTOM)/2));
            if (accuracy < 10) { result = "HOME RUN!!!"; sound = "bigCheer"; isHitResult = true; isABResult = true; advanceRunners('HR'); }
            else if (accuracy < 32) { result = "HIT!!"; sound = "cheer"; isHitResult = true; isABResult = true; advanceRunners('H'); }
            else { result = "FOUL BALL"; sound = "pop"; }
        }
    }

    if (result === "STRIKE!") { state.strikes++; if (state.strikes >= 3) { result = "OUT!!"; isABResult = true; } }
    if (state.balls >= 4) { result = "WALK!"; isHitResult = false; isABResult = false; advanceRunners('BB'); }

    displayResult(result, sound);

    setTimeout(() => {
        if (isABResult || isHitResult) {
            updateCareer(isHitResult, isABResult);
            state.sessionABCount++;
            if (state.sessionABCount >= 3) checkCareerMove() ? null : endGameSession();
            else initScenario(state.sessionABCount + 1);
        } else if (result === "OUT!!") { 
            updateCareer(false, true);
            state.sessionABCount++;
            if (state.sessionABCount >= 3) checkCareerMove() ? null : endGameSession();
            else initScenario(state.sessionABCount + 1);
        } else {
            if (state.strikes >= 3 || state.balls >= 4) { state.strikes = 0; state.balls = 0; }
            el.resultOverlay.classList.add('hidden'); updateUI(); startCountdown();
        }
    }, 1800);
}

function advanceRunners(type) {
    let runsScored = 0;
    const oldRunners = [...state.runners];
    
    if (type === 'HR') {
        runsScored = oldRunners.filter(r => r).length + 1;
        state.runners = [false, false, false];
    } else if (type === 'H') {
        // Single logic (as requested: 2nd/3rd score)
        if (oldRunners[2]) runsScored++; // 3rd scores
        if (oldRunners[1]) runsScored++; // 2nd scores
        state.runners = [true, oldRunners[0], false]; // 1st -> 2nd, Batter -> 1st
    } else if (type === 'BB') {
        if (oldRunners[0] && oldRunners[1] && oldRunners[2]) runsScored++;
        const r3 = oldRunners[2] || (oldRunners[1] && oldRunners[0]);
        const r2 = oldRunners[1] || oldRunners[0];
        state.runners = [true, r2, r3];
    }

    if (runsScored > 0) {
        state.homeScore += runsScored;
        state.lineScore.home[state.inning-1] += runsScored;
        el.resultText.textContent += ` (+${runsScored} RUNS!)`;
    }
    if (type === 'H' || type === 'HR') state.homeHitsCount++;
}

function displayResult(text, sound) {
    el.resultText.textContent = text;
    el.resultOverlay.classList.remove('hidden');
    if (text.includes("HIT") || text.includes("HOME") || text === "FOUL BALL") playSound('crack');
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
    const league = LEAGUES[state.teamIdx];
    
    if (avg > league.max && state.careerABs >= league.minABs && state.teamIdx < LEAGUES.length - 1) {
        const next = LEAGUES[state.teamIdx+1];
        showNotif("PROMOTION!", `OFFER FROM ${next.team}!`, () => { state.teamIdx++; saveCareer(); startNewGame(); });
        return true;
    } else if (avg < league.min && state.teamIdx > 0) {
        showNotif("DEMOTED", `BACK TO ${LEAGUES[state.teamIdx-1].team}`, () => { state.teamIdx--; saveCareer(); startNewGame(); });
        return true;
    }
    return false;
}

function saveCareer() { localStorage.setItem('bigManTeamIdx', state.teamIdx); }

function resetCareer() {
    if (confirm("Reset everything and start over?")) {
        localStorage.clear();
        location.reload();
    }
}

function endGameSession() {
    const win = state.homeScore > state.awayScore;
    const msg = win ? "VICTORY!" : (state.homeScore === state.awayScore ? "DRAW!" : "DEFEAT...");
    showNotif("GAME OVER", `${msg}\nFinal: Away ${state.awayScore} - Home ${state.homeScore}\nNext game?`, () => startNewGame());
}

function showNotif(title, body, cb) {
    el.notifTitle.textContent = title; el.notifBody.textContent = body;
    el.notifBtn.onclick = () => { el.notifOverlay.classList.add('hidden'); cb(); };
    el.notifOverlay.classList.remove('hidden');
}

el.swingBtn.addEventListener('click', swing);
el.restartBtn.addEventListener('click', resetCareer);
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !el.swingBtn.disabled) swing(); });
startNewGame();
