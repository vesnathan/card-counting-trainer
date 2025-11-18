# Blackjack Card Counting Trainer - Game Settings

## Overview

This document outlines the configurable game settings that users should be able to customize in the Card Counting Trainer. These settings allow users to practice card counting under different casino rule variations they might encounter in real-world play.

## User Settings Categories

### 1. Deck Configuration

#### Number of Decks

- **Options**: 1, 2, 4, 6, 8 decks
- **Default**: 6 decks (most common in casinos)
- **Impact**: Fewer decks = lower house edge and easier card counting
- **Notes**:
  - Single and double deck games are rare but offer best odds for players
  - 6-deck is the most common configuration in modern casinos
  - 8-deck games increase house edge further

#### Deck Penetration (Cut Card Placement)

- **Options**: 40% - 90% (in 5% increments)
- **Default**: 75% (1.5 decks cut off in 6-deck game)
- **Impact**: Higher penetration = more accurate true counts and better for card counting
- **Notes**:
  - Measured as percentage of cards dealt before shuffle
  - Typical 6-deck penetration: 75% (4.5 decks dealt, 1.5 cut off)
  - Typical 2-deck penetration: 50-65%
  - 75%+ is considered good for card counting
  - Below 60% penetration makes counting significantly less effective

### 2. Dealer Rules

#### Dealer Action on Soft 17

- **Options**:
  - Stand on Soft 17 (S17)
  - Hit on Soft 17 (H17)
- **Default**: Hit on Soft 17 (most common)
- **Impact**: S17 reduces house edge by ~0.2%
- **Notes**:
  - Soft 17 = Ace + 6 (can be counted as 7 or 17)
  - H17 favors the house
  - S17 is more favorable to players

#### Dealer Peek for Blackjack

