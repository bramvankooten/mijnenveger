// Game configuration
const GAME_CONFIG = { rows: 20, cols: 20, mines: 20 };

// Supabase client
let supabaseClient = null;

// Game state
let gameState = {
    board: [],
    revealed: [],
    flagged: [],
    gameOver: false,
    gameWon: false,
    timerInterval: null,
    elapsedTime: 0,
    startTime: null,
    rows: GAME_CONFIG.rows,
    cols: GAME_CONFIG.cols,
    totalMines: GAME_CONFIG.mines,
    scores: [],
    playerName: null,
    sessionId: null,
    sessionStartTime: null
};

// Initialize Supabase
function initializeSupabase() {
    // Check if SUPABASE_CONFIG is defined
    if (typeof SUPABASE_CONFIG === 'undefined') {
        console.warn('SUPABASE_CONFIG not defined. Ensure config.js is loaded before script.js');
        return false;
    }

    // Check if config has valid values
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
        console.warn('Supabase credentials not configured. Using local storage only.');
        console.log('To use Supabase, update config.js with your credentials.');
        gameState.scores = JSON.parse(localStorage.getItem('minesweeperScores') || '[]');
        return false;
    }

    try {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('Supabase initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        return false;
    }
}

// Login with player name
// Set player name
function setPlayerName(playerName) {
    const playerStatus = document.getElementById('playerStatus');

    if (!playerName.trim()) {
        playerStatus.textContent = 'Please enter your name';
        playerStatus.style.color = '#dc3545';
        return;
    }

    gameState.playerName = playerName.trim();

    // Update UI
    playerStatus.textContent = `Playing as: ${gameState.playerName}`;
    playerStatus.style.color = '#28a745';

    const setNameBtn = document.getElementById('setNameBtn');
    const playerNameInput = document.getElementById('playerName');
    setNameBtn.style.display = 'none';
    playerNameInput.style.display = 'none';

    const changeNameBtn = document.createElement('button');
    changeNameBtn.className = 'btn btn-secondary';
    changeNameBtn.textContent = 'Change Name';
    changeNameBtn.addEventListener('click', changeName);
    document.getElementById('playerSection').appendChild(changeNameBtn);

    initializeGame();
}

// Change player name
function changeName() {
    gameState.playerName = null;
    gameState.gameOver = true;
    gameState.gameWon = false;

    // Reset UI
    const playerStatus = document.getElementById('playerStatus');
    const playerSection = document.getElementById('playerSection');
    const setNameBtn = document.getElementById('setNameBtn');
    const playerNameInput = document.getElementById('playerName');
    const changeNameBtn = playerSection.querySelector('button:last-child');

    playerStatus.textContent = '';
    setNameBtn.style.display = 'inline-block';
    playerNameInput.style.display = 'inline-block';
    playerNameInput.value = '';
    if (changeNameBtn !== setNameBtn) {
        changeNameBtn.remove();
    }

    document.getElementById('gameBoard').innerHTML = '';
}
// Load global scores from Supabase
async function loadScores() {
    if (!supabaseClient) {
        // Fallback to localStorage
        gameState.scores = JSON.parse(localStorage.getItem('minesweeperGlobalScores') || '[]');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('player_high_scores')
            .select('*')
            .eq('result', 'won')
            .order('time_seconds', { ascending: true })
            .limit(20);

        if (error) {
            console.warn('Error loading scores:', error);
            gameState.scores = JSON.parse(localStorage.getItem('minesweeperGlobalScores') || '[]');
        } else {
            gameState.scores = (data || []).map(score => ({
                playerName: score.player_name,
                time: score.time_seconds,
                timeString: formatTime(score.time_seconds),
                difficulty: '20x20',
                date: new Date(score.date).toLocaleDateString()
            }));
        }
    } catch (err) {
        console.warn('Error loading scores:', err);
        gameState.scores = JSON.parse(localStorage.getItem('minesweeperGlobalScores') || '[]');
    }
}
function initializeGame() {
    if (!gameState.playerName) {
        const playerStatus = document.getElementById('playerStatus');
        playerStatus.textContent = 'Please enter your name first';
        playerStatus.style.color = '#dc3545';
        return;
    }

    gameState.gameOver = false;
    gameState.gameWon = false;
    gameState.elapsedTime = 0;
    gameState.startTime = null;
    gameState.sessionId = null;
    gameState.sessionStartTime = null;

    // Clear timer
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }

    // Initialize board arrays
    gameState.board = Array(gameState.rows * gameState.cols).fill(0);
    gameState.revealed = Array(gameState.rows * gameState.cols).fill(false);
    gameState.flagged = Array(gameState.rows * gameState.cols).fill(false);

    renderBoard();
    updateUI();
}

