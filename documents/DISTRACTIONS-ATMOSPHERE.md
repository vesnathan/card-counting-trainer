# Card Counting Trainer - Distractions & Casino Atmosphere

## Overview

Real casino environments are designed to distract card counters and make counting difficult. This document outlines realistic distractions, atmospheric elements, and challenge mechanics that simulate the pressure of counting cards in a live casino.

## Casino Atmosphere

### Background Sounds

#### Ambient Casino Sounds (Continuous)

- **Slot Machine Noises**:

  - Spinning reels, coins clinking, jackpot bells
  - Random jackpot celebrations (every 30-90 seconds)
  - Digital beeps and bloops
  - Volume: 15-25% (background level)

- **Crowd Chatter**:

  - General murmur of conversations
  - Occasional laughter and exclamations
  - Player reactions ("Yes!", "Come on!", "Damn!")
  - Volume: 10-20%

- **Dealer Voice**:

  - "Place your bets"
  - "No more bets"
  - "Insurance?"
  - "Blackjack!" / "Dealer wins" / "Push"
  - Card dealing sounds (shuffling, card sliding)
  - Volume: 30-40% (clear but not overpowering)

- **Environmental**:
  - Ice in glasses clinking
  - Footsteps on carpet
  - Chair scraping
  - Cocktail waitress taking orders
  - Volume: 5-15%

### Sound Events (Random)

#### High Distraction Events (Rare, 1-2% chance per hand)

- **Jackpot Nearby**: Loud slot machine jackpot celebration with sirens, bells, and shouting

  - Duration: 8-12 seconds
  - Volume spike: 60-80%
  - Impact: High distraction, players often lose count

- **Fight/Argument**: Heated argument between players at another table

  - Duration: 5-10 seconds
  - Volume: 40-60%
  - Impact: Attention-grabbing, disrupts concentration

- **Drunk Player**: Loud, belligerent drunk player making scene
  - Duration: 6-10 seconds
  - Volume: 50-70%
  - "WOOOOO! I'M ON FIRE!"
  - Impact: Annoying and distracting

#### Medium Distraction Events (5-10% chance per hand)

- **Cocktail Waitress**: "Can I get you a drink?" with order-taking

  - Duration: 3-5 seconds
  - Optional response: "Yes/No thanks" (no penalty for either)
  - Impact: Minor distraction

- **Dealer Change**: "New dealer coming in, shuffling up"

  - Duration: 5-8 seconds
  - Shoe shuffle animation
  - Count resets (legitimate)
  - Impact: Break in rhythm

- **Tray Drop**: Waitress drops drink tray, loud crash and glass breaking

  - Duration: 2-4 seconds
  - Volume spike: 70-90%
  - Impact: Sudden disruption

- **Player Spills Drink**: Another player knocks over their drink
  - Duration: 3-5 seconds
  - "Oh shit! Sorry, sorry!"
  - Cleanup animation
  - Impact: Visual and audio distraction

#### Low Distraction Events (15-20% chance per hand)

- **Phone Ring**: Someone's phone ringing nearby

  - Duration: 3-5 seconds
  - Various ringtones
  - Impact: Mild annoyance

- **Player Comments**: Other players making strategy comments

  - "Why did you hit on that?"
  - "You should always split eights"
  - "I have a system..."
  - Impact: Can throw off focus

- **Photo Flash**: Tourist taking photos nearby
  - Duration: 1 second
  - Flash effect on screen
  - Impact: Brief visual disruption

## Underground Training Casino - Challenge System

### Setting & Theme

This is an **underground training casino** (inspired by the movie "21") where mobsters and tough guys test aspiring card counters. You're here to **prove yourself** and **learn**, not to avoid detection like in a real casino.

**Key Differences from Real Casino:**

