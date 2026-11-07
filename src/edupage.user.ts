// ==UserScript==
// @name         New Userscript (Part 1)
// @namespace    http://tampermonkey.net
// @version      2026-11-07
// @match        https://*/*
// @grant        none
// ==/UserScript==

function waitForAllElements<T extends HTMLElement = HTMLElement>(
  selector: string,
  minCount: number = 1,
  timeout?: number
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    let timer: number | undefined;
    const checkElements = (observerToDisconnect?: MutationObserver) => {
      const elements = Array.from(document.querySelectorAll<T>(selector));
      if (elements.length >= minCount) {
        if (observerToDisconnect) observerToDisconnect.disconnect();
        if (timer) clearTimeout(timer);
        resolve(elements);
        return true;
      }
      return false;
    };
    if (checkElements()) return;
    const observer = new MutationObserver((_, obs) => { checkElements(obs); });
    observer.observe(document.body, { childList: true, subtree: true });
    if (timeout) {
      timer = window.setTimeout(() => {
        observer.disconnect();
        const currentElements = Array.from(document.querySelectorAll<T>(selector));
        reject(new Error(`Timeout. Found ${currentElements.length}/${minCount} items.`));
      }, timeout);
    }
  });
}

function copyElement(originalButton: HTMLButtonElement): HTMLButtonElement | null {
  if (!originalButton) return null;
  const clonedButton = originalButton.cloneNode(true) as HTMLButtonElement;
  clonedButton.id = 'new-button';
  originalButton.parentElement?.insertBefore(clonedButton, originalButton);
  return clonedButton;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i]!, shuffled[j]!] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

// ==UserScript==
// @name         New Userscript (Part 2)
// ==/UserScript==