// Create a game session on the server
async function createGameSession() {
    if (!gameState.isAuthenticated) return false;

    if (!supabaseClient) {
        // Generate a local session ID if Supabase is not available
        gameState.sessionId = 'local_' + Date.now();
        gameState.sessionStartTime = new Date();
        return true;
    }

    try {
        const { data, error } = await supabaseClient
            .from('game_sessions')
            .insert([{
                player_name: gameState.playerName
            }])
            .select();

        if (error) {
            console.warn('Error creating game session:', error);
            // Fallback to local session ID
            gameState.sessionId = 'local_' + Date.now();
            gameState.sessionStartTime = new Date();
            return true;
        }

        if (data && data.length > 0) {
            gameState.sessionId = data[0].id;
            gameState.sessionStartTime = new Date(data[0].started_at);
            return true;
        }
    } catch (err) {
        console.warn('Error creating game session:', err);
        gameState.sessionId = 'local_' + Date.now();
        gameState.sessionStartTime = new Date();
        return true;
    }

    return false;
}

// Record game result on the server
async function recordGameResult(result) {
    if (!gameState.playerName || !gameState.sessionId) return;

    if (!supabaseClient) {
        // Save to localStorage as fallback for won games
        if (result === 'won') {
            const localScores = JSON.parse(localStorage.getItem('minesweeperGlobalScores') || '[]');
            localScores.push({
                playerName: gameState.playerName,
                time: gameState.elapsedTime,
                timeString: formatTime(gameState.elapsedTime),
                difficulty: '20x20',
                date: new Date().toLocaleDateString()
            });
            localScores.sort((a, b) => a.time - b.time);
            localStorage.setItem('minesweeperGlobalScores', JSON.stringify(localScores));
        }
        return;
    }

    // Check if this is a local session ID (no server tracking)
    if (gameState.sessionId.startsWith('local_')) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('game_results')
            .insert([{
                session_id: gameState.sessionId,
                player_name: gameState.playerName,
                result: result,
                board_size: `${GAME_CONFIG.rows}x${GAME_CONFIG.cols}`,
                mines: GAME_CONFIG.mines
            }]);

        if (error) {
            console.warn('Error recording game result:', error);
        }
    } catch (err) {
        console.warn('Error recording game result:', err);
    }
}
function placeMines(excludeIndex = -1) {
    let minesPlaced = 0;
    const minePositions = new Set();

    while (minesPlaced < gameState.totalMines) {
        const randomIndex = Math.floor(Math.random() * (gameState.rows * gameState.cols));

        if (randomIndex !== excludeIndex && !minePositions.has(randomIndex)) {
            gameState.board[randomIndex] = 'M'; // M for mine
            minePositions.add(randomIndex);
            minesPlaced++;
        }
    }

    // Calculate numbers for non-mine tiles
    for (let i = 0; i < gameState.board.length; i++) {
        if (gameState.board[i] !== 'M') {
            gameState.board[i] = countAdjacentMines(i);
        }
    }
}

// Count adjacent mines for a given tile
function countAdjacentMines(index) {
    const row = Math.floor(index / gameState.cols);
    const col = index % gameState.cols;
    let count = 0;

    for (let r = -1; r <= 1; r++) {
        for (let c = -1; c <= 1; c++) {
            const newRow = row + r;
            const newCol = col + c;

            if (newRow >= 0 && newRow < gameState.rows &&
                newCol >= 0 && newCol < gameState.cols) {
                const neighborIndex = newRow * gameState.cols + newCol;
                if (gameState.board[neighborIndex] === 'M') {
                    count++;
                }
            }
        }
    }

    return count;
}

// Reveal a tile
function revealTile(index) {
    if (gameState.gameOver || gameState.gameWon) return;
    if (!gameState.playerName) return; // Player must set name first

    // Place mines on first click (avoiding the clicked tile)
    if (gameState.board.every(tile => tile === 0)) {
        placeMines(index);
        createGameSession(); // Start game session on server
        startTimer();
    }

    if (gameState.flagged[index]) return; // Can't reveal flagged tiles
    if (gameState.revealed[index]) return; // Already revealed

    gameState.revealed[index] = true;

    // Hit a mine - game over
    if (gameState.board[index] === 'M') {
        gameState.gameOver = true;
        revealAllMines();
        recordGameResult('lost'); // Record loss
        updateUI();
        stopTimer();
        return;
    }

    // Reveal adjacent tiles if empty (0 adjacent mines)
    if (gameState.board[index] === 0) {
        revealAdjacentEmpty(index);
    }

    // Check for win condition
    if (checkWin()) {
        gameState.gameWon = true;
        stopTimer();
        recordGameResult('won'); // Record win
        loadScores(); // Refresh global scores
        updateUI();
    } else {
        updateUI();
    }
}

