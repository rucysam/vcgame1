const gameArea = document.querySelector('#gameArea');
const player = document.querySelector('#player');
const obstacle = document.querySelector('#obstacle');
const levelText = document.querySelector('#level');
const scoreText = document.querySelector('#score');
const targetScoreText = document.querySelector('#targetScore');
const statusText = document.querySelector('#gameStatus');
const message = document.querySelector('#message');
const startButton = document.querySelector('#startButton');
const restartButton = document.querySelector('#restartButton');
const rankingList = document.querySelector('#rankingList');
const clearRankingButton = document.querySelector('#clearRankingButton');

const LEVELS = [
  {
    level: 1,
    targetScore: 5,
    obstacleSpeed: 6,
    obstacleWidth: 34,
    obstacleHeight: 48,
    label: '1단계',
  },
  {
    level: 2,
    targetScore: 10,
    obstacleSpeed: 7.7,
    obstacleWidth: 38,
    obstacleHeight: 56,
    label: '2단계',
  },
  {
    level: 3,
    targetScore: 15,
    obstacleSpeed: 9.4,
    obstacleWidth: 44,
    obstacleHeight: 64,
    label: '3단계',
  },
];

const FINAL_TARGET_SCORE = LEVELS[LEVELS.length - 1].targetScore;
const PLAYER_START_BOTTOM = 58;
const JUMP_POWER = 15;
const GRAVITY = 0.8;
const RANKING_STORAGE_KEY = 'jumpTimingGameRanking';
const MAX_RANKING_COUNT = 10;

let score = 0;
let currentLevelIndex = 0;
let playerBottom = PLAYER_START_BOTTOM;
let jumpVelocity = 0;
let isJumping = false;
let isGameRunning = false;
let obstacleX = -50;
let obstacleSpeed = LEVELS[0].obstacleSpeed;
let animationId = null;
let hasScoredCurrentObstacle = false;
let audioContext = null;
let jumpEffectTimeout = null;
let hasPlayedEndSound = false;
let lastGameResult = null;
let isLevelChanging = false;

targetScoreText.textContent = FINAL_TARGET_SCORE;

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

function playLevelUpSound() {
  playTone(440, 0, 0.08, 0.12, 'square');
  playTone(660, 0.08, 0.08, 0.12, 'square');
  playTone(880, 0.16, 0.12, 0.14, 'square');
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

function getRankingRecords() {
  const savedRanking = localStorage.getItem(RANKING_STORAGE_KEY);

  if (!savedRanking) {
    return [];
  }

  try {
    return JSON.parse(savedRanking);
  } catch (error) {
    localStorage.removeItem(RANKING_STORAGE_KEY);
    return [];
  }
}

function saveRankingRecords(records) {
  localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(records));
}

