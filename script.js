const gameBoard = document.getElementById('gameBoard');
const gameStatus = document.getElementById('gameStatus');
const resetBtn = document.getElementById('resetBtn');
const aiBtn = document.getElementById('aiBtn');
const multiplayerBtn = document.getElementById('multiplayerBtn');
const playerXBtn = document.getElementById('playerX');
const playerOBtn = document.getElementById('playerO');
const scoreX = document.getElementById('scoreX');
const scoreO = document.getElementById('scoreO');
const particlesContainer = document.getElementById('particles');
const setButtons = document.querySelectorAll('.set-btn');

let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = false;
let vsAI = false;
let vsMultiplayer = false;
let scores = { X: 0, O: 0 };
let playerSymbol = 'X';
let gameCount = 0;
let maxGames = 1;
let socket = null;
let messageQueue = [];

const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function createParticles() {
    particlesContainer.innerHTML = '';
    const particleCount = window.innerWidth < 768 ? 20 : 40;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const size = Math.random() * 5 + 1;
        const posX = Math.random() * window.innerWidth;
        const posY = Math.random() * window.innerHeight;
        const delay = Math.random() * 5;
        const duration = Math.random() * 10 + 10;
        const opacity = Math.random() * 0.5 + 0.1;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${posX}px`;
        particle.style.top = `${posY}px`;
        particle.style.opacity = opacity;
        particle.style.animation = `float ${duration}s ease-in-out ${delay}s infinite alternate`;
        const colors = ['#6e45e2', '#88d3ce', '#ff7e5f', '#ff4d4d', '#4da6ff'];
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particlesContainer.appendChild(particle);
    }
}

function initializeBoard() {
    gameBoard.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.setAttribute('data-index', i);
        cell.addEventListener('click', handleCellClick);
        cell.addEventListener('touchstart', handleCellClick, { passive: true });
        gameBoard.appendChild(cell);
    }
}

function handleCellClick(e) {
    e.preventDefault();
    const clickedCell = e.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));
    if (board[clickedCellIndex] !== '' || !gameActive || (vsMultiplayer && currentPlayer !== playerSymbol)) return;
    if (vsMultiplayer && socket) {
        sendWebSocketMessage({ type: 'move', index: clickedCellIndex, player: playerSymbol });
    } else {
        makeMove(clickedCell, clickedCellIndex, currentPlayer);
        const gameWon = checkWin();
        const gameDraw = checkDraw();
        if (gameWon) {
            handleWin(gameWon);
        } else if (gameDraw) {
            handleDraw();
        } else {
            currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
            updateGameStatus();
            if (vsAI && gameActive && currentPlayer !== playerSymbol) {
                setTimeout(makeAIMove, 800);
            }
        }
    }
}

function makeMove(cell, index, player) {
    board[index] = player;
    cell.classList.add(player.toLowerCase());
    cell.style.pointerEvents = 'none';
}

function checkWin() {
    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return winningConditions[i];
        }
    }
    return null;
}

function checkDraw() {
    return board.every(cell => cell !== '');
}

function handleWin(winningCombo) {
    gameActive = false;
    scores[currentPlayer]++;
    gameCount++;
    updateScores();
    winningCombo.forEach(index => {
        const cell = document.querySelector(`.cell[data-index="${index}"]`);
        cell.style.transform = 'scale(1.1)';
        cell.style.boxShadow = `0 0 20px ${currentPlayer === 'X' ? 'var(--x-color)' : 'var(--o-color)'}`;
    });
    gameStatus.textContent = `Player ${currentPlayer} wins!`;
    gameStatus.classList.add('winner');
    createConfetti();
    checkGameSetEnd();
}

function handleDraw() {
    gameActive = false;
    gameCount++;
    gameStatus.textContent = "Game ended in a draw!";
    gameStatus.style.color = "var(--secondary)";
    checkGameSetEnd();
}

function checkGameSetEnd() {
    if (gameCount >= maxGames) {
        const winner = scores.X > scores.O ? 'X' : scores.O > scores.X ? 'O' : 'Draw';
        setTimeout(() => {
            gameStatus.textContent = `Set complete! Winner: ${winner} (X: ${scores.X}, O: ${scores.O})`;
            gameActive = false;
            if (vsMultiplayer && socket) {
                socket.close();
            }
        }, 2000);
    } else {
        setTimeout(() => {
            resetGame();
        }, 2000);
    }
}

function updateGameStatus() {
    if (!gameActive) {
        return;
    }
    if (vsMultiplayer && currentPlayer !== playerSymbol) {
        gameStatus.textContent = `Opponent's turn (${currentPlayer})`;
    } else {
        gameStatus.textContent = `Your turn, ${currentPlayer}!`;
    }
    gameStatus.classList.remove('winner');
    gameStatus.style.color = currentPlayer === 'X' ? 'var(--x-color)' : 'var(--o-color)';
}