function createOverlay(textList: string[]): void {
  const overlay: HTMLDivElement = document.createElement('div');
  overlay.style.position = 'fixed';

  const updateOverlaySize = () => {
    const vv = window.visualViewport;
    if (vv) {
      overlay.style.width = `${vv.width}px`;
      overlay.style.height = `${vv.height}px`;
      overlay.style.top = `${vv.offsetTop}px`;
      overlay.style.left = `${vv.offsetLeft}px`;
    } else {
      overlay.style.width = '100%'; overlay.style.height = '100%';
      overlay.style.top = '0'; overlay.style.left = '0';
    }
  };
  updateOverlaySize();

  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
  overlay.style.zIndex = '2147483647';
  overlay.style.display = 'flex'; overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'stretch'; overlay.style.justifyContent = 'flex-start';
  overlay.style.boxSizing = 'border-box'; overlay.style.overflowY = 'auto';
  overlay.style.padding = '12px'; overlay.style.fontFamily = 'Arial, sans-serif';
  overlay.style.userSelect = 'none';

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateOverlaySize);
    window.visualViewport.addEventListener('scroll', updateOverlaySize);
  }

  const buttonsContainer: HTMLDivElement = document.createElement('div');
  buttonsContainer.style.display = 'flex'; buttonsContainer.style.flexDirection = 'column';
  buttonsContainer.style.gap = '8px'; buttonsContainer.style.width = '100%';
  overlay.appendChild(buttonsContainer);

  const closeBtn: HTMLButtonElement = document.createElement('button');
  closeBtn.innerText = '✕ Close Roll Call';
  closeBtn.style.padding = '14px'; closeBtn.style.fontSize = '16px'; closeBtn.style.fontWeight = 'bold';
  closeBtn.style.cursor = 'pointer'; closeBtn.style.border = 'none'; closeBtn.style.borderRadius = '6px';
  closeBtn.style.backgroundColor = '#ff4d4d'; closeBtn.style.color = 'white'; closeBtn.style.marginTop = '16px';

  closeBtn.onclick = (): void => {
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', updateOverlaySize);
      window.visualViewport.removeEventListener('scroll', updateOverlaySize);
    }
    overlay.remove();
  };

  const rowsData: Array<{ rowElement: HTMLDivElement; clicks: number; alerts: number }> = [];
  const reorderButtons = (): void => {
    rowsData.sort((a, b) => a.clicks - b.clicks);
    rowsData.forEach(item => buttonsContainer.appendChild(item.rowElement));
    buttonsContainer.appendChild(closeBtn);
  };

  const totalItems = textList.length;
  const verticalPadding = totalItems > 20 ? '10px' : '14px';
  const fontSize = totalItems > 20 ? '15px' : '17px';

  // Standardized Pointer API implementation to preempt text selection natively
  const addLongPressListener = (element: HTMLElement, onTap: () => void, onLongPress: () => void) => {
    let pressTimer: number | undefined;
    let isLongPress = false;

    const start = (e: PointerEvent) => {
      // Absorb the event context entirely to prevent system selection initialization
      if (e.cancelable) e.preventDefault();
      element.setPointerCapture(e.pointerId);

      isLongPress = false;
      pressTimer = window.setTimeout(() => {
        isLongPress = true;
        if (navigator.vibrate) navigator.vibrate(40);
        onLongPress();
      }, 500);
    };

    const cancel = (e: PointerEvent) => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = undefined;
      }
      try {
        element.releasePointerCapture(e.pointerId);
      } catch (err) { }
    };

    const end = (e: PointerEvent) => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = undefined;
      }
      try {
        element.releasePointerCapture(e.pointerId);
      } catch (err) { }

      if (!isLongPress) {
        onTap();
      }
      isLongPress = false;
    };

    // Touch-action none instructs mobile browsers not to intercept gestures for scrolling/magnification inside target buttons
    element.style.touchAction = 'none';

    element.addEventListener('pointerdown', start);
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', cancel);
    element.addEventListener('contextmenu', (e) => e.preventDefault());
  };

  textList.forEach((text: string): void => {
    const rowWrapper = document.createElement('div');
    rowWrapper.style.display = 'flex'; rowWrapper.style.width = '100%'; rowWrapper.style.gap = '6px';

    const nameBtn = document.createElement('button');
    nameBtn.innerText = `${text} (0)`;
    nameBtn.style.padding = `${verticalPadding} 14px`; nameBtn.style.fontSize = fontSize;
    nameBtn.style.cursor = 'pointer'; nameBtn.style.border = 'none'; nameBtn.style.borderRadius = '6px';
    nameBtn.style.backgroundColor = '#007bff'; nameBtn.style.color = 'white'; nameBtn.style.textAlign = 'left';
    nameBtn.style.flex = '1';
    nameBtn.style.userSelect = 'none';

    const alertBtn = document.createElement('button');
    alertBtn.innerText = '⚠️ 0';
    alertBtn.style.padding = `${verticalPadding} 12px`; alertBtn.style.fontSize = fontSize;
    alertBtn.style.fontWeight = 'bold'; alertBtn.style.cursor = 'pointer'; alertBtn.style.border = 'none';
    alertBtn.style.borderRadius = '6px'; alertBtn.style.backgroundColor = '#dc3545'; alertBtn.style.color = 'white';
    alertBtn.style.minWidth = '75px';
    alertBtn.style.userSelect = 'none';

    const rowState = { rowElement: rowWrapper, clicks: 0, alerts: 0 };
    rowsData.push(rowState);

    addLongPressListener(nameBtn,
      () => { rowState.clicks++; nameBtn.innerText = `${text} (${rowState.clicks})`; reorderButtons(); },
      () => { if (rowState.clicks > 0) { rowState.clicks--; nameBtn.innerText = `${text} (${rowState.clicks})`; reorderButtons(); } }
    );

    addLongPressListener(alertBtn,
      () => { rowState.alerts++; alertBtn.innerText = `⚠️ ${rowState.alerts}`; },
      () => { if (rowState.alerts > 0) { rowState.alerts--; alertBtn.innerText = `⚠️ ${rowState.alerts}`; } }
    );

    rowWrapper.appendChild(nameBtn);
    rowWrapper.appendChild(alertBtn);
  });

  reorderButtons();
  document.body.appendChild(overlay);
}

async function init() {
  const students = await waitForAllElements('.student .name');
  const names = shuffleArray(students.map(s => s.innerHTML));

  const closeButton = document.querySelector('[role=dialog]:has(.student .name) button[title=Close]');
  closeButton?.addEventListener('click', () => { init(); });

  setTimeout(() => {
    const saveButton = document.querySelector('[role=dialog]:has(.student .name) .asc-button-container:has(.button-green)') as HTMLButtonElement | null;
    if (!saveButton) return;

    const clonedBtnContainer = copyElement(saveButton);
    const newButton = clonedBtnContainer?.firstElementChild as HTMLElement | null;
    if (!newButton) return;

    newButton.classList.remove('button-green');
    newButton.classList.add('button-blue');
    newButton.innerHTML = 'Roll Call';
    newButton.addEventListener('click', () => { createOverlay(names); });
  }, 1000);
}

init();
