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
const strikeZone = document.getElementById('strike-zone');
const difficultySelect = document.getElementById('difficulty');

// --- Game State ---
let strikes = 0;
let balls = 0;
let outs = 0;
let runs = 0;
let highScore = parseInt(localStorage.getItem('baseballHighScore')) || 0;
let isPitching = false;
let hasSwung = false;
let pitchStartTime = 0;
let pitchDuration = 0;
let isStrikePitch = true;

const STRIKE_ZONE_TOP = 200; 
const STRIKE_ZONE_BOTTOM = 280;

// --- Sound Engine (Synthesized) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;

    if (type === 'pop') { // Pitch
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, now);
        oscillator.frequency.exponentialRampToValueAtTime(110, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
    } else if (type === 'crack') { // Hit
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, now);
        oscillator.frequency.exponentialRampToValueAtTime(220, now + 0.2);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
    } else if (type === 'thud') { // Strike / Out
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(150, now);
        oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.3);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
    }
}

// --- Logic ---
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

function showMessage(text, className) {
    messageDiv.textContent = text;
    messageDiv.className = className || '';
}

function getDifficultySettings() {
    const diff = difficultySelect.value;
    if (diff === 'easy') {
        return { durationRange: [1200, 2000], strikeProb: 0.9, zoneSize: 100 };
    } else if (diff === 'hard') {
        return { durationRange: [500, 900], strikeProb: 0.5, zoneSize: 60 };
    }
    return { durationRange: [700, 1400], strikeProb: 0.7, zoneSize: 80 }; // normal
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
    showMessage("Here comes the pitch!", "");
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

    const currentTime = Date.now();
    const elapsed = currentTime - pitchStartTime;
    const progress = elapsed / pitchDuration;
    const ballTop = -30 + (380 * progress);

    if (ballTop >= STRIKE_ZONE_TOP && ballTop <= STRIKE_ZONE_BOTTOM) {
        handleHit();
    } else {
        handleStrike("Strike! (Bad timing)");
    }
    
    endPitch(true);
}

function handleHit() {
    playSound('crack');
    const random = Math.random();
    if (random > 0.9) {
        runs++;
        showMessage("HOME RUN!!!", "hit");
    } else if (random > 0.6) {
        showMessage("Base Hit!", "hit");
        if (Math.random() > 0.7) runs++; 
    } else {
        showMessage("Foul Ball", "");
        if (strikes < 2) strikes++;
    }
    resetAtBat();
}

function handleStrike(msg) {
    playSound('thud');
    strikes++;
    showMessage(msg || "Strike!", "strike");
    if (strikes >= 3) {
        outs++;
        showMessage("You're OUT!", "strike");
        resetAtBat();
    }
}

function handleBall() {
    balls++;
    showMessage("Ball!", "ball-call");
    if (balls >= 4) {
        runs++;
        showMessage("Walk!", "hit");
        resetAtBat();
    }
}

function checkHighScore() {
    if (runs > highScore) {
        highScore = runs;
        localStorage.setItem('baseballHighScore', highScore);
        showMessage("NEW HIGH SCORE!", "hit");
    }
}

function endPitch(swung) {
    isPitching = false;
    pitchBtn.disabled = false;
    swingBtn.disabled = true;

    if (!swung) {
        if (isStrikePitch) {
            handleStrike("Strike! (Looking)");
        } else {
            handleBall();
        }
    }

    if (outs >= 3) {
        checkHighScore();
        showMessage("GAME OVER! Score: " + runs, "strike");
        pitchBtn.disabled = true;
        difficultySelect.disabled = false;
        setTimeout(() => {
            if (confirm("Game Over! Final Score: " + runs + ". Restart?")) {
                runs = 0;
                outs = 0;
                resetAtBat();
                pitchBtn.disabled = false;
                updateScoreboard();
            }
        }, 500);
    }

    updateScoreboard();
}

// --- Listeners ---
pitchBtn.addEventListener('click', pitch);
swingBtn.addEventListener('click', swing);

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (!pitchBtn.disabled) pitch();
        else if (!swingBtn.disabled) swing();
    }
});

updateScoreboard();
