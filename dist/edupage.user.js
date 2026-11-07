// ==UserScript==
// @name         EduPage Roll Call Extension
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
function shuffleArray(arr) {
    const shuff = [...arr];
    for (let i = shuff.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuff[i], shuff[j]] = [shuff[j], shuff[i]];
    }
    return shuff;
}
function createOverlay(studentList) {
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
    const vis = () => { if (wl !== null && document.visibilityState === 'visible')
        lock(); };
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
    };
    const rowsData = [];
    const render = () => {
        const active = rowsData.filter(r => !r.isInitiallyAbsent || r.clicks > 0);
        const absent = rowsData.filter(r => r.isInitiallyAbsent && r.clicks === 0);
        active.sort((a, b) => a.clicks !== b.clicks ? a.clicks - b.clicks : a.lastClickedTime - b.lastClickedTime);
        active.forEach(r => container.appendChild(r.rowElement));
        absent.forEach(r => container.appendChild(r.rowElement));
        container.appendChild(closeBtn);
    };
    const colorAlert = (btn, count) => {
        // 0 starts at soft, light yellow. As it climbs to 20, it descends into intense dark red.
        const f = Math.min(count / 20, 1);
        const h = Math.round(60 - (f * 60)); // Hue: 60 (Yellow) down to 0 (Red)
        const l = Math.round(85 - (f * 45)); // Lightness: 85% (Light) down to 40% (Darker bold red)
        btn.style.background = `hsl(${h},100%,${l}%)`;
        btn.style.color = l > 65 ? '#111' : 'white'; // Readable high contrast shift
    };
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
    studentList.forEach(st => {
        const row = document.createElement('div');
        row.style.cssText = "display:flex;width:100%;gap:6px;box-sizing:border-box;";
        const nBtn = document.createElement('button');
        nBtn.innerHTML = `${st.nameHtml} (0)`;
        nBtn.style.cssText = `padding:${pad} 14px;font-size:${fs};cursor:pointer;border:none;border-radius:6px;text-align:left;flex:1;user-select:none;`;
        if (st.isInitiallyAbsent) {
            nBtn.style.background = '#343a40';
            nBtn.style.color = '#6c757d';
        }
        else {
            nBtn.style.background = '#007bff';
            nBtn.style.color = 'white';
        }
        const aBtn = document.createElement('button');
        aBtn.innerText = '⚠️ 0';
        aBtn.style.cssText = `padding:${pad} 12px;font-size:${fs};font-weight:bold;cursor:pointer;border:none;border-radius:6px;min-width:75px;user-select:none;transition:background 0.2s;`;
        colorAlert(aBtn, 0); // Correctly calculate initial light yellow style color immediately on boot
        const state = { rowElement: row, clicks: 0, alerts: 0, lastClickedTime: 0, isInitiallyAbsent: st.isInitiallyAbsent };
        rowsData.push(state);
        addLP(nBtn, () => {
            if (state.isInitiallyAbsent && state.clicks === 0) {
                const act = rowsData.filter(r => r !== state && (!r.isInitiallyAbsent || r.clicks > 0));
                state.clicks = act.length > 0 ? Math.round(act.reduce((s, r) => s + r.clicks, 0) / act.length) : 1;
            }
            else
                state.clicks++;
            state.lastClickedTime = Date.now();
            nBtn.innerHTML = `${st.nameHtml} (${state.clicks})`;
            nBtn.style.background = '#007bff';
            nBtn.style.color = 'white';
            render();
        }, () => {
            if (state.clicks > 0) {
                state.clicks--;
                state.lastClickedTime = Date.now();
                nBtn.innerHTML = `${st.nameHtml} (${state.clicks})`;
                if (state.clicks === 0 && state.isInitiallyAbsent) {
                    nBtn.style.background = '#343a40';
                    nBtn.style.color = '#6c757d';
                }
                render();
            }
        });
        addLP(aBtn, () => { state.alerts++; aBtn.innerText = `⚠️ ${state.alerts}`; colorAlert(aBtn, state.alerts); }, () => { if (state.alerts > 0) {
            state.alerts--;
            aBtn.innerText = `⚠️ ${state.alerts}`;
            colorAlert(aBtn, state.alerts);
        } });
        row.appendChild(nBtn);
        row.appendChild(aBtn);
    });
    render();
    document.body.appendChild(overlay);
}
async function init() {
    const elements = await waitForAllElements('.student');
    const data = elements.map(el => ({
        nameHtml: el.querySelector('.name')?.innerHTML || 'Unknown',
        isInitiallyAbsent: el.classList.contains('absent')
    }));
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
        btn.addEventListener('click', () => createOverlay(shuffled));
    }, 1000);
}
init();
