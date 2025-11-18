# Card Count Simulation - Implementation Summary

## Overview

When users land on the Card Counting Trainer main page, the game is already in progress with a running count established. This creates a realistic casino experience where players join an active table.

## Implementation

### Location
- **File**: [frontend/src/hooks/useGameState.ts](frontend/src/hooks/useGameState.ts)
- **Function**: `simulateHandsInProgress()`

### How It Works

1. **Initialization**: When the `useGameState` hook initializes, it:
   - Creates and shuffles a fresh shoe (6 decks by default)
   - Calls `simulateHandsInProgress()` to deal several hands before the user joins

2. **Simulation Process**:
   - Deals between **5-15 random hands** (simulates other players)
   - Each hand deals **4-7 cards** (2 to player, 2 to dealer, plus 0-3 hits)
   - Updates the **running count** for all dealt cards using Hi-Lo system:
     - **2-6**: +1
     - **7-9**: 0
     - **10-A**: -1
   - Calculates **true count** = running count ÷ decks remaining

3. **Result**: The game starts with:
   - A non-zero running count (varies based on cards dealt)
   - A true count that reflects the count per remaining deck
   - Cards already dealt from the shoe (40-100+ cards typically)
   - A fresh hand ready for the user to play

## User Experience

### Visual Indicators
The score bar displays:
```
COUNT: +2  STREAK: 0  CHIPS: 1000  SCORE: 0  MULTIPLIER: 1.0x  (68/312 cards dealt)
```

- **COUNT**: Shows the true count (with + for positive)
- **Cards Dealt**: Shows progress through the shoe (e.g., "68/312 cards dealt")

### Console Logging
When the page loads, the browser console displays:
```
🎲 Game initialized with count: {
  runningCount: 8,
  trueCount: 2,
  cardsDealt: 68,
  totalCards: 312
}
```

## Benefits

1. **Realistic Training**: Players experience the pressure of joining a game mid-shoe
2. **Count Awareness**: Players must immediately assess the count situation
3. **No Dead Time**: Players can start playing immediately without waiting
4. **Random Scenarios**: Each page load presents a different count scenario

## Technical Details

### Hi-Lo Counting System
```typescript
// From src/lib/deck.ts
function getHiLoCount(rank: Rank): number {
  if (["2", "3", "4", "5", "6"].includes(rank)) return 1;
  if (["7", "8", "9"].includes(rank)) return 0;
  return -1; // 10, J, Q, K, A
}
```

### True Count Calculation
```typescript
// From src/lib/deck.ts
function calculateTrueCount(runningCount: number, decksRemaining: number): number {
  if (decksRemaining <= 0) return 0;
  return Math.round(runningCount / decksRemaining);
}
```

## Configuration

Default settings (from `useGameState.ts`):
- **Decks**: 6
- **Penetration**: 75%
- **Starting Chips**: 1,000
- **Min Bet**: $10
- **Max Bet**: $500

## Future Enhancements

Possible improvements:
1. Allow users to configure number of simulated hands
2. Show a "Game in Progress" indicator on first visit
3. Display recent card history (last 10 cards dealt)
4. Add option to "join at beginning of shoe" vs "join mid-shoe"
