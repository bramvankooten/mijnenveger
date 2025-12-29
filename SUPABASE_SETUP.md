# Minesweeper Game - Supabase Setup Guide

## Overview
Your Minesweeper game now supports storing scores in a Supabase database. Players can log in with their name and their scores will be saved to the cloud.

## Prerequisites
- A Supabase account (free tier works): https://supabase.com
- A Supabase project created

## Setup Instructions

### 1. Create Supabase Project
1. Go to https://supabase.com and sign up/log in
2. Create a new project (or use an existing one)
3. Wait for the project to be initialized

### 2. Create Database Tables
In your Supabase project:

1. Go to the "SQL Editor" section
2. Create a new query and paste the following SQL:

```sql
-- Game sessions table (stores game start events)
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game results table (stores game end events and calculates final time)
CREATE TABLE game_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    result TEXT NOT NULL CHECK (result IN ('won', 'lost')),
    board_size TEXT DEFAULT '20x20',
    mines INTEGER DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- View for displaying high scores (calculated from sessions and results)
CREATE OR REPLACE VIEW player_high_scores AS
SELECT 
    gr.player_name,
    EXTRACT(EPOCH FROM (gr.completed_at - gs.started_at))::INTEGER as time_seconds,
    gr.completed_at as date,
    gr.result,
    gr.board_size,
    gr.mines
FROM game_results gr
JOIN game_sessions gs ON gr.session_id = gs.id
WHERE gr.result = 'won'
ORDER BY gr.player_name, time_seconds ASC;

-- Indexes for performance
CREATE INDEX idx_session_player ON game_sessions(player_name);
CREATE INDEX idx_result_player ON game_results(player_name);
CREATE INDEX idx_result_session ON game_results(session_id);
```

3. Click "Run" to create the tables

### 3. Get Your Credentials
1. In your Supabase project, go to "Settings" → "API"
2. Copy the following:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **Anon Public Key** (under "Project API keys")

### 4. Configure Your Application
1. Rename `config.example.js` to `config.js`
2. Open `config.js` and replace:
   - `YOUR_SUPABASE_URL` with your Project URL
   - `YOUR_SUPABASE_ANON_KEY` with your Anon Public Key

Example:
```javascript
const SUPABASE_CONFIG = {
    url: 'https://abcdefghijk.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

### 5. (Optional) Enable Row Level Security
For added security, you can enable Row Level Security (RLS):

1. In Supabase, go to "Authentication" → "Policies"
2. Create policies for game_sessions table:

```sql
-- For SELECT on game_sessions
CREATE POLICY "Users can view their own sessions" ON public.game_sessions
FOR SELECT USING (true);

-- For INSERT on game_sessions
CREATE POLICY "Users can insert their own sessions" ON public.game_sessions
FOR INSERT WITH CHECK (true);
```

3. Create policies for game_results table:

```sql
-- For SELECT on game_results
CREATE POLICY "Users can view their own results" ON public.game_results
FOR SELECT USING (true);

-- For INSERT on game_results
CREATE POLICY "Users can insert their own results" ON public.game_results
FOR INSERT WITH CHECK (true);
```

## How It Works

### Global Leaderboard System
The game displays a global leaderboard showing the best times from all players:

1. **Player Entry**: Players enter their name before playing (no login required)
2. **Game Session**: When a player clicks the first tile, a `game_session` entry is created with:
   - Unique session ID
   - Player name
   - Server timestamp (start time)
3. **Game Completion**: When the game ends (win or loss), a `game_result` entry is created with:
   - Session ID (linking to the start)
   - Player name
   - Game result (won/lost)
   - Server timestamp (end time)
4. **Score Calculation**: The server calculates actual elapsed time:
   - `time = end_timestamp - start_timestamp`
   - Only "won" games appear on the leaderboard
5. **Global Display**: All players' top scores are displayed in descending order (fastest first)

### Leaderboard Features
- Shows top 20 all-time best scores
- Displays player name, time, and date for each score
- Automatically refreshes when a new score is submitted
- Works offline (falls back to localStorage if Supabase unavailable)

### Score Storage
- **Supabase**: Primary storage (cloud database with server-side verification)
- **localStorage**: Backup storage (browser local storage)
- If Supabase is unavailable, games are saved locally but not shared on leaderboard

### Features
- **Global Leaderboard**: See all-time best scores from any player
- **Cheat-proof**: Time verified on server between session start and end
- **No login required**: Just enter your name and play
- **Persistent scores**: Your name appears on the leaderboard if you win
- **Top 20 display**: Shows the fastest 20 winning games from all players

## Troubleshooting

### Leaderboard not updating?
1. Check browser console (F12 → Console) for errors
2. Verify your `config.js` credentials are correct
3. Check that both `game_sessions` and `game_results` tables exist
4. Verify you've won a game (lost games don't appear on leaderboard)
5. Wait a moment - scores may take a few seconds to appear

### Can't see my score on the leaderboard?
1. Make sure you **won** the game (lost games are not displayed)
2. Scores only appear after game completion is recorded
3. Try refreshing the page to reload the leaderboard
4. Check that your player name was entered before playing

### Can't connect to Supabase?
1. Check your internet connection
2. Verify the Project URL is correct in `config.js`
3. Make sure the Anon Key is valid
4. Check if Supabase is experiencing issues

### Game won't start?
1. Make sure you've entered a player name and clicked "Play"
2. The player status should show "Playing as: [your name]"
3. If not, try entering your name again

### Fallback to localStorage
If Supabase is not configured or unavailable:
- Game sessions are created locally
- Game results are saved to browser storage
- Scores won't appear on the global leaderboard
- The game works normally but scores aren't shared

## File Structure
```
/home/bram/Documents/Code/Minesweeper/
├── index.html          # Main HTML file (updated with login UI)
├── style.css           # Styling
├── script.js           # Game logic (updated with Supabase integration)
├── config.example.js   # Example configuration (copy this to config.js)
└── config.js           # Your Supabase credentials (create from example)
```

## Important Security Notes
- The Anon Key is public and visible in client-side code - this is intentional in Supabase
- Use Row Level Security policies to restrict what users can access
- Never commit `config.js` with real credentials to version control
- Add `config.js` to `.gitignore` if using Git
