// --- DOM Elements ---
const strikesSpan = document.getElementById('strikes');
const ballsSpan = document.getElementById('balls');
const outsSpan = document.getElementById('outs');
const runsSpan = document.getElementById('runs');
const highScoreSpan = document.getElementById('high-score');
const pitchBtn = document.getElementById('pitch-btn');
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
let runs = 0;
let runners = [false, false, false]; // [1st, 2nd, 3rd]
let highScore = parseInt(localStorage.getItem('baseballHighScore')) || 0;
let isPitching = false;
let hasSwung = false;
let pitchStartTime = 0;
let pitchDuration = 0;
let isStrikePitch = true;

const STRIKE_ZONE_TOP = 200; 
const STRIKE_ZONE_BOTTOM = 280;

// --- Sound Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === 'pop') {
        osc.frequency.setValueAtTime(440, now);
        oscillatorRamp(osc, gain, 110, 0.3, 0.1);
    } else if (type === 'crack') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        oscillatorRamp(osc, gain, 220, 0.4, 0.2);
    } else if (type === 'thud') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        oscillatorRamp(osc, gain, 40, 0.5, 0.3);
    }
}
function oscillatorRamp(osc, gain, freq, vol, duration) {
    const now = audioCtx.currentTime;
    osc.frequency.exponentialRampToValueAtTime(freq, now + duration);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    osc.start(now);
    osc.stop(now + duration);
}

// --- Runner Logic ---
function updateBasesUI() {
    runners.forEach((occupied, index) => {
        bases[index].classList.toggle('occupied', occupied);
    });
}

function advanceRunners(numBases) {
    let newRuns = 0;
    // Advance existing runners
    for (let i = 2; i >= 0; i--) {
        if (runners[i]) {
            runners[i] = false;
            if (i + numBases >= 3) {
                newRuns++;
            } else {
                runners[i + numBases] = true;
            }
        }
    }
    // Add the batter (unless it's a walk/hit that doesn't advance batter to specific base)
    if (numBases < 4) {
        runners[numBases - 1] = true;
    } else {
        newRuns++; // Home Run
    }

    if (newRuns > 0) {
        runs += newRuns;
        playSound('crack'); // Double sound for scoring
    }
    updateBasesUI();
    updateScoreboard();
}

function clearBases() {
    runners = [false, false, false];
    updateBasesUI();
}

// --- Game Logic ---
function updateScoreboard() {
    strikesSpan.textContent = strikes;
    ballsSpan.textContent = balls;
    outsSpan.textContent = outs;
    runsSpan.textContent = runs;
    highScoreSpan.textContent = highScore;
}

function resetAtBat() {
    strikes = 0;
    balls = 0;
    updateScoreboard();
}

function getDifficultySettings() {
    const diff = difficultySelect.value;
    if (diff === 'easy') return { durationRange: [1200, 1800], strikeProb: 0.9, zoneSize: 100 };
    if (diff === 'hard') return { durationRange: [500, 800], strikeProb: 0.5, zoneSize: 60 };
    return { durationRange: [700, 1300], strikeProb: 0.7, zoneSize: 80 };
}

function pitch() {
    if (isPitching) return;
    const settings = getDifficultySettings();
    strikeZone.style.width = settings.zoneSize + 'px';
    strikeZone.style.height = settings.zoneSize + 'px';

    isPitching = true;
    hasSwung = false;
    pitchBtn.disabled = true;
    swingBtn.disabled = false;
    difficultySelect.disabled = true;
    messageDiv.textContent = "Pitch is coming...";
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
    if (!isPitching || hasSwung) return;
    hasSwung = true;
    swingBtn.disabled = true;

    // Bat animation
    bat.classList.add('swinging');
    setTimeout(() => bat.classList.remove('swinging'), 300);

    const elapsed = Date.now() - pitchStartTime;
    const progress = elapsed / pitchDuration;
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
    // Determine hit type based on how centered the ball was in the zone (200-280)
    const center = (STRIKE_ZONE_TOP + STRIKE_ZONE_BOTTOM) / 2; // 240
    const accuracy = Math.abs(ballTop - center);

    if (accuracy < 10) {
        messageDiv.textContent = "HOME RUN!!!";
        messageDiv.className = "hit";
        advanceRunners(4);
    } else if (accuracy < 20) {
        messageDiv.textContent = "Triple!";
        messageDiv.className = "hit";
        advanceRunners(3);
    } else if (accuracy < 30) {
        messageDiv.textContent = "Double!";
        messageDiv.className = "hit";
        advanceRunners(2);
    } else if (accuracy < 38) {
        messageDiv.textContent = "Single!";
        messageDiv.className = "hit";
        advanceRunners(1);
    } else {
        messageDiv.textContent = "Foul Ball";
        messageDiv.className = "";
        if (strikes < 2) strikes++;
    }
    resetAtBat();
}

function handleStrike(msg) {
    playSound('thud');
    strikes++;
    messageDiv.textContent = msg || "Strike!";
    messageDiv.className = "strike";
    if (strikes >= 3) {
        outs++;
        messageDiv.textContent = "OUT!";
        resetAtBat();
    }
}

function handleBall() {
    balls++;
    messageDiv.textContent = "Ball!";
    messageDiv.className = "ball-call";
    if (balls >= 4) {
        messageDiv.textContent = "Walk!";
        messageDiv.className = "hit";
        advanceRunners(1);
        resetAtBat();
    }
}

function endPitch(swung) {
    isPitching = false;
    pitchBtn.disabled = false;
    swingBtn.disabled = true;

    if (!swung) {
        if (isStrikePitch) handleStrike("Strike! (Looking)");
        else handleBall();
    }

    if (outs >= 3) {
        if (runs > highScore) {
            highScore = runs;
            localStorage.setItem('baseballHighScore', highScore);
        }
        messageDiv.textContent = "GAME OVER! Score: " + runs;
        pitchBtn.disabled = true;
        difficultySelect.disabled = false;
        setTimeout(() => {
            if (confirm("Game Over! Score: " + runs + ". Restart?")) {
                runs = 0; outs = 0; clearBases();
                resetAtBat();
                pitchBtn.disabled = false;
                updateScoreboard();
            }
        }, 500);
    }
    updateScoreboard();
}

pitchBtn.addEventListener('click', pitch);
swingBtn.addEventListener('click', swing);
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (!pitchBtn.disabled) pitch();
        else if (!swingBtn.disabled) swing();
    }
});
updateScoreboard();
updateBasesUI();
