/* ==========================================================================
   ADMIN LOGIC — BRAIN ACADEMIA PINRANG
   ========================================================================== */

// ── Auth Guard ──
if (!Session.requireAdmin()) { /* redirected */ }

let currentWeekStart = '2026-06-08';
let currentSchedWeekStart = '2026-06-08';
let currentTimetableWeekStart = '2026-06-08';
let adminSchedulesView = 'list';

function getSubjectBadgeClass(subject) {
    if (!subject) return 'level-custom';
    const subjUpper = subject.toUpperCase();
    if (subjUpper.startsWith('SD:')) return 'level-sd';
    if (subjUpper.startsWith('SMP:')) return 'level-smp';
    if (subjUpper.startsWith('SMA:')) return 'level-sma';
    if (subjUpper.startsWith('UTBK:')) return 'level-utbk';
    return 'level-custom';
}

// ── Page navigation ──
function switchPage(page) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-link, .nav-link').forEach(l => l.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.getElementById('sb-' + page)?.classList.add('active');

    if (page === 'overview')  renderOverview();
    if (page === 'schedules') setAdminSchedulesView(adminSchedulesView);
    if (page === 'timetable') renderTimetable();
    if (page === 'teachers')  renderTeacherMgmt();
}

function doLogout() {
    Session.clear();
    window.location.href = 'index.html';
}

async function resetData() {
    if (!confirm('Reset semua data ke default? Tindakan ini tidak bisa dibatalkan.')) return;
    localStorage.removeItem(BA_DB_KEY);
    DB._data = null;
    DB.load();
    showToast('Data berhasil di-reset ke default.', 'info');
    // Re-seed Firestore with defaults if connected
    if (typeof FireDB !== 'undefined') {
        const overlay = document.getElementById('fb-loading-overlay') || (() => {
            const el = document.createElement('div');
            el.id = 'fb-loading-overlay';
            el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg-main,#0f1117);display:flex;align-items:center;justify-content:center;';
            el.innerHTML = '<div style="color:#fff;font-weight:600;">🔄 Re-seed data ke Firestore…</div>';
            document.body.appendChild(el);
            return el;
        })();
        overlay.classList.remove('hidden');
        overlay.style.opacity = '1';
        try {
            await FireDB.pushLocalToFirestore();
        } finally {
            overlay.classList.add('hidden');
        }
    }
    renderAll();
}

// ── Toast ──
function showToast(msg, type = 'info', sub = '') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span>
                   <div><div class="toast-text">${msg}</div>${sub ? `<div class="toast-sub">${sub}</div>` : ''}</div>`;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// ── Modal ──
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    const form = document.querySelector(`#${id} form`);
    if (form) form.reset();
}
// Close on backdrop click
document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});

// ────────────────────────────────────────────────────────────────────
//  OVERVIEW TAB
// ────────────────────────────────────────────────────────────────────
function renderOverview() {
    renderStats();
    
    // Update active week range label
    const weekDates = getWeekDates(currentWeekStart);
    const startStr = formatDateIndo(weekDates[0]);
    const endStr = formatDateIndo(weekDates[5]);
    document.getElementById('admin-week-label').textContent = `${startStr} – ${endStr}`;
    
    renderOverviewTable();
    updatePendingBadge();
}

function changeAdminWeek(offset) {
    currentWeekStart = adjustDateDays(currentWeekStart, offset * 7);
    renderOverview();
}

function renderStats() {
    const teachers  = DB.getTeachers();
    const schedules = DB.getSchedules();
    const pending   = schedules.filter(s => s.status === 'pending').length;
    const approved  = schedules.filter(s => s.status === 'approved').length;

    const totalAvail = DB.getAllAvailability().length;

    document.getElementById('admin-stats').innerHTML = `
        <div class="stat-card">
            <div class="stat-icon stat-icon-red">👥</div>
            <div>
                <div class="stat-num">${teachers.length}</div>
                <div class="stat-label">Total Master Teacher</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon stat-icon-green">🟢</div>
            <div>
                <div class="stat-num">${totalAvail}</div>
                <div class="stat-label">Slot Tersedia</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon stat-icon-yellow">⏳</div>
            <div>
                <div class="stat-num">${pending}</div>
                <div class="stat-label">Jadwal Menunggu</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon stat-icon-blue">✅</div>
            <div>
                <div class="stat-num">${approved}</div>
                <div class="stat-label">Jadwal Disetujui</div>
            </div>
        </div>
    `;
}

function buildSchedChip(s) {
    const statusMap = {
        pending: { emoji: '⏳', label: 'Menunggu' },
        approved: { emoji: '✅', label: 'Disetujui' },
        rejected: { emoji: '❌', label: 'Ditolak' }
    };
    const stat = statusMap[s.status] || statusMap.pending;
    const rejectTooltip = s.status === 'rejected' && s.rejectReason ? ` data-tooltip="Alasan: ${s.rejectReason}"` : '';
    
    return `
    <div class="sched-chip ${s.status}"${rejectTooltip}>
        <div style="font-weight:800; display:flex; align-items:center; justify-content:space-between; width:100%; gap:4px;">
            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${stat.emoji} ${s.startTime}–${s.endTime} | ${s.subject}</span>
            <button class="sched-chip-delete-btn" onclick="event.stopPropagation(); deleteSchedule('${s.id}')" title="Hapus Jadwal">×</button>
        </div>
        <div class="sched-chip-meta">
            <span>🏫 ${s.room} · 👥 ${s.rombel}${s.ket ? ` · 🏷️ ${s.ket}` : ''}</span>
        </div>
    </div>`;
}

