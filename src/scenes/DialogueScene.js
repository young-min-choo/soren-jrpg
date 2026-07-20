import Phaser from 'phaser';

/**
 * DialogueScene — overlay scene that runs on top of field scenes.
 * Renders an FFTA-style dialogue box at the bottom of the screen with:
 * - Portrait (left side, placeholder colored square for now)
 * - Speaker name
 * - Typewriter text effect
 * - Branching choices (when applicable)
 * - Z/Enter to advance, X/Esc to close
 *
 * Launched via: this.scene.launch('Dialogue', { ... dialogueData ... })
 * When done, emits 'dialogue-complete' event and stops itself.
 *
 * Dialogue data format:
 * {
 *   speaker: "Name",
 *   portrait: null,  // texture key, or null for placeholder
 *   pages: ["Page 1 text", "Page 2 text", ...],
 *   choices: [        // optional, only on last page
 *     { text: "Choice 1", value: "choice1" },
 *     { text: "Choice 2", value: "choice2" }
 *   ]
 * }
 */
export default class DialogueScene extends Phaser.Scene {
  constructor() {
    super('Dialogue');
  }

  create(data) {
    this.dialogueData = data;
    this.currentPage = 0;
    this.isTyping = false;
    this.typingTimer = null;
    this.choiceIndex = 0;
    this.showingChoices = false;

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // --- Dialogue box ---
    // Positioned at the bottom, takes up ~40% of the screen height
    const boxHeight = 90;
    const boxY = height - boxHeight;
    const padding = 8;

    // Background — semi-opaque dark blue (FFTA style)
    this.boxBg = this.add.graphics();
    this.boxBg.fillStyle(0x000040, 0.85);
    this.boxBg.fillRect(0, boxY, width, boxHeight);
    this.boxBg.lineStyle(1, 0xffffff, 0.5);
    this.boxBg.strokeRect(0.5, boxY + 0.5, width - 1, boxHeight - 1);

    // --- Portrait area (left side) ---
    const portraitSize = 48;
    const portraitX = padding;
    const portraitY = boxY + padding;

    if (this.dialogueData.portrait) {
      this.portrait = this.add.image(portraitX + portraitSize / 2, portraitY + portraitSize / 2, this.dialogueData.portrait);
      this.portrait.setOrigin(0.5);
    } else {
      // Placeholder portrait — colored square with a simple face
      this.portrait = this.add.graphics();
      this.portrait.fillStyle(0x4a4a8a, 1);
      this.portrait.fillRect(portraitX, portraitY, portraitSize, portraitSize);
      this.portrait.lineStyle(1, 0xffffff, 0.4);
      this.portrait.strokeRect(portraitX + 0.5, portraitY + 0.5, portraitSize - 1, portraitSize - 1);

      // Simple face dots (eyes + mouth)
      this.portrait.fillStyle(0xffffff, 1);
      this.portrait.fillRect(portraitX + 14, portraitY + 16, 4, 4); // left eye
      this.portrait.fillRect(portraitX + 30, portraitY + 16, 4, 4); // right eye
      this.portrait.fillRect(portraitX + 16, portraitY + 30, 16, 2); // mouth
    }

    // Portrait frame border
    const portraitFrame = this.add.graphics();
    portraitFrame.lineStyle(1, 0xffffff, 0.6);
    portraitFrame.strokeRect(portraitX + 0.5, portraitY + 0.5, portraitSize - 1, portraitSize - 1);

    // --- Speaker name ---
    const nameX = portraitX + portraitSize + padding;
    this.nameText = this.add.text(nameX, boxY + padding, this.dialogueData.speaker || '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
      color: '#ffff00',
      fontStyle: 'bold'
    });

    // --- Dialogue text (typewriter) ---
    const textX = nameX;
    const textY = boxY + padding + 14;
    const textWidth = width - textX - padding;

