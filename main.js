// --- DOM Elements ---
const strikesSpan = document.getElementById('strikes');
const ballsSpan = document.getElementById('balls');
const outsDots = document.getElementById('outs-dots');
const awayTotal = document.getElementById('away-total');
const homeTotal = document.getElementById('home-total');
const inningNum = document.getElementById('inning-num');
const inningHalf = document.getElementById('inning-half');
const avgSpan = document.getElementById('avg');
const scoutTeamSpan = document.getElementById('scout-team');
const swingBtn = document.getElementById('swing-btn');
const messageDiv = document.getElementById('message');
const ball = document.getElementById('ball');
const bat = document.getElementById('bat');
const strikeZone = document.getElementById('strike-zone');
const difficultySelect = document.getElementById('difficulty');
const bases = [document.getElementById('base-1'), document.getElementById('base-2'), document.getElementById('base-3')];
const awayLineRow = document.getElementById('away-line');
const homeLineRow = document.getElementById('home-line');

// --- Game State ---
let strikes = 0;
let balls = 0;
let outs = 0;
let awayScore = 0;
let homeScore = 0;
let currentInning = 1;
let isBottom = false;
let runners = [false, false, false];
let isPitching = false;
let hasSwung = false;
let isGameOver = false;
let pitchStartTime = 0;
let pitchDuration = 0;
let isStrikePitch = true;
let autoPitchTimer = null;

// Career Stats
let careerHits = parseInt(localStorage.getItem('bigManHits')) || 0;
let careerAtBats = parseInt(localStorage.getItem('bigManAtBats')) || 0;

// Line Score Data
let awayLine = [0, 0, 0, 0, 0, 0, 0, 0, 0];
let homeLine = [0, 0, 0, 0, 0, 0, 0, 0, 0];

const STRIKE_ZONE_TOP = 180; 
const STRIKE_ZONE_BOTTOM = 260;

// --- Sound Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    if (type === 'pop') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'crack') {
        const bufferSize = audioCtx.sampleRate * 0.1;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        noise.connect(noiseGain); noiseGain.connect(audioCtx.destination);
        noise.start(now);
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'thud') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80, now);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    }
}

// --- Career & Scouting ---
function updateCareerStats(isHit, isAtBat) {
    if (isHit) careerHits++;
    if (isAtBat) careerAtBats++;
    localStorage.setItem('bigManHits', careerHits);
    localStorage.setItem('bigManAtBats', careerAtBats);
    updateAvgDisplay();
}

function updateAvgDisplay() {
    const avg = careerAtBats === 0 ? 0 : careerHits / careerAtBats;
    avgSpan.textContent = avg.toFixed(3).substring(1);
    if (avg >= 0.450 && careerAtBats > 20) scoutTeamSpan.textContent = "NY Yankees / SF Giants (OFFER!)";
    else if (avg >= 0.350 && careerAtBats > 10) scoutTeamSpan.textContent = "LA Dodgers / Boston Red Sox";
    else if (avg >= 0.280) scoutTeamSpan.textContent = "Minor League (Triple-A)";
    else scoutTeamSpan.textContent = "Local League Scouts";
}

// --- Line Score Management ---
function updateLineScoreUI() {
    awayTotal.textContent = awayScore;
    homeTotal.textContent = homeScore;
    for (let i = 0; i < 9; i++) {
        awayLineRow.cells[i+1].textContent = (i + 1 < currentInning || (i + 1 === currentInning && isBottom)) ? awayLine[i] : (i + 1 === currentInning ? awayLine[i] : "-");
        homeLineRow.cells[i+1].textContent = (i + 1 < currentInning) ? homeLine[i] : (i + 1 === currentInning && isBottom ? homeLine[i] : "-");
    }
}

// --- Game Logic ---
function initRandomScenario() {
    isGameOver = false;
    currentInning = Math.floor(Math.random() * 9) + 1;
    isBottom = Math.random() > 0.5;
    outs = Math.floor(Math.random() * 3);
    strikes = 0; balls = 0;
    awayScore = 0; homeScore = 0;
    for (let i = 0; i < 9; i++) {
        if (i + 1 < currentInning) {
            awayLine[i] = Math.floor(Math.random() * 3);
            homeLine[i] = Math.floor(Math.random() * 3);
        } else if (i + 1 === currentInning) {
            awayLine[i] = Math.floor(Math.random() * 2);
            homeLine[i] = isBottom ? Math.floor(Math.random() * 2) : 0;
        } else {
            awayLine[i] = 0; homeLine[i] = 0;
        }
        awayScore += awayLine[i];
        homeScore += homeLine[i];
    }
    runners = [Math.random() > 0.7, Math.random() > 0.8, Math.random() > 0.9];
    updateScoreboard();
    updateLineScoreUI();
    updateBasesUI();
    updateAvgDisplay();
    messageDiv.textContent = "Big Man highlights...";
    setTimeout(startAutoPitch, 1500);
}

