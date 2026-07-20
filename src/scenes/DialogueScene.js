import Phaser from 'phaser';

/**
 * DialogueScene — overlay scene using DOM elements for crisp text.
 * Renders dialogue box, portrait, speaker name, typewriter text,
 * and branching choices as HTML positioned over the game canvas.
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
    this.domElements = [];

    const container = document.getElementById('game-container');
    if (!container) return;

    // --- Dialogue box (DOM) ---
    const box = document.createElement('div');
    box.style.cssText = `
      position: absolute;
      left: 2%; top: 58%;
      width: 96%; height: 38%;
      background: rgba(0, 0, 64, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.4);
      display: flex;
      flex-direction: row;
      padding: 8px;
      box-sizing: border-box;
      z-index: 20;
      pointer-events: none;
    `;
    container.appendChild(box);
    this.domElements.push(box);

    // --- Portrait (left side) ---
    const portrait = document.createElement('div');
    portrait.style.cssText = `
      width: 48px; height: 48px;
      min-width: 48px;
      background: #4a4a8a;
      border: 1px solid rgba(255,255,255,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 8px;
      font-size: 20px;
      color: #aaa;
    `;
    portrait.textContent = '?';
    box.appendChild(portrait);

    // --- Right side: name + text ---
    const rightSide = document.createElement('div');
    rightSide.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    box.appendChild(rightSide);

    // --- Speaker name ---
    this.nameDiv = document.createElement('div');
    this.nameDiv.style.cssText = `
      color: #ffff00;
      font-family: "Courier New", monospace;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 4px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    this.nameDiv.textContent = this.dialogueData.speaker || '';
    rightSide.appendChild(this.nameDiv);

    // --- Dialogue text ---
    this.textDiv = document.createElement('div');
    this.textDiv.style.cssText = `
      color: #ffffff;
      font-family: "Courier New", monospace;
      font-size: 13px;
      line-height: 1.5;
      flex: 1;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    rightSide.appendChild(this.textDiv);

    // --- Continue indicator ---
    this.indicatorDiv = document.createElement('div');
    this.indicatorDiv.style.cssText = `
      position: absolute;
      right: 12px; bottom: 8px;
      color: #ffffff;
      font-size: 14px;
      display: none;
    `;
    this.indicatorDiv.textContent = '▼';
    box.appendChild(this.indicatorDiv);

    this.blinkInterval = setInterval(() => {
      this.indicatorDiv.style.opacity = this.indicatorDiv.style.opacity === '0' ? '1' : '0';
    }, 300);

    // --- Choice container ---
    this.choiceContainer = document.createElement('div');
    this.choiceContainer.style.cssText = `
      position: absolute;
      left: 60px; bottom: 4px;
      display: none;
      flex-direction: column;
      gap: 2px;
    `;
    box.appendChild(this.choiceContainer);

    // --- Input (raw DOM) ---
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
      this.cleanup();
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

    this.textDiv.textContent = '';
    this.isTyping = true;
    this.indicatorDiv.style.display = 'none';
    let charIndex = 0;

    this.typingTimer = this.time.addEvent({
      delay: 30,
      callback: () => {
        charIndex++;
        this.textDiv.textContent = page.substring(0, charIndex);
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
    const isLastPage = this.currentPage === this.dialogueData.pages.length - 1;
    if (isLastPage && this.dialogueData.choices && this.dialogueData.choices.length > 0) {
      this.showChoices();
    } else {
      this.indicatorDiv.style.display = 'block';
    }
  }

  showChoices() {
    this.showingChoices = true;
    this.choiceIndex = 0;
    this.choiceContainer.innerHTML = '';
    this.choiceContainer.style.display = 'flex';

    this.dialogueData.choices.forEach((choice, i) => {
      const div = document.createElement('div');
      div.style.cssText = `
        color: #ffffff;
        font-family: "Courier New", monospace;
        font-size: 13px;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      `;
      div.textContent = (i === 0 ? '> ' : '  ') + choice.text;
      this.choiceContainer.appendChild(div);
    });
  }

  updateChoiceHighlight() {
    const children = this.choiceContainer.children;
    for (let i = 0; i < children.length; i++) {
      children[i].textContent = (i === this.choiceIndex ? '> ' : '  ') + this.dialogueData.choices[i].text;
    }
  }

  handleConfirm() {
    if (this.isTyping) {
      this.typingTimer.remove();
      this.textDiv.textContent = this.dialogueData.pages[this.currentPage];
      this.isTyping = false;
      this.onPageComplete();
      return;
    }

    if (this.showingChoices) {
      const selected = this.dialogueData.choices[this.choiceIndex];
      this.close(selected.value);
      return;
    }

    this.currentPage++;
    if (this.currentPage >= this.dialogueData.pages.length) {
      this.close();
    } else {
      this.startTyping();
    }
  }

  close(choiceValue) {
    if (this.dialogueData.onComplete) {
      this.dialogueData.onComplete(choiceValue);
    }
    this.events.emit('dialogue-complete', choiceValue);
    this.scene.stop('Dialogue');
  }

  cleanup() {
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.typingTimer) this.typingTimer.remove();
    if (this.blinkInterval) clearInterval(this.blinkInterval);
    this.domElements.forEach(el => el.remove());
    this.domElements = [];
  }

  shutdown() {
    this.cleanup();
  }
}