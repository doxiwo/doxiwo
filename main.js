// --- DOM Elements ---
const strikesSpan = document.getElementById('strikes');
const ballsSpan = document.getElementById('balls');
const outsSpan = document.getElementById('outs');
const awayScoreSpan = document.getElementById('away-score');
const homeScoreSpan = document.getElementById('home-score');
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
let outs = 2; // Always starts at 2 outs
let awayScore = 0;
let homeScore = 0;
let runners = [false, false, false];
let isPitching = false;
let hasSwung = false;
let isGameOver = false;
let pitchStartTime = 0;
let pitchDuration = 0;
let isStrikePitch = true;
let autoPitchTimer = null;

const STRIKE_ZONE_TOP = 200; 
const STRIKE_ZONE_BOTTOM = 280;

// --- Sound Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === 'pop') {
        osc.frequency.setValueAtTime(440, now);
        oscillatorRamp(osc, gain, 110, 0.3, 0.1);
    } else if (type === 'crack') {
        osc.type = 'square'; osc.frequency.setValueAtTime(880, now);
        oscillatorRamp(osc, gain, 220, 0.4, 0.2);
    } else if (type === 'thud') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(150, now);
        oscillatorRamp(osc, gain, 40, 0.5, 0.3);
    }
}
function oscillatorRamp(osc, gain, freq, vol, duration) {
    const now = audioCtx.currentTime;
    osc.frequency.exponentialRampToValueAtTime(freq, now + duration);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    osc.start(now); osc.stop(now + duration);
}

// --- Initialization ---
function initScenario() {
    isGameOver = false;
    outs = 2;
    strikes = 0;
    balls = 0;
    awayScore = Math.floor(Math.random() * 5) + 3; // 3-7
    // Randomly trailing, tied, or leading
    homeScore = awayScore + (Math.floor(Math.random() * 5) - 3); // awayScore -3 to +1
    
    // Random runners for tension
    runners = [Math.random() > 0.6, Math.random() > 0.7, Math.random() > 0.8];
    
    updateScoreboard();
    updateBasesUI();
    startAutoPitch();
}

function updateScoreboard() {
    strikesSpan.textContent = strikes;
    ballsSpan.textContent = balls;
    outsSpan.textContent = outs;
    awayScoreSpan.textContent = awayScore;
    homeScoreSpan.textContent = homeScore;
}

function updateBasesUI() {
    runners.forEach((occupied, index) => bases[index].classList.toggle('occupied', occupied));
}

// --- Pitching Logic ---
function startAutoPitch() {
    if (autoPitchTimer) clearInterval(autoPitchTimer);
    autoPitchTimer = setInterval(() => {
        if (!isPitching && !isGameOver) {
            let countdown = 3;
            const countInterval = setInterval(() => {
                if (isGameOver) { clearInterval(countInterval); return; }
                messageDiv.textContent = `Next pitch in ${countdown}s...`;
                countdown--;
                if (countdown < 0) {
                    clearInterval(countInterval);
                    pitch();
                }
            }, 1000);
        }
    }, 4000); // Check every 4s to ensure 3s gap after pitch ends
}

function pitch() {
    if (isPitching || isGameOver) return;
    const diff = difficultySelect.value;
    const settings = diff === 'easy' ? { durationRange: [1200, 1800], strikeProb: 0.9, zoneSize: 100 } :
                     diff === 'hard' ? { durationRange: [500, 800], strikeProb: 0.5, zoneSize: 60 } :
                     { durationRange: [700, 1300], strikeProb: 0.7, zoneSize: 80 };

    strikeZone.style.width = settings.zoneSize + 'px';
    strikeZone.style.height = settings.zoneSize + 'px';

    isPitching = true;
    hasSwung = false;
    swingBtn.disabled = false;
    difficultySelect.disabled = true;
    messageDiv.textContent = "Pitch is coming!";
    messageDiv.className = "";
    playSound('pop');

    pitchDuration = settings.durationRange[0] + Math.random() * (settings.durationRange[1] - settings.durationRange[0]);
    isStrikePitch = Math.random() < settings.strikeProb;
    
    const startOffset = (Math.random() - 0.5) * 40;
    const endOffset = isStrikePitch ? (Math.random() - 0.5) * settings.zoneSize : (Math.random() > 0.5 ? 80 : -80);

    ball.style.setProperty('--duration', `${pitchDuration}ms`);
    ball.style.setProperty('--start-offset', `${startOffset}px`);
    ball.style.setProperty('--end-offset', `${endOffset}px`);
    
    ball.classList.remove('pitching');
    void ball.offsetWidth;
    ball.classList.add('pitching');
    pitchStartTime = Date.now();

    setTimeout(() => {
        if (isPitching && !hasSwung) endPitch(false);
    }, pitchDuration);
}