function updateScores() {
    scoreX.querySelector('.score-value').textContent = scores.X;
    scoreO.querySelector('.score-value').textContent = scores.O;
    scoreX.classList.toggle('active', currentPlayer === 'X');
    scoreO.classList.toggle('active', currentPlayer === 'O');
}

function resetGame() {
    board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameActive = !vsMultiplayer || (socket && socket.readyState === WebSocket.OPEN);
    initializeBoard();
    updateGameStatus();
    gameStatus.classList.remove('winner');
    scoreX.classList.toggle('active', playerSymbol === 'X');
    scoreO.classList.toggle('active', playerSymbol === 'O');
    if (vsMultiplayer && socket && socket.readyState === WebSocket.OPEN) {
        sendWebSocketMessage({ type: 'reset' });
    }
}

function resetAll() {
    scores = { X: 0, O: 0 };
    gameCount = 0;
    resetGame();
    updateScores();
    if (vsMultiplayer && socket) {
        socket.close();
    }
}

function makeAIMove() {
    if (!gameActive) {
        return;
    }
    let move = findWinningMove('O') || findWinningMove('X') || findRandomMove();
    if (move !== null) {
        const cell = document.querySelector(`.cell[data-index="${move}"]`);
        makeMove(cell, move, 'O');
        const gameWon = checkWin();
        const gameDraw = checkDraw();
        if (gameWon) {
            handleWin(gameWon);
        } else if (gameDraw) {
            handleDraw();
        } else {
            currentPlayer = 'X';
            updateGameStatus();
        }
    }
}

function findWinningMove(player) {
    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (board[a] === player && board[b] === player && board[c] === '') {
            return c;
        }
        if (board[a] === player && board[c] === player && board[b] === '') {
            return b;
        }
        if (board[b] === player && board[c] === player && board[a] === '') {
            return a;
        }
    }
    return null;
}

function findRandomMove() {
    const availableMoves = board.map((cell, index) => cell === '' ? index : null).filter(val => val !== null);
    return availableMoves.length ? availableMoves[Math.floor(Math.random() * availableMoves.length)] : null;
}

function createConfetti() {
    const confettiContainer = document.createElement('div');
    confettiContainer.classList.add('confetti-container');
    document.body.appendChild(confettiContainer);
    const colors = ['#ff4d4d', '#4da6ff', '#6e45e2', '#88d3ce', '#ff7e5f', '#feb47b', '#ffffff'];
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        const size = Math.random() * 10 + 5;
        const posX = Math.random() * window.innerWidth;
        const delay = Math.random() * 3;
        const duration = Math.random() * 3 + 2;
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        confetti.style.left = `${posX}px`;
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        confetti.style.animation = `confetti-fall ${duration}s ease-in ${delay}s forwards`;
        confettiContainer.appendChild(confetti);
    }
    setTimeout(() => confettiContainer.remove(), 5000);
}

