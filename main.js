// --- DOM Elements ---
const strikesSpan = document.getElementById('strikes');
const ballsSpan = document.getElementById('balls');
const outsDots = document.getElementById('outs-dots');
const awayTotal = document.getElementById('away-total');
const homeTotal = document.getElementById('home-total');
const inningNum = document.getElementById('inning-num');
const inningHalf = document.getElementById('inning-half');
const avgSpan = document.getElementById('avg');
const currentTeamSpan = document.getElementById('current-team');
const abCountSpan = document.getElementById('ab-count');
const swingBtn = document.getElementById('swing-btn');
const messageDiv = document.getElementById('message');
const ball = document.getElementById('ball');
const bat = document.getElementById('bat');
const strikeZone = document.getElementById('strike-zone');
const difficultySelect = document.getElementById('difficulty');
const bases = [document.getElementById('base-1'), document.getElementById('base-2'), document.getElementById('base-3')];
const awayLineRow = document.getElementById('away-line');
const homeLineRow = document.getElementById('home-line');
const notifOverlay = document.getElementById('notification-overlay');
const notifTitle = document.getElementById('notif-title');
const notifBody = document.getElementById('notif-body');
const notifBtn = document.getElementById('notif-btn');

// --- Game State ---
let strikes = 0, balls = 0, outs = 0, awayScore = 0, homeScore = 0;
let currentInning = 1, isBottom = false, runners = [false, false, false];
let isPitching = false, hasSwung = false, isGameOver = false;
let pitchStartTime = 0, pitchDuration = 0, isStrikePitch = true, autoPitchTimer = null;
let sessionABs = 0;

// Career Data
let careerHits = parseInt(localStorage.getItem('bigManHits')) || 0;
let careerAtBats = parseInt(localStorage.getItem('bigManAtBats')) || 0;
let teamIndex = parseInt(localStorage.getItem('bigManTeamIndex')) || 0;

const LEAGUES = [
    { name: "Sandlot League", team: "Local Nobodies", minAvg: 0.0, maxAvg: 1.0 },
    { name: "Independent League", team: "Dirt Diggers", minAvg: 0.200, maxAvg: 0.300 },
    { name: "Minor League (A)", team: "Wood Bats", minAvg: 0.250, maxAvg: 0.350 },
    { name: "Minor League (AAA)", team: "Future Stars", minAvg: 0.300, maxAvg: 0.400 },
    { name: "MLB (Low-tier)", team: "Oakland Athletics", minAvg: 0.350, maxAvg: 0.450 },
    { name: "MLB (Mid-tier)", team: "Toronto Blue Jays", minAvg: 0.400, maxAvg: 0.500 },
    { name: "MLB (Elite)", team: "NY Yankees", minAvg: 0.450, maxAvg: 1.0 }
];

const STRIKE_ZONE_TOP = 180, STRIKE_ZONE_BOTTOM = 260;

// --- Audio ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    if (type === 'pop') {
        createOsc(440, 110, 0.2, 0.1);
    } else if (type === 'crack') {
        createWhiteNoise(0.5, 0.05); // Snap
        createOsc(150, 40, 0.6, 0.1); // Thump
    } else if (type === 'thud') {
        createOsc(80, 40, 0.4, 0.2, 'triangle');
    } else if (type === 'cheer') {
        createWhiteNoise(0.3, 1.5, true); // Sustained swell
    } else if (type === 'bigCheer') {
        createWhiteNoise(0.5, 3.0, true); // HR swell
    }
}
function createOsc(startFreq, endFreq, vol, dur, type = 'sine') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type; osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + dur);
    osc.start(now); osc.stop(now + dur);
}
function createWhiteNoise(vol, dur, swell = false) {
    const bufferSize = audioCtx.sampleRate * dur;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1000;
    noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (swell) {
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(vol, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, now + dur);
    } else {
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + dur);
    }
    noise.start(now);
}

