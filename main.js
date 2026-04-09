const strikesSpan = document.getElementById('strikes');
const ballsSpan = document.getElementById('balls');
const outsSpan = document.getElementById('outs');
const pitchButton = document.getElementById('pitch');
const resultDiv = document.getElementById('result');

let strikes = 0;
let balls = 0;
let outs = 0;

pitchButton.addEventListener('click', () => {
    const random = Math.floor(Math.random() * 3);

    if (random === 0) {
        strikes++;
        resultDiv.textContent = 'Strike!';
    } else if (random === 1) {
        balls++;
        resultDiv.textContent = 'Ball!';
    } else {
        resultDiv.textContent = 'Hit!';
        strikes = 0;
        balls = 0;
    }

    if (strikes === 3) {
        outs++;
        strikes = 0;
        balls = 0;
        resultDiv.textContent = 'Out!';
    }

    if (balls === 4) {
        resultDiv.textContent = 'Walk!';
        strikes = 0;
        balls = 0;
    }

    if (outs === 3) {
        resultDiv.textContent = 'Game Over!';
        pitchButton.disabled = true;
    }

    strikesSpan.textContent = strikes;
    ballsSpan.textContent = balls;
    outsSpan.textContent = outs;
});