    this.dialogueText = this.add.text(textX, textY, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
      color: '#ffffff',
      wordWrap: { width: textWidth },
      maxLines: 4,
      lineSpacing: 2
    });

    // --- Continue indicator (blinking ▼) ---
    this.continueIndicator = this.add.text(width - 16, boxY + boxHeight - 14, '▼', {
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
      color: '#ffffff'
    });
    this.continueIndicator.setOrigin(0.5);
    this.continueIndicator.setVisible(false);

    this.tweens.add({
      targets: this.continueIndicator,
      alpha: 0,
      duration: 300,
      yoyo: true,
      repeat: -1
    });

    // --- Choice area (rendered below text when choices exist) ---
    this.choiceTexts = [];

    // --- Input ---
    this.handleKeyDown = (e) => {
      switch (e.key) {
        case 'z': case 'Z': case 'Enter':
          this.handleConfirm();
          e.preventDefault();
          break;
        case 'x': case 'X': case 'Escape':
          this.close();
          e.preventDefault();
          break;
        case 'ArrowUp': case 'w': case 'W':
          if (this.showingChoices) {
            this.choiceIndex = Math.max(0, this.choiceIndex - 1);
            this.updateChoiceHighlight();
            e.preventDefault();
          }
          break;
        case 'ArrowDown': case 's': case 'S':
          if (this.showingChoices) {
            this.choiceIndex = Math.min(this.dialogueData.choices.length - 1, this.choiceIndex + 1);
            this.updateChoiceHighlight();
            e.preventDefault();
          }
          break;
      }
    };

    window.addEventListener('keydown', this.handleKeyDown);

    this.events.on('shutdown', () => {
      window.removeEventListener('keydown', this.handleKeyDown);
      if (this.typingTimer) this.typingTimer.remove();
    });

    // Start typing first page
    this.startTyping();
  }

  startTyping() {
    const page = this.dialogueData.pages[this.currentPage];
    if (!page) {
      this.close();
      return;
    }

    this.dialogueText.setText('');
    this.isTyping = true;
    this.continueIndicator.setVisible(false);
    let charIndex = 0;

    this.typingTimer = this.time.addEvent({
      delay: 30, // ms per character
      callback: () => {
        charIndex++;
        this.dialogueText.setText(page.substring(0, charIndex));
        if (charIndex >= page.length) {
          this.typingTimer.remove();
          this.isTyping = false;
          this.onPageComplete();
        }
      },
      loop: true
    });
  }

  onPageComplete() {
    // If this is the last page and there are choices, show them
    const isLastPage = this.currentPage === this.dialogueData.pages.length - 1;
    if (isLastPage && this.dialogueData.choices && this.dialogueData.choices.length > 0) {
      this.showChoices();
    } else {
      this.continueIndicator.setVisible(true);
    }
  }

  showChoices() {
    this.showingChoices = true;
    this.choiceIndex = 0;

    const textY = this.dialogueText.y + this.dialogueText.height + 4;
    const textX = this.dialogueText.x;

    this.dialogueData.choices.forEach((choice, i) => {
      const prefix = i === 0 ? '> ' : '  ';
      const choiceText = this.add.text(textX, textY + i * 14, prefix + choice.text, {
        fontFamily: '"Courier New", monospace',
        fontSize: '10px',
        color: '#ffffff'
      });
      this.choiceTexts.push(choiceText);
    });
  }

  updateChoiceHighlight() {
    this.choiceTexts.forEach((text, i) => {
      text.setText((i === this.choiceIndex ? '> ' : '  ') + this.dialogueData.choices[i].text);
    });
  }

  handleConfirm() {
    if (this.isTyping) {
      // Skip typewriter — show full text immediately
      this.typingTimer.remove();
      this.dialogueText.setText(this.dialogueData.pages[this.currentPage]);
      this.isTyping = false;
      this.onPageComplete();
      return;
    }

    if (this.showingChoices) {
      // Select choice
      const selected = this.dialogueData.choices[this.choiceIndex];
      this.close(selected.value);
      return;
    }

    // Advance to next page
    this.currentPage++;
    if (this.currentPage >= this.dialogueData.pages.length) {
      this.close();
    } else {
      this.startTyping();
    }
  }

  close(choiceValue) {
    // Emit result to parent scene
    if (this.dialogueData.onComplete) {
      this.dialogueData.onComplete(choiceValue);
    }
    this.events.emit('dialogue-complete', choiceValue);
    this.scene.stop('Dialogue');
  }
}