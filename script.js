'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const highscoreEl = document.getElementById('highscore');
const finalScoreEl = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('gameover-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// ゲーム設定・状態
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const BLOCK_HEIGHT = 30;
const INITIAL_WIDTH = 140;

let score = 0;
let highscore = localStorage.getItem('block_tower_highscore') || 0;
highscoreEl.textContent = highscore;

let gameState = 'START'; // 'START', 'PLAYING', 'GAMEOVER'
let cameraY = 0;
let targetCameraY = 0;

let stack = [];
let currentBlock = null;
let debris = [];
let particles = [];

// 色のバリエーション（パステルネオン）
const COLORS = [
  '#38bdf8', // スカイブルー
  '#818cf8', // インディゴ
  '#c084fc', // パープル
  '#f472b6', // ピンク
  '#fb7185', // ローズ
  '#34d399', // エメラルド
];

class Block {
  constructor(x, y, width, height, colorIndex) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.colorIndex = colorIndex % COLORS.length;
    this.color = COLORS[this.colorIndex];
    this.direction = 1;
    this.speed = 3;
    this.isMoving = true;
  }

  update() {
    if (!this.isMoving) return;
    this.x += this.speed * this.direction;
    // 壁に当たったら折り返し
    if (this.x < 0 || this.x + this.width > CANVAS_WIDTH) {
      this.direction *= -1;
    }
  }

  draw() {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(this.x, CANVAS_HEIGHT - this.y, this.width, this.height);
    ctx.restore();
  }
}

// 落下する削りカス
class Debris {
  constructor(x, y, width, height, color, vx) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
    this.vx = vx;
    this.vy = -1;
    this.gravity = 0.4;
  }
  update() {
    this.x += this.vx;
    this.vy += this.gravity;
    this.y += this.vy;
  }
  draw() {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(this.x, CANVAS_HEIGHT - this.y, this.width, this.height);
    ctx.restore();
  }
}

// パーティクル演出
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.alpha = 1;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 0.03;
  }
  draw() {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, CANVAS_HEIGHT - this.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function initGame() {
  score = 0;
  scoreEl.textContent = score;
  stack = [];
  debris = [];
  particles = [];
  cameraY = 0;
  targetCameraY = 0;

  // 土台ブロック
  const baseBlock = new Block(
    CANVAS_WIDTH / 2 - INITIAL_WIDTH / 2,
    50,
    INITIAL_WIDTH,
    BLOCK_HEIGHT,
    0
  );
  baseBlock.isMoving = false;
  stack.push(baseBlock);

  spawnNewBlock();
  gameState = 'PLAYING';
}

function spawnNewBlock() {
  const prevBlock = stack[stack.length - 1];
  const newY = prevBlock.y + BLOCK_HEIGHT;
  const newSpeed = Math.min(3 + Math.floor(stack.length / 5) * 0.5, 7); // だんだんスピードアップ

  const newBlock = new Block(0, newY, prevBlock.width, BLOCK_HEIGHT, stack.length);
  newBlock.speed = newSpeed;
  currentBlock = newBlock;
}

function placeBlock() {
  if (!currentBlock || !currentBlock.isMoving) return;
  currentBlock.isMoving = false;

  const prevBlock = stack[stack.length - 1];
  const diff = currentBlock.x - prevBlock.x;
  const absDiff = Math.abs(diff);

  // 完全に外れていたらゲームオーバー
  if (absDiff >= prevBlock.width) {
    gameState = 'GAMEOVER';
    finalScoreEl.textContent = score;
    if (score > highscore) {
      highscore = score;
      localStorage.setItem('block_tower_highscore', highscore);
      highscoreEl.textContent = highscore;
    }
    gameOverScreen.classList.remove('hidden');
    return;
  }

  // ズレた分をカットする
  let newWidth = prevBlock.width - absDiff;
  let newX = currentBlock.x;

  // パーフェクト判定（5px以内のズレなら補正＆ボーナス）
  if (absDiff < 5) {
    newWidth = prevBlock.width;
    newX = prevBlock.x;
    score += 5; // パーフェクトボーナス
    // スパーク演出
    for (let i = 0; i < 15; i++) {
      particles.push(new Particle(newX + newWidth / 2, currentBlock.y, '#fbbf24'));
    }
  } else {
    // 削りカスの発生
    if (diff > 0) {
      debris.push(new Debris(prevBlock.x + prevBlock.width, currentBlock.y, absDiff, BLOCK_HEIGHT, currentBlock.color, 2));
    } else {
      debris.push(new Debris(currentBlock.x + newWidth, currentBlock.y, absDiff, BLOCK_HEIGHT, currentBlock.color, -2));
    }
  }

  // ブロックの大きさを更新
  currentBlock.x = newX;
  currentBlock.width = newWidth;
  stack.push(currentBlock);

  score++;
  scoreEl.textContent = score;

  // カメラを上にスクロール
  if (stack.length > 5) {
    targetCameraY += BLOCK_HEIGHT;
  }

  spawnNewBlock();
}

// メインループ
function update() {
  if (gameState === 'PLAYING' && currentBlock) {
    currentBlock.update();
  }

  // カメラのスムーズなスクロール
  cameraY += (targetCameraY - cameraY) * 0.1;

  // デブリの更新
  debris.forEach(d => d.update());
  debris = debris.filter(d => d.y > cameraY - 100);

  // パーティクルの更新
  particles.forEach(p => p.update());
  particles = particles.filter(p => p.alpha > 0);
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.save();
  ctx.translate(0, cameraY);

  // 積み重なったブロックを描画
  stack.forEach(block => block.draw());

  // 動いている現在のブロックを描画
  if (currentBlock) {
    currentBlock.draw();
  }

  // 削りカスを描画
  debris.forEach(d => d.draw());

  // パーティクルを描画
  particles.forEach(p => p.draw());

  ctx.restore();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// イベントリスナー（pointerdownを使って即座に反応させる）
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (gameState === 'PLAYING') {
    placeBlock();
  }
});

startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  initGame();
});

restartBtn.addEventListener('click', () => {
  gameOverScreen.classList.add('hidden');
  initGame();
});

// 初期描画のループ開始
loop();
