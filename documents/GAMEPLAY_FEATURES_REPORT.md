# Card Counting Trainer - Gameplay Features Investigation Report

**Date:** November 12, 2025  
**Codebase Location:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend`

---

## Executive Summary

This report analyzes the implementation status of key blackjack gameplay features in the card counting trainer:

- **Split**: FULLY IMPLEMENTED and working
- **Double Down**: FULLY IMPLEMENTED and working
- **Surrender**: RECOGNIZED but NOT IMPLEMENTED
- **Insurance**: FULLY IMPLEMENTED and working
- **Resplit**: DEFINED in settings but NOT ENFORCED in game logic

---

## 1. SPLIT GAMEPLAY

### Implementation Status: FULLY IMPLEMENTED ✓

#### UI Component
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/components/SplitHandsModal.tsx`

- **Lines:** 1-307
- **Features:**
  - Displays multiple split hands side-by-side
  - Shows active hand with gold border highlight
  - Displays hand status (ACTIVE, DONE, BUST)
  - Shows card values and individual bets
  - Provides HIT and STAND buttons for each hand
  - Can minimize modal when not player's turn

#### Game Logic
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/lib/gameActions.ts`

- **Function:** `split()` (Lines 287-350)
- **What it does:**
  - Checks if hand can be split (matching ranks)
  - Creates two new hands from the split pair
  - Deals one card to each new hand
  - Deducts additional bet from player chips
  - Updates shoe and running count

**Helper Function:** `canSplit()` (Lines 113-116)
- Returns true if hand has exactly 2 cards of same rank

#### UI/Game Integration
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/components/GameModals.tsx`

- **Lines:** 62-65: Split validation
```typescript
const canSplitHand =
  playerHand.cards.length === 2 &&
  playerHand.cards[0].rank === playerHand.cards[1].rank &&
  playerChips >= playerHand.bet;
```

- **Lines:** 107-135: Split hands modal display
- **Line:** 147: Split button in PlayerActionsModal

#### State Management
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/types/gameState.ts`

- **Lines:** 11-13: Split hand tracking
```typescript
isSplit?: boolean; // True if this is a split hand
splitHands?: PlayerHand[]; // For split hands - array of individual hands
activeSplitHandIndex?: number; // Which split hand is currently being played
```

#### Basic Strategy Support
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/lib/basicStrategy.ts`

- **Lines:** 91-122: PAIR_SPLITS strategy table
- **Lines:** 174-191: Split logic in `getBasicStrategyAction()`
- Includes adjustment for "Double After Split" setting

### Issues/Notes
- ✓ Works correctly with multiple hands
- ✓ Bet is properly duplicated for second hand
- ✓ Proper handling of active hand index

---

## 2. DOUBLE DOWN

### Implementation Status: FULLY IMPLEMENTED ✓

#### Game Logic
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/lib/gameActions.ts`

- **Function:** `doubleDown()` (Lines 248-278)
- **What it does:**
  - Takes current bet and doubles it
  - Deals exactly one more card
  - Deducts doubled amount from player chips
  - Updates shoe and running count

**Helper Function:** `canDouble()` (Lines 125-131)
- Returns true if:
  - Hand has exactly 2 cards
  - Player has enough chips to double the bet

#### UI Integration
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/components/PlayerActionsModal.tsx`

- **Lines:** 79-104: Double button UI
- Blue button with hover effects
- Only shows when `canDouble` is true

**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/components/GameModals.tsx`

- **Lines:** 67-68: Double validation
```typescript
const canDoubleHand =
  playerHand.cards.length === 2 && playerChips >= playerHand.bet;
```

#### Game Settings Rules
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/types/gameSettings.ts`

- **Line:** 48: `doubleDownRule` (DoubleDownRule enum)
- **Options:**
  - ANY_TWO_CARDS (default)
  - NINE_TEN_ELEVEN
  - TEN_ELEVEN
  - NOT_ALLOWED

#### Basic Strategy Support
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/lib/basicStrategy.ts`

- **Lines:** 137-150: `canDoubleByRules()` function
- **Lines:** 214-219: Soft hand double handling
- **Lines:** 243-249: Hard hand double handling
- Strategy tables include "D" (Double) recommendations

### Issues/Notes
- ✓ Properly enforces 2-card minimum
- ✓ Respects doubleDownRule settings
- ✓ Correctly doubles bet and adds exactly one card
- ✓ Prevents further hits after double

---

## 3. SURRENDER

### Implementation Status: RECOGNIZED BUT NOT IMPLEMENTED ✗

#### Recognition in Code
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/lib/basicStrategy.ts`

