/**
 * Booking form: single-screen UI (Book A Session kit). POST /api/bookings.
 */
function formatDateTimeISO(dateStr, timeStr) {
    return dateStr + 'T' + timeStr + ':00.000Z';
}

function init() {
    const nameEl = document.getElementById('bookingName');
    const emailEl = document.getElementById('bookingEmail');
    const serviceEl = document.getElementById('bookingService');
    const dateEl = document.getElementById('bookingDate');
    const timeEl = document.getElementById('bookingTime');
    const submitBtn = document.getElementById('bookingSubmit');
    const messageEl = document.getElementById('bookingMessage');

    if (!submitBtn || !messageEl) return;

    submitBtn.addEventListener('click', () => {
        const name = (nameEl?.value ?? '').trim();
        const email = (emailEl?.value ?? '').trim();
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
        if (!service) {
            messageEl.textContent = 'Please choose a service.';
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
                email
            })
        })
            .then(res => {
                if (res.ok) {
                    const serviceLabelEl = document.querySelector('.kit-modal-select .kit-modal-dropdown-label');
                    const dateLabelEl = document.querySelector('.kit-modal-date .kit-modal-dropdown-label');
                    const serviceLabel = serviceLabelEl?.textContent?.trim() || service;
                    const dateLabel = dateLabelEl?.textContent?.trim() || dateVal;
                    messageEl.className = 'booking-message success';
                    const wrap = messageEl.closest('.kit-modal-wrap');
                    if (wrap) wrap.classList.add('booking-done');
                    messageEl.innerHTML = '<div class="booking-success-card">' +
                        '<div class="booking-success-title">Booking successful</div>' +
                        '<div class="booking-success-details">' + (serviceLabel ? 'Service: ' + serviceLabel + '<br>' : '') + 'Date: ' + dateLabel + '<br>Time: ' + timeVal + '</div>' +
                        '<div class="booking-success-actions">' +
                        '<a href="kitchen.html">Continue to kitchen</a>' +
                        '<button type="button" class="booking-success-btn" data-date="' + dateVal + '" data-time="' + timeVal + '" data-summary="' + (serviceLabel || 'Session').replace(/"/g, '&quot;') + '">Add to calendar</button>' +
                        '</div></div>';
                    const addBtn = messageEl.querySelector('.booking-success-btn');
                    if (addBtn) {
                        addBtn.addEventListener('click', () => {
                            const d = addBtn.getAttribute('data-date');
                            const t = addBtn.getAttribute('data-time');
                            let summary = (addBtn.getAttribute('data-summary') || 'Session').replace(/&quot;/g, '"');
                            if (!d || !t) return;
                            const icsStart = d.replace(/-/g, '') + 'T' + t.replace(':', '') + '0000Z';
                            const endHour = parseInt(t.slice(0, 2), 10) + 1;
                            const icsEnd = d.replace(/-/g, '') + 'T' + (endHour < 10 ? '0' : '') + endHour + '000000Z';
                            const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART:' + icsStart + '\r\nDTEND:' + icsEnd + '\r\nSUMMARY:' + summary + '\r\nEND:VEVENT\r\nEND:VCALENDAR';
                            const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'booking.ics';
                            a.click();
                            URL.revokeObjectURL(url);
                        });
                    }
                } else {
                    return res.json().then(j => { throw new Error(j?.error || res.statusText); });
                }
            })
            .catch(() => {
                messageEl.textContent = 'Something went wrong. Please try again.';
                messageEl.className = 'booking-message error';
            })
            .finally(() => { submitBtn.disabled = false; });
    });
}

init();
