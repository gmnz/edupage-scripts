// ==UserScript==
// @name         EduPage Roll Call Extension
// @namespace    http://tampermonkey.net
// @version      2026-11-11
// @include      https://*.edupage.*/*
// @grant        none
// ==/UserScript==
// Stores all counts in memory only.
// Everything resets when the page is reloaded.
const countStore = new Map();
function waitForAllElements(selector, minCount = 1, timeout) {
    return new Promise((resolve, reject) => {
        let timer;
        const check = (obs) => {
            const el = Array.from(document.querySelectorAll(selector));
            if (el.length >= minCount) {
                if (obs)
                    obs.disconnect();
                if (timer)
                    clearTimeout(timer);
                resolve(el);
                return true;
            }
            return false;
        };
        if (check())
            return;
        const observer = new MutationObserver((_, obs) => check(obs));
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        if (timeout) {
            timer = window.setTimeout(() => {
                observer.disconnect();
                reject(new Error("Timeout"));
            }, timeout);
        }
    });
}
function copyElement(orig) {
    if (!orig)
        return null;
    const clone = orig.cloneNode(true);
    clone.id = 'new-button';
    orig.parentElement?.insertBefore(clone, orig);
    return clone;
}
function shuffleArray(arr) {
    const shuff = [...arr];
    for (let i = shuff.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuff[i], shuff[j]] = [shuff[j], shuff[i]];
    }
    return shuff;
}
function createOverlay(studentList, groupKey) {
    // Retrieve existing counts for this student group.
    let groupCounts = countStore.get(groupKey);
    if (!groupCounts) {
        groupCounts = new Map();
        countStore.set(groupKey, groupCounts);
    }
    const overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed;background:rgba(0,0,0,0.95);z-index:2147483647;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;box-sizing:border-box;overflow-y:auto;padding:12px;font-family:Arial,sans-serif;user-select:none;";
    const resize = () => {
        const vv = window.visualViewport;
        if (vv) {
            overlay.style.width = vv.width + "px";
            overlay.style.height = vv.height + "px";
            overlay.style.top = vv.offsetTop + "px";
            overlay.style.left = vv.offsetLeft + "px";
        }
        else {
            overlay.style.width = "100%";
            overlay.style.height = "100%";
            overlay.style.top = "0";
            overlay.style.left = "0";
        }
    };
    resize();
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', resize);
        window.visualViewport.addEventListener('scroll', resize);
    }
    let wl = null;
    const lock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wl = await navigator.wakeLock.request('screen');
            }
        }
        catch (e) { }
    };
    const unlock = async () => {
        if (wl) {
            try {
                await wl.release();
                wl = null;
            }
            catch (e) { }
        }
    };
    lock();
    const vis = () => {
        if (wl !== null && document.visibilityState === 'visible')
            lock();
    };
    document.addEventListener('visibilitychange', vis);
    const container = document.createElement('div');
    container.style.cssText = "display:flex;flex-direction:column;gap:8px;width:100%;";
    overlay.appendChild(container);
    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕ Close Roll Call';
    closeBtn.style.cssText = "padding:14px;font-size:16px;font-weight:bold;cursor:pointer;border:none;border-radius:6px;background:#ff4d4d;color:white;margin-top:16px;";
    closeBtn.onclick = () => {
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', resize);
            window.visualViewport.removeEventListener('scroll', resize);
        }
        document.removeEventListener('visibilitychange', vis);
        unlock();
        overlay.remove();
        // Do not clear countStore.
        // Both counters must survive closing the overlay.
    };
    const rowsData = [];
    const render = () => {
        const active = rowsData.filter(r => !r.isInitiallyAbsent || r.clicks > 0);
        const absent = rowsData.filter(r => r.isInitiallyAbsent && r.clicks === 0);
        active.sort((a, b) => a.clicks !== b.clicks
            ? a.clicks - b.clicks
            : a.lastClickedTime - b.lastClickedTime);
        active.forEach(r => container.appendChild(r.rowElement));
        absent.forEach(r => container.appendChild(r.rowElement));
        container.appendChild(closeBtn);
    };
    const colorAlert = (btn, count) => {
        // 0 starts at soft, light yellow.
        // As it climbs to 20, it descends into intense dark red.
        const f = Math.min(count / 20, 1);
        const h = Math.round(60 - (f * 60));
        const l = Math.round(85 - (f * 45));
        btn.style.background = `hsl(${h},100%,${l}%)`;
        btn.style.color = l > 65 ? '#111' : 'white';
    };
    const pad = studentList.length > 20 ? '10px' : '14px';
    const fs = studentList.length > 20 ? '15px' : '17px';
    // Pointer handling: allow scrolling and prevent accidental taps.
    const addLP = (el, tap, lp) => {
        let t;
        let isLP = false;
        let moved = false;
        let startX = 0;
        let startY = 0;
        const MOVE_THRESHOLD = 10;
        const clear = () => {
            if (t !== undefined) {
                clearTimeout(t);
                t = undefined;
            }
        };
        const start = (e) => {
            // Ignore non-primary mouse buttons.
            if (e.pointerType === 'mouse' && e.button !== 0)
                return;
            clear();
            isLP = false;
            moved = false;
            startX = e.clientX;
            startY = e.clientY;
            t = window.setTimeout(() => {
                if (!moved) {
                    isLP = true;
                    if (navigator.vibrate)
                        navigator.vibrate(40);
                    lp();
                }
            }, 500);
        };
        const move = (e) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > MOVE_THRESHOLD ||
                Math.abs(dy) > MOVE_THRESHOLD) {
                moved = true;
                clear();
            }
        };
        const cancel = () => {
            clear();
            moved = true;
        };
        const end = () => {
            clear();
            if (!moved && !isLP) {
                tap();
            }
            isLP = false;
        };
        // Allow native vertical scrolling.
        el.style.touchAction = 'pan-y';
        el.addEventListener('pointerdown', start);
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', cancel);
        el.addEventListener('contextmenu', e => e.preventDefault());
    };
    studentList.forEach(st => {
        const row = document.createElement('div');
        row.style.cssText = "display:flex;width:100%;gap:6px;box-sizing:border-box;";
        // Identify the student consistently.
        const cleanName = st.nameHtml
            .replace(/<[^>]*>/g, '')
            .trim();
        // Retrieve existing counts or initialize them.
        let savedCounts = groupCounts.get(cleanName);
        if (!savedCounts) {
            savedCounts = {
                clicks: 0,
                alerts: 0,
                lastClickedTime: 0
            };
            groupCounts.set(cleanName, savedCounts);
        }
        const nBtn = document.createElement('button');
        nBtn.innerHTML = `${st.nameHtml} (${savedCounts.clicks})`;
        nBtn.style.cssText = `padding:${pad} 14px;font-size:${fs};cursor:pointer;border:none;border-radius:6px;text-align:left;flex:1;user-select:none;`;
        if (st.isInitiallyAbsent && savedCounts.clicks === 0) {
            nBtn.style.background = '#343a40';
            nBtn.style.color = '#6c757d';
        }
        else {
            nBtn.style.background = '#007bff';
            nBtn.style.color = 'white';
        }
        const aBtn = document.createElement('button');
        aBtn.innerText = `⚠️ ${savedCounts.alerts}`;
        aBtn.style.cssText = `padding:${pad} 12px;font-size:${fs};font-weight:bold;cursor:pointer;border:none;border-radius:6px;min-width:75px;user-select:none;transition:background 0.2s;`;
        colorAlert(aBtn, savedCounts.alerts);
        const state = {
            rowElement: row,
            clicks: savedCounts.clicks,
            alerts: savedCounts.alerts,
            lastClickedTime: savedCounts.lastClickedTime,
            isInitiallyAbsent: st.isInitiallyAbsent
        };
        rowsData.push(state);
        // Student click counter.
        addLP(nBtn, () => {
            if (state.isInitiallyAbsent && state.clicks === 0) {
                const act = rowsData.filter(r => r !== state &&
                    (!r.isInitiallyAbsent || r.clicks > 0));
                state.clicks = act.length > 0
                    ? Math.round(act.reduce((s, r) => s + r.clicks, 0) / act.length)
                    : 1;
            }
            else {
                state.clicks++;
            }
            state.lastClickedTime = Date.now();
            // Save both counters in memory.
            groupCounts.set(cleanName, {
                clicks: state.clicks,
                alerts: state.alerts,
                lastClickedTime: state.lastClickedTime
            });
            nBtn.innerHTML = `${st.nameHtml} (${state.clicks})`;
            nBtn.style.background = '#007bff';
            nBtn.style.color = 'white';
            render();
        }, () => {
            if (state.clicks > 0) {
                state.clicks--;
                state.lastClickedTime = Date.now();
                // Save both counters in memory.
                groupCounts.set(cleanName, {
                    clicks: state.clicks,
                    alerts: state.alerts,
                    lastClickedTime: state.lastClickedTime
                });
                nBtn.innerHTML = `${st.nameHtml} (${state.clicks})`;
                if (state.clicks === 0 && state.isInitiallyAbsent) {
                    nBtn.style.background = '#343a40';
                    nBtn.style.color = '#6c757d';
                }
                render();
            }
        });
        // Warning counter.
        addLP(aBtn, () => {
            state.alerts++;
            // Save both counters in memory.
            groupCounts.set(cleanName, {
                clicks: state.clicks,
                alerts: state.alerts,
                lastClickedTime: state.lastClickedTime
            });
            aBtn.innerText = `⚠️ ${state.alerts}`;
            colorAlert(aBtn, state.alerts);
        }, () => {
            if (state.alerts > 0) {
                state.alerts--;
                // Save both counters in memory.
                groupCounts.set(cleanName, {
                    clicks: state.clicks,
                    alerts: state.alerts,
                    lastClickedTime: state.lastClickedTime
                });
                aBtn.innerText = `⚠️ ${state.alerts}`;
                colorAlert(aBtn, state.alerts);
            }
        });
        row.appendChild(nBtn);
        row.appendChild(aBtn);
    });
    render();
    document.body.appendChild(overlay);
}
async function init() {
    const elements = await waitForAllElements('.student');
    // Identify the group, following forgotten.user.ts.
    let groupName = "DefaultGroup";
    try {
        const groupHeader = document.querySelector('.dlg-header > .icon.students')?.nextElementSibling?.firstElementChild;
        if (groupHeader && groupHeader.innerText) {
            groupName = groupHeader.innerText.trim();
        }
    }
    catch (e) { }
    const data = elements.map(el => ({
        nameHtml: el.querySelector('.name')?.innerHTML || 'Unknown',
        isInitiallyAbsent: el.classList.contains('absent')
    }));
    // Identify the group by its name and complete student list.
    // Sorting ensures that student order does not affect the group key.
    const studentNames = data
        .map(st => st.nameHtml.replace(/<[^>]*>/g, '').trim())
        .sort();
    const groupKey = JSON.stringify([
        groupName,
        studentNames
    ]);
    const shuffled = shuffleArray(data);
    const close = document.querySelector('[role=dialog]:has(.student .name) button[title=Close]');
    close?.addEventListener('click', () => init());
    setTimeout(() => {
        const save = document.querySelector('[role=dialog]:has(.student .name) .asc-button-container:has(.button-green)');
        if (!save)
            return;
        const btn = copyElement(save)?.firstElementChild;
        if (!btn)
            return;
        btn.classList.remove('button-green');
        btn.classList.add('button-blue');
        btn.innerHTML = 'Roll Call';
        btn.addEventListener('click', () => {
            createOverlay(shuffled, groupKey);
        });
    }, 1000);
}
init();