- **Options**:
  - American (dealer peeks for blackjack)
  - European No-Peek (dealer doesn't peek)
  - European No Hole Card (dealer takes second card after players act)
- **Default**: American (dealer peeks)
- **Impact**: Affects strategy for doubles and splits
- **Notes**:
  - **American**: Dealer receives hole card and peeks if showing Ace or 10
  - **European No-Peek**: Dealer has hole card but doesn't peek
  - **European No Hole Card**: Dealer only takes second card after all players finish
  - No-peek/No hole card increases risk when doubling or splitting against Ace/10

### 3. Payout Rules

#### Blackjack Payout

- **Options**:
  - 3:2 (Standard)
  - 6:5 (Reduced)
  - 2:1 (Rare, promotional)
  - 1:1 (Even money, worst)
- **Default**: 3:2
- **Impact**: 6:5 adds ~1.4% to house edge
- **Notes**:
  - 3:2 = $10 bet wins $15
  - 6:5 = $10 bet wins $12
  - **ALWAYS avoid 6:5 games in real play**
  - 3:2 is the standard and only acceptable payout

#### Insurance Payout

- **Options**:
  - Available (2:1 payout)
  - Not Available
- **Default**: Available
- **Impact**: Insurance is generally a bad bet (house edge ~7%)
- **Notes**:
  - Offered when dealer shows Ace
  - Pays 2:1 if dealer has blackjack
  - Card counters may take insurance at high positive counts

### 4. Player Action Rules

#### Double Down

- **Options**:
  - Any two cards
  - 9, 10, 11 only
  - 10, 11 only
  - Not allowed
- **Default**: Any two cards
- **Impact**: More flexibility = lower house edge
- **Notes**: Most casinos allow doubling on any two cards

#### Double After Split (DAS)

- **Options**: Allowed / Not Allowed
- **Default**: Allowed
- **Impact**: Reduces house edge by ~0.14%
- **Notes**: Ability to double down after splitting a pair

#### Resplit

- **Options**:
  - Can resplit up to 4 hands
  - Can resplit up to 3 hands
  - Can resplit up to 2 hands (1 split only)
  - Cannot resplit
- **Default**: Up to 4 hands
- **Impact**: Minor reduction in house edge
- **Notes**: Number of times you can split pairs

#### Resplit Aces

- **Options**: Allowed / Not Allowed
- **Default**: Not Allowed (most common)
- **Impact**: Reduces house edge by ~0.03% when allowed
- **Notes**: Most casinos don't allow resplitting Aces

#### Hit Split Aces

- **Options**: Allowed / Not Allowed
- **Default**: Not Allowed (most common)
- **Impact**: Reduces house edge by ~0.14% when allowed
- **Notes**: Most casinos only allow one card per split Ace

### 5. Surrender Options

#### Late Surrender

- **Options**: Allowed / Not Allowed
- **Default**: Not Allowed
- **Impact**: Reduces house edge by ~0.07-0.08% when used correctly
- **Notes**:
  - Give up hand and lose half bet after dealer checks for blackjack
  - Basic strategy: Surrender hard 16 vs dealer 9, 10, A; hard 15 vs dealer 10

#### Early Surrender

- **Options**: Allowed / Not Allowed
- **Default**: Not Allowed (very rare)
- **Impact**: Reduces house edge by ~0.63%
- **Notes**:
  - Give up hand before dealer checks for blackjack
  - Extremely rare in modern casinos

### 6. Counting System Configuration

#### Counting System

- **Options**:
  - Hi-Lo (Level 1, Balanced)
  - KO - Knock-Out (Level 1, Unbalanced)
  - Hi-Opt I (Level 1, Balanced)
  - Hi-Opt II (Level 2, Balanced)
  - Omega II (Level 2, Balanced)
- **Default**: Hi-Lo (most popular)
- **Impact**: Complexity vs. accuracy tradeoff
- **Card Values**:

**Hi-Lo** (Recommended for beginners):

- +1: 2, 3, 4, 5, 6
- 0: 7, 8, 9
- -1: 10, J, Q, K, A

**KO - Knock-Out** (Easier, no true count conversion):

- +1: 2, 3, 4, 5, 6, 7
- 0: 8, 9
- -1: 10, J, Q, K, A

**Hi-Opt I**:

- +1: 3, 4, 5, 6
- 0: 2, 7, 8, 9, A
- -1: 10, J, Q, K

**Hi-Opt II** (More complex):

- +2: 4, 5
- +1: 2, 3, 6, 7
- 0: 8, 9, A
- -2: 10, J, Q, K

**Omega II** (Advanced, ~99% betting efficiency):

- +2: 4, 5, 6
- +1: 2, 3, 7
- 0: 8, A
- -1: 9
- -2: 10, J, Q, K

#### Side Count Aces

- **Options**: Enabled / Disabled
- **Default**: Disabled
- **Impact**: Improves betting accuracy for advanced systems
- **Notes**: Used with Hi-Opt and Omega II systems for maximum accuracy

### 7. Training Configuration

#### Training Mode

- **Options**:
  - Practice Mode (show running count)
  - Test Mode (hide running count, verify at end)
  - Timed Challenge (speed + accuracy)
- **Default**: Practice Mode

#### Speed Control

- **Options**:
  - Slow (2 seconds per card)
  - Medium (1 second per card)
  - Fast (0.5 seconds per card)
  - Very Fast (0.25 seconds per card)
  - Custom (user defined)
- **Default**: Medium

#### Show True Count

- **Options**: Enabled / Disabled
- **Default**: Enabled
- **Notes**: True Count = Running Count ÷ Remaining Decks

#### Betting Hints

- **Options**: Enabled / Disabled
- **Default**: Enabled
- **Notes**: Suggests bet sizing based on true count

#### Strategy Hints

- **Options**:
  - No hints
  - Show correct action after mistake
  - Show correct action always
- **Default**: Show correct action after mistake

### 8. Common Casino Presets

To make setup easier, provide preset configurations for common casino scenarios:

#### Las Vegas Strip (Typical)

- 6 decks
- H17
- 3:2 blackjack
- DAS allowed
- Resplit to 4 hands
- No resplit Aces
- No surrender
- 75% penetration
- American (dealer peeks)

#### Single Deck (Player Favorable)

- 1 deck
- S17
- 3:2 blackjack
- No DAS
- Cannot resplit
- 60% penetration
- American (dealer peeks)

#### Double Deck (Good)

- 2 decks
- S17
- 3:2 blackjack
- DAS allowed
- Resplit to 4 hands
- 65% penetration
- American (dealer peeks)

#### European Style

- 6 decks
- S17
- 3:2 blackjack
- DAS allowed
- Resplit to 4 hands
- 75% penetration
- European No Hole Card

#### Bad Rules (Avoid in Real Life)

- 6 decks
- H17
- 6:5 blackjack
- No DAS
- No resplit
- 50% penetration
- American (dealer peeks)

## Settings Storage

### User Preferences

- Store settings per user in DynamoDB
- Allow multiple saved configurations ("profiles")
- Track statistics per configuration

### GraphQL Schema Structure

```graphql
type GameSettings {
  id: ID!
  userId: ID!
  name: String! # "My Vegas Setup", "Practice Config", etc.
  isDefault: Boolean!

  # Deck Configuration
  numberOfDecks: Int! # 1, 2, 4, 6, 8
  deckPenetration: Int! # 40-90 (percentage)
  # Dealer Rules
  dealerHitsSoft17: Boolean!
  dealerPeekRule: DealerPeekRule!

  # Payout Rules
  blackjackPayout: BlackjackPayout!
  insuranceAvailable: Boolean!

  # Player Action Rules
  doubleDownRule: DoubleDownRule!
  doubleAfterSplit: Boolean!
  maxResplits: Int! # 0-3 (0 = no split, 3 = up to 4 hands)
  resplitAces: Boolean!
  hitSplitAces: Boolean!

  # Surrender Options
  lateSurrenderAllowed: Boolean!
  earlySurrenderAllowed: Boolean!

  # Counting System
  countingSystem: CountingSystem!
  sideCountAces: Boolean!

  # Training Configuration
  trainingMode: TrainingMode!
  cardSpeed: Float! # seconds per card
  showTrueCount: Boolean!
  showBettingHints: Boolean!
  strategyHints: StrategyHintLevel!

  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

enum DealerPeekRule {
  AMERICAN_PEEK
  EUROPEAN_NO_PEEK
  EUROPEAN_NO_HOLE_CARD
}

enum BlackjackPayout {
  THREE_TO_TWO # Standard 3:2
  SIX_TO_FIVE # Terrible 6:5
  TWO_TO_ONE # Rare promotional
  EVEN_MONEY # 1:1 (worst)
}

enum DoubleDownRule {
  ANY_TWO_CARDS
  NINE_TEN_ELEVEN
  TEN_ELEVEN
  NOT_ALLOWED
}

enum CountingSystem {
  HI_LO
  KO
  HI_OPT_I
  HI_OPT_II
  OMEGA_II
}

enum TrainingMode {
  PRACTICE
  TEST
  TIMED_CHALLENGE
}

enum StrategyHintLevel {
  NONE
  AFTER_MISTAKE
  ALWAYS
}
```

## Settings Page UI Structure

### Layout Sections

1. **Quick Presets** (Top)

   - Dropdown or cards for common casino presets
   - "Load Preset" button

2. **Deck Configuration**

   - Number of decks (radio buttons or dropdown)
   - Deck penetration (slider with percentage display)

3. **Dealer Rules**

   - Soft 17 action (toggle)
   - Peek rule (radio buttons)

4. **Payout Rules**

   - Blackjack payout (dropdown)
   - Insurance availability (toggle)

5. **Player Actions**

   - Double down rules (dropdown)
   - DAS, resplit options (toggles and number input)

6. **Surrender** (Collapsible)

   - Late surrender (toggle)
   - Early surrender (toggle)

7. **Counting System**

   - System selection (dropdown with descriptions)
   - Side count aces (toggle)
   - Display card value chart for selected system

8. **Training Options**

   - Mode selection
   - Speed control
   - Hint settings

9. **Actions**
   - Save as new profile
   - Update current profile
   - Delete profile
   - Reset to default

### House Edge Calculator

Include a real-time house edge calculator that updates as settings change, showing:

- Estimated house edge percentage
- Impact of each rule variation
- Comparison to "ideal" rules

Example: "Current house edge: 0.62%. Changing to S17 would reduce it to 0.42%."

## Implementation Priority

### Phase 1 (MVP)

- Number of decks
- Deck penetration
- Dealer hits/stands on soft 17
- Blackjack payout (3:2 vs 6:5)
- Basic counting system (Hi-Lo only)
- Training mode (Practice mode only)

### Phase 2

- All player action rules (double, split options)
- Multiple counting systems
- Surrender options
- Dealer peek variations
- Test mode and timed challenges

### Phase 3

- Preset configurations
- House edge calculator
- Advanced training features
- Statistics per configuration

## Notes

- Default settings should reflect most common casino rules (6-deck, H17, 3:2, DAS)
- Provide educational tooltips explaining each setting's impact
- Warn users about unfavorable settings (6:5, low penetration)
- Allow saving multiple configurations for different practice scenarios
- Track performance metrics per configuration to help users identify weak areas