// --- Career Logic ---
function updateCareerStats(isHit, isAtBat) {
    if (isHit) careerHits++;
    if (isAtBat) { careerAtBats++; sessionABs++; }
    localStorage.setItem('bigManHits', careerHits);
    localStorage.setItem('bigManAtBats', careerAtBats);
    updateAvgDisplay();
}

function updateAvgDisplay() {
    const avg = careerAtBats === 0 ? 0 : careerHits / careerAtBats;
    avgSpan.textContent = avg.toFixed(3).substring(1);
    currentTeamSpan.textContent = LEAGUES[teamIndex].team;
    abCountSpan.textContent = sessionABs;
}

function checkCareerMove() {
    const avg = careerHits / careerAtBats;
    if (sessionABs >= 3) {
        if (avg > LEAGUES[teamIndex].maxAvg && teamIndex < LEAGUES.length - 1) {
            showNotification("CONTRACT OFFER!", `The ${LEAGUES[teamIndex + 1].team} from ${LEAGUES[teamIndex + 1].name} are offering a contract!`, () => {
                teamIndex++;
                localStorage.setItem('bigManTeamIndex', teamIndex);
                sessionABs = 0;
                initRandomScenario();
            });
            return true;
        } else if (avg < LEAGUES[teamIndex].minAvg && teamIndex > 0) {
            showNotification("DEMOTED...", `You've been sent down to the ${LEAGUES[teamIndex - 1].team}. Work harder!`, () => {
                teamIndex--;
                localStorage.setItem('bigManTeamIndex', teamIndex);
                sessionABs = 0;
                initRandomScenario();
            });
            return true;
        } else {
            showNotification("Game Session Over", `Next game starts now. AVG: ${avg.toFixed(3).substring(1)}`, () => {
                sessionABs = 0;
                initRandomScenario();
            });
            return true;
        }
    }
    return false;
}

function showNotification(title, body, callback) {
    clearInterval(autoPitchTimer);
    notifTitle.textContent = title;
    notifBody.textContent = body;
    notifBtn.onclick = () => {
        notifOverlay.classList.add('hidden');
        callback();
    };
    notifOverlay.classList.remove('hidden');
}

// --- Game Logic ---
function initRandomScenario() {
    isGameOver = false; strikes = 0; balls = 0; outs = Math.floor(Math.random() * 3);
    currentInning = Math.floor(Math.random() * 9) + 1; isBottom = Math.random() > 0.5;
    awayScore = 0; homeScore = 0;
    const lineArr = [0,0,0,0,0,0,0,0,0];
    for (let i = 0; i < 9; i++) {
        const r = (i + 1 < currentInning) ? Math.floor(Math.random() * 3) : 0;
        awayScore += r; homeScore += r;
    }
    runners = [Math.random() > 0.7, Math.random() > 0.8, Math.random() > 0.9];
    updateScoreboard();
    updateAvgDisplay();
    messageDiv.textContent = "Highlight loading...";
    setTimeout(startAutoPitch, 1500);
}

function updateScoreboard() {
    strikesSpan.textContent = strikes; ballsSpan.textContent = balls;
    inningNum.textContent = currentInning; inningHalf.textContent = isBottom ? "Bottom" : "Top";
    outsDots.innerHTML = "";
    for (let i = 0; i < 2; i++) {
        const dot = document.createElement('div');
        dot.className = 'out-dot' + (i < outs ? ' filled' : '');
        outsDots.appendChild(dot);
    }
    updateBasesUI();
}

function updateBasesUI() { runners.forEach((occupied, index) => bases[index].classList.toggle('occupied', occupied)); }

function startAutoPitch() {
    if (autoPitchTimer) clearInterval(autoPitchTimer);
    autoPitchTimer = setInterval(() => {
        if (!isPitching && !isGameOver) {
            let countdown = 3;
            const countInterval = setInterval(() => {
                if (isGameOver) { clearInterval(countInterval); return; }
                messageDiv.textContent = `Pitch in ${countdown}s...`;
                countdown--;
                if (countdown < 0) { clearInterval(countInterval); pitch(); }
            }, 1000);
        }
    }, 4500);
}

