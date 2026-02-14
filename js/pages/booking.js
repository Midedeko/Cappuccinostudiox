/**
 * Booking flow: service → time slot → confirm. Scramble + fade transitions, POST /api/bookings.
 */
import { scrambleText } from '../animations.js';

const SERVICES = [
    'Immersive Experiences',
    'Brand Strategy',
    'Product Development',
    'Set Design',
    'Video Production',
    'Animation Production',
    'Music Release Content Dev',
    'Music Production',
    'Sound Design and Production',
    'Content Design and Dev',
    'Web Development',
    'Real Estate Launch',
    'Real Estate Content Development',
    'Marketing Consult',
    'Creative Direction'
];

const MOCK_SLOTS = [
    { date: '2026-03-01', time: '10:00' },
    { date: '2026-03-01', time: '14:00' },
    { date: '2026-03-02', time: '09:00' },
    { date: '2026-03-02', time: '15:00' },
    { date: '2026-03-03', time: '11:00' },
    { date: '2026-03-03', time: '16:00' },
    { date: '2026-03-04', time: '10:30' },
    { date: '2026-03-04', time: '14:30' },
    { date: '2026-03-05', time: '13:00' }
];

const STEP_TITLES = {
    1: 'Choose a service',
    2: 'Pick a time',
    3: 'Confirm'
};

const PHASE1 = 12;
const PHASE2 = 18;

function runScrambleTransition(el, fromText, toText, onDone) {
    if (!el) return;
    const seed = Math.floor(Math.random() * 1000000);
    let phase = 0;
    let frame = 0;
    let lastTime = performance.now();
    let currentFrom = fromText;

    function tick(currentTime) {
        if (currentTime - lastTime < 16) {
            requestAnimationFrame(tick);
            return;
        }
        lastTime = currentTime;
        let progress;
        if (phase === 0) {
            progress = frame / PHASE1;
            el.textContent = scrambleText(currentFrom, toText, 0, progress, frame, seed);
            if (frame >= PHASE1) {
                phase = 1;
                frame = 0;
                currentFrom = el.textContent;
            }
        } else {
            progress = frame / PHASE2;
            el.textContent = scrambleText(currentFrom, toText, 1, progress, frame + PHASE1, seed);
        }
        frame++;
        if (phase < 1 || frame < PHASE2) requestAnimationFrame(tick);
        else {
            el.textContent = toText;
            if (onDone) onDone();
        }
    }
    requestAnimationFrame(tick);
}

function fadeOutPanel(panel, onDone) {
    panel.style.opacity = '0';
    setTimeout(() => {
        panel.classList.remove('active');
        if (onDone) onDone();
    }, 350);
}

function fadeInPanel(panel, onDone) {
    panel.classList.add('active');
    panel.style.opacity = '0';
    requestAnimationFrame(() => {
        panel.style.opacity = '1';
        setTimeout(() => { if (onDone) onDone(); }, 350);
    });
}

function formatSlotLabel(dateStr, timeStr) {
    const d = new Date(dateStr + 'T' + timeStr + ':00');
    const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = timeStr.slice(0, 5);
    return date + ', ' + time;
}

function formatDateTimeISO(dateStr, timeStr) {
    return dateStr + 'T' + timeStr + ':00:00.000Z';
}

function init() {
    const state = {
        step: 1,
        service: '',
        slot: null,
        name: '',
        email: '',
        phone: ''
    };

    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const step1Title = document.getElementById('step1Title');
    const step2Title = document.getElementById('step2Title');
    const step3Title = document.getElementById('step3Title');
    const serviceSelect = document.getElementById('serviceSelect');
    const slotsGrid = document.getElementById('slotsGrid');
    const summaryBlock = document.getElementById('summaryBlock');
    const bookingName = document.getElementById('bookingName');
    const bookingEmail = document.getElementById('bookingEmail');
    const bookingPhone = document.getElementById('bookingPhone');
    const confirmBookingBtn = document.getElementById('confirmBookingBtn');
    const bookingMessage = document.getElementById('bookingMessage');

    SERVICES.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        serviceSelect.appendChild(opt);
    });

    function setStepTitle(el, text) {
        if (!el) return;
        el.textContent = text;
    }

    function goToStep2() {
        state.step = 2;
        fadeOutPanel(step1, () => {
            setStepTitle(step1Title, STEP_TITLES[1]);
            step2.classList.add('active');
            step2.style.opacity = '0';
            requestAnimationFrame(() => {
                step2.style.opacity = '1';
                runScrambleTransition(step2Title, STEP_TITLES[1], STEP_TITLES[2]);
            });
            slotsGrid.innerHTML = '';
            MOCK_SLOTS.forEach(slot => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'slot-btn';
                btn.textContent = formatSlotLabel(slot.date, slot.time);
                btn.dataset.date = slot.date;
                btn.dataset.time = slot.time;
                btn.addEventListener('click', () => selectSlot(slot, btn));
                slotsGrid.appendChild(btn);
            });
        });
    }

    function selectSlot(slot, btn) {
        slotsGrid.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.slot = slot;
        fadeOutPanel(step2, () => {
            setStepTitle(step2Title, STEP_TITLES[2]);
            step3.classList.add('active');
            step3.style.opacity = '0';
            summaryBlock.innerHTML = '<p><strong>Service</strong> ' + escapeHtml(state.service) + '</p><p><strong>Date & time</strong> ' + formatSlotLabel(state.slot.date, state.slot.time) + '</p>';
            bookingName.value = state.name;
            bookingEmail.value = state.email;
            bookingPhone.value = state.phone;
            bookingMessage.textContent = '';
            bookingMessage.className = 'booking-message';
            requestAnimationFrame(() => {
                step3.style.opacity = '1';
                runScrambleTransition(step3Title, STEP_TITLES[2], STEP_TITLES[3]);
            });
        });
    }

    function escapeHtml(s) {
        if (s == null) return '';
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    serviceSelect.addEventListener('change', () => {
        const val = (serviceSelect.value || '').trim();
        if (!val) return;
        state.service = val;
        goToStep2();
    });

    confirmBookingBtn.addEventListener('click', () => {
        state.name = (bookingName.value || '').trim();
        state.email = (bookingEmail.value || '').trim();
        state.phone = (bookingPhone.value || '').trim();
        bookingMessage.textContent = '';
        bookingMessage.className = 'booking-message';
        if (!state.name || !state.email) {
            bookingMessage.textContent = 'Please enter name and email.';
            bookingMessage.classList.add('error');
            return;
        }
        confirmBookingBtn.disabled = true;
        const datetime = formatDateTimeISO(state.slot.date, state.slot.time);
        fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service: state.service,
                datetime,
                name: state.name,
                email: state.email,
                phone: state.phone
            })
        })
            .then(res => {
                if (res.ok) {
                    bookingMessage.textContent = 'Booking confirmed.';
                    bookingMessage.classList.add('success');
                } else {
                    return res.json().then(j => { throw new Error(j?.error || res.statusText); });
                }
            })
            .catch(err => {
                bookingMessage.textContent = err.message || 'Booking failed.';
                bookingMessage.classList.add('error');
            })
            .finally(() => { confirmBookingBtn.disabled = false; });
    });
}

init();
