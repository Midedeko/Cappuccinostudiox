/**
 * Scramble animation and storyline typewriter.
 */
const STORYLINE_WPM = 360;
const MS_PER_WORD = (60 * 1000) / STORYLINE_WPM;
const STORYLINE_COMPLETE_WAIT_MS = 60 * 1000;

export function getRandomChar(seed, index) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    const pseudoRandom = (seed + index * 7919) % 2147483647;
    return chars[pseudoRandom % chars.length];
}

export function scrambleText(currentText, targetText, phase, progress, frame, seed) {
    let result = '';
    const targetLength = targetText.length;
    if (phase === 0) {
        for (let i = 0; i < currentText.length; i++) {
            const charProgress = progress;
            const randomValue = ((seed + i * 7919 + frame * 997) % 1000) / 1000;
            if (charProgress < 0.5) {
                const blend = charProgress * 2;
                result += (randomValue < blend) ? getRandomChar(seed, i + frame) : (currentText[i] || ' ');
            } else {
                result += getRandomChar(seed, i + frame);
            }
        }
        for (let i = currentText.length; i < targetLength; i++) result += getRandomChar(seed, i + frame);
    } else {
        for (let i = 0; i < targetLength; i++) {
            const charProgress = (i / targetLength) + (progress * 0.8);
            const randomValue = ((seed + i * 7919 + frame * 997) % 1000) / 1000;
            if (charProgress < 0.2) result += getRandomChar(seed, i + frame);
            else if (charProgress < 0.6) {
                const revealProgress = (charProgress - 0.2) / 0.4;
                result += (randomValue < revealProgress) ? (targetText[i] || ' ') : getRandomChar(seed, i + frame);
            } else result += targetText[i] || ' ';
        }
    }
    return result;
}

export function getTypedSoFar(state) {
    if (!state || !state.words) return '';
    let s = '';
    for (let wi = 0; wi < state.wordIndex; wi++) {
        if (state.words[wi] === '\n') s += '\n';
        else s += state.words[wi] + (wi + 1 < state.words.length && state.words[wi + 1] !== '\n' ? ' ' : '');
    }
    if (state.wordIndex < state.words.length && state.words[state.wordIndex] !== '\n') {
        const w = state.words[state.wordIndex];
        for (let ci = 0; ci < state.charIndex; ci++) s += w[ci];
    }
    return s;
}

/**
 * Creates a storyline typewriter controller (run, stop, setupHoverReveal).
 * State is held inside the controller.
 */
