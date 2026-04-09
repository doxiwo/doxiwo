// --- DOM Elements ---
const strikesSpan = document.getElementById('strikes');
const ballsSpan = document.getElementById('balls');
const outsSpan = document.getElementById('outs');
const awayScoreSpan = document.getElementById('away-score');
const homeScoreSpan = document.getElementById('home-score');
const inningNumSpan = document.getElementById('inning-num');
const inningHalfSpan = document.getElementById('inning-half');
const avgSpan = document.getElementById('avg');
const scoutTeamSpan = document.getElementById('scout-team');
const swingBtn = document.getElementById('swing-btn');
const messageDiv = document.getElementById('message');
const ball = document.getElementById('ball');
const bat = document.getElementById('bat');
const strikeZone = document.getElementById('strike-zone');
const difficultySelect = document.getElementById('difficulty');
const bases = [
    document.getElementById('base-1'),
    document.getElementById('base-2'),
    document.getElementById('base-3')
];

// --- Game State ---
let strikes = 0;
let balls = 0;
let outs = 0;
let awayScore = 0;
let homeScore = 0;
let inning = 1;
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

const STRIKE_ZONE_TOP = 200; 
const STRIKE_ZONE_BOTTOM = 280;

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

// --- Game Logic ---
function initRandomGame() {
    isGameOver = false;
    inning = Math.floor(Math.random() * 9) + 1;
    isBottom = Math.random() > 0.5;
    outs = Math.floor(Math.random() * 3);
    strikes = 0; balls = 0;
    
    // Weighted random score based on inning
    awayScore = Math.floor(Math.random() * (inning + 1));
    homeScore = Math.floor(Math.random() * (inning + 1));
    
    // Random runners
    runners = [Math.random() > 0.7, Math.random() > 0.8, Math.random() > 0.9];
    
    updateScoreboard();
    updateBasesUI();
    updateAvgDisplay();
    startAutoPitch();
}

function updateScoreboard() {
    strikesSpan.textContent = strikes;
    ballsSpan.textContent = balls;
    outsSpan.textContent = outs;
    awayScoreSpan.textContent = awayScore;
    homeScoreSpan.textContent = homeScore;
    inningNumSpan.textContent = inning;
    inningHalfSpan.textContent = isBottom ? "Bottom" : "Top";
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
    isPitching = true; hasSwung = false;
    swingBtn.disabled = false;
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
    if (accuracy < 10) { messageDiv.textContent = "HOME RUN!!!"; advanceRunners(4); updateCareerStats(true, true); }
    else if (accuracy < 20) { messageDiv.textContent = "Triple!"; advanceRunners(3); updateCareerStats(true, true); }
    else if (accuracy < 30) { messageDiv.textContent = "Double!"; advanceRunners(2); updateCareerStats(true, true); }
    else if (accuracy < 38) { messageDiv.textContent = "Single!"; advanceRunners(1); updateCareerStats(true, true); }
    else { messageDiv.textContent = "Foul Ball"; if (strikes < 2) strikes++; }
    strikes = 0; balls = 0;
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
        checkWalkOff();
    }
    updateBasesUI();
}

function handleStrike(msg) {
    playSound('thud');
    strikes++; messageDiv.textContent = msg;
    if (strikes >= 3) {
        outs++; messageDiv.textContent = "OUT!";
        updateCareerStats(false, true);
        strikes = 0; balls = 0;
        checkInningEnd();
    }
}

function handleBall() {
    balls++; messageDiv.textContent = "Ball!";
    if (balls >= 4) {
        messageDiv.textContent = "Walk!";
        advanceRunners(1); strikes = 0; balls = 0;
    }
}

function checkWalkOff() {
    if (inning >= 9 && isBottom && homeScore > awayScore) {
        isGameOver = true;
        messageDiv.textContent = "WALK-OFF VICTORY!!!";
        endGame();
    }
}

function checkInningEnd() {
    if (outs >= 3) {
        if (inning >= 9 && (!isBottom || homeScore !== awayScore)) {
            isGameOver = true;
            endGame();
        } else {
            // Next half-inning
            outs = 0; strikes = 0; balls = 0;
            runners = [false, false, false];
            if (isBottom) { inning++; isBottom = false; } else { isBottom = true; }
            messageDiv.textContent = `Inning ${inning} ${isBottom ? "Bottom" : "Top"} begins!`;
            updateBasesUI();
        }
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

function endGame() {
    clearInterval(autoPitchTimer);
    const win = homeScore > awayScore;
    const msg = win ? "VICTORY!" : (homeScore === awayScore ? "DRAW!" : "DEFEAT...");
    setTimeout(() => {
        if (confirm(`${msg}\nFinal: Away ${awayScore} - Home ${homeScore}\nPlay again?`)) initRandomGame();
    }, 1000);
}

swingBtn.addEventListener('click', swing);
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !swingBtn.disabled) swing(); });
initRandomGame();
