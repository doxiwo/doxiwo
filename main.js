const strikesSpan = document.getElementById('strikes');
const ballsSpan = document.getElementById('balls');
const outsSpan = document.getElementById('outs');
const runsSpan = document.getElementById('runs');
const pitchBtn = document.getElementById('pitch-btn');
const swingBtn = document.getElementById('swing-btn');
const messageDiv = document.getElementById('message');
const ball = document.getElementById('ball');

let strikes = 0;
let balls = 0;
let outs = 0;
let runs = 0;
let isPitching = false;
let hasSwung = false;
let pitchStartTime = 0;
let pitchDuration = 0;
let isStrikePitch = true;

const STRIKE_ZONE_TOP = 200; // Ball top position where it enters strike zone
const STRIKE_ZONE_BOTTOM = 280; // Ball top position where it leaves strike zone

function updateScoreboard() {
    strikesSpan.textContent = strikes;
    ballsSpan.textContent = balls;
    outsSpan.textContent = outs;
    runsSpan.textContent = runs;
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

function pitch() {
    if (isPitching) return;

    isPitching = true;
    hasSwung = false;
    pitchBtn.disabled = true;
    swingBtn.disabled = false;
    showMessage("Here comes the pitch!", "");

    // Randomize pitch properties for "Challenging Mode"
    pitchDuration = 600 + Math.random() * 1200; // 0.6s to 1.8s
    isStrikePitch = Math.random() > 0.3; // 70% chance of strike pitch
    
    const startOffset = (Math.random() - 0.5) * 40; // Random horizontal start
    const endOffset = isStrikePitch ? (Math.random() - 0.5) * 60 : (Math.random() > 0.5 ? 80 : -80); // End inside or outside

    ball.style.setProperty('--duration', `${pitchDuration}ms`);
    ball.style.setProperty('--start-offset', `${startOffset}px`);
    ball.style.setProperty('--end-offset', `${endOffset}px`);
    
    ball.classList.remove('pitching');
    void ball.offsetWidth; // Trigger reflow
    ball.classList.add('pitching');

    pitchStartTime = Date.now();

    // Handle end of pitch (if no swing)
    setTimeout(() => {
        if (isPitching && !hasSwung) {
            endPitch(false);
        }
    }, pitchDuration);
}

function swing() {
    if (!isPitching || hasSwung) return;
    hasSwung = true;
    swingBtn.disabled = true;

    const currentTime = Date.now();
    const elapsed = currentTime - pitchStartTime;
    const progress = elapsed / pitchDuration;
    
    // Calculate ball's vertical position based on progress (0 to 380px roughly)
    const ballTop = -30 + (380 * progress);

    if (ballTop >= STRIKE_ZONE_TOP && ballTop <= STRIKE_ZONE_BOTTOM) {
        // HIT!
        handleHit();
    } else {
        // STRIKE! (Missed timing)
        handleStrike("Strike! (Bad timing)");
    }
    
    endPitch(true);
}

function handleHit() {
    const random = Math.random();
    if (random > 0.9) {
        runs++;
        showMessage("HOME RUN!!!", "hit");
    } else if (random > 0.6) {
        showMessage("Base Hit!", "hit");
        // Simple logic: every few hits could be a run, but let's keep it simple
        if (Math.random() > 0.7) runs++; 
    } else {
        showMessage("Foul Ball", "");
        if (strikes < 2) strikes++; // Foul only adds strike if < 2
    }
    resetAtBat();
}

function handleStrike(msg) {
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
        showMessage("GAME OVER! Final Score: " + runs, "strike");
        pitchBtn.disabled = true;
        setTimeout(() => {
            if (confirm("Game Over! Restart?")) {
                location.reload();
            }
        }, 1000);
    }

    updateScoreboard();
}

pitchBtn.addEventListener('click', pitch);
swingBtn.addEventListener('click', swing);

// Add keyboard support (Space to swing)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (!pitchBtn.disabled) pitch();
        else if (!swingBtn.disabled) swing();
    }
});