function updateScoreboard() {
    strikesSpan.textContent = strikes;
    ballsSpan.textContent = balls;
    inningNum.textContent = currentInning;
    inningHalf.textContent = isBottom ? "Bottom" : "Top";
    outsDots.innerHTML = "";
    for (let i = 0; i < 2; i++) {
        const dot = document.createElement('div');
        dot.className = 'out-dot' + (i < outs ? ' filled' : '');
        outsDots.appendChild(dot);
    }
}

function updateBasesUI() {
    runners.forEach((occupied, index) => bases[index].classList.toggle('occupied', occupied));
}

function startAutoPitch() {
    if (autoPitchTimer) clearInterval(autoPitchTimer);
    autoPitchTimer = setInterval(() => {
        if (!isPitching && !isGameOver) {
            let countdown = 3;
            const countInterval = setInterval(() => {
                if (isGameOver) { clearInterval(countInterval); return; }
                messageDiv.textContent = `Next pitch in ${countdown}s...`;
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
                     diff === 'hard' ? { dr: [500, 800], sp: 0.5, zs: 60 } :
                     { dr: [700, 1300], sp: 0.7, zs: 80 };
    strikeZone.style.width = settings.zs + 'px';
    strikeZone.style.height = settings.zs + 'px';
    isPitching = true; hasSwung = false; swingBtn.disabled = false;
    messageDiv.textContent = "Pitch is coming!";
    playSound('pop');
    pitchDuration = settings.dr[0] + Math.random() * (settings.dr[1] - settings.dr[0]);
    isStrikePitch = Math.random() < settings.sp;
    const startOffset = (Math.random() - 0.5) * 40;
    const endOffset = isStrikePitch ? (Math.random() - 0.5) * settings.zs : (Math.random() > 0.5 ? 80 : -80);
    ball.style.setProperty('--duration', `${pitchDuration}ms`);
    ball.style.setProperty('--start-offset', `${startOffset}px`);
    ball.style.setProperty('--end-offset', `${endOffset}px`);
    ball.classList.remove('pitching');
    void ball.offsetWidth;
    ball.classList.add('pitching');
    pitchStartTime = Date.now();
    setTimeout(() => { if (isPitching && !hasSwung) endPitch(false); }, pitchDuration);
}

function swing() {
    if (!isPitching || hasSwung || isGameOver) return;
    hasSwung = true; swingBtn.disabled = true;
    bat.classList.add('swinging');
    setTimeout(() => bat.classList.remove('swinging'), 300);
    const progress = (Date.now() - pitchStartTime) / pitchDuration;
    const ballTop = -30 + (380 * progress);
    if (ballTop >= STRIKE_ZONE_TOP && ballTop <= STRIKE_ZONE_BOTTOM) handleHit(ballTop);
    else handleStrike("Strike! (Miss)");
    endPitch(true);
}

function handleHit(ballTop) {
    playSound('crack');
    const center = (STRIKE_ZONE_TOP + STRIKE_ZONE_BOTTOM) / 2;
    const accuracy = Math.abs(ballTop - center);
    let hitResult = "";
    if (accuracy < 10) { hitResult = "HOME RUN!!!"; advanceRunners(4); updateCareerStats(true, true); }
    else if (accuracy < 20) { hitResult = "Triple!"; advanceRunners(3); updateCareerStats(true, true); }
    else if (accuracy < 30) { hitResult = "Double!"; advanceRunners(2); updateCareerStats(true, true); }
    else if (accuracy < 38) { hitResult = "Single!"; advanceRunners(1); updateCareerStats(true, true); }
    else { hitResult = "Foul Ball"; if (strikes < 2) strikes++; }
    messageDiv.textContent = hitResult;
    if (hitResult !== "Foul Ball") {
        strikes = 0; balls = 0;
        setTimeout(initRandomScenario, 1000); // Jump to next highlight
    }
}

function advanceRunners(numBases) {
    let newRuns = 0;
    for (let i = 2; i >= 0; i--) {
        if (runners[i]) {
            runners[i] = false;
            if (i + numBases >= 3) newRuns++; else runners[i + numBases] = true;
        }
    }
    if (numBases < 4) runners[numBases - 1] = true; else newRuns++; 
    if (newRuns > 0) {
        if (isBottom) homeScore += newRuns; else awayScore += newRuns;
    }
}

function handleStrike(msg) {
    playSound('thud');
    strikes++; messageDiv.textContent = msg;
    if (strikes >= 3) {
        messageDiv.textContent = "OUT!";
        updateCareerStats(false, true);
        strikes = 0; balls = 0;
        setTimeout(initRandomScenario, 1000); // Jump to next highlight
    }
}

function handleBall() {
    balls++; messageDiv.textContent = "Ball!";
    if (balls >= 4) {
        messageDiv.textContent = "Walk!";
        advanceRunners(1); strikes = 0; balls = 0;
        setTimeout(initRandomScenario, 1000); // Jump to next highlight
    }
}

function endPitch(swung) {
    isPitching = false; swingBtn.disabled = true;
    if (!swung && !isGameOver) {
        if (isStrikePitch) handleStrike("Strike! (Looking)");
        else handleBall();
    }
    updateScoreboard();
}

swingBtn.addEventListener('click', swing);
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !swingBtn.disabled) swing(); });
initRandomScenario();
