# Dev Testing System - Implementation Summary

## ✅ COMPLETED FEATURES

### 1. Dev Testing Mode Toggle
**Location**: [GameSettingsModal.tsx](../frontend/src/components/GameSettingsModal.tsx)
- Added toggle switch in Admin Settings (Game Settings modal)
- Orange accent color with ON/OFF button
- Warning message: "⚠️ Testing UI will appear at the start of each hand"
- State managed in UIStateContext

**Files Modified**:
- `contexts/UIStateContext.tsx` - Added `devTestingMode` state and setter
- `components/GameSettingsModal.tsx` - Added Developer Testing section (lines 685-771)
- `app/page.tsx` - Added `devTestingMode` state and passed to UIStateProvider

### 2. Test Scenario Definitions
**Location**: [testScenarios.ts](../frontend/src/types/testScenarios.ts)

Created 15 comprehensive test scenarios across 6 categories:

#### Basic Strategy (3 scenarios)
- Hard 16 vs Dealer 10 (surrender scenario)
- Hard 12 vs Dealer 2 (borderline hit)
- Hard 13 vs Dealer 5 (stand on bust card)

#### Splitting (3 scenarios)
- Split 8s vs Dealer 10 (always split 8s)
- Split Aces vs Dealer 6
- Don't Split 10s (never split tens)

#### Double Down (2 scenarios)
- Double 11 vs Dealer 6 (always double 11)
- Double Soft 18 vs Dealer 6

#### Soft Hands (3 scenarios)
- Soft 17 - Always Hit
- Soft 18 vs Dealer 9 (hit against 9/10/A)
- Soft 19 - Always Stand

#### Surrender (3 scenarios)
- Surrender 16 vs Dealer Ace
- Surrender 16 vs Dealer 10
- Surrender 15 vs Dealer 10

#### Insurance (1 scenario)
- Dealer Shows Ace (insurance decision)

**Scenario Structure**:
```typescript
{
  id: string;
  name: string;
  description: string;
  category: "basic" | "split" | "double" | "surrender" | "insurance" | "soft-hands";
  dealerUpCard: { rank: Rank; suit: Suit };
  playerHands?: Array<{ rank: Rank; suit: Suit }>;  // Force player cards
  aiHands?: Record<number, Array<{ rank: Rank; suit: Suit }>>;  // Force AI cards by position
  expectedAction?: "H" | "S" | "D" | "SP" | "SU";  // Expected basic strategy
  settingsOverride?: {  // Override game settings for this scenario
    lateSurrenderAllowed?: boolean;
    maxResplits?: number;
    resplitAces?: boolean;
    hitSplitAces?: boolean;
  };
}
```

### 3. Test Scenario Selector UI
**Location**: [TestScenarioSelector.tsx](../frontend/src/components/TestScenarioSelector.tsx)

**Features**:
- Auto-opens during BETTING phase when `devTestingMode` is enabled
- Category filtering (All, Basic, Split, Double, Surrender, Insurance, Soft Hands)
- Big green "🎲 Random Hand" button for normal play
- Each scenario card shows:
  - Name and description
  - Expected action badge (HIT/STAND/DOUBLE/SPLIT/SURRENDER)
  - Category label
  - Dealer upcard with suit symbol
- Hover effects and clean UI matching game style

**State Management**:
- Added `showTestScenarioSelector` and `selectedTestScenario` state to page.tsx
- Modal auto-opens via useEffect when entering BETTING phase in dev mode
- Selected scenario stored in state for use during dealing

### 4. AI Decision Info Display Component
**Location**: [AIDecisionInfo.tsx](../frontend/src/components/AIDecisionInfo.tsx)

**Features**:
- Floating info bubble positioned above AI players
- Shows:
  - Character name and skill level
  - Hand value vs dealer upcard
  - Likely action with probability percentage (based on skill level)
  - Random mistake chance
  - Notes about strategy conversions (e.g., "AI converts DOUBLE to HIT")