function pitch() {
    if (isPitching || isGameOver) return;
    const diff = difficultySelect.value;
    const settings = diff === 'easy' ? { dr: [1200, 1800], sp: 0.9, zs: 100 } :
                     diff === 'hard' ? { dr: [500, 800], sp: 0.5, zs: 60 } : { dr: [700, 1300], sp: 0.7, zs: 80 };
    strikeZone.style.width = settings.zs + 'px'; strikeZone.style.height = settings.zs + 'px';
    isPitching = true; hasSwung = false; swingBtn.disabled = false;
    messageDiv.textContent = "Pitching!"; playSound('pop');
    pitchDuration = settings.dr[0] + Math.random() * (settings.dr[1] - settings.dr[0]);
    isStrikePitch = Math.random() < settings.sp;
    const startOffset = (Math.random() - 0.5) * 40;
    const endOffset = isStrikePitch ? (Math.random() - 0.5) * settings.zs : (Math.random() > 0.5 ? 80 : -80);
    ball.style.setProperty('--duration', `${pitchDuration}ms`);
    ball.style.setProperty('--start-offset', `${startOffset}px`);
    ball.style.setProperty('--end-offset', `${endOffset}px`);
    ball.classList.remove('pitching'); void ball.offsetWidth; ball.classList.add('pitching');
    pitchStartTime = Date.now();
    setTimeout(() => { if (isPitching && !hasSwung) endPitch(false); }, pitchDuration);
}

function swing() {
    if (!isPitching || hasSwung || isGameOver) return;
    hasSwung = true; swingBtn.disabled = true;
    bat.classList.add('swinging'); setTimeout(() => bat.classList.remove('swinging'), 300);
    const progress = (Date.now() - pitchStartTime) / pitchDuration;
    const ballTop = -30 + (380 * progress);
    if (ballTop >= STRIKE_ZONE_TOP && ballTop <= STRIKE_ZONE_BOTTOM) handleHit(ballTop);
    else handleStrike("Strike!");
    endPitch(true);
}

function handleHit(ballTop) {
    playSound('crack');
    const accuracy = Math.abs(ballTop - ((STRIKE_ZONE_TOP + STRIKE_ZONE_BOTTOM) / 2));
    let hitResult = "";
    if (accuracy < 10) { hitResult = "HOME RUN!!!"; playSound('bigCheer'); updateCareerStats(true, true); }
    else if (accuracy < 38) { hitResult = "Hit!"; playSound('cheer'); updateCareerStats(true, true); }
    else { hitResult = "Foul Ball"; if (strikes < 2) strikes++; }
    messageDiv.textContent = hitResult;
    if (hitResult !== "Foul Ball") {
        if (!checkCareerMove()) setTimeout(initRandomScenario, 1500);
    }
}

function handleStrike(msg) {
    playSound('thud');
    strikes++; messageDiv.textContent = msg;
    if (strikes >= 3) {
        messageDiv.textContent = "OUT!";
        updateCareerStats(false, true);
        if (!checkCareerMove()) setTimeout(initRandomScenario, 1500);
    }
}

function handleBall() {
    balls++; messageDiv.textContent = "Ball!";
    if (balls >= 4) {
        messageDiv.textContent = "Walk!";
        updateCareerStats(true, false); // Walk is not an AB but we'll count it as a "hit" for fun or just skip update
        if (!checkCareerMove()) setTimeout(initRandomScenario, 1500);
    }
}

function endPitch(swung) {
    isPitching = false; swingBtn.disabled = true;
    if (!swung) { if (isStrikePitch) handleStrike("Strike!"); else handleBall(); }
    updateScoreboard();
}

swingBtn.addEventListener('click', swing);
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !swingBtn.disabled) swing(); });
initRandomScenario();
updateAvgDisplay();