- Mobster "trainers" TEST your counting ability
- Getting the count RIGHT is rewarded (proves you're good)
- Getting it WRONG is punished (proves you're not ready)
- This is a proving ground for future professional counters
- Atmosphere is intimidating but educational

### Challenge Types

#### 1. Mobster Count Quiz (Rare, 2-3% chance per hand)

**Appearance:**

- Screen darkens/blurs with dramatic lighting
- Intimidating mobster in suit appears center screen
- Stern expression, possibly smoking cigar
- Fedora hat, thick accent optional
- Countdown timer: 10 seconds to respond

**Dialog:**

```
🎩 MOBSTER
"Hold up, kid. Let's see if you got what it takes.
What's the running count right now? And don't lie to me."

[+X] [-X] [0] [Give Up]
```

**Response Options:**

1. **Give Up (Coward)**: Admit you lost count

   - **Penalty**: -300 chips + shame message
   - Message: "You're not ready for the big leagues, kid. Come back when you can keep up."
   - Score multiplier reduced to 0.8x for next 10 hands

2. **State Count Correctly**: Exact running count or within ±1

   - **REWARD**: +500 bonus chips + 1500 bonus points
   - Message: "Not bad, kid. You might actually have a future in this."
   - Score multiplier temporarily boosted to 1.2x for next 5 hands
   - Unlocks "Mobster Approved" badge (cosmetic)

3. **State Count Incorrectly**: More than ±1 off
   - **Penalty**: -400 chips + score multiplier reset to 1.0x
   - Message: "Wrong! You better sharpen up or you're gonna get hurt out there."
   - Increases chance of next challenge by 50%

**Context Clue:**
If player seems unsure, mobster adds: "We're training you here. This ain't about hiding—it's about proving you can do it under pressure."

#### 2. The Boss's Test (Very Rare, 1% chance, triggered at high performance)

**Appearance:**

- Dramatic entrance with two bodyguards
- Well-dressed crime boss character
- More sophisticated, less aggressive
- 15 second timer
- Background music intensifies

**Dialog:**

```
👔 THE BOSS
"Impressive run you're having. I wanna see if you're the real deal.
Give me the TRUE COUNT. Impress me, and there's a reward in it."

[State Count] [Ask for Hint] [Decline Respectfully]
```

**Response Options:**

1. **State Count Correctly** (exact, no ±1 margin):

   - **MASSIVE REWARD**: +1500 chips + 3000 bonus points
   - Message: "Now THAT'S what I'm talking about. You're gonna make us all a lot of money."
   - Unlocks "Made Man" achievement
   - Reduces challenge frequency for rest of session (you've proven yourself)

2. **State Count Incorrectly**:

   - **Moderate Penalty**: -600 chips
   - Message: "You got potential, but you're not there yet. Keep practicing."
   - No multiplier reset (boss is more forgiving than mobsters)

3. **Ask for Hint** (Shows humility):

   - Boss gives you range: "It's between +2 and +8"
   - Must guess within that range within 5 seconds
   - If correct: +300 chips, +500 points
   - If wrong: -200 chips
   - Message: "Smart to know your limits, kid."

4. **Decline Respectfully**:
   - **Neutral**: No penalty, no reward
   - Message: "Honest. I can respect that. Now get back to work."
   - No future consequences

#### 3. Drunk Wannabe Counter (Common, 5% chance)

**Appearance:**

- Intoxicated player at table stands up
- Slurred speech, animated, thinks he's a counter too
- 8 second timer

**Dialog:**

```
🍺 DRUNK PLAYER
"Hey! HEY! I'm countin' too, buddy! What you got?
Let's compare! C'mon, what's the count?!"

[Ignore] [Tell Him Correct] [Tell Him Wrong] [Make Joke]
```

**Response Options:**

1. **Ignore**:

   - **Neutral**: Player sits down mumbling
   - Message: "Fine... be that way... I know it's +4 anyway..." (usually wrong)
   - No penalty, no reward

2. **Tell Him Correct Count**:

   - **Risky**: He repeats it loudly, might be overheard
   - 25% chance mobster hears and tests you both
   - If mobster comes: You both get quizzed
   - If you're right and he's wrong: You get +200 points for showing him up
   - Message: "Yeah! That's what I thought! +7!"

3. **Tell Him Wrong Count**:

   - **Deception**: He believes you and plays badly
   - He loses chips and blames you later
   - Next time he sees you: "You lied to me!" (harmless, just funny)
   - No penalty

4. **Make Joke**:
   - **Reward**: He laughs and leaves you alone
   - +100 points, no other effect
   - Message: "Haha! You're alright man! Good luck out there!"

#### 4. Veteran Counter "Mentor" (Occasional, 3% chance at high performance)

**Appearance:**

- Older, experienced-looking player
- Weathered face, confident demeanor
- Former professional counter teaching the next generation
- No timer (friendly encounter)

**Dialog:**

```
🎓 VETERAN
"I've been watching you, kid. You got potential.
Let me test you real quick - what's the true count?"

[State True Count] [Ask for Advice] [Decline Politely]
```

**Response Options:**

1. **State True Count Correctly**:

   - **REWARD**: +300 chips + 500 bonus points
   - **Bonus**: He gives you a tip: "When the count hits +6, that's when you really push it."
   - Unlocks "Mentored" status (10% XP bonus for next 20 hands)
   - Message: "Excellent! You're a natural. Keep it up."

2. **State True Count Incorrectly**:

   - **Educational**: He corrects you
   - No penalty, but no reward
   - Message: "It's actually [X]. Remember - running count divided by decks remaining. You'll get it."
   - Shows count formula reminder on screen

3. **Ask for Advice**:

   - **Learning Opportunity**: He shares wisdom
   - No count quiz, no penalty
   - Random tip:
     - "Never bet big on the first hand after shuffle"
     - "If heat gets too high, make a dumb play to cool it off"
     - "True count of +3 is your sweet spot for doubling bets"
   - +100 points for humility
   - Message: "Smart to ask. Here's what I learned..."

4. **Decline Politely**:
   - **Neutral**: No penalty, no reward
   - Message: "I respect that. Good luck out there, kid."
   - He nods and walks away

## Visual Distractions

### Random Visual Events

#### 1. Cocktail Waitress Animation (Common, 10% chance)

- Animated character walks across table area
- Carries drink tray
- May "trip" and spill drinks (5% sub-chance)
- Duration: 3-5 seconds
- Blocks partial view of cards

#### 2. Other Players Standing/Moving (Common, 15% chance)

- Player at table stands up
- Stretches, adjusts seat, looks at phone
- Partially blocks view for 2-3 seconds
- No gameplay impact, just visual distraction

#### 3. Security Camera Pan (Rare, 2% chance at high counts)

- Camera icon appears in corner
- Red recording light
- Pans to focus on player
- Message: "You're being monitored"
- Adds pressure but no direct penalty

#### 4. Smoke Effect (If enabled, 5% chance)

- Cigarette/cigar smoke drifts across screen
- Blurs cards slightly for 1-2 seconds
- Can toggle in settings (some players find annoying)

#### 5. Phone Notification Pop-ups (If enabled)

- Fake notification pop-ups on screen
- "Your friend sent you a message"
- "Breaking News Alert"
- Must be dismissed (click X)
- Duration: Until dismissed

## Pressure Mechanics

### Respect Meter (Replaces "Heat")

**Concept**: In this underground training casino, you're building RESPECT by performing well. Higher respect means mobsters will test you more to see if you're really that good.

**Respect Levels:**

- **0-25% (Rookie)**: They're ignoring you, you're beneath notice
- **26-50% (Getting Noticed)**: Mobsters start paying attention
- **51-75% (Impressive)**: You're catching eyes, challenges more frequent
- **76-100% (Made Your Bones)**: The boss wants to see if you're for real

**Respect Increases When:**

- Win 5+ hands in a row: +10% respect
- Make perfect count-based bets: +5% respect per hand
- Nail a mobster's count quiz: +15% respect
- Get the Boss's test correct: +25% respect
- Perfect basic strategy streak: +2% respect per hand

**Respect Decreases When:**

- Lose hands consistently: -2% per loss
- Fail a count challenge: -10% respect
- Give up on a quiz: -20% respect (coward)
- Make obvious counting mistakes: -5% respect

**Effects of High Respect:**

- 50%+ respect: Mobsters start testing you more (2x challenge rate)
- 75%+ respect: The Boss might make an appearance
- 85%+ respect: Veteran counters offer mentorship opportunities
- 95%+ respect: Unlocks "VIP Table" access (higher stakes, better rewards)

**Why This Makes Sense:**

- In a training casino, you WANT to be tested
- High respect = you're proving yourself
- Challenges are opportunities to earn rewards
- It's not about hiding—it's about showing you've got skills

### Countdown Pressure

**Timed Decision Making** (Optional Setting):

- **Normal Mode**: 30 seconds to make decision
- **Pressure Mode**: 15 seconds to make decision
- **Casino Sim Mode**: 8 seconds to make decision

**Penalties for Timeout:**

- **First timeout**: Warning message
- **Second timeout**: -50 chips
- **Third timeout**: Automatic stand + -100 chips
- **Fourth timeout**: Kicked from table

## Configuration Settings

### Distraction Intensity

**Difficulty Levels:**

1. **Practice Mode (Minimal Distractions)**

   - Sound effects: 25% volume
   - Visual distractions: 5% frequency
   - No pit boss challenges
   - No heat meter
   - No countdown pressure
   - Perfect for learning

2. **Casual Mode (Moderate Distractions)**

   - Sound effects: 50% volume
   - Visual distractions: 10% frequency
   - Mobster challenges: 1% chance
   - Respect meter: Yes, slow buildup
   - Countdown: 30 seconds
   - Balanced experience

3. **Underground Mode (High Distractions)**

   - Sound effects: 75% volume
   - Visual distractions: 15% frequency
   - Mobster challenges: 3% chance
   - Boss appearances enabled
   - Respect meter: Yes, normal buildup
   - Countdown: 15 seconds
   - Authentic underground casino experience

4. **Made Man Mode (Maximum Pressure)**
   - Sound effects: 100% volume (variable, sudden spikes)
   - Visual distractions: 20% frequency
   - Mobster challenges: 5% chance
   - Boss tests: 2% chance
   - Respect meter: Yes, fast buildup
   - Countdown: 8 seconds
   - Multiple simultaneous challenges possible
   - For expert counters only

### Customizable Options

Users can toggle individual distraction types:

- ✅ Background casino sounds
- ✅ Slot machine noises
- ✅ Crowd chatter
- ✅ Visual distractions (waitress, players)
- ✅ Mobster challenges
- ✅ Boss appearances
- ✅ Respect meter
- ✅ Countdown timer
- ✅ Drunk wannabe counter events
- ✅ Veteran mentor appearances
- ✅ Phone notifications
- ✅ Smoke effects

## Achievements & Rewards

### Underground Casino Achievements

1. **"Rookie to Pro"**: Build respect from 0% to 100% in single session

   - Reward: 2000 bonus points

2. **"Made Man"**: Ace The Boss's Test 5 times

   - Reward: "Fedora" avatar accessory + permanent 5% chip bonus

3. **"Unshakeable"**: Maintain perfect count through 10 high distraction events

   - Reward: 2000 bonus points + "Noise-Canceling Headphones" cosmetic

4. **"Respect Earned"**: Complete 100 hands in Made Man Mode

   - Reward: 5000 bonus points + "Legend" badge + access to "High Roller Room"

5. **"Quick Draw"**: Make 50 correct decisions in under 5 seconds each

   - Reward: 1000 bonus points + "Speedster" title

6. **"Mobster Approved"**: Successfully answer 10 mobster count quizzes correctly

   - Reward: 3000 bonus points + "Made Man" title + reduced challenge frequency

7. **"Student of the Game"**: Accept mentorship from Veteran 5 times

   - Reward: 1500 bonus points + permanent 10% XP boost

8. **"Street Smart"**: Trick the drunk player 10 times with wrong counts
   - Reward: 500 bonus points + "Trickster" badge

## DynamoDB Schema

### Challenge Events

```
PK: USER#<userId>
SK: CHALLENGE#<timestamp>

Attributes:
- userId: string
- timestamp: string (ISO8601)
- sessionId: string
- challengeType: string ("PIT_BOSS", "SECURITY", "DRUNK_PLAYER", "CASINO_HOST")
- actualCount: number (running count at challenge time)
- userResponse: string (what they answered)
- responseCorrect: boolean
- penaltyApplied: string (description of penalty)
- rewardGained: string (description of reward if any)
- responseTime: number (seconds taken to respond)
- heatLevel: number (percentage at time of challenge)
```

### Distraction Events

```
PK: USER#<userId>
SK: DISTRACTION#<timestamp>

Attributes:
- userId: string
- timestamp: string (ISO8601)
- sessionId: string
- distractionType: string ("JACKPOT", "SPILL", "PHONE", etc.)
- duration: number (seconds)
- impactOnAccuracy: boolean (did they lose count?)
- handNumber: number
```

### Heat Tracking

```
PK: SESSION#<sessionId>
SK: HEAT#<handNumber>

Attributes:
- sessionId: string
- handNumber: number
- heatLevel: number (0-100 percentage)
- factors: array of heat-affecting actions
- timestamp: string (ISO8601)
```

## GraphQL Schema

### Types

```graphql
type Challenge {
  id: ID!
  type: ChallengeType!
  question: String!
  options: [ChallengeOption!]!
  timeLimit: Int!
  actualCount: Int!
  heatLevel: Float!
}

enum ChallengeType {
  PIT_BOSS
  SECURITY
  DRUNK_PLAYER
  CASINO_HOST
}

type ChallengeOption {
  id: String!
  text: String!
  outcome: ChallengeOutcome!
}

enum ChallengeOutcome {
  REWARD
  PENALTY
  NEUTRAL
  TRIGGERS_NEXT
}

type ChallengeResult {
  success: Boolean!
  chipChange: Int!
  pointChange: Int!
  multiplierReset: Boolean!
  heatChange: Float!
  message: String!
  sessionEnded: Boolean!
  nextChallenge: Challenge
}

type Distraction {
  type: DistractionType!
  duration: Int!
  intensity: Float!
  audioFile: String
  visualEffect: String
}

enum DistractionType {
  JACKPOT
  FIGHT
  DRUNK_PLAYER_YELL
  COCKTAIL_WAITRESS
  DEALER_CHANGE
  TRAY_DROP
  SPILL
  PHONE_RING
  PLAYER_COMMENT
  PHOTO_FLASH
  SMOKE
  NOTIFICATION
}

type HeatStatus {
  level: Float!
  status: HeatLevel!
  factors: [String!]!
  timeToCool: Int
  challengeRisk: Float!
}

enum HeatLevel {
  COOL
  WARM
  HOT
  BURNED
}
```

### Queries

```graphql
type Query {
  # Get current heat level
  getHeatStatus(sessionId: ID!): HeatStatus!

  # Get distraction settings
  getDistractionSettings: DistractionSettings!

  # Get pending challenge (if any)
  getPendingChallenge: Challenge
}

type DistractionSettings {
  mode: DistractionMode!
  soundVolume: Float!
  visualDistractionsEnabled: Boolean!
  pitBossChallengesEnabled: Boolean!
  heatMeterEnabled: Boolean!
  countdownEnabled: Boolean!
  countdownSeconds: Int!
}

enum DistractionMode {
  PRACTICE
  CASUAL
  REALISTIC
  HELL
}
```

### Mutations

```graphql
type Mutation {
  # Respond to challenge
  respondToChallenge(
    challengeId: ID!
    optionId: String!
    statedCount: Int
  ): ChallengeResult!

  # Update distraction settings
  updateDistractionSettings(
    settings: DistractionSettingsInput!
  ): DistractionSettings!

  # Manually cool down heat (take break)
  takeBreak(sessionId: ID!): HeatStatus!
}

input DistractionSettingsInput {
  mode: DistractionMode
  soundVolume: Float
  visualDistractionsEnabled: Boolean
  pitBossChallengesEnabled: Boolean
  heatMeterEnabled: Boolean
  countdownEnabled: Boolean
  countdownSeconds: Int
}
```

### Subscriptions

```graphql
type Subscription {
  # Subscribe to distraction events
  onDistractionEvent(sessionId: ID!): Distraction!

  # Subscribe to challenge events
  onChallengeTriggered(sessionId: ID!): Challenge!

  # Subscribe to heat changes
  onHeatChanged(sessionId: ID!): HeatStatus!
}
```

## Sound Asset Requirements

### Audio Files Needed

**Background Ambience** (Looping):

- `casino_ambience.mp3` (crowd chatter, general noise)
- `slot_machines.mp3` (spinning reels, beeps)
- `dealer_shuffle.mp3` (card shuffling)

**Event Sounds** (One-shot):

- `jackpot_celebration.mp3` (bells, sirens, cheering)
- `glass_break.mp3` (drink spill/drop)
- `phone_ring_1.mp3` through `phone_ring_5.mp3` (various ringtones)
- `camera_flash.mp3` (photo flash)
- `chair_scrape.mp3` (chair movement)
- `argument_voices.mp3` (heated argument)
- `drunk_yell.mp3` (drunk player shouting)

**Voice Lines** (Text-to-speech or recorded):

- Dealer: "Place your bets", "No more bets", "Blackjack", etc.
- Pit Boss: Challenge dialog
- Security: Challenge dialog
- Drunk Player: Various drunk comments
- Casino Host: Hospitality offers
- Cocktail Waitress: "Can I get you a drink?"

## Implementation Priority

### Phase 1: Basic Atmosphere

- Background casino sounds
- Dealer voice lines
- Simple visual distractions (waitress walk-by)
- Heat meter (display only, no challenges)

### Phase 2: Challenges

- Pit boss challenge system
- Drunk player challenge
- Heat-based difficulty scaling
- Challenge response mechanics

### Phase 3: Advanced Distractions

- All visual distraction types
- Sound event system (jackpots, spills, etc.)
- Security challenge
- Casino host distraction

### Phase 4: Hell Mode

- Multiple simultaneous distractions
- Rapid-fire challenges
- Extreme time pressure
- Advanced heat mechanics

## User Experience Notes

### Accessibility Options

- **Mute All Distractions**: Complete silence mode
- **Reduce Motion**: Disable visual animations
- **High Contrast**: Make cards/UI more visible during distractions
- **Screen Reader Support**: For challenge dialogs
- **Color Blind Mode**: Alternative visual indicators

### Player Feedback

- Clear indication when challenge is coming (subtle build-up)
- Visual/audio cues for heat level increasing
- Post-session summary of distractions faced
- Statistics on challenge success rate

### Balance Considerations

- Distractions should challenge, not frustrate
- Give players control over difficulty
- Reward skilled play under pressure
- Don't make penalties feel unfair
- Provide feedback on why they got challenged (too obvious pattern)