function swing() {
    if (!isPitching || hasSwung || isGameOver) return;
    hasSwung = true;
    swingBtn.disabled = true;

    bat.classList.add('swinging');
    setTimeout(() => bat.classList.remove('swinging'), 300);

    const progress = (Date.now() - pitchStartTime) / pitchDuration;
    const ballTop = -30 + (380 * progress);

    if (ballTop >= STRIKE_ZONE_TOP && ballTop <= STRIKE_ZONE_BOTTOM) {
        handleHit(ballTop);
    } else {
        handleStrike("Strike! (Bad timing)");
    }
    endPitch(true);
}

function handleHit(ballTop) {
    playSound('crack');
    const center = (STRIKE_ZONE_TOP + STRIKE_ZONE_BOTTOM) / 2;
    const accuracy = Math.abs(ballTop - center);

    if (accuracy < 10) { messageDiv.textContent = "HOME RUN!!!"; advanceRunners(4); }
    else if (accuracy < 20) { messageDiv.textContent = "Triple!"; advanceRunners(3); }
    else if (accuracy < 30) { messageDiv.textContent = "Double!"; advanceRunners(2); }
    else if (accuracy < 38) { messageDiv.textContent = "Single!"; advanceRunners(1); }
    else { messageDiv.textContent = "Foul Ball"; if (strikes < 2) strikes++; }
    
    strikes = 0; balls = 0;
}

function advanceRunners(numBases) {
    let newRuns = 0;
    for (let i = 2; i >= 0; i--) {
        if (runners[i]) {
            runners[i] = false;
            if (i + numBases >= 3) newRuns++;
            else runners[i + numBases] = true;
        }
    }
    if (numBases < 4) runners[numBases - 1] = true;
    else newRuns++; 
    
    if (newRuns > 0) {
        homeScore += newRuns;
        playSound('crack');
        checkWinCondition();
    }
    updateBasesUI();
}

function handleStrike(msg) {
    playSound('thud');
    strikes++;
    messageDiv.textContent = msg;
    messageDiv.className = "strike";
    if (strikes >= 3) {
        outs++;
        messageDiv.textContent = "OUT!";
        strikes = 0; balls = 0;
        checkGameOver();
    }
}

function handleBall() {
    balls++;
    messageDiv.textContent = "Ball!";
    messageDiv.className = "ball-call";
    if (balls >= 4) {
        messageDiv.textContent = "Walk!";
        advanceRunners(1);
        strikes = 0; balls = 0;
    }
}

function checkWinCondition() {
    if (homeScore > awayScore) {
        isGameOver = true;
        messageDiv.textContent = "WALK-OFF VICTORY!!!";
        messageDiv.className = "hit";
        endGame();
    }
}

function checkGameOver() {
    if (outs >= 3) {
        isGameOver = true;
        if (homeScore > awayScore) {
            messageDiv.textContent = "VICTORY!!!";
        } else if (homeScore === awayScore) {
            messageDiv.textContent = "DRAW! Game to Extra Innings?";
        } else {
            messageDiv.textContent = "DEFEAT... 9th Inning Over.";
        }
        endGame();
    }
}

function endPitch(swung) {
    isPitching = false;
    swingBtn.disabled = true;
    if (!swung && !isGameOver) {
        if (isStrikePitch) handleStrike("Strike! (Looking)");
        else handleBall();
    }
    updateScoreboard();
}

function endGame() {
    clearInterval(autoPitchTimer);
    difficultySelect.disabled = false;
    setTimeout(() => {
        if (confirm(`${messageDiv.textContent}\nFinal Score: ${awayScore}-${homeScore}\nPlay again?`)) {
            initScenario();
        }
    }, 1000);
}

swingBtn.addEventListener('click', swing);
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (!swingBtn.disabled) swing();
    }
});

initScenario();
