# AI Player Audio System Implementation

## Overview

Comprehensive audio system for AI player characters with priority-based queuing and automatic speech bubble synchronization.

## Architecture

### 1. Audio Generation

- **208 audio files** generated via ElevenLabs API for 8 AI characters
- **File Organization**: `/audio/players/{character-id}/{type}_{variant}.mp3`

**Breakdown by type:**

- 7 distraction files per character (56 total)
- 4 personality reactions per character (32 total): bust, hit21, goodHit, badStart
- 5 win reactions per character (40 total)
- 5 loss reactions per character (40 total)
- 5 dealer blackjack reactions per character (40 total)

### 2. Audio Queue System (`useAudioQueue.ts`)

**Priority Levels:**

- `IMMEDIATE (3)` - Bust, blackjack (interrupt everything)
- `HIGH (2)` - Dealer blackjack, important events
- `NORMAL (1)` - Win/loss reactions, conversations
- `LOW (0)` - Distractions, casual comments

**Features:**

- Only one audio plays at a time
- Higher priority audio interrupts lower priority
- Interrupted HIGH/IMMEDIATE audio re-queues
- 300ms gap between audio clips
- Automatic error handling with fallback

**Usage:**

```typescript
const { queueAudio, isPlaying, currentItem } = useAudioQueue();

queueAudio({
  id: "unique-id",
  audioPath: "/audio/players/drunk-danny/bust_01.mp3",
  priority: AudioPriority.IMMEDIATE,
  playerId: "drunk-danny",
  message: "*hiccup* BUSTED! Fuck!",
  position: { left: "50%", top: "50%" },
  onComplete: () => console.log("Audio finished"),
});
```

### 3. Audio Path Helpers (`audioHelpers.ts`)

**Functions:**

- `getPlayerAudioPath(characterId, reactionType, variant?)` - Get path to AI player audio
- `getDealerAudioPath(dealerId, voiceLine)` - Get path to dealer audio
- `mapOutcomeToAudioType(outcomeType, context)` - Map reaction outcomes to audio types
- `getRandomDistractionAudio(characterId)` - Random distraction for character

**Example:**

```typescript
// Get bust reaction audio
const audioPath = getPlayerAudioPath("drunk-danny", "bust");
// Returns: "/audio/players/drunk-danny/bust_01.mp3"

// Get random win reaction (variant 1-5)
const winPath = getPlayerAudioPath("nervous-nancy", "win");
// Returns: "/audio/players/nervous-nancy/win_03.mp3" (random)

// Get random distraction (variant 1-7)
const distractionPath = getPlayerAudioPath("chatty-carlos", "distraction");
// Returns: "/audio/players/chatty-carlos/distraction_05.mp3" (random)
```

### 4. Integration Points (To Be Implemented)

#### A. Modify `useGameInteractions.ts`

Add audio queue integration to `addSpeechBubble`:

```typescript
const addSpeechBubble = useCallback(
  (
    playerId: string,
    message: string,
    position: number,
    reactionType?: string,
    priority: AudioPriority = AudioPriority.NORMAL,
  ) => {
    // Existing speech bubble logic...

    // NEW: Queue audio if reaction type provided
    if (reactionType) {
      const audioPath = getPlayerAudioPath(playerId, reactionType);
      queueAudio({
        id: `${playerId}-${Date.now()}`,
        audioPath,
        priority,
        playerId,
        message,
        position: bubblePosition,
      });
    }
  },
  [setSpeechBubbles, queueAudio],
);
```

#### B. Update Reaction Callers

Modify all calls to `addSpeechBubble` to include reaction type and priority:

**Bust reactions (IMMEDIATE priority):**

```typescript
// In useAITurnsPhase.ts or wherever bust happens
addSpeechBubble(
  ai.character.id,
  bustMessage,
  ai.position,
  "bust",
  AudioPriority.IMMEDIATE,
);
```

**Win/Loss reactions (NORMAL priority):**

```typescript
// In endOfHandReactions
addSpeechBubble(
  ai.character.id,
  reactionMessage,
  ai.position,
  "win",
  AudioPriority.NORMAL,
);
```

**Dealer blackjack (HIGH priority):**

```typescript
// When dealer reveals blackjack
addSpeechBubble(
  ai.character.id,
  dealerBJMessage,
  ai.position,
  "dealer_blackjack",
  AudioPriority.HIGH,
);
```

**Distractions (LOW priority):**

```typescript
// Random AI banter
addSpeechBubble(
  ai.character.id,
  distraction,
  ai.position,
  "distraction",
  AudioPriority.LOW,
);
```