export function createStorylineController() {
    let typewriterId = null;
    let restartId = null;
    let cancel = false;
    let paused = false;
    let revealActive = false;
    let state = null;

    function stop() {
        cancel = true;
        paused = false;
        if (typewriterId) { clearTimeout(typewriterId); typewriterId = null; }
        if (restartId) { clearTimeout(restartId); restartId = null; }
    }

    function run(el, text) {
        stop();
        cancel = false;
        paused = false;
        revealActive = false;
        el.classList.remove('reveal');
        el.innerHTML = '';
        if (!text || !text.trim()) return;
        const scrollWrap = document.createElement('div');
        scrollWrap.className = 'storyline-scroll';
        const container = document.createElement('span');
        container.className = 'storyline-typewriter-content';
        const cursorSpan = document.createElement('span');
        cursorSpan.className = 'typewriter-cursor';
        scrollWrap.appendChild(container);
        scrollWrap.appendChild(cursorSpan);
        el.appendChild(scrollWrap);

        const lines = text.split('\n');
        const words = [];
        lines.forEach((line, i) => {
            line.split(/\s+/).forEach(w => { if (w.length) words.push(w); });
            if (i < lines.length - 1) words.push('\n');
        });
        const fullText = text;
        state = { words, wordIndex: 0, charIndex: 0, fullText, container, scrollWrap, el };

        function scrollToBottom() {
            if (paused) return;
            scrollWrap.scrollTop = Math.max(0, scrollWrap.scrollHeight - scrollWrap.clientHeight);
        }

        function typeNext() {
            if (cancel || paused) return;
            if (state.wordIndex >= state.words.length) {
                restartId = setTimeout(() => { restartId = null; run(el, fullText); }, STORYLINE_COMPLETE_WAIT_MS);
                return;
            }
            const word = state.words[state.wordIndex];
            if (word === '\n') {
                container.appendChild(document.createElement('br'));
                state.wordIndex++;
                typewriterId = setTimeout(typeNext, 50);
                scrollToBottom();
                return;
            }
            if (state.charIndex < word.length) {
                const span = document.createElement('span');
                span.textContent = word[state.charIndex];
                container.appendChild(span);
                state.charIndex++;
                typewriterId = setTimeout(typeNext, Math.max(20, MS_PER_WORD / word.length));
            } else {
                if (state.wordIndex < state.words.length - 1 && state.words[state.wordIndex + 1] !== '\n')
                    container.appendChild(document.createTextNode(' '));
                state.wordIndex++;
                state.charIndex = 0;
                typewriterId = setTimeout(typeNext, 30);
            }
            scrollToBottom();
        }
        typeNext();
    }

    function setupHoverReveal(overlayEl) {
        if (!overlayEl) return;
        let scrambleSeed = 0;
        let animId = null;

        function runScrambleAnimation(fromText, toText, onDone) {
            if (animId) cancelAnimationFrame(animId);
            scrambleSeed = Math.floor(Math.random() * 1000000);
            let phase = 0, frame = 0;
            const phase1 = 15, phase2 = 25;
            let lastTime = performance.now();
            const s = state;
            if (!s) return;
            const container = s.container;
            function tick(currentTime) {
                if (currentTime - lastTime < 16) { animId = requestAnimationFrame(tick); return; }
                lastTime = currentTime;
                let progress, display;
                if (phase === 0) {
                    progress = frame / phase1;
                    display = scrambleText(fromText, toText, 0, progress, frame, scrambleSeed);
                    if (frame >= phase1) { phase = 1; frame = 0; fromText = display; }
                } else {
                    progress = frame / phase2;
                    display = scrambleText(fromText, toText, 1, progress, frame + phase1, scrambleSeed);
                }
                container.textContent = display;
                if (phase === 0 || frame < phase2) { frame++; animId = requestAnimationFrame(tick); }
                else { animId = null; if (onDone) onDone(); }
            }
            animId = requestAnimationFrame(tick);
        }

        function enterReveal() {
            if (!state || revealActive) return;
            paused = true;
            if (typewriterId) { clearTimeout(typewriterId); typewriterId = null; }
            const s = state;
            const currentText = getTypedSoFar(s);
            const fullText = s.fullText;
            if (currentText === fullText) {
                s.container.textContent = fullText;
                overlayEl.classList.add('reveal');
                revealActive = true;
                return;
            }
            runScrambleAnimation(currentText, fullText, () => {
                s.container.textContent = fullText;
                overlayEl.classList.add('reveal');
                revealActive = true;
            });
        }

        function exitReveal() {
            if (!state || !revealActive) return;
            const s = state;
            const targetText = getTypedSoFar(s);
            const fullText = s.fullText;
            overlayEl.classList.remove('reveal');
            revealActive = false;
            if (targetText === fullText || targetText === '') {
                s.container.textContent = targetText;
                paused = false;
                if (s.wordIndex >= s.words.length) {
                    restartId = setTimeout(() => run(s.el, s.fullText), STORYLINE_COMPLETE_WAIT_MS);
                    return;
                }
                if (s.wordIndex < s.words.length) {
                    const words = s.words, container = s.container, scrollWrap = s.scrollWrap;
                    function scrollToBottom() { scrollWrap.scrollTop = Math.max(0, scrollWrap.scrollHeight - scrollWrap.clientHeight); }
                    function typeNext() {
                        if (cancel || paused) return;
                        if (s.wordIndex >= s.words.length) {
                            restartId = setTimeout(() => run(s.el, s.fullText), STORYLINE_COMPLETE_WAIT_MS);
                            return;
                        }
                        const word = words[s.wordIndex];
                        if (word === '\n') {
                            container.appendChild(document.createElement('br'));
                            s.wordIndex++;
                            typewriterId = setTimeout(typeNext, 50);
                            scrollToBottom();
                            return;
                        }
                        if (s.charIndex < word.length) {
                            const span = document.createElement('span');
                            span.textContent = word[s.charIndex];
                            container.appendChild(span);
                            s.charIndex++;
                            typewriterId = setTimeout(typeNext, Math.max(20, MS_PER_WORD / word.length));
                        } else {
                            if (s.wordIndex < words.length - 1 && words[s.wordIndex + 1] !== '\n')
                                container.appendChild(document.createTextNode(' '));
                            s.wordIndex++;
                            s.charIndex = 0;
                            typewriterId = setTimeout(typeNext, 30);
                        }
                        scrollToBottom();
                    }
                    typeNext();
                }
                return;
            }
            runScrambleAnimation(fullText, targetText, () => {
                s.container.textContent = targetText;
                paused = false;
                const words = s.words, container = s.container, scrollWrap = s.scrollWrap;
                function scrollToBottom() { scrollWrap.scrollTop = Math.max(0, scrollWrap.scrollHeight - scrollWrap.clientHeight); }
                function typeNext() {
                    if (cancel || paused) return;
                    if (s.wordIndex >= s.words.length) {
                        restartId = setTimeout(() => run(s.el, s.fullText), STORYLINE_COMPLETE_WAIT_MS);
                        return;
                    }
                    const word = words[s.wordIndex];
                    if (word === '\n') {
                        container.appendChild(document.createElement('br'));
                        s.wordIndex++;
                        typewriterId = setTimeout(typeNext, 50);
                        scrollToBottom();
                        return;
                    }
                    if (s.charIndex < word.length) {
                        const span = document.createElement('span');
                        span.textContent = word[s.charIndex];
                        container.appendChild(span);
                        s.charIndex++;
                        typewriterId = setTimeout(typeNext, Math.max(20, MS_PER_WORD / word.length));
                    } else {
                        if (s.wordIndex < words.length - 1 && words[s.wordIndex + 1] !== '\n')
                            container.appendChild(document.createTextNode(' '));
                        s.wordIndex++;
                        s.charIndex = 0;
                        typewriterId = setTimeout(typeNext, 30);
                    }
                    scrollToBottom();
                }
                typeNext();
            });
        }

        overlayEl.addEventListener('mouseenter', () => enterReveal());
        overlayEl.addEventListener('mouseleave', () => exitReveal());
        overlayEl.addEventListener('click', (e) => { e.preventDefault(); if (!revealActive) enterReveal(); });
        overlayEl.addEventListener('touchstart', () => { if (!revealActive) enterReveal(); }, { passive: true });
        document.addEventListener('click', (e) => { if (revealActive && overlayEl.contains && !overlayEl.contains(e.target)) exitReveal(); });
        document.addEventListener('touchend', (e) => { if (revealActive && overlayEl.contains && !overlayEl.contains(e.target)) exitReveal(); }, { passive: true });
    }

    return { run, stop, getState: () => state, setupHoverReveal };
}
