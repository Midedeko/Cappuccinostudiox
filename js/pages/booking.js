/**
 * Booking form: single-screen UI (Book A Session kit). POST /api/bookings.
 */
function formatDateTimeISO(dateStr, timeStr) {
    return dateStr + 'T' + timeStr + ':00:00.000Z';
}

function init() {
    const nameEl = document.getElementById('bookingName');
    const emailEl = document.getElementById('bookingEmail');
    const phoneEl = document.getElementById('bookingPhone');
    const serviceEl = document.getElementById('bookingService');
    const dateEl = document.getElementById('bookingDate');
    const timeEl = document.getElementById('bookingTime');
    const submitBtn = document.getElementById('bookingSubmit');
    const messageEl = document.getElementById('bookingMessage');

    if (!submitBtn || !messageEl) return;

    submitBtn.addEventListener('click', () => {
        const name = (nameEl?.value ?? '').trim();
        const email = (emailEl?.value ?? '').trim();
        const phone = (phoneEl?.value ?? '').trim() || null;
        const service = (serviceEl?.value ?? '').trim() || null;
        const dateVal = (dateEl?.value ?? '').trim();
        const timeVal = (timeEl?.value ?? '').trim();

        messageEl.textContent = '';
        messageEl.className = 'booking-message';

        if (!name || !email) {
            messageEl.textContent = 'Please enter name and email.';
            messageEl.classList.add('error');
            return;
        }
        if (!dateVal || !timeVal) {
            messageEl.textContent = 'Please choose a date and time.';
            messageEl.classList.add('error');
            return;
        }

        submitBtn.disabled = true;
        const datetime = formatDateTimeISO(dateVal, timeVal);

        fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service: service || null,
                datetime,
                name,
                email,
                phone
            })
        })
            .then(res => {
                if (res.ok) {
                    messageEl.textContent = 'Booking confirmed.';
                    messageEl.classList.add('success');
                } else {
                    return res.json().then(j => { throw new Error(j?.error || res.statusText); });
                }
            })
            .catch(err => {
                messageEl.textContent = err.message || 'Booking failed.';
                messageEl.classList.add('error');
            })
            .finally(() => { submitBtn.disabled = false; });
    });
}

init();
