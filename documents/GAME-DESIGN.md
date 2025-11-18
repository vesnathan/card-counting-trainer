# Card Counting Trainer - Game Design & Monetization

## Game Layout

### Table Configuration

- **Number of Seats**: 8 player positions
- **Table Style**: Classic casino blackjack layout with red felt background
- **Visual Elements**:
  - Dealer position at top center
  - Player positions arranged in arc around dealer
  - Individual betting circles for each position
  - Action buttons (HIT, STAND, DOUBLE, SPLIT, etc.) below player cards
  - Count display in top left
  - Statistics (streak, chips, score) in top bar
  - Settings and strategy reference on right side

### UI Components

#### Top Status Bar

- **Running Count**: Display current running count (e.g., "COUNT: -2")
- **Streak**: Current win/loss streak (e.g., "STREAK: 0")
- **Chip Balance**: Available chips (e.g., "CHIPS: 990")
- **Score/XP**: Player score/experience (e.g., "SCORE: -200")

#### Player Position

- **Betting Circle**: Green chip placement area
- **Player Cards**: Display dealt cards face-up
- **Card Total**: Show hand value
- **Bet Amount**: Display current wager

#### Dealer Position

- **Dealer Cards**: One face-up, one face-down initially
- **Game Status Messages**: "DEALER HITS ON 16", "DEALER STANDS ON 17", etc.
- **Blackjack Result**: "BLACKJACK PAYS 3 TO 2"

#### Action Buttons

- **HIT**: Request another card (green button)
- **STAND**: Keep current hand (green button)
- **DOUBLE**: Double bet and take one card (gray when unavailable)
- **SPLIT**: Split pairs into two hands (gray when unavailable)
- **TIP**: Dealer tip button (green)

#### Side Panel

- **Deck/Shoe Display**: Visual representation of remaining cards
- **Strategy Reference**: Quick access to basic strategy chart
- **Settings**: Game rule configuration

## Monetization Model

### Free Tier

- **Starting Chips**: 1,000 chips (free on account creation)
- **Use Case**: Practice and learning card counting
- **Limitations**:
  - Once chips run out, must purchase more
  - No chip regeneration over time
  - Cannot play without chips

### Chip Purchase

- **Price**: $10 USD
- **Amount**: 1,000 chips (base)
- **Payment**: One-time purchase (no subscription)
- **Unlimited Purchases**: Users can buy chips as many times as needed
- **Patreon Bonuses**: Supporters receive bonus chips on purchase (see PATREON-BENEFITS.md)
  - BRONZE: +10% (1,100 total chips)
  - SILVER: +25% (1,250 total chips)
  - GOLD: +50% (1,500 total chips)
  - PLATINUM: +100% (2,000 total chips)

### Patreon Support

- **See**: [PATREON-BENEFITS.md](PATREON-BENEFITS.md) for complete tier details
- **Early Adopter Program**: First 100 PLATINUM supporters who maintain tier for 12 months receive **lifetime unlimited chips**
- **Monthly Stipends**: SILVER+ supporters receive free chips monthly (500-3,000 depending on tier)

### Chip Economics

#### Minimum/Maximum Bets (Configurable)

Based on casino standards, typical configurations:

- **Low Stakes Table**: $5 - $100 per hand
- **Medium Stakes Table**: $10 - $500 per hand
- **High Stakes Table**: $25 - $2,500 per hand
- **VIP Table**: $100 - $10,000 per hand

For the trainer, default to medium stakes:

- **Default Min Bet**: 10 chips
- **Default Max Bet**: 500 chips
- **Initial Bankroll**: 1,000 chips (100 minimum bets)

#### Expected Play Duration

With 1,000 chips and $10 average bet:

- ~100 hands at break-even
- ~50-150 hands with typical variance
- Chip purchase provides 1-3 hours of gameplay

### Payment Integration

#### DynamoDB Schema - User Chips

```
PK: USER#<userId>
SK: METADATA

Attributes:
- chips: number (current chip balance)
- totalChipsPurchased: number (lifetime purchases)
- purchaseHistory: array of purchase records
```

#### Purchase History Record

```
PK: USER#<userId>
SK: PURCHASE#<timestamp>

Attributes:
- transactionId: string (Stripe/payment processor ID)
- amount: number (chips purchased)
- price: number (USD amount paid)
- timestamp: string (ISO8601)
- paymentMethod: string (card type)
```

#### GraphQL Schema - Chip Management