- Color-coded action labels:
  - HIT: Green (#4CAF50)
  - STAND: Blue (#2196F3)
  - DOUBLE: Orange (#FF9800)
  - SPLIT: Purple (#9C27B0)
  - SURRENDER: Red (#F44336)

**Logic**:
```typescript
// AI decision probability
const followBasicStrategyChance = character.skillLevel;  // 15-70%
const randomActionChance = 100 - followBasicStrategyChance;

// AI converts double to hit (we don't care about AI bet sizes)
if (basicStrategyAction === "D") {
  likelyAction = "H";
  likelyActionProbability = 100;
}

// AI surrenders based on skill level and game rules
if (basicStrategyAction === "SU") {
  if (canSurrender) {
    likelyActionProbability = followBasicStrategyChance;  // Skill-based
  } else {
    likelyAction = "H";  // Converts to hit if surrender disabled
    likelyActionProbability = 100;
  }
}
```

### 5. Reduced AI Players in Dev Mode
**Location**: [useGameInitialization.ts](../frontend/src/hooks/useGameInitialization.ts)

**Implementation**:
- Normal mode: 8 AI players (all seats filled)
- Dev mode: 2 AI players at positions 2 and 4 (spread out for visibility)
- Hook now accepts `devTestingMode` parameter
- Updated dependency array to react to dev mode changes

**Code**:
```typescript
const numAIPlayers = devTestingMode ? 2 : 8;
const availablePositions = devTestingMode ? [2, 4] : [0, 1, 2, 3, 4, 5, 6, 7];
```

### 6. Integration Complete
- Test scenario selector appears automatically when entering BETTING phase in dev mode
- State management for selected scenario added to page.tsx
- All TypeScript compilation passes ✅

---

## 🚧 REMAINING WORK

### 1. Apply Selected Scenario to Card Dealing
**Status**: Not implemented
**Complexity**: High

**What's Needed**:
- Modify `useAnimatedDealing.ts` or the dealing logic to use forced cards from `selectedTestScenario`
- When `selectedTestScenario` is not null:
  - Use `scenario.dealerUpCard` for dealer's first card
  - Use `scenario.playerHands` for player's two cards (if seated)
  - Use `scenario.aiHands[position]` for specific AI players' cards
  - Continue with random cards for remaining deals
- Apply `scenario.settingsOverride` to temporarily override game settings

**Approach**:
```typescript
// In dealing logic
if (selectedTestScenario && !devModeCardsApplied) {
  // Force dealer upcard
  dealerCards[0] = createCardFromScenario(selectedTestScenario.dealerUpCard);

  // Force player cards (if seated)
  if (playerSeat !== null && selectedTestScenario.playerHands) {
    playerHand.cards = selectedTestScenario.playerHands.map(createCardFromScenario);
  }

  // Force AI cards by position
  if (selectedTestScenario.aiHands) {
    Object.entries(selectedTestScenario.aiHands).forEach(([position, cards]) => {
      const aiIndex = aiPlayers.findIndex(ai => ai.position === parseInt(position));
      if (aiIndex !== -1) {
        aiPlayers[aiIndex].hand.cards = cards.map(createCardFromScenario);
      }
    });
  }

  // Apply settings overrides
  if (selectedTestScenario.settingsOverride) {
    tempGameSettings = { ...gameSettings, ...selectedTestScenario.settingsOverride };
  }

  devModeCardsApplied = true;
}
```

**Helper Function Needed**:
```typescript
function createCardFromScenario(cardSpec: { rank: Rank; suit: Suit }): Card {
  const value = calculateCardValue(cardSpec.rank);
  const count = getCountValue(cardSpec.rank, currentCountingSystem);
  return {
    ...cardSpec,
    value,
    count
  };
}
```

### 2. Show AI Decision Info Bubbles During AI Turns
**Status**: Not implemented
**Complexity**: Medium

**What's Needed**:
- In `useAITurnsPhase.ts` or wherever AI decisions are rendered
- When `devTestingMode` is enabled:
  - Calculate basic strategy action for current AI player
  - Render `<AIDecisionInfo />` component above the AI player's seat
  - Show during AI's turn (when `activePlayerIndex` matches AI index)
  - Hide when AI finishes their turn

**Approach**:
```typescript
// In BlackjackGameUI or AI player rendering
{devTestingMode && activePlayerIndex !== null && activePlayerIndex >= 0 && (
  <AIDecisionInfo
    character={aiPlayers[activePlayerIndex].character}
    playerCards={aiPlayers[activePlayerIndex].hand.cards}
    dealerUpCard={dealerHand.cards[0]}
    basicStrategyAction={getBasicStrategyAction(...)}
    canSplit={checkIfCanSplit(...)}
    canDouble={checkIfCanDouble(...)}
    canSurrender={gameSettings.lateSurrenderAllowed}
  />
)}
```

### 3. Disable Speech Bubbles in Dev Mode
**Status**: Not implemented
**Complexity**: Low

**What's Needed**:
- Add conditional check in speech bubble rendering logic
- When `devTestingMode` is enabled, skip all speech bubble updates
- This reduces visual clutter during testing

**Locations to Modify**:
- `useGameInteractions.ts` - `addSpeechBubble` function
- `useConversationHandlers.ts` - Conversation triggers
- Any component that renders `SpeechBubble` components

**Approach**:
```typescript
// In addSpeechBubble function
if (devTestingMode) {
  return; // Skip speech bubbles in dev mode
}

// In speech bubble rendering
{!devTestingMode && speechBubbles.map(...)}
```

---

## 📁 FILES CREATED

1. **`src/types/testScenarios.ts`** - Test scenario type definitions and 15 predefined scenarios
2. **`src/components/TestScenarioSelector.tsx`** - Modal UI for selecting test scenarios
3. **`src/components/AIDecisionInfo.tsx`** - Floating bubble showing AI decision probabilities

## 📝 FILES MODIFIED

1. **`src/contexts/UIStateContext.tsx`**
   - Added `devTestingMode: boolean`
   - Added `setDevTestingMode: (enabled: boolean) => void`

2. **`src/components/GameSettingsModal.tsx`**
   - Imported `useUIState`
   - Added Developer Testing section (lines 685-771)

3. **`src/app/page.tsx`**
   - Added imports for `TestScenario` and `TestScenarioSelector`
   - Added `devTestingMode` state
   - Added `showTestScenarioSelector` and `selectedTestScenario` states
   - Added TestScenarioSelector modal component
   - Added useEffect to auto-open scenario selector in BETTING phase
   - Passed `devTestingMode` to `useGameInitialization`

4. **`src/hooks/useGameInitialization.ts`**
   - Added `devTestingMode` parameter (default false)
   - Modified to create 2 AI players (positions 2, 4) in dev mode
   - Modified to create 8 AI players (all positions) in normal mode

---

## 🎯 USAGE

### Enabling Dev Testing Mode

1. Open Game Settings modal (⚙️ button)
2. Scroll to "🧪 Developer Testing" section
3. Click the ON button
4. Click "Save Settings"

### Using Test Scenarios

1. With dev mode enabled, start a new hand
2. During BETTING phase, Test Scenario Selector modal appears automatically
3. **Option 1**: Click "🎲 Random Hand" for normal random dealing
4. **Option 2**: Filter by category and select a specific test scenario
5. After selecting, the modal closes and dealing begins
6. *(When implemented)* Forced cards will be dealt according to the scenario

### Viewing AI Decision Info

*(When implemented)* During AI turns in dev mode:
- Floating bubble appears above each AI player
- Shows their skill level and likely action
- Shows probability of following basic strategy
- Shows notes about strategy modifications

---

## 💡 DESIGN DECISIONS

### Why Only 2 AI Players in Dev Mode?
- Easier to focus on specific AI behaviors
- Less visual clutter
- Positions 2 and 4 are spread out for better visibility
- Still tests multi-player scenarios (insurance, turn order, etc.)

### Why Force Cards Instead of Retry Until Match?
- Deterministic testing
- Faster - no waiting for random occurrence
- Can test rare scenarios (pair of 8s vs dealer 10)
- Ensures exact scenario every time

### Why Disable Speech Bubbles in Dev Mode?
- Reduces visual noise during testing
- Easier to focus on decision-making
- Speech bubbles can overlap with AI decision info bubbles
- Testing is about game logic, not character interactions

### Why Show Probability Instead of Actual Decision?
- Educational - shows how skill level affects decisions
- Helps understand AI behavior patterns
- Shows why AI sometimes makes "bad" plays
- Transparent about randomness in AI decisions

---

## 🔧 TECHNICAL NOTES

### Card Value Calculation
When forcing cards from scenarios, need to calculate:
- `value`: Blackjack value (1-11 for Ace, 10 for face cards, etc.)
- `count`: Hi-Lo count value (-1, 0, +1) based on current counting system

### Counting System Integration
Test scenarios should respect the current counting system:
- Hi-Lo: +1 (2-6), 0 (7-9), -1 (10-A)
- KO: +1 (2-7), 0 (8-9), -1 (10-A)
- Hi-Opt I: +1 (3-6), 0 (2,7-9,A), -1 (10-K)
- etc.

### Settings Override Precedence
When a scenario has `settingsOverride`:
1. Apply overrides temporarily
2. Original settings remain unchanged
3. After hand completes, revert to original settings
4. User should see indicator that settings are overridden

---

## 🧪 TESTING CHECKLIST

When completing implementation:

- [ ] Test scenario selector appears during BETTING in dev mode
- [ ] Test scenario selector does NOT appear in normal mode
- [ ] "Random Hand" button works and closes modal
- [ ] Selecting a scenario closes modal and stores selection
- [ ] Forced cards are dealt correctly for dealer
- [ ] Forced cards are dealt correctly for player (if seated)
- [ ] Forced cards are dealt correctly for AI players by position
- [ ] Settings overrides are applied during the hand
- [ ] Settings revert after hand completes
- [ ] AI decision info bubbles appear during AI turns
- [ ] AI decision info bubbles show correct probabilities
- [ ] Speech bubbles are disabled in dev mode
- [ ] All surrender scenarios work with surrender enabled
- [ ] Type checking passes
- [ ] No console errors during normal operation
- [ ] Dev mode can be toggled on/off without issues
- [ ] Game works normally when dev mode is OFF

---

## 📚 RELATED DOCUMENTATION

- [AI Strategy Implementation](./aiStrategy.ts) - How AI makes decisions
- [AI Characters](../frontend/src/data/aiCharacters.ts) - Character personalities and skill levels
- [Basic Strategy](../frontend/src/lib/basicStrategy.ts) - Basic strategy calculation
- [Game Actions](../frontend/src/lib/gameActions.ts) - Core game logic functions
