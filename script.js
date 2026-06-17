const gameArea = document.querySelector('#gameArea');
const player = document.querySelector('#player');
const obstacle = document.querySelector('#obstacle');
const scoreText = document.querySelector('#score');
const targetScoreText = document.querySelector('#targetScore');
const statusText = document.querySelector('#gameStatus');
const message = document.querySelector('#message');
const startButton = document.querySelector('#startButton');
const restartButton = document.querySelector('#restartButton');

const TARGET_SCORE = 15;
const PLAYER_START_BOTTOM = 58;
const JUMP_POWER = 15;
const GRAVITY = 0.8;

let score = 0;
let playerBottom = PLAYER_START_BOTTOM;
let jumpVelocity = 0;
let isJumping = false;
let isGameRunning = false;
let obstacleX = -50;
let obstacleSpeed = 6;
let animationId = null;
let hasScoredCurrentObstacle = false;
let audioContext = null;
let jumpEffectTimeout = null;
let hasPlayedEndSound = false;

targetScoreText.textContent = TARGET_SCORE;

function getAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;

  if (!AudioContext) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContext();
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  return audioContext;
}

function playTone(frequency, startTimeOffset, duration, volume, type = 'sine') {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startTime = context.currentTime + startTimeOffset;
  const endTime = startTime + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startTime);
  oscillator.stop(endTime);
}

function playJumpSound() {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startTime = context.currentTime;
  const endTime = startTime + 0.14;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(420, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(850, endTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.16, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startTime);
  oscillator.stop(endTime);
}

function playWinSound() {
  if (hasPlayedEndSound) return;

  hasPlayedEndSound = true;
  playTone(523.25, 0, 0.12, 0.14);
  playTone(659.25, 0.12, 0.12, 0.14);
  playTone(783.99, 0.24, 0.22, 0.16);
}

function playLoseSound() {
  if (hasPlayedEndSound) return;

  hasPlayedEndSound = true;
  playTone(220, 0, 0.16, 0.15, 'triangle');
  playTone(164.81, 0.16, 0.28, 0.15, 'triangle');
}

function playJumpVisualEffect() {
  player.classList.add('jump-effect');

  if (jumpEffectTimeout) {
    clearTimeout(jumpEffectTimeout);
  }

  jumpEffectTimeout = setTimeout(() => {
    player.classList.remove('jump-effect');
  }, 90);
}

function resetGame() {
  score = 0;
  playerBottom = PLAYER_START_BOTTOM;
  jumpVelocity = 0;
  isJumping = false;
  isGameRunning = false;
  obstacleX = -50;
  obstacleSpeed = 6;
  hasScoredCurrentObstacle = false;
  hasPlayedEndSound = false;

  scoreText.textContent = score;
  statusText.textContent = '대기 중';
  player.style.bottom = `${playerBottom}px`;
  player.classList.remove('jump-effect');
  obstacle.style.right = `${obstacleX}px`;

  showMessage('점프 타이밍 게임', '시작 버튼을 눌러 게임을 시작하세요.');

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function startGame() {
  if (isGameRunning) return;

  getAudioContext();
  isGameRunning = true;
  statusText.textContent = '진행 중';
  hideMessage();
  animationId = requestAnimationFrame(gameLoop);
}

function jump() {
  if (!isGameRunning || isJumping) return;

  isJumping = true;
  jumpVelocity = JUMP_POWER;
  playJumpSound();
  playJumpVisualEffect();
}

function updatePlayer() {
  if (!isJumping) return;

  playerBottom += jumpVelocity;
  jumpVelocity -= GRAVITY;

  if (playerBottom <= PLAYER_START_BOTTOM) {
    playerBottom = PLAYER_START_BOTTOM;
    jumpVelocity = 0;
    isJumping = false;
  }

  player.style.bottom = `${playerBottom}px`;
}

function updateObstacle() {
  obstacleX += obstacleSpeed;
  obstacle.style.right = `${obstacleX}px`;

  const gameWidth = gameArea.clientWidth;
  const obstaclePassedPlayer = gameWidth - obstacleX < 70;

  if (obstaclePassedPlayer && !hasScoredCurrentObstacle) {
    score += 1;
    scoreText.textContent = score;
    hasScoredCurrentObstacle = true;

    if (score % 5 === 0) {
      obstacleSpeed += 0.8;
    }
  }

  if (obstacleX > gameWidth + 60) {
    obstacleX = -50;
    hasScoredCurrentObstacle = false;
  }
}

function isColliding() {
  const playerRect = player.getBoundingClientRect();
  const obstacleRect = obstacle.getBoundingClientRect();

  return !(
    playerRect.right < obstacleRect.left ||
    playerRect.left > obstacleRect.right ||
    playerRect.bottom < obstacleRect.top ||
    playerRect.top > obstacleRect.bottom
  );
}

function endGame(isWin) {
  isGameRunning = false;
  cancelAnimationFrame(animationId);
  animationId = null;

  if (isWin) {
    playWinSound();
    statusText.textContent = '승리!';
    showMessage('승리!', `목표 점수 ${TARGET_SCORE}점을 달성했습니다!`);
  } else {
    playLoseSound();
    statusText.textContent = '패배!';
    showMessage('패배!', '장애물에 부딪혔습니다. 다시 도전해보세요!');
  }
}

function gameLoop() {
  updatePlayer();
  updateObstacle();

  if (isColliding()) {
    endGame(false);
    return;
  }

  if (score >= TARGET_SCORE) {
    endGame(true);
    return;
  }

  animationId = requestAnimationFrame(gameLoop);
}

function showMessage(title, text) {
  message.classList.remove('hide');
  message.innerHTML = `
    <strong>${title}</strong>
    <span>${text}</span>
  `;
}

function hideMessage() {
  message.classList.add('hide');
}

startButton.addEventListener('click', startGame);

restartButton.addEventListener('click', () => {
  resetGame();
  startGame();
});

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();

    if (!isGameRunning && statusText.textContent !== '진행 중') {
      startGame();
      return;
    }

    jump();
  }
});

gameArea.addEventListener('click', () => {
  if (!isGameRunning) {
    startGame();
    return;
  }

  jump();
});

resetGame();