function sendWebSocketMessage(message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    } else {
        messageQueue.push(message);
        if (socket && socket.readyState === WebSocket.CONNECTING) {
            gameStatus.textContent = 'Connecting to server...';
        }
    }
}

function processMessageQueue() {
    while (messageQueue.length > 0 && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(messageQueue.shift()));
    }
}

function initWebSocket() {
    socket = new WebSocket('ws://localhost:8080');
    socket.onopen = () => {
        gameStatus.textContent = 'Connected! Waiting for opponent...';
        processMessageQueue();
        if (vsMultiplayer) {
            gameActive = false;
        }
    };
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'start') {
            playerSymbol = data.symbol;
            playerXBtn.classList.toggle('active', playerSymbol === 'X');
            playerOBtn.classList.toggle('active', playerSymbol === 'O');
            gameActive = true;
            updateGameStatus();
        } else if (data.type === 'move') {
            board = data.board;
            currentPlayer = data.currentPlayer;
            const cell = document.querySelector(`.cell[data-index="${data.index}"]`);
            makeMove(cell, data.index, data.player);
            const gameWon = checkWin();
            const gameDraw = checkDraw();
            if (gameWon) {
                handleWin(gameWon);
            } else if (gameDraw) {
                handleDraw();
            } else {
                updateGameStatus();
            }
        } else if (data.type === 'reset') {
            resetGame();
        }
    };
    socket.onerror = () => {
        gameStatus.textContent = 'Failed to connect to server';
        gameActive = false;
        vsMultiplayer = false;
        multiplayerBtn.innerHTML = '<i class="fas fa-users"></i> Multiplayer';
        if (socket) {
            socket.close();
        }
    };
    socket.onclose = () => {
        gameStatus.textContent = 'Disconnected from server';
        gameActive = false;
        vsMultiplayer = false;
        multiplayerBtn.innerHTML = '<i class="fas fa-users"></i> Multiplayer';
        messageQueue = [];
    };
}

resetBtn.addEventListener('click', resetAll);

aiBtn.addEventListener('click', function() {
    vsAI = !vsAI;
    vsMultiplayer = false;
    this.classList.toggle('active', vsAI);
    multiplayerBtn.classList.remove('active');
    this.innerHTML = vsAI ? 
        '<i class="fas fa-user-friends"></i> Play vs Human' : 
        '<i class="fas fa-robot"></i> Play vs AI';
    if (socket) {
        socket.close();
    }
    resetGame();
});

multiplayerBtn.addEventListener('click', function() {
    vsMultiplayer = !vsMultiplayer;
    vsAI = false;
    this.classList.toggle('active', vsMultiplayer);
    aiBtn.classList.remove('active');
    this.innerHTML = vsMultiplayer ? 
        '<i class="fas fa-user-friends"></i> Play vs AI' : 
        '<i class="fas fa-users"></i> Multiplayer';
    if (vsMultiplayer) {
        initWebSocket();
        gameStatus.textContent = 'Connecting to server...';
    } else if (socket) {
        socket.close();
    }
    resetGame();
});

playerXBtn.addEventListener('click', function() {
    if (!vsMultiplayer) {
        playerSymbol = 'X';
        playerXBtn.classList.add('active');
        playerOBtn.classList.remove('active');
        resetGame();
    }
});

playerOBtn.addEventListener('click', function() {
    if (!vsMultiplayer) {
        playerSymbol = 'O';
        playerOBtn.classList.add('active');
        playerXBtn.classList.remove('active');
        resetGame();
    }
});

setButtons.forEach(btn => {
    btn.addEventListener('click', function() {
        setButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        maxGames = parseInt(this.getAttribute('data-games'));
        gameCount = 0;
        scores = { X: 0, O: 0 };
        resetGame();
        updateScores();
    });
});

createParticles();
initializeBoard();
updateGameStatus();
window.addEventListener('resize', createParticles);