```graphql
type User {
  id: ID!
  email: String!
  username: String!
  chips: Int!
  totalChipsPurchased: Int!
  purchaseHistory: [ChipPurchase!]
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type ChipPurchase {
  transactionId: ID!
  amount: Int!
  price: Float!
  timestamp: AWSDateTime!
  paymentMethod: String
}

type Mutation {
  purchaseChips(paymentMethodId: String!): ChipPurchaseResult!
  updateChips(amount: Int!): User! # Internal use only
}

type ChipPurchaseResult {
  success: Boolean!
  user: User
  error: String
}
```

### Payment Flow

1. **User Initiates Purchase**

   - Click "Buy Chips" button
   - Opens payment modal

2. **Payment Processing**

   - Integrate with Stripe for payment processing
   - Lambda function handles webhook for successful payment
   - Securely process payment on backend (NEVER trust frontend)

3. **Chip Grant**

   - On successful payment, update DynamoDB
   - Add 1,000 chips to user's balance
   - Record purchase in history
   - Send confirmation email

4. **Error Handling**
   - Payment failed: Show error, don't grant chips
   - Duplicate transaction: Check transactionId to prevent double-grant
   - Refund: Deduct chips if possible, or flag account

### Anti-Fraud Measures

- **Server-Side Validation**: All chip transactions validated on backend
- **Transaction Logging**: Complete audit trail of all chip changes
- **No Client-Side Chip Updates**: Frontend can only display, not modify
- **Payment Verification**: Verify with Stripe before granting chips
- **Rate Limiting**: Prevent rapid purchase attempts
- **Account Monitoring**: Flag suspicious patterns (e.g., buying chips, losing immediately, refund request)

## Game Mechanics

### Card Counting Display

#### Running Count

- Display current running count prominently
- Update after each card is revealed
- Color coding:
  - Positive count (green): Favorable to player
  - Zero (white): Neutral
  - Negative count (red): Favorable to house

#### True Count

- Calculate and display true count
- Formula: Running Count ÷ Decks Remaining
- Update after each card based on penetration settings

#### Count Practice Mode

- **Practice Mode**: Show count automatically (for learning)
- **Test Mode**: Hide count, require user input
- **Challenge Mode**: Timed count tests with accuracy scoring

### Betting Strategy

#### Bet Sizing Based on True Count

- True Count ≤ 0: Minimum bet
- True Count = 1: 2x minimum bet
- True Count = 2: 4x minimum bet
- True Count = 3: 6x minimum bet
- True Count ≥ 4: 8x minimum bet (or max bet)

#### Betting Hints

- Optional feature: Suggest optimal bet based on count
- Educational mode: Explain why bet size is recommended
- Can be toggled on/off in settings

### Gameplay Flow

1. **Place Bet**

   - User clicks betting circle
   - Select chip denomination
   - Place bet (within min/max limits)
   - Confirm bet

2. **Deal Cards**

   - Two cards to each player position
   - Two cards to dealer (one face-up, one face-down)
   - Check for blackjack

3. **Player Actions**

   - Hit, stand, double down, split (if applicable)
   - Insurance offered if dealer shows Ace
   - Surrender option if enabled

4. **Dealer Plays**

   - Reveal hole card
   - Follow dealer rules (hit soft 17, etc.)
   - Resolve all hands

5. **Payout**

   - Update chip balance based on results
   - Update statistics (wins, losses, streak)
   - Shuffle if cut card reached

6. **New Hand**
   - Place next bet
   - Continue playing

### Statistics Tracking

#### Per-Session Stats

- Hands played
- Hands won/lost/pushed
- Blackjacks hit
- Net profit/loss
- Highest chip count
- Current streak
- Betting accuracy (vs optimal)
- Count accuracy (in test mode)

#### Lifetime Stats

- Total hands played
- Total chips won/lost
- Total chips purchased
- Average bet size
- Win rate by true count
- Best/worst sessions
- Counting accuracy over time

## Game Modes

### 1. Practice Mode (Default)

- **Purpose**: Learn card counting
- **Features**:
  - Running count displayed
  - True count displayed
  - Betting hints available
  - Strategy hints available
  - No time pressure
  - Detailed feedback

### 2. Test Mode

- **Purpose**: Test counting skills
- **Features**:
  - Count hidden (user must track mentally)
  - Prompt for user's count at end of shoe
  - Compare user count to actual count
  - Accuracy scoring
  - No hints available

### 3. Speed Challenge Mode

