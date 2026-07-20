# Testing — How to Verify the Game

## Running the Game

```bash
# Start dev server
npx vite

# Open in browser (Vite prints the URL, usually http://localhost:5173)
```

## Manual Testing Checklist

### Per-Feature Verification
After implementing a feature, verify these points:

| Feature | What to check |
|---|---|
| Scene transition | Screen changes, no errors in console, correct scene loads |
| Player movement | 4-directional, sprint works, collision blocks solid tiles |
| NPC interaction | Walk up, press Z, dialogue appears, portrait shows |
| Dialogue | Text scrolls, choices work, correct branch taken |
| Combat start | Encounter triggers, battle scene loads, enemies + party displayed |
| Combat actions | Each action (Fight/Magic/Item/Defend/Flee) works as expected |
| Damage | Numbers are reasonable, formula applied correctly |
| Win/lose | Victory screen on win, game over on party wipe |
| Save/load | Save writes to localStorage, load restores exact state |
| Job change | Job switches in town, stats update, abilities available |
| Puzzle | Push blocks move, switches activate, progress gates work |

### Browser Console
- Open DevTools (F12) → Console tab
- **No errors or warnings** should appear during normal play
- If errors appear, fix before moving on

### Visual Check
- Pixel art is crisp (not blurry) — `image-rendering: pixelated` working
- Integer scaling (no fractional pixels)
- Sprites are correctly sized (16×24 field, 32×32 battle)
- No sprite flickering or z-order issues

## Automated Testing (Optional, for Later Phases)

### Playwright Setup
```bash
npm install -D playwright
npx playwright install chromium
```

### Test Script Pattern
```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');

  // Wait for game to load
  await page.waitForSelector('canvas');

  // Screenshot
  await page.screenshot({ path: 'test-screenshots/title.png' });

  // Press Enter to start
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-screenshots/after-start.png' });

  // Check game state via exposed global
  const gameState = await page.evaluate(() => window.gameState);
  console.log('Game state:', gameState);

  await browser.close();
})();
```

### What to Automate (Later Phases)
- Title screen renders
- New game → name entry → job choice → overworld flow
- Walking in 4 directions
- Entering a town
- Triggering a battle
- Winning a battle
- Saving and loading

## Performance Check
- Target: 60 FPS in desktop browser
- Check with DevTools → Performance tab
- If dropping frames, check for:
  - Too many active sprites
  - Unoptimized tilemap rendering
  - Memory leaks (event listeners not cleaned up on scene change)