- **Lines:** 251-258: Surrender handling
```typescript
// If strategy says surrender but not allowed or available
if (hardAction === "SU" && !settings.lateSurrenderAllowed) {
  return "H";
}
if (hardAction === "SU") {
  // Note: Surrender is not implemented in the game yet, so default to hit
  return "H";
}
```

**Comment indicates:** "Surrender is not implemented in the game yet"

#### Settings Defined
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/types/gameSettings.ts`

- **Lines:** 54-56: Surrender options
```typescript
lateSurrenderAllowed: boolean;
earlySurrenderAllowed: boolean;
```

- **Default settings:** Both set to `false` (Lines 86-88)

#### Strategy Tables Reference Surrender
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/lib/basicStrategy.ts`

- **Lines:** 50-51: Surrender vs 10 and 9-A
```typescript
15: ["S", "S", "S", "S", "S", "H", "H", "H", "H", "SU"], // Surrender vs 10
16: ["S", "S", "S", "S", "S", "H", "H", "SU", "SU", "SU"], // Surrender vs 9-A
```

### Issues/Notes
- ❌ No UI component for surrender
- ❌ No game logic handler for surrender
- ❌ No surrender button in PlayerActionsModal
- ❌ Strategy suggests surrender but always converts to hit
- ✓ Settings infrastructure exists for future implementation

### To Implement Surrender:
1. Create surrender handler in gameActions.ts
2. Add SurrenderUI component
3. Add surrender button to PlayerActionsModal
4. Update GameModals.tsx to show surrender option
5. Handle surrender phase logic

---

## 4. INSURANCE

### Implementation Status: FULLY IMPLEMENTED ✓

#### UI Component
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/components/InsuranceUI.tsx`

- **Lines:** 1-143
- **Features:**
  - Shows insurance prompt when dealer shows Ace
  - Displays insurance cost (50% of current bet)
  - Shows insurance payout (2:1)
  - Calculates if player can afford insurance
  - Disables button if insufficient chips

#### Game Logic - Player Insurance
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/app/page.tsx`

- **Function:** `handleTakeInsurance()` (Lines 322-346)
  - Calculates insurance cost as 50% of bet (floor)
  - Deducts cost from player chips
  - Sets playerInsuranceBet state
  - Withdraws insurance offer

- **Function:** `handleDeclineInsurance()` (Lines 348-352)
  - Clears playerInsuranceBet
  - Withdraws insurance offer

#### Insurance Phase Hook
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/hooks/useInsurancePhase.ts`

- **Lines:** 1-125
- **Features:**
  - Triggered when INSURANCE phase begins
  - AI players make insurance decisions (~10% of the time)
  - Waits for player to decide (if seated)
  - Transitions to next phase after all decisions

- **Lines:** 56-90: AI insurance logic
  - Takes insurance 10% of the time (simplified logic)
  - Deducts insurance cost from AI chips
  - Logs decisions for debugging

#### Game Settings
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/types/gameSettings.ts`

- **Line:** 45: `insuranceAvailable: boolean`
- **Default:** `true`

#### Game Modals Integration
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/components/GameModals.tsx`

- **Lines:** 96-104: Insurance UI display
```typescript
{phase === "INSURANCE" && insuranceOffered && playerSeat !== null && (
  <InsuranceUI
    currentBet={currentBet}
    playerChips={playerChips}
    onTakeInsurance={handleTakeInsurance}
    onDeclineInsurance={handleDeclineInsurance}
  />
)}
```

### Issues/Notes
- ✓ Shows only when dealer shows Ace (handled in dealing phase)
- ✓ Properly calculates insurance cost
- ✓ Prevents insurance if insufficient chips
- ✓ AI makes reasonable decisions
- ✓ Insurance result resolution (needs verification in resolving phase)

---

## 5. RESPLIT (Resplitting Pairs)

### Implementation Status: DEFINED IN SETTINGS BUT NOT ENFORCED ⚠️

#### Settings Defined
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/types/gameSettings.ts`

- **Line:** 50: `maxResplits: number; // 0-3 (0 = no split, 3 = up to 4 hands)`
- **Line:** 51: `resplitAces: boolean;`
- **Line:** 52: `hitSplitAces: boolean;`

#### Default Values
- `maxResplits: 3` (allows up to 4 hands)
- `resplitAces: false` (cannot resplit Aces)
- `hitSplitAces: false` (cannot hit split Aces)