- **Purpose**: Improve counting speed
- **Features**:
  - Rapid card display
  - Configurable card speed (0.25s - 2s per card)
  - Timed rounds
  - Speed + accuracy scoring
  - Leaderboards

### 4. Casino Simulation Mode

- **Purpose**: Realistic casino practice
- **Features**:
  - Multiple AI players at table
  - Dealer chat/banter
  - Pit boss warnings (if betting spread too obvious)
  - Realistic distractions
  - Variable rules between sessions

## Multi-Player Features (Future)

### Table Sharing

- Multiple human players at same table
- Spectator mode
- Chat functionality
- Shared dealer

### Competitive Features

- Head-to-head challenges
- Tournament mode
- Leaderboards:
  - Most chips won
  - Best win streak
  - Highest accuracy
  - Fastest counting speed

### Social Features

- Friend lists
- Share sessions
- Compete on same shoe
- Challenge friends

## Technical Implementation Notes

### Real-Time Updates

- Use GraphQL subscriptions for multi-player games
- WebSocket connections for live game updates
- Optimistic UI updates for single-player

### Game State Management

- Store game state in DynamoDB
- Allow pause/resume functionality
- Session recovery if connection lost

### Random Number Generation

- Use cryptographically secure RNG for card dealing
- Seed-based shuffle for reproducible games
- Fair shuffle verification

### Mobile Responsiveness

- Touch-friendly betting interface
- Responsive table layout for small screens
- Portrait and landscape support
- Swipe gestures for hit/stand

## Monetization Analysis

### Revenue Projections

#### Conservative Estimate

- 1,000 active users
- Average 2 chip purchases per user per month
- $10 per purchase
- Monthly Revenue: $20,000

#### Optimistic Estimate

- 10,000 active users
- Average 3 chip purchases per user per month
- $10 per purchase
- Monthly Revenue: $300,000

### Cost Structure

- AWS hosting: ~$50-500/month (depends on scale)
- Stripe fees: 2.9% + $0.30 per transaction
- Domain/SSL: ~$20/year
- Development: One-time cost

### Break-Even Analysis

- Need ~100 chip purchases/month to break even at small scale
- At $10/purchase = $1,000 revenue
- After Stripe fees: ~$970
- Covers AWS + overhead

## Legal Considerations

### Important Disclaimers

- **Not Real Gambling**: Chips have no cash value
- **Educational Purpose**: Tool for learning, not winning
- **No Cash Prizes**: Cannot redeem chips for money
- **Age Restriction**: 18+ recommended (not gambling, but gambling education)

### Terms of Service Must Include

- Chips are virtual currency with no real-world value
- No refunds on chip purchases (standard digital goods policy)
- Account termination for fraudulent activity
- Chips cannot be transferred between accounts
- Service can be discontinued at any time

### GDPR/Privacy Compliance

- Secure payment processing (PCI-DSS via Stripe)
- Data encryption at rest and in transit
- User data deletion requests honored
- Clear privacy policy
- No selling of user data

## Future Monetization Options

### Alternative Revenue Streams

1. **Subscription Model** (Alternative to chip purchases)

   - Monthly subscription for unlimited chips
   - $9.99/month for unlimited play
   - Includes premium features

2. **Cosmetic Items**

   - Custom card backs/designs
   - Table themes
   - Avatar customization
   - $0.99 - $4.99 per item

3. **Premium Features**

   - Advanced statistics dashboard
   - Historical hand replay
   - Strategy analyzer
   - $4.99/month add-on

4. **Educational Content**

   - Video tutorials
   - Advanced strategy guides
   - One-on-one coaching sessions
   - $19.99 - $99.99

5. **Ad-Supported Free Tier** (Alternative Model)
   - Regenerate X chips per day for free
   - Watch ads to earn bonus chips
   - Remove ads with purchase/subscription

## Development Priorities

### Phase 1: MVP (Minimal Viable Product)

- Basic blackjack gameplay
- Single-player mode
- Chip purchase system
- Hi-Lo counting system only
- Simple statistics

### Phase 2: Enhanced Features

- Multiple counting systems
- Configurable game rules
- Test mode and challenges
- Improved statistics dashboard
- Mobile optimization

### Phase 3: Social Features

- Multi-player tables
- Leaderboards
- Friend system
- Tournament mode

### Phase 4: Monetization Expansion

- Subscription option
- Cosmetic items
- Premium analytics
- Educational content marketplace
