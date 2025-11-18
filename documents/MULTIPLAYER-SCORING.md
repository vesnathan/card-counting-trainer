# Card Counting Trainer - Multi-Player & Scoring System

## Table Seating System

### Seat Configuration

- **Total Seats**: 8 player positions per table
- **Simultaneous Players**: 1-8 human/AI players at any given time
- **Dynamic Seating**: Seats can be occupied or vacant at any time
- **Seat States**:
  - **Occupied by User**: Current authenticated user
  - **Occupied by Other Player**: Another human player or AI
  - **Vacant**: Empty seat available for sitting
  - **Reserved**: Temporarily held (player in hand, will return)

### Seat Selection Flow

#### On Page Load

1. **Fetch Table State**

   - Query current table occupancy
   - Identify which seats are taken/available
   - Show player usernames/avatars at occupied seats

2. **User Options**

   - If vacant seats exist: "Sit Down" button available
   - If all seats taken: "Join Waitlist" or spectate
   - If already seated: Resume at current position

3. **Seat Selection**
   - Click on vacant seat to claim it
   - Confirmation prompt: "Sit at Position X?"
   - Minimum buy-in check (must have enough chips)
   - Seat claimed via GraphQL mutation

#### Joining Mid-Game

- User can sit down between hands (not during active deal)
- Joins at start of next hand
- Must wait for current hand to complete if game in progress

#### Leaving Table

- **Stand Up Button**: Leave voluntarily
- **Auto-Stand After X Hands**: Configurable (e.g., stand after 50 hands)
- **Kicked for Inactivity**: Auto-stand after 5 minutes no action
- **Bankrupt**: Auto-stand when chips = 0
- Seat immediately becomes available for others

### Spectator Mode

- Users can spectate without sitting down
- View all player hands and dealer cards
- See running count (if enabled in settings)
- Cannot place bets or take actions
- "Sit Down" button available when seats open

## Strategy Card Feature

### Overview

Strategy cards are a paid hint system that shows optimal basic strategy decisions based on current hand and dealer upcard.

### Cost Structure

- **Peek Cost**: 10 chips per use
- **Cooldown**: Can only peek once per hand
- **Available When**: Only during player's action phase (before decision made)

### How It Works

1. **Player Activates Strategy Card**

   - Click "Strategy Card" button during their turn
   - Deduct 10 chips immediately
   - Display basic strategy chart overlay

2. **Strategy Display**

   - Highlight optimal action for current situation
   - Show player hand total vs dealer upcard
   - Indicate: HIT, STAND, DOUBLE, SPLIT, or SURRENDER
   - Brief explanation (e.g., "Basic strategy: HIT on 12 vs dealer 7")

3. **After Viewing**
   - User still makes own decision
   - Can follow or ignore advice
   - Accuracy tracked (see Scoring System below)

### Strategy Card Rules Reference

Display full basic strategy chart showing:

