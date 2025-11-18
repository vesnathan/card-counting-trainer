# Card Counting Trainer - Patreon Supporter Tiers & Benefits

## Overview

Card Counting Trainer offers Patreon support tiers that provide various benefits to supporters. Early adopters at the highest tier (PLATINUM) receive **lifetime unlimited chips** and never need to purchase chips.

## Patreon Tiers

### NONE (Non-supporter)

**Price**: Free

**Benefits**:

- 1,000 starting chips (one-time)
- Access to all training modes
- Can purchase chips ($10 for 1,000 chips)

---

### BRONZE ($3/month)

**Price**: $3/month

**Benefits**:

- All NONE benefits, plus:
- **10% chip purchase bonus** - Get 1,100 chips instead of 1,000 when purchasing
- **Bronze badge** on profile and in multiplayer tables
- **Priority support** via Patreon DMs

**Chip Economics**:

- Effective price per chip: ~$0.0091 (vs $0.01 for non-supporters)

---

### SILVER ($5/month)

**Price**: $5/month

**Benefits**:

- All BRONZE benefits, plus:
- **25% chip purchase bonus** - Get 1,250 chips instead of 1,000 when purchasing
- **Monthly chip stipend**: 500 bonus chips every month (auto-granted)
- **Silver badge** on profile and in multiplayer tables
- **Early access** to new training modes and features
- **Custom avatar border** (silver frame)
- **Ad-free experience** (if ads are implemented)

**Chip Economics**:

- Monthly value: $5 subscription + 500 chips (~$5) = ~$10 value
- Effective price per chip: $0.008 (vs $0.01 for non-supporters)
- Break-even: If you'd buy 1,000+ chips per month, SILVER saves money

---

### GOLD ($10/month)

**Price**: $10/month

**Benefits**:

- All SILVER benefits, plus:
- **50% chip purchase bonus** - Get 1,500 chips instead of 1,000 when purchasing
- **Monthly chip stipend**: 1,500 bonus chips every month (auto-granted)
- **Gold badge** on profile and in multiplayer tables
- **Exclusive Discord role** and access to patron-only channels
- **Custom avatar border** (gold frame)
- **Vote on new features** - Help decide what gets built next
- **Personalized statistics dashboard** with advanced analytics
- **Priority placement** in multiplayer tables

**Chip Economics**:

- Monthly value: $10 subscription + 1,500 chips (~$15) = ~$25 value
- Effective price per chip: $0.0067 (vs $0.01 for non-supporters)
- Break-even: If you'd buy 2,000+ chips per month, GOLD is cheaper

---

### PLATINUM ($20/month)

**Price**: $20/month

**Benefits**:

- All GOLD benefits, plus:
- **100% chip purchase bonus** - Get 2,000 chips instead of 1,000 when purchasing
- **Monthly chip stipend**: 3,000 bonus chips every month (auto-granted)
- **Platinum badge** on profile and in multiplayer tables
- **Exclusive platinum-only multiplayer tables**
- **Custom table themes** - Choose your felt color, card backs, chip designs
- **Personal leaderboard tracking** with historical data
- **Behind-the-scenes development updates**
- **Exclusive video tutorials** on advanced card counting techniques
- **Your name in credits** (optional)

**Chip Economics**:

- Monthly value: $20 subscription + 3,000 chips (~$30) = ~$50 value
- Effective price per chip: $0.0067 (vs $0.01 for non-supporters)
- Break-even: If you'd buy 4,000+ chips per month, PLATINUM is cheaper

---

## Early Adopter Special: Lifetime Unlimited Chips

### Eligibility

- Must be a **PLATINUM tier supporter** ($20/month)
- Must join during the **first 3 months** after launch (or before hitting 1,000 total users)
- Must maintain continuous PLATINUM support for **12 months**

### Benefit

After 12 consecutive months of PLATINUM support:

- **Lifetime unlimited chips** - Never need to purchase chips again
- **Unlimited chip regeneration** - Chips automatically refill to 10,000 when below 1,000
- **"Founding Member" badge** - Exclusive badge showing you helped build the platform
- **Lifetime PLATINUM benefits** - Even if you downgrade/cancel subscription later

### How It Works

1. Join as PLATINUM supporter during early adopter period
2. Maintain PLATINUM tier for 12 consecutive months ($240 total)
3. On month 13, account is flagged as `earlyAdopter: true` in database
4. From that point forward:
   - Automatic chip refills when balance < 1,000
   - Maximum chip balance: 10,000 (no cap on earnings via gameplay)
   - Can still downgrade or cancel Patreon - chip benefits remain forever

