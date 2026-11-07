// ==UserScript==
// @name         New Userscript (Part 1)
// @namespace    http://tampermonkey.net
// @version      2026-11-07
// @match        https://*/*
// @grant        none
// ==/UserScript==
function waitForAllElements(selector, minCount = 1, timeout) {
    return new Promise((resolve, reject) => {
        let timer;
        const checkElements = (observerToDisconnect) => {
            const elements = Array.from(document.querySelectorAll(selector));
            if (elements.length >= minCount) {
                if (observerToDisconnect)
                    observerToDisconnect.disconnect();
                if (timer)
                    clearTimeout(timer);
                resolve(elements);
                return true;
            }
            return false;
        };
        if (checkElements())
            return;
        const observer = new MutationObserver((_, obs) => { checkElements(obs); });
        observer.observe(document.body, { childList: true, subtree: true });
        if (timeout) {
            timer = window.setTimeout(() => {
                observer.disconnect();
                const currentElements = Array.from(document.querySelectorAll(selector));
                reject(new Error(`Timeout. Found ${currentElements.length}/${minCount} items.`));
            }, timeout);
        }
    });
}
function copyElement(originalButton) {
    if (!originalButton)
        return null;
    const clonedButton = originalButton.cloneNode(true);
    clonedButton.id = 'new-button';
    originalButton.parentElement?.insertBefore(clonedButton, originalButton);
    return clonedButton;
}
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
// ==UserScript==
// @name         New Userscript (Part 2)
// ==/UserScript==
function createOverlay(textList) {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    const updateOverlaySize = () => {
        const vv = window.visualViewport;
        if (vv) {
            overlay.style.width = `${vv.width}px`;
            overlay.style.height = `${vv.height}px`;
            overlay.style.top = `${vv.offsetTop}px`;
            overlay.style.left = `${vv.offsetLeft}px`;
        }
        else {
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.top = '0';
            overlay.style.left = '0';
        }
    };
    updateOverlaySize();
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    overlay.style.zIndex = '2147483647';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'stretch';
    overlay.style.justifyContent = 'flex-start';
    overlay.style.boxSizing = 'border-box';
    overlay.style.overflowY = 'auto';
    overlay.style.padding = '12px';
    overlay.style.fontFamily = 'Arial, sans-serif';
    // Prevent selection inside the entire layout
    overlay.style.webkitUserSelect = 'none';
    overlay.style.userSelect = 'none';
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateOverlaySize);
        window.visualViewport.addEventListener('scroll', updateOverlaySize);
    }
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.flexDirection = 'column';
    buttonsContainer.style.gap = '8px';
    buttonsContainer.style.width = '100%';
    overlay.appendChild(buttonsContainer);
    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕ Close Roll Call';
    closeBtn.style.padding = '14px';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '6px';
    closeBtn.style.backgroundColor = '#ff4d4d';
    closeBtn.style.color = 'white';
    closeBtn.style.marginTop = '16px';
    closeBtn.onclick = () => {
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', updateOverlaySize);
            window.visualViewport.removeEventListener('scroll', updateOverlaySize);
        }
        overlay.remove();
    };
    const rowsData = [];
    const reorderButtons = () => {
        rowsData.sort((a, b) => a.clicks - b.clicks);
        rowsData.forEach(item => buttonsContainer.appendChild(item.rowElement));
        buttonsContainer.appendChild(closeBtn);
    };
    const totalItems = textList.length;
    const verticalPadding = totalItems > 20 ? '10px' : '14px';
    const fontSize = totalItems > 20 ? '15px' : '17px';
    const addLongPressListener = (element, onTap, onLongPress) => {
        let pressTimer;
        let isLongPress = false;
        const start = () => {
            isLongPress = false;
            pressTimer = window.setTimeout(() => {
                isLongPress = true;
                if (navigator.vibrate)
                    navigator.vibrate(40);
                onLongPress();
            }, 500);
        };
        const cancel = () => { if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = undefined;
        } };
        const end = () => { cancel(); if (!isLongPress)
            onTap(); isLongPress = false; };
        element.addEventListener('mousedown', start);
        element.addEventListener('mouseup', end);
        element.addEventListener('mouseleave', cancel);
        element.addEventListener('touchstart', start, { passive: true });
        element.addEventListener('touchend', (e) => { end(); e.preventDefault(); });
        element.addEventListener('touchcancel', cancel);
        // Explicitly block system context menus while holding
        element.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    textList.forEach((text) => {
        const rowWrapper = document.createElement('div');
        rowWrapper.style.display = 'flex';
        rowWrapper.style.width = '100%';
        rowWrapper.style.gap = '6px';
        const nameBtn = document.createElement('button');
        nameBtn.innerText = `${text} (0)`;
        nameBtn.style.padding = `${verticalPadding} 14px`;
        nameBtn.style.fontSize = fontSize;
        nameBtn.style.cursor = 'pointer';
        nameBtn.style.border = 'none';
        nameBtn.style.borderRadius = '6px';
        nameBtn.style.backgroundColor = '#007bff';
        nameBtn.style.color = 'white';
        nameBtn.style.textAlign = 'left';
        nameBtn.style.flex = '1';
        // Disable text callouts and system text magnification tools
        nameBtn.style.webkitTouchCallout = 'none';
        nameBtn.style.webkitUserSelect = 'none';
        nameBtn.style.userSelect = 'none';
        const alertBtn = document.createElement('button');
        alertBtn.innerText = '⚠️ 0';
        alertBtn.style.padding = `${verticalPadding} 12px`;
        alertBtn.style.fontSize = fontSize;
        alertBtn.style.fontWeight = 'bold';
        alertBtn.style.cursor = 'pointer';
        alertBtn.style.border = 'none';
        alertBtn.style.borderRadius = '6px';
        alertBtn.style.backgroundColor = '#dc3545';
        alertBtn.style.color = 'white';
        alertBtn.style.minWidth = '75px';
        alertBtn.style.webkitTouchCallout = 'none';
        alertBtn.style.webkitUserSelect = 'none';
        alertBtn.style.userSelect = 'none';
        const rowState = { rowElement: rowWrapper, clicks: 0, alerts: 0 };
        rowsData.push(rowState);
        addLongPressListener(nameBtn, () => { rowState.clicks++; nameBtn.innerText = `${text} (${rowState.clicks})`; reorderButtons(); }, () => { if (rowState.clicks > 0) {
            rowState.clicks--;
            nameBtn.innerText = `${text} (${rowState.clicks})`;
            reorderButtons();
        } });
        addLongPressListener(alertBtn, () => { rowState.alerts++; alertBtn.innerText = `⚠️ ${rowState.alerts}`; }, () => { if (rowState.alerts > 0) {
            rowState.alerts--;
            alertBtn.innerText = `⚠️ ${rowState.alerts}`;
        } });
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
        const saveButton = document.querySelector('[role=dialog]:has(.student .name) .asc-button-container:has(.button-green)');
        if (!saveButton)
            return;
        const clonedBtnContainer = copyElement(saveButton);
        const newButton = clonedBtnContainer?.firstElementChild;
        if (!newButton)
            return;
        newButton.classList.remove('button-green');
        newButton.classList.add('button-blue');
        newButton.innerHTML = 'Roll Call';
        newButton.addEventListener('click', () => { createOverlay(names); });
    }, 1000);
}
init();
