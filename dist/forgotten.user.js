// ==UserScript==
// @name         EduPage Materials Tracker & Logger
// @namespace    http://tampermonkey.net
// @version      2026-11-07
// @include      https://*.edupage.*/*
// @grant        none
// ==/UserScript==
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
        observer.observe(document.body, { childList: true, subtree: true });
        if (timeout)
            timer = window.setTimeout(() => { observer.disconnect(); reject(new Error("Timeout")); }, timeout);
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
function createOverlay(studentList, groupKey) {
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
    const lock = async () => { try {
        if ('wakeLock' in navigator)
            wl = await navigator.wakeLock.request('screen');
    }
    catch (e) { } };
    const unlock = async () => { if (wl) {
        try {
            await wl.release();
            wl = null;
        }
        catch (e) { }
    } };
    lock();
    document.addEventListener('visibilitychange', () => { if (wl !== null && document.visibilityState === 'visible')
        lock(); });
    const container = document.createElement('div');
    container.style.cssText = "display:flex;flex-direction:column;gap:8px;width:100%;";
    overlay.appendChild(container);
    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕ Close Tracker';
    closeBtn.style.cssText = "padding:14px;font-size:16px;font-weight:bold;cursor:pointer;border:none;border-radius:6px;background:#ff4d4d;color:white;margin-top:16px;";
    closeBtn.onclick = () => {
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', resize);
            window.visualViewport.removeEventListener('scroll', resize);
        }
        unlock();
        overlay.remove();
    };
    const storageKey = `edupage_tracker_${groupKey}`;
    let preservedData = {};
    try {
        const raw = localStorage.getItem(storageKey);
        if (raw)
            preservedData = JSON.parse(raw);
    }
    catch (e) {
        console.error(e);
    }
    const saveData = () => { localStorage.setItem(storageKey, JSON.stringify(preservedData)); };
    const getNowStr = () => { const d = new Date(); return `[${d.toLocaleDateString()} ${d.toLocaleTimeString()}]`; };
    const pad = studentList.length > 20 ? '10px' : '14px', fs = studentList.length > 20 ? '15px' : '17px';
    const addLP = (el, tap, lp) => {
        let t, isLP = false;
        const start = (e) => { if (e.cancelable)
            e.preventDefault(); el.setPointerCapture(e.pointerId); isLP = false; t = window.setTimeout(() => { isLP = true; if (navigator.vibrate)
            navigator.vibrate(40); lp(); }, 500); };
        const cancel = (e) => { if (t)
            clearTimeout(t); try {
            el.releasePointerCapture(e.pointerId);
        }
        catch (err) { } };
        const end = (e) => { if (t)
            clearTimeout(t); try {
            el.releasePointerCapture(e.pointerId);
        }
        catch (err) { } if (!isLP)
            tap(); isLP = false; };
        el.style.touchAction = 'none';
        el.addEventListener('pointerdown', start);
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', cancel);
        el.addEventListener('contextmenu', e => e.preventDefault());
    };
    const activeRows = [];
    const absentRows = [];
    studentList.forEach(st => {
        const cleanName = st.nameHtml.replace(/<[^>]*>/g, '').trim();
        if (!preservedData[cleanName]) {
            preservedData[cleanName] = { books: 0, homework: 0, logs: [] };
        }
        if (!preservedData[cleanName].logs) {
            preservedData[cleanName].logs = [];
        }
        const currentMetrics = preservedData[cleanName];
        const row = document.createElement('div');
        row.style.cssText = "display:flex;width:100%;gap:6px;box-sizing:border-box;align-items:center;";
        const nameLabel = document.createElement('button');
        nameLabel.innerHTML = st.nameHtml;
        nameLabel.style.cssText = `padding:${pad} 14px;font-size:${fs};border:none;background:transparent;text-align:left;flex:1;color:white;box-sizing:border-box;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;`;
        if (st.isInitiallyAbsent) {
            nameLabel.style.opacity = '0.4';
        }
        nameLabel.onclick = () => {
            if (currentMetrics.logs.length === 0) {
                alert(`Increase Log for ${cleanName}:\n\nNo counters have been increased yet.`);
            }
            else {
                alert(`Increase Log for ${cleanName}:\n\n${currentMetrics.logs.join('\n')}`);
            }
        };
        const bookBtn = document.createElement('button');
        bookBtn.innerText = `📘 ${currentMetrics.books}`;
        bookBtn.style.cssText = `padding:${pad} 10px;font-size:${fs};font-weight:bold;cursor:pointer;border:none;border-radius:6px;min-width:70px;user-select:none;background:#28a745;color:white;`;
        const hwBtn = document.createElement('button');
        hwBtn.innerText = `📝 ${currentMetrics.homework}`;
        hwBtn.style.cssText = `padding:${pad} 10px;font-size:${fs};font-weight:bold;cursor:pointer;border:none;border-radius:6px;min-width:70px;user-select:none;background:#fd7e14;color:white;`;
        addLP(bookBtn, () => { currentMetrics.books++; currentMetrics.logs.push(`${getNowStr()} 📘 Forgotten Book`); bookBtn.innerText = `📘 ${currentMetrics.books}`; saveData(); }, () => { if (currentMetrics.books > 0) {
            currentMetrics.books--;
            const idx = currentMetrics.logs.map(l => l.includes('📘')).lastIndexOf(true);
            if (idx > -1)
                currentMetrics.logs.splice(idx, 1);
            bookBtn.innerText = `📘 ${currentMetrics.books}`;
            saveData();
        } });
        addLP(hwBtn, () => { currentMetrics.homework++; currentMetrics.logs.push(`${getNowStr()} 📝 Forgotten Homework`); hwBtn.innerText = `📝 ${currentMetrics.homework}`; saveData(); }, () => { if (currentMetrics.homework > 0) {
            currentMetrics.homework--;
            const idx = currentMetrics.logs.map(l => l.includes('📝')).lastIndexOf(true);
            if (idx > -1)
                currentMetrics.logs.splice(idx, 1);
            hwBtn.innerText = `📝 ${currentMetrics.homework}`;
            saveData();
        } });
        row.appendChild(nameLabel);
        row.appendChild(bookBtn);
        row.appendChild(hwBtn);
        if (st.isInitiallyAbsent) {
            absentRows.push(row);
        }
        else {
            activeRows.push(row);
        }
    });
    activeRows.forEach(r => container.appendChild(r));
    absentRows.forEach(r => container.appendChild(r));
    container.appendChild(closeBtn);
    document.body.appendChild(overlay);
}
async function init() {
    const elements = await waitForAllElements('.student');
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
        btn.classList.add('button-red');
        btn.innerHTML = 'Track Materials';
        btn.addEventListener('click', () => createOverlay(data, groupName));
    }, 1000);
}
init();