### Value Calculation

- 12 months × $20 = $240 investment
- If you'd normally spend $30/month on chips = $360/year
- **Lifetime savings**: Unlimited (chips never run out)
- **Effective ROI**: Pays for itself in 8 months, then infinite value

---

## DynamoDB Schema Extensions

### User Record

```
PK: USER#<userId>
SK: METADATA

Attributes:
- id: string (userId from Cognito)
- email: string
- username: string
- chips: number (current balance)
- totalChipsPurchased: number (lifetime purchases)
- patreonTier: string (NONE, BRONZE, SILVER, GOLD, PLATINUM)
- patreonUserId: string (Patreon user ID)
- patreonLastSynced: string (ISO8601 timestamp)
- earlyAdopter: boolean (true if qualified for lifetime chips)
- earlyAdopterQualifiedAt: string (ISO8601 timestamp when they qualified)
- platinumSince: string (ISO8601 timestamp when first became PLATINUM)
- monthlyChipsGrantedAt: string (ISO8601 timestamp of last monthly stipend)
- createdAt: string (ISO8601)
- updatedAt: string (ISO8601)
```

### Patreon Sync Record

```
PK: USER#<userId>
SK: PATREON_SYNC#<timestamp>

Attributes:
- userId: string
- timestamp: string (ISO8601)
- previousTier: string
- newTier: string
- pledgeAmount: number (cents)
- patreonUserId: string
- syncSource: string (webhook, daily_sync, manual)
```

---

## GraphQL Schema Extensions

```graphql
type User {
  id: ID!
  email: String!
  username: String!
  chips: Int!
  totalChipsPurchased: Int!
  patreonInfo: PatreonInfo
  earlyAdopter: Boolean!
  earlyAdopterQualifiedAt: AWSDateTime
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type PatreonInfo {
  tier: PatreonTier!
  patreonUserId: String
  lastSynced: AWSDateTime
  platinumSince: AWSDateTime
  monthsAsPlatinum: Int
  monthlyStipendGrantedAt: AWSDateTime
}

enum PatreonTier {
  NONE
  BRONZE
  SILVER
  GOLD
  PLATINUM
}

type Mutation {
  # Called by Patreon webhook when pledge changes
  syncPatreonStatus(
    patreonUserId: String!
    tier: PatreonTier!
    pledgeAmountCents: Int!
  ): User!

  # Grant monthly chip stipend (called by scheduled Lambda)
  grantMonthlyChips: ChipGrantResult!

  # Purchase chips (applies tier bonus)
  purchaseChips(paymentMethodId: String!): ChipPurchaseResult!
}

type ChipGrantResult {
  success: Boolean!
  chipsGranted: Int!
  newBalance: Int!
  tier: PatreonTier!
}

type ChipPurchaseResult {
  success: Boolean!
  chipsPurchased: Int!
  bonusChips: Int!
  totalChipsReceived: Int!
  newBalance: Int!
  tier: PatreonTier!
}
```

---

## Backend Implementation

### Chip Purchase with Tier Bonus

```typescript
// When user purchases chips
const basePurchase = 1000;
let bonusChips = 0;

switch (user.patreonTier) {
  case "BRONZE":
    bonusChips = basePurchase * 0.1; // 10% = 100 chips
    break;
  case "SILVER":
    bonusChips = basePurchase * 0.25; // 25% = 250 chips
    break;
  case "GOLD":
    bonusChips = basePurchase * 0.5; // 50% = 500 chips
    break;
  case "PLATINUM":
    bonusChips = basePurchase * 1.0; // 100% = 1000 chips
    break;
}

const totalChips = basePurchase + bonusChips;
await grantChips(userId, totalChips);
```

### Monthly Chip Stipend (Scheduled Lambda)

```typescript
// Runs daily at 00:00 UTC
// Grants monthly stipend to eligible supporters

const monthlyStipends = {
  SILVER: 500,
  GOLD: 1500,
  PLATINUM: 3000,
};

for (const tier of ["SILVER", "GOLD", "PLATINUM"]) {
  const users = await getUsersByTier(tier);

  for (const user of users) {
    const lastGranted = user.monthlyChipsGrantedAt;
    const now = new Date();

    // Check if 30 days have passed since last grant
    if (!lastGranted || daysSince(lastGranted) >= 30) {
      await grantChips(user.id, monthlyStipends[tier]);
      await updateUser(user.id, {
        monthlyChipsGrantedAt: now.toISOString(),
      });

      console.log(
        `Granted ${monthlyStipends[tier]} chips to ${user.username} (${tier})`,
      );
    }
  }
}
```