- Hard totals (5-20)
- Soft totals (A,2 through A,9)
- Pairs (2,2 through A,A)
- Actions vs dealer upcards (2-A)
- Color coding:
  - Green = Hit
  - Red = Stand
  - Blue = Double (hit if can't double)
  - Yellow = Split
  - Orange = Surrender (hit if can't surrender)

### Free Strategy Card Option

For practice mode, could offer:

- First 5 peeks free per day
- Unlimited peeks in "Training Mode" (no scoring)
- Must play "Scored Mode" to compete on leaderboards

## Count Peek Feature

### Overview

Players can peek at the current running count and true count, but doing so has significant scoring penalties.

### Cost Structure

- **Chip Cost**: Free (no chip cost)
- **Scoring Penalty**: Score multiplier resets to 1.0x
- **Cooldown**: Can peek at any time
- **Available When**: Any time during gameplay

### How It Works

1. **Player Peeks at Count**

   - Click "Show Count" or "👁️" button
   - No chip deduction
   - Display current running count and true count
   - Show cards dealt / cards remaining

2. **Count Display**

   - **Running Count**: Current count (e.g., "+7")
   - **True Count**: Adjusted for decks remaining (e.g., "+3.5")
   - **Decks Remaining**: Visual indicator (e.g., "4.2 decks left")
   - Brief explanation of what the count means

3. **Scoring Penalty Applied**
   - **Score Multiplier Reset**: Any accumulated multiplier resets to 1.0x
   - **Counting Accuracy Bonus Lost**: Forfeits end-of-shoe accuracy bonus
   - **Penalty Indicator**: Red flash and warning message
   - Message: "⚠️ Count revealed! Score multiplier reset to 1.0x"

### Penalty Details

#### What Resets

- **Accuracy Multiplier**: Goes back to 1.0x (from potential 2.0x)
- **Counting Accuracy Bonus**: Loses 100% accuracy bonus opportunity
- **Perfect Shoe Bonus**: Ineligible for 1000 point perfect counting bonus

#### What Doesn't Reset

- **Decision Streak**: Streak for correct strategy decisions continues
- **Base Points**: Still earn base 10/20/40/80... points for correct decisions
- **Chips**: No chip penalty

#### Multiplier Recovery

- **Cannot recover**: Once peeked, multiplier stays at 1.0x for remainder of shoe
- **Resets on shuffle**: New shoe starts fresh with multiplier opportunity
- **Strategy**: Players must decide if knowing count is worth losing multiplier

### Strategic Considerations

#### When to Peek

- **Learning Phase**: Peek frequently to verify counting accuracy
- **Practice Mode**: Free peeking with no scoring impact
- **Low Multiplier**: If already <1.2x, less costly to peek
- **Critical Decision**: High-stakes bet where knowing exact count crucial

#### When Not to Peek

- **High Multiplier**: If at 1.5x+ multiplier, keep it going
- **End of Shoe**: Near cut card, maintain accuracy for end-of-shoe bonus
- **Confident Count**: If confident in count, don't risk multiplier
- **Leaderboard Push**: Competing for high score, need maximum multiplier

### UI/UX

#### Count Peek Button

- **Location**: Top right near score display
- **Icon**: 👁️ or "Show Count"
- **Warning Indicator**: Yellow/red border if multiplier >1.0x
- **Tooltip**: "Peek at count (resets score multiplier to 1.0x)"

#### Confirmation Dialog

If multiplier >1.0x, show confirmation:

```
⚠️ Are you sure?

Current Multiplier: 1.8x
This will reset to: 1.0x

You'll lose your counting accuracy bonus.

[Cancel] [Yes, Show Count]
```

#### Post-Peek Display

After peeking, show:

```
Running Count: +8
True Count: +4.0
Decks Remaining: 2.0

⚠️ Multiplier reset to 1.0x
Next shoe starts fresh!
```

## Scoring System

### Exponential Points for Correct Decisions

#### Base Formula

- **Points for Nth correct decision in a row**: `10 × 2^(N-1)`
- **Streak resets on wrong decision**: Back to 10 points

#### Point Values

| Streak Position | Points Earned | Cumulative Total |
| --------------- | ------------- | ---------------- |
| 1st correct     | 10            | 10               |
| 2nd correct     | 20            | 30               |
| 3rd correct     | 40            | 70               |
| 4th correct     | 80            | 150              |
| 5th correct     | 160           | 310              |
| 6th correct     | 320           | 630              |
| 7th correct     | 640           | 1,270            |
| 8th correct     | 1,280         | 2,550            |
| 9th correct     | 2,560         | 5,110            |
| 10th correct    | 5,120         | 10,230           |

#### Exponential Growth Impact

- Rewards consistent correct play dramatically
- After 10 correct decisions in a row: 10,230 points
- After 15 correct decisions: 327,670 points
- After 20 correct decisions: 10,485,750 points

### What Counts as "Correct"?

#### Compared Against Basic Strategy

- **Hit**: When basic strategy says hit
- **Stand**: When basic strategy says stand
- **Double Down**: When basic strategy says double
- **Split**: When basic strategy says split
- **Surrender**: When basic strategy says surrender

#### Handling Ambiguous Situations

- If basic strategy says "Double if allowed, else Hit":
  - Double = correct
  - Hit = correct (if can't double or chose not to)
  - Stand = wrong
- If basic strategy says "Surrender if allowed, else Hit":
  - Surrender = correct
  - Hit = correct (if surrender not allowed)
  - Stand = wrong

### Scoring Display

#### In-Game HUD

- **Current Streak**: "Streak: 5" (top of screen)
- **Next Correct Worth**: "Next: 160 points"
- **Total Score**: "Score: 310"
- **Streak Icon**: Fire icon or streak counter with visual intensity

#### Streak Visual Feedback

- **1-2 correct**: White text, no special effects
- **3-5 correct**: Yellow text, subtle glow
- **6-10 correct**: Orange text, moderate glow
- **11-15 correct**: Red text, strong glow + particles
- **16+ correct**: Rainbow text, intense effects, screen shake on correct decision

#### Wrong Decision Feedback

- Red "X" animation
- Streak counter resets with animation
- Show "Streak broken! Was: 5, Now: 0"
- Brief explanation: "Basic strategy was: HIT (you chose STAND)"

### Scoring Variations

#### Counting Accuracy Bonus

- Multiply score by counting accuracy percentage
- If 95% accurate on count at end of shoe: `score × 1.95`
- If 100% accurate: `score × 2.0` + 1000 bonus points
- If <80% accurate: No multiplier

#### Speed Bonus

- Decisions made within 5 seconds: +10% bonus
- Decisions made within 3 seconds: +25% bonus
- Decisions made >15 seconds: -10% penalty

#### Bet Sizing Accuracy

- Track if user bet size matches optimal count-based strategy
- Correct bet sizing: +5 bonus points per hand
- Incorrect sizing: -5 points per hand

### Leaderboards

#### Score-Based Rankings

1. **All-Time High Score**: Highest single session score
2. **Monthly High Score**: Best score this month
3. **Longest Streak**: Most consecutive correct decisions
4. **Perfect Shoes**: Count of shoes with 100% strategy accuracy

#### Filtering Options

- Filter by counting system (Hi-Lo, KO, etc.)
- Filter by game rules (6-deck H17, single-deck S17, etc.)
- Filter by time period (daily, weekly, monthly, all-time)

## Multi-Player Interaction

### Shared Table State

#### Real-Time Updates

- Use GraphQL subscriptions to sync table state
- When player sits/stands: Update all clients immediately
- When cards dealt: Push updates to all spectators/players
- When player acts: Show decision to all viewers

#### Turn-Based Play

- Only current player can act
- Timer shows whose turn it is
- Other players wait (with countdown timer)
- Action timeout (30 seconds) then auto-stand

### Social Features

#### Player Info Display

- Username above each seat
- Chip count (public or private based on settings)
- Win/loss streak icon
- Current bet amount
- Player avatar/profile picture

#### Chat System (Future)

- Table chat for seated players
- Spectator chat (separate channel)
- Dealer chat messages ("Player 3 busts!", "Blackjack for Player 1!")
- Emote reactions (thumbs up, fire, etc.)

#### Competitive Elements

- Compare scores with other players at table
- "Beat Your Neighbor" challenges
- Table-wide achievements (e.g., "Everyone hits blackjack")

## DynamoDB Schema

### Table Occupancy

```
PK: TABLE#<tableId>
SK: SEAT#<seatNumber>

Attributes:
- tableId: string (e.g., "table-1", "table-vip-2")
- seatNumber: number (1-8)
- userId: string | null (null if vacant)
- username: string | null
- chips: number (player's chip count)
- seatStatus: "VACANT" | "OCCUPIED" | "RESERVED"
- joinedAt: string (ISO8601)
- lastActionAt: string (ISO8601)
```

### Game Session

```
PK: GAME#<gameId>
SK: METADATA

Attributes:
- gameId: string (unique game session ID)
- tableId: string
- dealerId: string (AI or human dealer)
- gameState: "WAITING" | "BETTING" | "DEALING" | "PLAYER_TURN" | "DEALER_TURN" | "RESOLVING"
- currentTurn: number (seat number of active player)
- shoePosition: number (cards dealt from shoe)
- runningCount: number
- trueCount: number
- handNumber: number
- players: array of player objects
- startedAt: string (ISO8601)
- updatedAt: string (ISO8601)
```

### Player Score

```
PK: USER#<userId>
SK: SCORE#<sessionId>

Attributes:
- userId: string
- sessionId: string
- score: number
- currentStreak: number
- longestStreak: number
- scoreMultiplier: number (1.0 - 2.0, resets on count peek)
- totalHandsPlayed: number
- correctDecisions: number
- wrongDecisions: number
- strategyAccuracy: number (percentage)
- countingAccuracy: number (percentage)
- countPeeks: number (times peeked at count)
- gameRules: object (deck count, penetration, etc.)
- countingSystem: string ("HI_LO", "KO", etc.)
- startedAt: string (ISO8601)
- completedAt: string (ISO8601)
```

### Strategy Card Usage

```
PK: USER#<userId>
SK: STRATEGY_PEEK#<timestamp>

Attributes:
- userId: string
- timestamp: string (ISO8601)
- handId: string (specific hand where peek occurred)
- playerHand: string (e.g., "16")
- dealerUpcard: string (e.g., "10")
- recommendedAction: string ("HIT", "STAND", etc.)
- actualAction: string
- wasCorrect: boolean
- chipCost: number (10)
```

### Count Peek Usage

```
PK: USER#<userId>
SK: COUNT_PEEK#<timestamp>

Attributes:
- userId: string
- timestamp: string (ISO8601)
- sessionId: string
- shoePosition: number (cards dealt when peeked)
- runningCountRevealed: number
- trueCountRevealed: number
- decksRemaining: number
- previousMultiplier: number
- multiplierAfterPeek: number (1.0)
- reason: string (optional - why they peeked)
```

## GraphQL Schema

### Types

```graphql
type Table {
  id: ID!
  name: String!
  seats: [Seat!]!
  currentGame: Game
  spectators: [User!]
  minBet: Int!
  maxBet: Int!
  rules: GameRules!
}

type Seat {
  number: Int!
  status: SeatStatus!
  player: User
  chips: Int
  currentBet: Int
  joinedAt: AWSDateTime
}

enum SeatStatus {
  VACANT
  OCCUPIED
  RESERVED
}

type Game {
  id: ID!
  tableId: ID!
  state: GameState!
  currentTurn: Int
  runningCount: Int!
  trueCount: Float!
  handNumber: Int!
  players: [PlayerHand!]!
  dealer: DealerHand!
}

enum GameState {
  WAITING
  BETTING
  DEALING
  PLAYER_TURN
  DEALER_TURN
  RESOLVING
}

type PlayerHand {
  seatNumber: Int!
  userId: ID!
  cards: [Card!]!
  bet: Int!
  status: HandStatus!
  canHit: Boolean!
  canStand: Boolean!
  canDouble: Boolean!
  canSplit: Boolean!
  canSurrender: Boolean!
}

enum HandStatus {
  ACTIVE
  STANDING
  BUSTED
  BLACKJACK
  SURRENDERED
}

type Card {
  suit: String!
  rank: String!
  value: Int!
}

type Score {
  current: Int!
  currentStreak: Int!
  longestStreak: Int!
  nextCorrectWorth: Int!
  scoreMultiplier: Float!
  totalCorrect: Int!
  totalWrong: Int!
  accuracy: Float!
  countPeeks: Int!
}

type StrategyRecommendation {
  action: PlayerAction!
  explanation: String!
  confidence: Float!
}

enum PlayerAction {
  HIT
  STAND
  DOUBLE
  SPLIT
  SURRENDER
}
```

### Queries

```graphql
type Query {
  # Get available tables
  getTables(minSeats: Int): [Table!]!

  # Get specific table state
  getTable(tableId: ID!): Table!

  # Get user's current score
  getMyScore: Score!

  # Get leaderboard
  getLeaderboard(
    period: LeaderboardPeriod!
    countingSystem: CountingSystem
    gameRules: GameRulesInput
    limit: Int
  ): [LeaderboardEntry!]!

  # Get strategy recommendation (costs 10 chips)
  peekStrategyCard(
    playerHand: [String!]!
    dealerUpcard: String!
  ): StrategyRecommendation!
}

enum LeaderboardPeriod {
  DAILY
  WEEKLY
  MONTHLY
  ALL_TIME
}

type LeaderboardEntry {
  rank: Int!
  userId: ID!
  username: String!
  score: Int!
  streak: Int!
  accuracy: Float!
  handsPlayed: Int!
}
```

### Mutations

```graphql
type Mutation {
  # Seat management
  sitAtTable(tableId: ID!, seatNumber: Int!): SitResult!
  standFromTable(tableId: ID!): Boolean!

  # Game actions
  placeBet(amount: Int!): Boolean!
  playerHit: Game!
  playerStand: Game!
  playerDouble: Game!
  playerSplit: Game!
  playerSurrender: Game!

  # Strategy card
  useStrategyCard: StrategyRecommendation!

  # Count peek (resets score multiplier)
  peekAtCount: CountPeekResult!

  # Scoring
  recordDecision(action: PlayerAction!, wasCorrect: Boolean!): Score!
}

type CountPeekResult {
  runningCount: Int!
  trueCount: Float!
  decksRemaining: Float!
  multiplierReset: Boolean!
  previousMultiplier: Float!
  message: String!
}

type SitResult {
  success: Boolean!
  table: Table
  error: String
}
```

### Subscriptions

```graphql
type Subscription {
  # Subscribe to table updates
  onTableUpdate(tableId: ID!): Table!

  # Subscribe to game events
  onGameEvent(tableId: ID!): GameEvent!

  # Subscribe to score updates
  onScoreUpdate(userId: ID!): Score!
}

type GameEvent {
  type: GameEventType!
  message: String!
  data: String # JSON payload
}

enum GameEventType {
  PLAYER_JOINED
  PLAYER_LEFT
  HAND_STARTED
  CARD_DEALT
  PLAYER_ACTION
  HAND_RESOLVED
  SHOE_SHUFFLED
}
```

## Implementation Priority

### Phase 1: Single Player with Scoring

- Implement exponential scoring system
- Track streaks and accuracy
- Score multiplier system
- Count peek feature (resets multiplier)
- Strategy card peek feature (costs chips)
- Basic leaderboard
- No multi-player yet

### Phase 2: Multi-Player Tables

- Table occupancy system
- Seat selection UI
- Turn-based play
- Real-time sync via subscriptions
- Spectator mode

### Phase 3: Social Features

- Chat system
- Player profiles at table
- Challenges and achievements
- Table-wide competitions

### Phase 4: Advanced Scoring

- Counting accuracy multipliers
- Speed bonuses
- Bet sizing accuracy
- Advanced leaderboards with filtering

## UI/UX Considerations

### Streak Celebration

- Milestone animations at 5, 10, 15, 20 streaks
- Sound effects for correct decisions
- Visual fireworks for 10+ streaks
- Confetti animation for new personal best

### Strategy Card UI

- Floating modal overlay
- Semi-transparent to show game behind
- Quick reference chart with color coding
- "Got it" button to dismiss
- Shows chips deducted

### Seat Selection UI

- Click vacant seat to claim
- Show "Sit Here" button on hover
- Display other players' usernames
- Indicate which seat is yours (highlight)
- Quick-sit button (auto-select first available)

### Score Display

- Always visible in top bar
- Pulse animation on score increase
- Streak counter with fire icon
- Progress bar to next milestone
- Score multiplier badge (1.0x - 2.0x) with glow effect

### Count Peek UI

- Prominent button in top bar (eye icon 👁️)
- Warning border when multiplier >1.0x
- Confirmation dialog with multiplier impact
- Post-peek overlay showing count details
- Visual penalty effect (red flash, multiplier reset animation)

## Anti-Cheat Measures

### Server-Side Validation

- All decisions validated on backend
- Correct action calculated server-side
- No client-side score modification
- Compare player action to basic strategy table

### Timing Analysis

- Track decision timing patterns
- Flag suspiciously perfect play
- Detect bot-like behavior (consistent timing)
- Require occasional CAPTCHA for high scores

### Audit Trail

- Log every decision with timestamp
- Record strategy card usage
- Record count peek usage
- Track all score changes and multiplier resets
- Enable manual review of suspicious scores

### Leaderboard Integrity

- Minimum hands played to qualify (e.g., 100)
- Require verified email for leaderboard
- Moderator review of top scores
- Ban accounts with proven cheating
