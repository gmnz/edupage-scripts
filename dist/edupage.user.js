// ==UserScript==
// @name         New Userscript (Part 1)
// @namespace    http://tampermonkey.net
// @version      2026-11-07
// @include        https://*.edupage.*/*
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
// Updated shuffler to preserve our structured student objects instead of plain strings
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
function createOverlay(studentList) {
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
    overlay.style.userSelect = 'none';
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateOverlaySize);
        window.visualViewport.addEventListener('scroll', updateOverlaySize);
    }
    let wakeLock = null;
    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
            }
        }
        catch (err) { }
    };
    const releaseWakeLock = async () => {
        if (wakeLock !== null) {
            try {
                await wakeLock.release();
                wakeLock = null;
            }
            catch (err) { }
        }
    };
    requestWakeLock();
    const handleVisibilityChange = () => {
        if (wakeLock !== null && document.visibilityState === 'visible')
            requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
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
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        releaseWakeLock();
        overlay.remove();
    };
    const rowsData = [];
    const reorderButtons = () => {
        const activePool = rowsData.filter(item => !item.isInitiallyAbsent || item.clicks > 0);
        const unclickedAbsentPool = rowsData.filter(item => item.isInitiallyAbsent && item.clicks === 0);
        activePool.sort((a, b) => {
            if (a.clicks !== b.clicks) {
                return a.clicks - b.clicks;
            }
            return a.lastClickedTime - b.lastClickedTime;
        });
        activePool.forEach(item => buttonsContainer.appendChild(item.rowElement));
        unclickedAbsentPool.forEach(item => buttonsContainer.appendChild(item.rowElement));
        buttonsContainer.appendChild(closeBtn);
    };
    const totalItems = studentList.length;
    const verticalPadding = totalItems > 20 ? '10px' : '14px';
    const fontSize = totalItems > 20 ? '15px' : '17px';
    const addLongPressListener = (element, onTap, onLongPress) => {
        let pressTimer;
        let isLongPress = false;
        const start = (e) => {
            if (e.cancelable)
                e.preventDefault();
            element.setPointerCapture(e.pointerId);
            isLongPress = false;
            pressTimer = window.setTimeout(() => {
                isLongPress = true;
                if (navigator.vibrate)
                    navigator.vibrate(40);
                onLongPress();
            }, 500);
        };
        const cancel = (e) => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = undefined;
            }
            try {
                element.releasePointerCapture(e.pointerId);
            }
            catch (err) { }
        };
        const end = (e) => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = undefined;
            }
            try {
                element.releasePointerCapture(e.pointerId);
            }
            catch (err) { }
            if (!isLongPress)
                onTap();
            isLongPress = false;
        };
        element.style.touchAction = 'none';
        element.addEventListener('pointerdown', start);
        element.addEventListener('pointerup', end);
        element.addEventListener('pointercancel', cancel);
        element.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    studentList.forEach((student) => {
        const rowWrapper = document.createElement('div');
        rowWrapper.style.display = 'flex';
        rowWrapper.style.width = '100%';
        rowWrapper.style.gap = '6px';
        const nameBtn = document.createElement('button');
        nameBtn.innerHTML = `${student.nameHtml} (0)`;
        nameBtn.style.padding = `${verticalPadding} 14px`;
        nameBtn.style.fontSize = fontSize;
        nameBtn.style.cursor = 'pointer';
        nameBtn.style.border = 'none';
        nameBtn.style.borderRadius = '6px';
        nameBtn.style.textAlign = 'left';
        nameBtn.style.flex = '1';
        nameBtn.style.userSelect = 'none';
        if (student.isInitiallyAbsent) {
            nameBtn.style.backgroundColor = '#343a40';
            nameBtn.style.color = '#6c757d';
        }
        else {
            nameBtn.style.backgroundColor = '#007bff';
            nameBtn.style.color = 'white';
        }
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
        alertBtn.style.userSelect = 'none';
        const rowState = {
            rowElement: rowWrapper,
            clicks: 0,
            alerts: 0,
            lastClickedTime: 0,
            isInitiallyAbsent: student.isInitiallyAbsent
        };
        rowsData.push(rowState);
        addLongPressListener(nameBtn, () => {
            rowState.clicks++;
            rowState.lastClickedTime = Date.now();
            nameBtn.innerHTML = `${student.nameHtml} (${rowState.clicks})`;
            nameBtn.style.backgroundColor = '#007bff';
            nameBtn.style.color = 'white';
            reorderButtons();
        }, () => {
            if (rowState.clicks > 0) {
                rowState.clicks--;
                rowState.lastClickedTime = Date.now();
                nameBtn.innerHTML = `${student.nameHtml} (${rowState.clicks})`;
                if (rowState.clicks === 0 && rowState.isInitiallyAbsent) {
                    nameBtn.style.backgroundColor = '#343a40';
                    nameBtn.style.color = '#6c757d';
                }
                reorderButtons();
            }
        });
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
    const studentElements = await waitForAllElements('.student');
    const studentsData = studentElements.map(el => {
        const nameEl = el.querySelector('.name');
        return {
            nameHtml: nameEl ? nameEl.innerHTML : 'Unknown',
            isInitiallyAbsent: el.classList.contains('absent')
        };
    });
    const shuffledStudents = shuffleArray(studentsData);
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
        newButton.addEventListener('click', () => { createOverlay(shuffledStudents); });
    }, 1000);
}
init();