### Early Adopter Chip Refill

```typescript
// Runs every time user loads the game
// Auto-refills chips for early adopters

if (user.earlyAdopter && user.chips < 1000) {
  const refillAmount = 10000 - user.chips;
  await grantChips(user.id, refillAmount);

  console.log(
    `Early Adopter refill: ${refillAmount} chips for ${user.username}`,
  );
}
```

### Early Adopter Qualification Check

```typescript
// Runs daily via scheduled Lambda
// Checks if PLATINUM users have completed 12 months

const platinumUsers = await getUsersByTier("PLATINUM");

for (const user of platinumUsers) {
  if (user.earlyAdopter) continue; // Already qualified

  const platinumSince = new Date(user.platinumSince);
  const now = new Date();
  const monthsAsPlatinum = monthDiff(platinumSince, now);

  if (monthsAsPlatinum >= 12) {
    await updateUser(user.id, {
      earlyAdopter: true,
      earlyAdopterQualifiedAt: now.toISOString(),
    });

    // Send congratulations email
    await sendEmail(user.email, "early-adopter-qualified", {
      username: user.username,
    });

    console.log(`User ${user.username} qualified as Early Adopter!`);
  }
}
```

---

## UI/UX

### Patreon Badge Display

- Show tier badge next to username in:
  - Profile page
  - Multiplayer tables (next to seat)
  - Leaderboards
  - Comment sections
- Badge colors:
  - BRONZE: #CD7F32 (bronze metallic)
  - SILVER: #C0C0C0 (silver metallic)
  - GOLD: #FFD700 (gold)
  - PLATINUM: #E5E4E2 (platinum with shimmer)
  - EARLY ADOPTER: #9B59B6 (purple with star icon)

### Chip Purchase Screen

- Show tier bonus clearly:
  - "Base: 1,000 chips"
  - "GOLD Bonus (+50%): 500 chips"
  - "**Total: 1,500 chips**"
  - "Price: $10.00"

### Monthly Stipend Notification

- Toast notification when monthly chips are granted:
  - "Your GOLD monthly stipend of 1,500 chips has been added!"
  - Auto-dismiss after 5 seconds

### Early Adopter Status

- Profile page shows:
  - "Founding Member" badge
  - "Unlimited Chips (Early Adopter Lifetime Benefit)"
  - "Member since: [date]"

---

## Marketing Copy

### Patreon Campaign Page

**Headline**: Support Card Counting Trainer & Get Exclusive Benefits!

**Subheadline**: Help us build the ultimate card counting training platform while unlocking powerful perks.

**PLATINUM Early Adopter Callout**:

> **🌟 Limited Time: Become a Founding Member**
>
> Join as a PLATINUM supporter in our first 3 months and unlock **lifetime unlimited chips** after 12 months of support. Never buy chips again!
>
> Only available to the first 100 PLATINUM supporters. **[X] spots remaining**.

---

## Anti-Fraud Measures

### Patreon Verification

- Verify Patreon webhook signatures
- Cross-check pledge amounts with Patreon API
- Log all tier changes with audit trail

### Early Adopter Protection

- Track exact date/time of PLATINUM tier changes
- Require **continuous** 12-month support (breaks reset counter)
- Manual review for edge cases (e.g., payment failures)

### Chip Refill Rate Limiting

- Early adopter refills limited to once per hour
- Prevents exploitation via rapid chip spending/refilling

---

## Migration Plan

### Phase 1: Schema Updates

- Add Patreon fields to User DynamoDB table
- Deploy GraphQL schema updates
- Create Patreon webhook Lambda

### Phase 2: Backend Logic

- Implement tier bonus calculation
- Create monthly stipend scheduler
- Build early adopter qualification checker

### Phase 3: Frontend UI

- Add Patreon connection flow
- Display tier badges
- Show chip bonuses on purchase screen
- Early adopter status display

### Phase 4: Launch

- Launch Patreon campaign
- Enable early adopter qualification
- Monitor first 100 PLATINUM supporters