// Recursively reveal adjacent tiles when an empty tile is clicked
function revealAdjacentEmpty(index) {
    const row = Math.floor(index / gameState.cols);
    const col = index % gameState.cols;

    for (let r = -1; r <= 1; r++) {
        for (let c = -1; c <= 1; c++) {
            const newRow = row + r;
            const newCol = col + c;

            if (newRow >= 0 && newRow < gameState.rows &&
                newCol >= 0 && newCol < gameState.cols) {
                const neighborIndex = newRow * gameState.cols + newCol;

                if (!gameState.revealed[neighborIndex] && !gameState.flagged[neighborIndex]) {
                    gameState.revealed[neighborIndex] = true;

                    if (gameState.board[neighborIndex] === 0) {
                        revealAdjacentEmpty(neighborIndex);
                    }
                }
            }
        }
    }
}

// Toggle flag on a tile
function toggleFlag(index, event) {
    event.rightClick = true;

    if (gameState.gameOver || gameState.gameWon) return;
    if (gameState.revealed[index]) return; // Can't flag revealed tiles

    gameState.flagged[index] = !gameState.flagged[index];
    updateUI();
}

// Reveal all mines when game is over
function revealAllMines() {
    for (let i = 0; i < gameState.board.length; i++) {
        if (gameState.board[i] === 'M') {
            gameState.revealed[i] = true;
        }
    }
}

// Check if player won the game
function checkWin() {
    for (let i = 0; i < gameState.board.length; i++) {
        if (gameState.board[i] !== 'M' && !gameState.revealed[i]) {
            return false; // Still unrevealed non-mine tiles
        }
    }
    return true;
}

// Start the timer
function startTimer() {
    gameState.startTime = Date.now();
    gameState.timerInterval = setInterval(() => {
        gameState.elapsedTime = Math.floor((Date.now() - gameState.startTime) / 1000);
        updateTimerDisplay();
    }, 100);
}

// Stop the timer
function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
}

// Update timer display
function updateTimerDisplay() {
    const minutes = Math.floor(gameState.elapsedTime / 60);
    const seconds = gameState.elapsedTime % 60;
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer').textContent = timeString;
}

// Format time for display
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Display global leaderboard
function displayScores() {
    const scoreList = document.getElementById('scoreList');

    if (gameState.scores.length === 0) {
        scoreList.innerHTML = '<li class="no-games">No scores yet</li>';
        return;
    }

    scoreList.innerHTML = gameState.scores
        .map((score, index) => `
            <li>
                #${index + 1} - <strong>${score.playerName}</strong> - ${score.timeString} (${score.date})
            </li>
        `)
        .join('');
}

// Render the game board
function renderBoard() {
    const boardElement = document.getElementById('gameBoard');
    boardElement.innerHTML = '';
    boardElement.style.gridTemplateColumns = `repeat(${gameState.cols}, 40px)`;

    for (let i = 0; i < gameState.board.length; i++) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.index = i;

        if (gameState.revealed[i]) {
            tile.classList.add('revealed');
            const value = gameState.board[i];

            if (value === 'M') {
                tile.classList.add('mine');
                tile.textContent = '💣';
            } else if (value === 0) {
                tile.classList.add('empty', 'number-0');
            } else {
                tile.classList.add(`number-${value}`);
                tile.textContent = value;
            }
        } else if (gameState.flagged[i]) {
            tile.classList.add('flagged');
        }

        tile.addEventListener('click', () => revealTile(i));
        tile.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            toggleFlag(i, e);
        });

        boardElement.appendChild(tile);
    }
}

// Update UI elements
function updateUI() {
    renderBoard();

    const minesLeft = gameState.totalMines - gameState.flagged.filter(f => f).length;
    document.getElementById('minesLeft').textContent = Math.max(0, minesLeft);

    const statusElement = document.getElementById('status');
    if (gameState.gameWon) {
        statusElement.textContent = '🎉 You Won!';
        statusElement.style.color = '#28a745';
    } else if (gameState.gameOver) {
        statusElement.textContent = '💥 Game Over';
        statusElement.style.color = '#dc3545';
    } else {
        statusElement.textContent = 'Playing';
        statusElement.style.color = '#667eea';
    }
}

// Event listeners
document.getElementById('newGameBtn').addEventListener('click', () => {
    if (gameState.playerName) {
        initializeGame();
    }
});

document.getElementById('setNameBtn').addEventListener('click', () => {
    const playerName = document.getElementById('playerName').value;
    setPlayerName(playerName);
});

document.getElementById('playerName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const playerName = document.getElementById('playerName').value;
        setPlayerName(playerName);
    }
});

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
    initializeSupabase();
    await loadScores();
    displayScores();
});