#### C. Update Main Component (`page.tsx`)

Add audio queue hook:

```typescript
const audioQueue = useAudioQueue();

// Pass to useGameInteractions
const { addSpeechBubble, showInitialReactions, showEndOfHandReactions } =
  useGameInteractions({
    // ... existing params
    audioQueue,
  });
```

## Audio File Mapping

### AI Character Voice IDs

| Character           | Voice ID                                   |
| ------------------- | ------------------------------------------ |
| Drunk Danny         | `Vr1ZyHpAtTpW6DEVZwwI`                     |
| Clumsy Claire       | `ef1T91Fo2YqVYGug3C2p`                     |
| Chatty Carlos       | `MnqYh9UZerXWcrKflGOg`                     |
| Superstitious Susan | `8t6aWwL1WUiIpGgYJKnOYrXLriTqHsJZvuBMRrvc` |
| Cocky Kyle          | `XiPuSi02djl3mdNjSaio`                     |
| Nervous Nancy       | `lo7AgX1athQfnbY9sVMj`                     |
| Lucky Larry         | `xefN48Dq40rKHHpNo8gn`                     |
| Unlucky Ursula      | `ADk3UhQjkXzfOux4ovHq`                     |

### Audio File Structure

```
/audio/
  /background/
    background.mp3
  /dealers/
    /maria-counter/
      place_bets_01.mp3
      dealer_has_17_01.mp3
      ...
    /rookie-jenny/
      ...
  /players/
    /drunk-danny/
      distraction_01.mp3 through distraction_07.mp3
      bust_01.mp3
      hit21_01.mp3
      goodHit_01.mp3
      badStart_01.mp3
      win_01.mp3 through win_05.mp3
      loss_01.mp3 through loss_05.mp3
      dealer_blackjack_01.mp3 through dealer_blackjack_05.mp3
    /clumsy-claire/
      ... (same structure)
    ... (6 more characters)
  /scripts/
    manifest.json (dealers)
    ai-players-manifest.json (players)
    run-batch.sh (dealer generation)
    run-player-batch.sh (player generation)
    generate-player-manifest.py
```

## Generation Scripts

### Generate AI Player Manifest

```bash
cd packages/card-counting-trainer/frontend/src/audio/scripts
python3 generate-player-manifest.py
```

### Generate Audio Files

```bash
cd packages/card-counting-trainer/frontend/src/audio/scripts
export ELEVEN_API_KEY="your_api_key_here"

# Generate dealer audio
./run-batch.sh

# Generate AI player audio
./run-player-batch.sh
```

## Testing

### Test Audio Queue

```typescript
// In dev tools console
const testQueue = () => {
  const { queueAudio } = useAudioQueue();

  // Queue low priority
  queueAudio({
    id: "test-1",
    audioPath: "/audio/players/drunk-danny/distraction_01.mp3",
    priority: AudioPriority.LOW,
    playerId: "drunk-danny",
    message: "Test message",
  });

  // Queue immediate (should interrupt)
  setTimeout(() => {
    queueAudio({
      id: "test-2",
      audioPath: "/audio/players/drunk-danny/bust_01.mp3",
      priority: AudioPriority.IMMEDIATE,
      playerId: "drunk-danny",
      message: "BUST!",
    });
  }, 1000);
};
```

### Test Audio Files

```bash
# Check if all files were generated
cd packages/card-counting-trainer/frontend/src/audio/players
find . -name "*.mp3" | wc -l
# Should output: 208

# List files for one character
ls -lh drunk-danny/
```

## Next Steps

1. ✅ Generate AI player audio manifest (208 files)
2. ✅ Create directory structure for player audio
3. ✅ Run batch audio generation (in progress)
4. ✅ Implement audio queue system with priority
5. 🔄 **IN PROGRESS**: Integrate audio with speech bubbles
   - Modify `useGameInteractions.ts` to accept audio queue
   - Update `addSpeechBubble` to queue audio
   - Update all reaction callers with reaction types and priorities
6. **TODO**: Test audio playback with speech bubbles
7. **TODO**: Add audio volume controls
8. **TODO**: Add audio mute/unmute toggle

## Future Enhancements

- **Conversation Audio**: Generate audio for AI-to-AI conversation turns (939 dialogue lines)
- **Player Blackjack Reactions**: Add special reactions when player gets blackjack
- **Background Music**: Integrate casino background ambiance
- **Audio Ducking**: Lower background music when characters speak
- **Accessibility**: Add captions toggle for all audio