function renderOverviewTable() {
    const teachers = DB.getTeachers();
    const tbody    = document.getElementById('overview-tbody');

    if (!teachers.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:2rem;">
            Belum ada data Master Teacher.
        </td></tr>`;
        return;
    }

    const weekDates = getWeekDates(currentWeekStart);

    let html = '';
    teachers.forEach((t, ti) => {
        const avails    = DB.getAvailability(t.id);
        const schedules = DB.getSchedulesByTeacher(t.id);

        weekDates.forEach((dateStr, di) => {
            const dayName = getDayNameFromDate(dateStr);
            const formattedDate = formatDateIndo(dateStr);
            const dayLabel = `${dayName.toUpperCase()}<br><span style="font-size:0.65rem; font-weight:normal; color:var(--text-secondary);">${formattedDate.split(' ')[0]} ${formattedDate.split(' ')[1]}</span>`;

            const dayAvails = avails.filter(a => a.date === dateStr);
            const daySchedules = schedules.filter(s => s.date === dateStr);

            let chipsHtml = '';
            const renderedScheduleIds = new Set();

            dayAvails.forEach(a => {
                const matchingSched = daySchedules.find(
                    s => s.startTime === a.startTime && s.endTime === a.endTime && !renderedScheduleIds.has(s.id)
                );

                if (matchingSched) {
                    renderedScheduleIds.add(matchingSched.id);
                    chipsHtml += buildSchedChip(matchingSched);
                } else {
                    chipsHtml += `
                    <span class="avail-chip" onclick="quickAssign('${t.id}','${dateStr}','${a.subject}','${a.startTime}','${a.endTime}')" data-tooltip="Klik untuk assign jadwal">
                        ➕ ${a.startTime}–${a.endTime} | ${a.subject}
                    </span>`;
                }
            });

            daySchedules.forEach(s => {
                if (!renderedScheduleIds.has(s.id)) {
                    chipsHtml += buildSchedChip(s);
                }
            });

            if (!chipsHtml) {
                chipsHtml = '<span class="text-muted" style="font-size:.75rem;">–</span>';
            }

            if (di === 0) {
                // First row for this teacher: include name, profile, subjects
                html += `
                <tr class="teacher-first-row">
                    <td class="teacher-name-td" rowspan="${weekDates.length}" style="cursor:pointer;" onclick="viewAvailDetail('${t.id}')">
                        <div style="display:flex;align-items:center;gap:.6rem;">
                            <div style="width:34px;height:34px;border-radius:8px;background:${t.avatarBg};color:${t.avatarColor};
                                        display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.72rem;flex-shrink:0;">
                                ${t.name.split(' ').map(w => w[0]).join('').slice(0,2)}
                            </div>
                            <span>${t.name}</span>
                        </div>
                    </td>
                    <td rowspan="${weekDates.length}" class="subj-cell">${t.subjects.SD?.join(', ')||'–'}</td>
                    <td rowspan="${weekDates.length}" class="subj-cell">${t.subjects.SMP?.join(', ')||'–'}</td>
                    <td rowspan="${weekDates.length}" class="subj-cell">${t.subjects.SMA?.join(', ')||'–'}</td>
                    <td rowspan="${weekDates.length}" class="subj-cell">${t.subjects.UTBK?.join(', ')||'–'}</td>
                    <td class="day-td">${dayLabel}</td>
                    <td>
                        <div class="avail-chips-container">
                            ${chipsHtml}
                        </div>
                    </td>
                </tr>`;
            } else {
                // Subsequent rows: only day + availability chips
                html += `
                <tr>
                    <td class="day-td">${dayLabel}</td>
                    <td>
                        <div class="avail-chips-container">
                            ${chipsHtml}
                        </div>
                    </td>
                </tr>`;
            }
        });
    });

    tbody.innerHTML = html;
}

// Quick-assign shortcut from overview table
function quickAssign(teacherId, dateStr, subject, startTime, endTime) {
    populateAssignSelects();
    document.getElementById('assign-teacher').value = teacherId;
    document.getElementById('assign-date').value = dateStr;
    
    // Ensure the subject exists in the dropdown options
    const subjectEl = document.getElementById('assign-subject');
    let hasOption = false;
    for (let i = 0; i < subjectEl.options.length; i++) {
        if (subjectEl.options[i].value === subject) {
            hasOption = true;
            break;
        }
    }
    if (!hasOption && subject) {
        const opt = document.createElement('option');
        opt.value = subject;
        opt.textContent = subject;
        subjectEl.appendChild(opt);
    }
    subjectEl.value = subject;

    document.getElementById('assign-start-time').value = startTime;
    document.getElementById('assign-end-time').value = endTime;
    document.getElementById('assign-rombel').value = '';
    document.getElementById('assign-ket').value = '';
    document.getElementById('assign-notes').value = '';

    updateAvailHint();
    openModal('modal-assign');
    document.getElementById('assign-rombel').focus();
}

// View availability detail for a teacher
function viewAvailDetail(teacherId) {
    const teacher  = DB.getTeacher(teacherId);
    const avails   = DB.getAvailability(teacherId);
    const schedules = DB.getSchedulesByTeacher(teacherId);

    document.getElementById('avail-detail-name').textContent = `Ketersediaan: ${teacher.name}`;

    let html = `<div style="overflow-x:auto;">
        <table class="avail-detail-table">
            <thead><tr>
                <th style="text-align:left;">Tanggal / Hari</th>
                <th>Mata Pelajaran</th>
                <th>Ketersediaan Waktu</th>
                <th>Status Jadwal</th>
            </tr></thead>
            <tbody>`;

    if (!avails.length) {
        html += `<tr><td colspan="4" class="text-center text-muted" style="padding:1.5rem;">MT belum mengisi data ketersediaan.</td></tr>`;
    } else {
        const sorted = [...avails].sort((a,b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
        
        sorted.forEach(a => {
            const assigned = schedules.find(s => s.date === a.date && s.startTime === a.startTime && s.endTime === a.endTime);
            let statusText = '<span class="status-badge badge-approved" style="font-size:.68rem;">Tersedia</span>';
            if (assigned) {
                const statusLabel = assigned.status === 'pending' ? '⏳ Menunggu' : assigned.status === 'approved' ? '✅ Disetujui' : '❌ Ditolak';
                const badgeClass = assigned.status === 'pending' ? 'badge-pending' : assigned.status === 'approved' ? 'badge-approved' : 'badge-rejected';
                statusText = `<span class="status-badge ${badgeClass}" style="font-size:.68rem;">${statusLabel}<br>${assigned.rombel}</span>`;
            }
            const dayName = getDayNameFromDate(a.date);
            const dateFormatted = formatDateIndo(a.date);
            const badgeClass = getSubjectBadgeClass(a.subject);
            html += `
            <tr>
                <td style="font-weight:700;text-align:left;">
                    <div>${dayName}</div>
                    <div class="text-muted" style="font-size:0.75rem; font-weight:normal; margin-top:2px;">${dateFormatted}</div>
                </td>
                <td><span class="subject-tag ${badgeClass}">${a.subject}</span></td>
                <td><b>${a.startTime} – ${a.endTime}</b></td>
                <td>${statusText}</td>
            </tr>`;
        });
    }

    html += '</tbody></table></div>';
    html += `<div style="margin-top:1.25rem;display:flex;gap:.75rem;justify-content:flex-end;">
        <button class="btn btn-primary btn-sm" onclick="closeModal('modal-avail-detail');quickAssignByTeacher('${teacherId}')">
            ➕ Assign Jadwal Baru untuk MT ini
        </button>
    </div>`;

    document.getElementById('avail-detail-content').innerHTML = html;
    openModal('modal-avail-detail');
}

function quickAssignByTeacher(teacherId) {
    populateAssignSelects();
    document.getElementById('assign-teacher').value = teacherId;
    document.getElementById('assign-date').value = '';
    document.getElementById('assign-subject').value = '';
    document.getElementById('assign-start-time').value = '';
    document.getElementById('assign-end-time').value = '';
    document.getElementById('assign-rombel').value = '';
    document.getElementById('assign-ket').value = '';
    document.getElementById('assign-notes').value = '';

    updateAvailHint();
    openModal('modal-assign');
}

// Update pending badge
function updatePendingBadge() {
    const pending = DB.getSchedules().filter(s => s.status === 'pending').length;
    const badge = document.getElementById('sb-pending-badge');
    if (pending > 0) {
        badge.textContent = pending;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// ────────────────────────────────────────────────────────────────────
//  ASSIGN MODAL
// ────────────────────────────────────────────────────────────────────
function openAssignModal() {
    populateAssignSelects();
    document.getElementById('form-assign').reset();
    updateAvailHint();
    openModal('modal-assign');
}

function populateAssignTeacherSelect() {
    const sel = document.getElementById('assign-teacher');
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Pilih MT —</option>';
    DB.getTeachers().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
}

function populateAssignSelects() {
    populateAssignTeacherSelect();

    // Populate MAPEL
    const subSel = document.getElementById('assign-subject');
    if (subSel) {
        subSel.innerHTML = '<option value="">— Pilih Mapel —</option>';
        MAPEL_LIST.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            subSel.appendChild(opt);
        });
    }

    // Populate RUANGAN
    const roomSel = document.getElementById('assign-room');
    if (roomSel) {
        roomSel.innerHTML = '<option value="">— Pilih Ruangan —</option>';
        RUANGAN_LIST.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            roomSel.appendChild(opt);
        });
    }

    // Populate KELAS
    const rombelSel = document.getElementById('assign-rombel');
    if (rombelSel) {
        rombelSel.innerHTML = '<option value="">— Pilih Kelas —</option>';
        KELAS_LIST.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = k;
            rombelSel.appendChild(opt);
        });
    }

    // Populate KET
    const ketSel = document.getElementById('assign-ket');
    if (ketSel) {
        ketSel.innerHTML = '<option value="">— Pilih Keterangan —</option>';
        KET_LIST.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = k;
            ketSel.appendChild(opt);
        });
    }
}

function updateAvailHint() {
    const teacherId = document.getElementById('assign-teacher').value;
    const dateStr   = document.getElementById('assign-date').value;
    const hint      = document.getElementById('avail-hint');
    const hintText  = document.getElementById('avail-hint-text');

    if (!teacherId || !dateStr) { hint.classList.add('hidden'); return; }

    const avails  = DB.getAvailability(teacherId).filter(a => a.date === dateStr);
    const teacher = DB.getTeacher(teacherId);
    const dayName = getDayNameFromDate(dateStr);
    const dateFormatted = formatDateIndo(dateStr);

    if (avails.length) {
        hint.className = 'alert alert-success';
        const slotsStr = avails.map(a => `<b>${a.startTime}–${a.endTime}</b> (<span class="subject-tag ${getSubjectBadgeClass(a.subject)}" style="font-size:.7rem;padding:.1rem .4rem;">${a.subject}</span>)`).join(', ');
        hintText.innerHTML = `<b>${teacher.name}</b> tersedia <b>${dayName}, ${dateFormatted}</b>: ${slotsStr}`;
    } else {
        hint.className = 'alert alert-warning';
        hintText.innerHTML = `<b>${teacher.name}</b> <b>tidak</b> mengisi ketersediaan untuk tanggal <b>${dayName}, ${dateFormatted}</b>. Anda tetap bisa assign jadwal mengajar.`;
    }
    hint.classList.remove('hidden');
}

async function submitAssign(e) {
    e.preventDefault();
    const teacherId = document.getElementById('assign-teacher').value;
    const date      = document.getElementById('assign-date').value;
    const startTime = document.getElementById('assign-start-time').value;
    const endTime   = document.getElementById('assign-end-time').value;
    const room      = document.getElementById('assign-room').value;
    const subject   = document.getElementById('assign-subject').value.trim();
    const rombel    = document.getElementById('assign-rombel').value.trim();
    const ket       = document.getElementById('assign-ket').value;
    const notes     = document.getElementById('assign-notes').value.trim();

    const teacher = DB.getTeacher(teacherId);
    if (!teacher) return;

    if (startTime >= endTime) {
        showToast('Jam selesai harus setelah jam mulai.', 'warning');
        return;
    }

    const allSchedules = DB.getSchedules();
    const dayName = getDayNameFromDate(date);
    const conflicts = [];

    // 1. Check teacher time overlap
    const teacherConflict = allSchedules.find(
        s => s.teacherId === teacherId && s.date === date && (
            (startTime >= s.startTime && startTime < s.endTime) ||
            (endTime > s.startTime && endTime <= s.endTime) ||
            (startTime <= s.startTime && endTime >= s.endTime)
        )
    );
    if (teacherConflict) {
        conflicts.push(`⚠️ MT "${teacher.name}" sudah ada jadwal ${teacherConflict.startTime}–${teacherConflict.endTime} (${teacherConflict.rombel}) di waktu yang sama.`);
    }

    // 2. Check room conflict
    const roomRooms = room.split(',').map(r => r.trim());
    roomRooms.forEach(rm => {
        const roomConflict = allSchedules.find(
            s => s.date === date && s.room.split(',').map(r=>r.trim()).includes(rm) && (
                (startTime >= s.startTime && startTime < s.endTime) ||
                (endTime > s.startTime && endTime <= s.endTime) ||
                (startTime <= s.startTime && endTime >= s.endTime)
            )
        );
        if (roomConflict) {
            const conflictTeacher = DB.getTeacher(roomConflict.teacherId);
            conflicts.push(`🏫 Ruangan ${rm} sudah terpakai ${roomConflict.startTime}–${roomConflict.endTime} oleh ${conflictTeacher?.name || '?'} (${roomConflict.rombel}).`);
        }
    });

    // 3. Check rombel conflict
    if (rombel) {
        const rombelConflict = allSchedules.find(
            s => s.rombel === rombel && s.date === date && (
                (startTime >= s.startTime && startTime < s.endTime) ||
                (endTime > s.startTime && endTime <= s.endTime) ||
                (startTime <= s.startTime && endTime >= s.endTime)
            )
        );
        if (rombelConflict) {
            const conflictTeacher = DB.getTeacher(rombelConflict.teacherId);
            conflicts.push(`👥 Rombel "${rombel}" sudah ada jadwal ${rombelConflict.startTime}–${rombelConflict.endTime} dengan ${conflictTeacher?.name || '?'}.`);
        }
    }

    if (conflicts.length > 0) {
        const msg = '⚠️ TABRAKAN JADWAL TERDETEKSI!\n\n' + conflicts.join('\n') + '\n\nApakah Anda tetap ingin menyimpan jadwal ini?';
        if (!confirm(msg)) return;
    }

    await FireDB.addSchedule({ teacherId, date, startTime, endTime, room, subject, rombel, notes, ket });
    closeModal('modal-assign');
    showToast('Jadwal berhasil di-assign!', 'success', `${teacher.name} — ${dayName} ${formatDateIndo(date)}, ${startTime}–${endTime}`);
    renderAll();
}

// ────────────────────────────────────────────────────────────────────
//  SCHEDULES TAB
// ────────────────────────────────────────────────────────────────────
function setAdminSchedulesView(view) {
    adminSchedulesView = view;
    document.getElementById('btn-admin-view-list').classList.toggle('active', view === 'list');
    document.getElementById('btn-admin-view-grid').classList.toggle('active', view === 'grid');

    const listView = document.getElementById('admin-schedules-list-view');
    const gridView = document.getElementById('admin-schedules-grid-view');

    if (view === 'list') {
        listView.classList.remove('hidden');
        gridView.classList.add('hidden');
        populateSchedulesFilter();
        renderSchedulesList();
    } else {
        listView.classList.add('hidden');
        gridView.classList.remove('hidden');
        renderWeeklyGridSchedulesAdmin();
    }
}

function renderSchedulesList() {
    const filterTeacher = document.getElementById('filter-sched-teacher')?.value || '';
    const filterDay     = document.getElementById('filter-sched-day')?.value     || '';
    const filterStatus  = document.getElementById('filter-sched-status')?.value  || '';

    let list = DB.getSchedules();
    if (filterTeacher) list = list.filter(s => s.teacherId === filterTeacher);
    if (filterDay)     list = list.filter(s => getDayNameFromDate(s.date) === filterDay);
    if (filterStatus)  list = list.filter(s => s.status === filterStatus);

    const tbody = document.getElementById('schedules-tbody');

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding:2rem;">
            Tidak ada jadwal ditemukan.
        </td></tr>`;
        return;
    }

    list.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
    });

    tbody.innerHTML = list.map(s => {
        const t = DB.getTeacher(s.teacherId);
        const dayName = getDayNameFromDate(s.date);
        const dateFormatted = formatDateIndo(s.date);
        const badgeClass = getSubjectBadgeClass(s.subject);
        return `
        <tr>
            <td class="td-bold">${t ? t.name : '?'}</td>
            <td>
                <div style="font-weight:700;color:var(--text-primary);">${dayName}</div>
                <div style="font-size:.72rem;color:var(--text-secondary); margin-bottom:2px;">${dateFormatted}</div>
                <div style="font-size:.78rem;color:var(--text-secondary);">🕒 ${s.startTime} – ${s.endTime}</div>
            </td>
            <td><span class="subject-tag ${badgeClass}">${s.subject}</span></td>
            <td>${s.rombel}${s.ket ? ` <br><span style="font-size:.75rem;color:var(--text-secondary);font-weight:600;">🏷️ ${s.ket}</span>` : ''}</td>
            <td style="font-size:.8rem;">${s.room}</td>
            <td>${getStatusBadge(s.status)}</td>
            <td style="font-size:.78rem;color:var(--danger);max-width:120px;">
                ${s.rejectReason ? `"${s.rejectReason}"` : '<span class="text-muted">–</span>'}
            </td>
            <td>
                <div class="schedule-row-actions">
                    <button class="btn btn-icon btn-sm" title="Hapus jadwal ini"
                        onclick="deleteSchedule('${s.id}')">🗑️</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function renderWeeklyGridSchedulesAdmin() {
    const weekDates = getWeekDates(currentSchedWeekStart);

    // Update label
    const startStr = formatDateIndo(weekDates[0]);
    const endStr   = formatDateIndo(weekDates[5]);
    document.getElementById('admin-sched-week-label').textContent = `${startStr} – ${endStr}`;

    const board = document.getElementById('admin-schedules-weekly-board');
    board.innerHTML = '';

    const allSchedules = DB.getSchedules();
    const allTeachers  = DB.getTeachers();

    weekDates.forEach(dateStr => {
        const dayName      = getDayNameFromDate(dateStr);
        const dayFormatted = formatDateIndo(dateStr);

        const daySchedules = allSchedules.filter(s => s.date === dateStr);
        daySchedules.sort((a, b) => a.startTime.localeCompare(b.startTime));

        let cardsHTML = '';
        if (daySchedules.length === 0) {
            cardsHTML = `<div style="text-align:center; padding:2.5rem 0.5rem; color:var(--text-muted); font-size:0.75rem;">Tidak ada jadwal</div>`;
        } else {
            cardsHTML = daySchedules.map(s => {
                const t = allTeachers.find(x => x.id === s.teacherId);
                const initials = t ? t.name.split(' ').map(w => w[0]).join('').slice(0,2) : '?';
                const badgeClass = getSubjectBadgeClass(s.subject);
                const statusBadge = getStatusBadge(s.status);
                return `
                <div class="weekly-card ${s.status}">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                        <div style="width:24px;height:24px;border-radius:6px;background:${t?.avatarBg||'#eee'};color:${t?.avatarColor||'#333'};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.6rem;flex-shrink:0;">${initials}</div>
                        <div class="weekly-card-title" style="font-size:0.72rem;" title="${t?.name||'?'}">${t?.name||'?'}</div>
                    </div>
                    <span class="subject-tag ${badgeClass}" style="display:block; font-size:0.65rem; padding:1px 6px; margin-bottom:4px; text-align:center;">${s.subject}</span>
                    <div class="weekly-card-time">🕒 ${s.startTime} – ${s.endTime}</div>
                    <div class="weekly-card-meta">
                        👥 <b>${s.rombel}</b>${s.ket ? ` · <b>${s.ket}</b>` : ''}<br>
                        🏫 <b>${s.room}</b>
                    </div>
                    <div style="margin-top:4px;display:flex;align-items:center;justify-content:space-between;">
                        ${statusBadge}
                        <button class="btn btn-icon btn-sm" style="padding:1px 4px;font-size:.65rem;" onclick="deleteSchedule('${s.id}')" title="Hapus">🗑️</button>
                    </div>
                </div>`;
            }).join('');
        }

        board.innerHTML += `
        <div class="weekly-column">
            <div class="weekly-column-header">
                <div style="font-size:0.8rem;font-weight:800;">${dayName.toUpperCase()}</div>
                <div style="font-size:0.68rem;font-weight:600;color:var(--text-secondary);margin-top:2px;">
                    ${dayFormatted.split(' ')[0]} ${dayFormatted.split(' ')[1]}
                </div>
            </div>
            ${cardsHTML}
        </div>`;
    });
}

function changeAdminSchedWeek(offset) {
    currentSchedWeekStart = adjustDateDays(currentSchedWeekStart, offset * 7);
    renderWeeklyGridSchedulesAdmin();
}

function populateSchedulesFilter() {
    const sel = document.getElementById('filter-sched-teacher');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Semua MT</option>';
    DB.getTeachers().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
}

async function deleteSchedule(id) {
    if (!confirm('Hapus jadwal ini?')) return;
    await FireDB.deleteSchedule(id);
    showToast('Jadwal dihapus.', 'info');
    renderAll();
}

// ────────────────────────────────────────────────────────────────────
//  TEACHER MANAGEMENT TAB
// ────────────────────────────────────────────────────────────────────
function renderTeacherMgmt() {
    const grid = document.getElementById('teacher-mgmt-grid');
    const teachers = DB.getTeachers();

    if (!teachers.length) {
        grid.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div>
            <div class="empty-title">Belum ada Master Teacher</div>
            <div class="empty-desc">Klik "Tambah MT Baru" untuk mulai.</div></div>`;
        return;
    }

    grid.innerHTML = teachers.map(t => {
        const initials = t.name.split(' ').map(w => w[0]).join('').slice(0, 2);
        const schedCount = DB.getSchedulesByTeacher(t.id).length;
        const subjLines = Object.entries(t.subjects)
            .filter(([, arr]) => arr.length)
            .map(([level, arr]) => {
                const badgeClass = { SD: 'level-sd', SMP: 'level-smp', SMA: 'level-sma', UTBK: 'level-utbk' }[level] || 'level-custom';
                return `<span class="subject-tag ${badgeClass}">${level}: ${arr.join(', ')}</span>`;
            })
            .join('');

        return `
        <div class="teacher-mgmt-card">
            <div class="teacher-mgmt-head">
                <div class="teacher-big-avatar" style="background:${t.avatarBg};color:${t.avatarColor};">${initials}</div>
                <div>
                    <div class="teacher-mgmt-name">${t.name}</div>
                    <div class="teacher-mgmt-email">${t.email || '—'}</div>
                </div>
            </div>
            <div class="subject-tags">${subjLines || '<span class="text-muted" style="font-size:.78rem;">Belum ada mata pelajaran</span>'}</div>
            <div style="font-size:.78rem;color:var(--text-secondary);">
                📋 ${schedCount} jadwal &nbsp;·&nbsp; PIN: ****
            </div>
            <div class="teacher-mgmt-actions">
                <button class="btn btn-secondary btn-sm" onclick="viewAvailDetail('${t.id}')">🗓️ Availability</button>
                <button class="btn btn-secondary btn-sm" onclick="editTeacher('${t.id}')">✏️ Edit</button>
                <button class="btn btn-icon btn-sm" onclick="deleteTeacher('${t.id}')" title="Hapus MT">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

function openAddTeacherModal() {
    document.getElementById('modal-teacher-title').textContent = 'Tambah Master Teacher Baru';
    document.getElementById('btn-save-teacher').textContent = '💾 Simpan';
    document.getElementById('edit-teacher-id').value = '';
    document.getElementById('form-teacher').reset();
    openModal('modal-teacher');
}

function editTeacher(id) {
    const t = DB.getTeacher(id);
    if (!t) return;
    document.getElementById('modal-teacher-title').textContent = 'Edit Master Teacher';
    document.getElementById('btn-save-teacher').textContent = '💾 Perbarui';
    document.getElementById('edit-teacher-id').value = t.id;
    document.getElementById('mt-name').value  = t.name;
    document.getElementById('mt-email').value = t.email || '';
    document.getElementById('mt-pin').value   = t.pin;
    document.getElementById('mt-subj-sd').value   = (t.subjects.SD   || []).join(', ');
    document.getElementById('mt-subj-smp').value  = (t.subjects.SMP  || []).join(', ');
    document.getElementById('mt-subj-sma').value  = (t.subjects.SMA  || []).join(', ');
    document.getElementById('mt-subj-utbk').value = (t.subjects.UTBK || []).join(', ');
    openModal('modal-teacher');
}

async function submitTeacherForm(e) {
    e.preventDefault();
    const id    = document.getElementById('edit-teacher-id').value;
    const name  = document.getElementById('mt-name').value.trim().toUpperCase();
    const email = document.getElementById('mt-email').value.trim() || '-';
    const pin   = document.getElementById('mt-pin').value.trim();

    const parseSubs = val => val.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const subjects  = {
        SD:   parseSubs(document.getElementById('mt-subj-sd').value),
        SMP:  parseSubs(document.getElementById('mt-subj-smp').value),
        SMA:  parseSubs(document.getElementById('mt-subj-sma').value),
        UTBK: parseSubs(document.getElementById('mt-subj-utbk').value),
    };

    const COLORS = ['#FFF3CD|#856404','#F8D7DA|#842029','#D1ECF1|#0c5460','#D4EDDA|#155724','#E8D5F5|#5b21b6'];
    const rnd    = COLORS[Math.floor(Math.random() * COLORS.length)].split('|');

    if (id) {
        // Edit existing
        const existing = DB.getTeacher(id);
        await FireDB.saveTeacher({ ...existing, name, email, pin, subjects });
        showToast('Data MT berhasil diperbarui.', 'success');
    } else {
        // Add new
        await FireDB.addTeacher({ name, email, pin, subjects, avatarBg: rnd[0], avatarColor: rnd[1] });
        showToast('Master Teacher baru berhasil ditambahkan!', 'success');
    }

    closeModal('modal-teacher');
    renderAll();
}

async function deleteTeacher(id) {
    const t = DB.getTeacher(id);
    if (!t) return;
    if (!confirm(`Hapus "${t.name}"? Semua data availability & jadwal terkait juga akan terhapus.`)) return;
    await FireDB.deleteTeacher(id);
    showToast(`${t.name} dihapus.`, 'info');
    renderAll();
}

// ────────────────────────────────────────────────────────────────────
//  TIMETABLE (PETA JADWAL KELAS)
// ────────────────────────────────────────────────────────────────────
function changeTimetableWeek(offset) {
    currentTimetableWeekStart = adjustDateDays(currentTimetableWeekStart, offset * 7);
    renderTimetable();
}

function getRombelLevelClass(rombel) {
    const r = rombel.toUpperCase();
    if (r.startsWith('MC'))    return 'tt-level-mc';
    if (r.includes('SD'))      return 'tt-level-sd';
    if (r.includes('SMP'))     return 'tt-level-smp';
    if (r.includes('SNBT'))    return 'tt-level-snbt';
    if (r.includes('SMA'))     return 'tt-level-sma';
    return '';
}

function renderTimetable() {
    const weekDates = getWeekDates(currentTimetableWeekStart);
    const dayNames = weekDates.map(d => getDayNameFromDate(d));

    // Update week label
    const startStr = formatDateIndo(weekDates[0]);
    const endStr = formatDateIndo(weekDates[5]);
    const weekLabel = document.getElementById('timetable-week-label');
    if (weekLabel) weekLabel.textContent = `${startStr} – ${endStr}`;

    // Populate room filter
    const roomFilter = document.getElementById('filter-timetable-room');
    const curRoom = roomFilter?.value || '';
    if (roomFilter) {
        roomFilter.innerHTML = '<option value="">Semua Ruangan</option>';
        RUANGAN_LIST.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r; opt.textContent = 'Ruangan ' + r;
            roomFilter.appendChild(opt);
        });
        roomFilter.value = curRoom;
    }

    const allSchedules = DB.getSchedules();
    const allTeachers  = DB.getTeachers();

    // Filter templates by room
    let templates = CLASS_SCHEDULE_TEMPLATES;
    if (curRoom) {
        templates = templates.filter(t => t.room.split(',').map(r=>r.trim()).includes(curRoom));
    }

    const tbody = document.getElementById('timetable-tbody');
    let html = '';
    const conflicts = [];

    templates.forEach((tmpl, tmplIdx) => {
        const levelClass = getRombelLevelClass(tmpl.rombel);
        const totalRows = tmpl.sessions.length;
        const daysStr = tmpl.days.join(', ');
        const timesStr = tmpl.sessions.map(s => `${s.start}–${s.end}`).join('<br>');

        tmpl.sessions.forEach((session, sIdx) => {
            html += '<tr>';

            // Rombel cell (only first session row)
            if (sIdx === 0) {
                html += `<td class="tt-rombel-cell ${levelClass}" rowspan="${totalRows}">${tmpl.rombel}</td>`;
                html += `<td rowspan="${totalRows}" style="font-size:.72rem;font-weight:600;color:var(--text-secondary);">${daysStr}</td>`;
                html += `<td rowspan="${totalRows}" style="font-size:.72rem;font-weight:600;">${timesStr}</td>`;
                html += `<td rowspan="${totalRows}" style="font-weight:700;">${tmpl.room}</td>`;
            }

            // Day cells (6 days: Senin–Sabtu)
            const dayOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            dayOrder.forEach((day, dayIdx) => {
                const dateStr = weekDates[dayIdx];
                const isActiveDay = tmpl.days.includes(day);

                if (!isActiveDay) {
                    html += '<td class="tt-day-cell"><span class="tt-slot-empty">–</span></td>';
                    return;
                }

                // Find matching schedule
                const matchedScheds = allSchedules.filter(
                    s => s.date === dateStr && s.rombel === tmpl.rombel &&
                         s.startTime === session.start && s.endTime === session.end
                );

                if (matchedScheds.length > 0) {
                    const s = matchedScheds[0];
                    const t = allTeachers.find(x => x.id === s.teacherId);
                    const statusClass = s.status === 'approved' ? 'tt-slot-approved' :
                                       s.status === 'rejected' ? 'tt-slot-rejected' : 'tt-slot-pending';

                    // Check room conflict for this slot
                    const roomConflicts = allSchedules.filter(
                        other => other.id !== s.id && other.date === dateStr &&
                            other.room.split(',').some(r => s.room.split(',').map(rr=>rr.trim()).includes(r.trim())) &&
                            ((other.startTime >= s.startTime && other.startTime < s.endTime) ||
                             (other.endTime > s.startTime && other.endTime <= s.endTime) ||
                             (other.startTime <= s.startTime && other.endTime >= s.endTime))
                    );
                    const hasConflict = roomConflicts.length > 0;
                    const conflictClass = hasConflict ? ' tt-slot-conflict' : '';

                    if (hasConflict) {
                        roomConflicts.forEach(rc => {
                            const rcTeacher = allTeachers.find(x => x.id === rc.teacherId);
                            const key = [s.id, rc.id].sort().join('-');
                            if (!conflicts.find(c => c.key === key)) {
                                conflicts.push({
                                    key,
                                    text: `<b>${day} ${formatDateIndo(dateStr)}</b>: Ruangan <b>${s.room}</b> — "<b>${s.rombel}</b>" (${s.startTime}–${s.endTime}, ${t?.name||'?'}) bentrok dengan "<b>${rc.rombel}</b>" (${rc.startTime}–${rc.endTime}, ${rcTeacher?.name||'?'})`
                                });
                            }
                        });
                    }

                    html += `<td class="tt-day-cell">
                        <div class="tt-slot-chip tt-slot-assigned ${statusClass}${conflictClass}" title="${t?.name||'?'} • ${s.subject}">
                            <span class="tt-chip-teacher">${t?.name||'?'}</span>
                            <span style="font-size:.6rem;">${s.subject || '–'}</span>
                            ${hasConflict ? '<span style="font-size:.6rem;color:#ef4444;">⚠️ Bentrok!</span>' : ''}
                        </div>
                    </td>`;
                } else {
                    // Empty assignable slot
                    html += `<td class="tt-day-cell">
                        <div class="tt-slot-chip" onclick="quickAssignFromTemplate('${tmpl.rombel}','${dateStr}','${session.start}','${session.end}','${tmpl.room}')" title="Klik untuk assign MT">
                            ➕ Assign
                            <span class="tt-chip-label">${session.start}–${session.end}</span>
                        </div>
                    </td>`;
                }
            });

            html += '</tr>';
        });

        // Separator between rombels
        if (tmplIdx < templates.length - 1) {
            html += '<tr class="tt-separator-row"><td colspan="10"></td></tr>';
        }
    });

    if (!templates.length) {
        html = '<tr><td colspan="10" class="text-center text-muted" style="padding:2rem;">Tidak ada template jadwal untuk filter ini.</td></tr>';
    }

    tbody.innerHTML = html;

    // Render conflict alerts
    const alertContainer = document.getElementById('conflict-alerts');
    if (conflicts.length > 0) {
        alertContainer.innerHTML = conflicts.map(c => `
            <div class="conflict-alert-card">
                <span class="conflict-icon">⚠️</span>
                <div class="conflict-text">${c.text}</div>
            </div>
        `).join('');
    } else {
        alertContainer.innerHTML = '';
    }
}

function quickAssignFromTemplate(rombel, dateStr, startTime, endTime, room) {
    populateAssignSelects();
    document.getElementById('assign-teacher').value = '';
    document.getElementById('assign-date').value = dateStr;
    document.getElementById('assign-start-time').value = startTime;
    document.getElementById('assign-end-time').value = endTime;
    document.getElementById('assign-rombel').value = rombel;
    document.getElementById('assign-ket').value = '';
    document.getElementById('assign-notes').value = '';

    // Set room (pick first if multi-room)
    const roomSel = document.getElementById('assign-room');
    const firstRoom = room.split(',')[0].trim();
    roomSel.value = firstRoom;

    // Auto-detect subject based on rombel level
    document.getElementById('assign-subject').value = '';

    updateAvailHint();
    openModal('modal-assign');
    document.getElementById('assign-teacher').focus();
}

// ────────────────────────────────────────────────────────────────────
//  RENDER ALL
// ────────────────────────────────────────────────────────────────────
function renderAll() {
    renderOverview();
    setAdminSchedulesView(adminSchedulesView);
    renderTeacherMgmt();
    populateSchedulesFilter();
    // Render timetable if visible
    if (document.getElementById('page-timetable')?.classList.contains('active')) {
        renderTimetable();
    }
}

// ── Firebase-aware Init ──
(async function init() {
    // Set default date for assign-date to today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const dateEl = document.getElementById('assign-date');
    if (dateEl) dateEl.value = todayStr;

    // Set timetable week to current week's Monday
    const dayOfWeek = today.getDay(); // 0=Sun,1=Mon...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    currentTimetableWeekStart = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;

    // ── Firebase: wait for init then sync Firestore → localStorage ──
    const overlay = document.getElementById('fb-loading-overlay');
    const fbLabel = document.getElementById('fb-status-label');
    try {
        if (typeof window.firebaseReady !== 'undefined') {
            await window.firebaseReady;
            await FireDB.seedIfEmpty();
            await FireDB.syncToLocal();
            if (fbLabel) fbLabel.textContent = 'Firebase ✅';
        } else {
            if (fbLabel) fbLabel.textContent = 'Mode Lokal';
        }
    } catch (e) {
        console.warn('[Admin] Firebase init error, using local data.', e);
        if (fbLabel) fbLabel.textContent = 'Mode Lokal ⚠️';
    } finally {
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => overlay.remove(), 500);
        }
    }

    renderAll();
    populateSchedulesFilter();
})();

// ── Firebase Push Helper ──
async function pushToFirebase() {
    if (typeof FireDB === 'undefined' || !await FireDB.isReady()) {
        showToast('Firebase tidak terhubung. Periksa firebase-config.js', 'warning');
        return;
    }
    if (!confirm('Upload semua data lokal ke Firebase Firestore?\nData di Firestore akan ditimpa dengan data lokal saat ini.')) return;
    await FireDB.pushLocalToFirestore();
    showToast('Data berhasil diupload ke Firebase!', 'success');
}