function formatDate(dateText) {
  const date = new Date(dateText);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${month}/${day} ${hour}:${minute}`;
}

function renderRanking() {
  const records = getRankingRecords();

  if (records.length === 0) {
    rankingList.innerHTML = '<p class="ranking-empty">아직 플레이 로그가 없습니다.</p>';
    return;
  }

  rankingList.innerHTML = records
    .map((record) => {
      const resultClass = record.result === '승리' ? 'result-win' : 'result-lose';
      const levelLabel = record.level ? `${record.level}단계` : '기록 없음';

      return `
        <li>
          <span>${record.nickname}</span>
          <span class="${resultClass}">${record.result} / ${record.score}점 / ${levelLabel}</span>
          <span class="play-date">${formatDate(record.createdAt)}</span>
        </li>
      `;
    })
    .join('');
}

function addRankingRecord(nickname) {
  const trimmedNickname = nickname.trim().slice(0, 12);

  if (!trimmedNickname || !lastGameResult) {
    return;
  }

  const records = getRankingRecords();
  const newRecord = {
    nickname: trimmedNickname,
    score: lastGameResult.score,
    level: lastGameResult.level,
    result: lastGameResult.isWin ? '승리' : '패배',
    createdAt: new Date().toISOString(),
  };

  records.unshift(newRecord);
  saveRankingRecords(records.slice(0, MAX_RANKING_COUNT));
  renderRanking();
  showMessage(
    '기록 저장 완료!',
    `${trimmedNickname}님의 ${newRecord.result} 기록이 저장되었습니다.<br>다시 시작 버튼으로 재도전하세요!`
  );
}

function handleNicknameSubmit(event) {
  event.preventDefault();

  const nicknameInput = document.querySelector('#nicknameInput');

  if (!nicknameInput) {
    return;
  }

  addRankingRecord(nicknameInput.value);
}

function getCurrentLevel() {
  return LEVELS[currentLevelIndex];
}

function applyLevelSettings() {
  const currentLevel = getCurrentLevel();

  obstacleSpeed = currentLevel.obstacleSpeed;
  obstacle.style.width = `${currentLevel.obstacleWidth}px`;
  obstacle.style.height = `${currentLevel.obstacleHeight}px`;

  levelText.textContent = currentLevel.level;

  gameArea.classList.remove('level-one', 'level-two', 'level-three');
  gameArea.classList.add(`level-${['one', 'two', 'three'][currentLevelIndex]}`);

  document.querySelectorAll('.level-card').forEach((card, index) => {
    card.classList.toggle('active', index === currentLevelIndex);
  });
}

function resetObstacle() {
  obstacleX = -50;
  hasScoredCurrentObstacle = false;
  obstacle.style.right = `${obstacleX}px`;
}

function resetGame() {
  score = 0;
  currentLevelIndex = 0;
  playerBottom = PLAYER_START_BOTTOM;
  jumpVelocity = 0;
  isJumping = false;
  isGameRunning = false;
  resetObstacle();
  hasPlayedEndSound = false;
  lastGameResult = null;
  isLevelChanging = false;

  applyLevelSettings();
  scoreText.textContent = score;
  statusText.textContent = '대기 중';
  player.style.bottom = `${playerBottom}px`;
  player.classList.remove('jump-effect');

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
  lastGameResult = null;
  statusText.textContent = `${getCurrentLevel().label} 진행 중`;
  hideMessage();
  animationId = requestAnimationFrame(gameLoop);
}

function jump() {
  if (!isGameRunning || isJumping || isLevelChanging) return;

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
  if (isLevelChanging) return;

  obstacleX += obstacleSpeed;
  obstacle.style.right = `${obstacleX}px`;

  const gameWidth = gameArea.clientWidth;
  const obstaclePassedPlayer = gameWidth - obstacleX < 70;

  if (obstaclePassedPlayer && !hasScoredCurrentObstacle) {
    score += 1;
    scoreText.textContent = score;
    hasScoredCurrentObstacle = true;
  }

  if (obstacleX > gameWidth + 60) {
    resetObstacle();
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

function shouldLevelUp() {
  const currentLevel = getCurrentLevel();

  return score >= currentLevel.targetScore && currentLevelIndex < LEVELS.length - 1;
}

function levelUp() {
  isLevelChanging = true;
  isGameRunning = false;
  currentLevelIndex += 1;
  applyLevelSettings();
  resetObstacle();
  playLevelUpSound();
  statusText.textContent = `${getCurrentLevel().label} 준비`;
  showMessage(
    `${getCurrentLevel().label} 시작!`,
    '장애물이 더 빠르고 커졌습니다.<br>잠시 후 자동으로 계속 진행됩니다.'
  );

  setTimeout(() => {
    if (!isLevelChanging) return;

    isLevelChanging = false;
    isGameRunning = true;
    statusText.textContent = `${getCurrentLevel().label} 진행 중`;
    hideMessage();
    animationId = requestAnimationFrame(gameLoop);
  }, 1100);
}

function endGame(isWin) {
  isGameRunning = false;
  isLevelChanging = false;
  cancelAnimationFrame(animationId);
  animationId = null;
  lastGameResult = {
    isWin,
    score,
    level: getCurrentLevel().level,
  };

  if (isWin) {
    playWinSound();
    statusText.textContent = '최종 승리!';
    showNicknameForm('최종 승리!', `3단계까지 통과해서 총 ${FINAL_TARGET_SCORE}점을 달성했습니다!`);
  } else {
    playLoseSound();
    statusText.textContent = '패배!';
    showNicknameForm('패배!', `${getCurrentLevel().label}에서 장애물에 부딪혔습니다. 닉네임을 남겨 플레이 로그를 저장하세요!`);
  }
}

function gameLoop() {
  updatePlayer();
  updateObstacle();

  if (isColliding()) {
    endGame(false);
    return;
  }

  if (score >= FINAL_TARGET_SCORE) {
    endGame(true);
    return;
  }

  if (shouldLevelUp()) {
    cancelAnimationFrame(animationId);
    animationId = null;
    levelUp();
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

function showNicknameForm(title, text) {
  message.classList.remove('hide');
  message.innerHTML = `
    <strong>${title}</strong>
    <span>${text}</span>
    <form id="nicknameForm" class="nickname-form">
      <input id="nicknameInput" type="text" maxlength="12" placeholder="닉네임 입력" autocomplete="off" required />
      <button type="submit">기록 저장</button>
    </form>
  `;

  const nicknameForm = document.querySelector('#nicknameForm');
  const nicknameInput = document.querySelector('#nicknameInput');

  nicknameForm.addEventListener('submit', handleNicknameSubmit);
  nicknameInput.focus();
}

function hideMessage() {
  message.classList.add('hide');
}

startButton.addEventListener('click', startGame);

restartButton.addEventListener('click', () => {
  resetGame();
  startGame();
});

clearRankingButton.addEventListener('click', () => {
  const shouldClear = confirm('플레이 로그를 모두 삭제할까요?');

  if (!shouldClear) {
    return;
  }

  localStorage.removeItem(RANKING_STORAGE_KEY);
  renderRanking();
});

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    const activeElement = document.activeElement;
    const isTypingNickname = activeElement && activeElement.id === 'nicknameInput';

    if (isTypingNickname) {
      return;
    }

    event.preventDefault();

    if (!isGameRunning && !isLevelChanging && statusText.textContent !== '진행 중') {
      startGame();
      return;
    }

    jump();
  }
});

gameArea.addEventListener('click', (event) => {
  const clickedFormElement = event.target.closest('#nicknameForm');

  if (clickedFormElement) {
    return;
  }

  if (!isGameRunning && !isLevelChanging) {
    startGame();
    return;
  }

  jump();
});

resetGame();
renderRanking();