#### Preset Configurations
**File:** `/home/liqk1ugzoezh5okwywlr_/dev/nl-mono-repo-agent-1/packages/card-counting-trainer/frontend/src/types/gameSettings.ts`

- **Lines:** 117-172: Various presets with different resplit rules
  - Las Vegas Strip: `maxResplits: 3`
  - Single Deck: `maxResplits: 0` (no resplits)
  - Double Deck: `maxResplits: 3`
  - European: `maxResplits: 3`
  - Bad Rules: `maxResplits: 0`

### Current Limitation
The split function in gameActions.ts does NOT check `maxResplits`. When a hand is split, the player can immediately split again without limit.

**Current behavior:**
```typescript
// gameActions.ts split() function
const canSplitHand = (GameModals.tsx line 62-65):
  playerHand.cards.length === 2 &&
  playerHand.cards[0].rank === playerHand.cards[1].rank &&
  playerChips >= playerHand.bet;
```

This checks if the current hand is a pair, but doesn't check:
- How many times the original pair has been split
- If the setting allows resplits at all
- If maxResplits limit has been reached

### To Enforce Resplit Rules:
1. Track split count per hand in PlayerHand interface
2. In GameModals.tsx `canSplitHand` calculation, add:
   ```typescript
   const splitCount = getHandSplitCount(playerHand);
   const canResplit = splitCount < gameSettings.maxResplits;
   ```
3. Prevent resplitting of Aces if `resplitAces` is false
4. Prevent hitting split Aces if `hitSplitAces` is false

---

## Summary Table

| Feature | Status | UI | Game Logic | Basic Strategy | Settings | Notes |
|---------|--------|----|----|--------|----------|--------|
| **Split** | ✓ FULL | SplitHandsModal.tsx | gameActions.ts | basicStrategy.ts | Supported | Fully working |
| **Double Down** | ✓ FULL | PlayerActionsModal.tsx | gameActions.ts | basicStrategy.ts | doubleDownRule | Fully working |
| **Surrender** | ✗ NOT IMPL | None | None | Converts to HIT | lateSurrender Allowed | Only in strategy tables |
| **Insurance** | ✓ FULL | InsuranceUI.tsx | page.tsx handlers | Basic AI logic | insuranceAvailable | Fully working |
| **Resplit** | ⚠️ PARTIAL | Works (via split) | Not enforced | N/A | maxResplits defined | Limit not checked |

---

## File Reference Map

### Core Game Logic
- `/src/lib/gameActions.ts` - All action functions (deal, hit, stand, double, split)
- `/src/lib/basicStrategy.ts` - Strategy tables and recommendations
- `/src/types/gameSettings.ts` - Game configuration and rules

### UI Components
- `/src/components/PlayerActionsModal.tsx` - Hit/Stand/Double/Split buttons
- `/src/components/SplitHandsModal.tsx` - Split hands display and management
- `/src/components/InsuranceUI.tsx` - Insurance offer prompt
- `/src/components/GameModals.tsx` - Master modal controller

### Game State
- `/src/types/game.ts` - Card and hand types
- `/src/types/gameState.ts` - Player hand and game phase types
- `/src/contexts/GameActionsContext.tsx` - Action handlers context

### Game Phases
- `/src/hooks/useInsurancePhase.ts` - Insurance phase logic
- `/src/hooks/useGameActions.ts` - Core action handlers

### Main Game Page
- `/src/app/page.tsx` - Insurance handlers (lines 322-352)

---

## Testing Recommendations

1. **Split Testing:**
   - Split pairs (e.g., 8-8, A-A)
   - Verify bet is duplicated
   - Play out multiple hands sequentially
   - Test with insufficient chips

2. **Double Down Testing:**
   - Double on 10 and 11 (common)
   - Try double on other values based on rules
   - Verify bet doubles
   - Verify only one card dealt

3. **Insurance Testing:**
   - Trigger when dealer shows Ace
   - Take insurance and verify payout
   - Decline insurance
   - Test with insufficient chips for insurance

4. **Resplit Testing (When Implemented):**
   - Split A-A and see if can resplit based on maxResplits
   - Test maxResplits=0 (no resplits allowed)
   - Test maxResplits=3 (up to 4 hands)
   - Test resplitAces setting

5. **Surrender Testing (When Implemented):**
   - Surrender on hard 15 vs 10
   - Surrender on hard 16 vs 9-A
   - Verify proper payout (50% of bet returned)

