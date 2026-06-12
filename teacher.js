/* ==========================================================================
   TEACHER PORTAL LOGIC — BRAIN ACADEMIA PINRANG
   ========================================================================== */

// ── Auth Guard ──
const teacherId = Session.requireTeacher();
if (!teacherId) { /* redirected */ }

let teacher = null;
let currentFilter = 'all';
let activeView = 'list';
let currentWeekStart = '2026-06-08';

function getSubjectBadgeClass(subject) {
    if (!subject) return 'level-custom';
    const subjUpper = subject.toUpperCase();
    if (subjUpper.startsWith('SD:')) return 'level-sd';
    if (subjUpper.startsWith('SMP:')) return 'level-smp';
    if (subjUpper.startsWith('SMA:')) return 'level-sma';
    if (subjUpper.startsWith('UTBK:')) return 'level-utbk';
    return 'level-custom';
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
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    const form = document.querySelector(`#${id} form`);
    if (form) form.reset();
}
document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});

// ── Logout ──
function doLogout() {
    Session.clear();
    window.location.href = 'index.html';
}

// ── Page Navigation ──
function switchPage(page) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-link, .nav-link, .bottom-nav-item').forEach(l => l.classList.remove('active'));

    document.getElementById('page-' + page).classList.add('active');
    document.getElementById('sb-' + page)?.classList.add('active');
    document.getElementById('bn-' + page)?.classList.add('active');

    if (page === 'dashboard')    renderDashboard();
    if (page === 'availability') renderAvailabilityList();
    if (page === 'myschedules')  renderMySchedules();
}

// ────────────────────────────────────────────────────────────────────
//  INIT
// ────────────────────────────────────────────────────────────────────
async function init() {
    // ── Firebase: wait for init then sync Firestore → localStorage ──
    const overlay = document.getElementById('fb-loading-overlay');
    try {
        if (typeof window.firebaseReady !== 'undefined') {
            await window.firebaseReady;
            await FireDB.syncToLocal();
        }
    } catch (e) {
        console.warn('[Teacher] Firebase init error, using local data.', e);
    } finally {
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => overlay.remove(), 500);
        }
    }

    teacher = DB.getTeacher(teacherId);
    if (!teacher) { doLogout(); return; }

    // Header
    const initials = teacher.name.split(' ').map(w => w[0]).join('').slice(0, 2);
    document.getElementById('header-avatar').textContent = initials;
    document.getElementById('header-name').textContent   = teacher.name;

    renderDashboard();
    updatePendingBadges();
}

// ────────────────────────────────────────────────────────────────────
//  DASHBOARD
// ────────────────────────────────────────────────────────────────────
function renderDashboard() {
    renderProfileCard();
    renderTeacherStats();
    renderPendingNotifSection();
    renderDashSchedules();
    updatePendingBadges();
}

// Subjects tags
function renderProfileCard() {
    const initials = teacher.name.split(' ').map(w => w[0]).join('').slice(0, 2);
    document.getElementById('dash-avatar').textContent = initials;
    document.getElementById('dash-name').textContent   = teacher.name;

    const subjContainer = document.getElementById('dash-subjects');
    const allSubjs = Object.entries(teacher.subjects)
        .filter(([, arr]) => arr.length)
        .flatMap(([level, arr]) => arr.map(s => `${level}: ${s}`));

    subjContainer.innerHTML = allSubjs.slice(0, 6).map(s =>
        `<span class="profile-subj-tag">${s}</span>`
    ).join('') + (allSubjs.length > 6 ? `<span class="profile-subj-tag">+${allSubjs.length - 6}</span>` : '');
}

function renderTeacherStats() {
    const schedules = DB.getSchedulesByTeacher(teacherId);
    const pending   = schedules.filter(s => s.status === 'pending').length;
    const approved  = schedules.filter(s => s.status === 'approved').length;

    const avails    = DB.getAvailability(teacherId);
    const totalAvail = avails.length;

    document.getElementById('teacher-stats').innerHTML = `
        <div class="stat-card" style="cursor:pointer;" onclick="switchPage('availability')">
            <div class="stat-icon stat-icon-green">🟢</div>
            <div>
                <div class="stat-num">${totalAvail}</div>
                <div class="stat-label">Slot Tersedia</div>
            </div>
        </div>
        <div class="stat-card" style="cursor:pointer;" onclick="switchPage('myschedules')">
            <div class="stat-icon stat-icon-yellow">⏳</div>
            <div>
                <div class="stat-num" style="${pending ? 'color:var(--ba-red);' : ''}">${pending}</div>
                <div class="stat-label">Menunggu Konfirmasi</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon stat-icon-blue">✅</div>
            <div>
                <div class="stat-num">${approved}</div>
                <div class="stat-label">Jadwal Disetujui</div>
            </div>
        </div>
        <div class="stat-card" style="cursor:pointer;" onclick="switchPage('availability')">
            <div class="stat-icon stat-icon-red">🗓️</div>
            <div>
                <div class="stat-num" style="font-size:1.1rem;">Atur</div>
                <div class="stat-label">Ketersediaan Saya</div>
            </div>
        </div>
    `;
}

function renderPendingNotifSection() {
    const pending = DB.getSchedulesByTeacher(teacherId).filter(s => s.status === 'pending');
    const sec = document.getElementById('pending-notif-section');

    if (!pending.length) {
        sec.innerHTML = '';
        return;
    }

    sec.innerHTML = `
        <div class="alert alert-warning" style="cursor:pointer;" onclick="switchPage('myschedules');filterSchedules('pending');">
            <span class="alert-icon">🔔</span>
            <div>
                <b>Ada ${pending.length} jadwal menunggu konfirmasi Anda!</b><br>
                <span style="font-size:.82rem;">Harap segera approve atau reject jadwal yang telah di-assign admin.</span>
            </div>
        </div>`;
}

function renderDashSchedules() {
    const schedules = DB.getSchedulesByTeacher(teacherId);
    const container = document.getElementById('dash-recent-schedules');

    if (!schedules.length) {
        container.innerHTML = `<div class="empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-title">Belum ada jadwal yang di-assign</div>
            <div class="empty-desc">Admin belum mengassign jadwal kepada Anda.</div>
        </div>`;
        return;
    }

    const sorted = [...schedules].sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
    });

    container.innerHTML = sorted.slice(0, 4).map(s => buildSchedCard(s, true)).join('');
    if (schedules.length > 4) {
        container.innerHTML += `<div style="text-align:center;margin-top:1rem;">
            <button class="btn btn-outline" onclick="switchPage('myschedules')">
                Lihat semua jadwal (${schedules.length}) →
            </button>
        </div>`;
    }
}

// ────────────────────────────────────────────────────────────────────
//  AVAILABILITY REDESIGNED LIST & MODAL
// ────────────────────────────────────────────────────────────────────
function renderAvailabilityList() {
    const tbody = document.getElementById('avail-list-tbody');
    const list = DB.getAvailability(teacherId);

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding:2rem;">
            Belum ada data ketersediaan mengajar yang didaftarkan.
        </td></tr>`;
        return;
    }

    // Sort by date then start time
    list.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    tbody.innerHTML = list.map(item => {
        const dayName = getDayNameFromDate(item.date);
        const formattedDate = formatDateIndo(item.date);
        return `
        <tr>
            <td class="td-bold">
                <div>${dayName}</div>
                <div class="text-muted" style="font-size:0.75rem; font-weight:normal; margin-top:2px;">${formattedDate}</div>
            </td>
            <td><span class="subject-tag ${getSubjectBadgeClass(item.subject)}">${item.subject}</span></td>
            <td>🕒 <b>${item.startTime} – ${item.endTime}</b></td>
            <td style="text-align: center;">
                <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger-light);" onclick="deleteAvailability('${item.id}')">
                    🗑️ Hapus
                </button>
            </td>
        </tr>`;
    }).join('');
}

function openAddAvailModal() {
    const sel = document.getElementById('avail-subject-select');
    sel.innerHTML = '<option value="">— Pilih Mata Pelajaran —</option>';
    
    Object.entries(teacher.subjects).forEach(([level, subjs]) => {
        if (subjs && subjs.length) {
            subjs.forEach(s => {
                const opt = document.createElement('option');
                opt.value = `${level}: ${s}`;
                opt.textContent = `${level}: ${s}`;
                sel.appendChild(opt);
            });
        }
    });

    const optCustom = document.createElement('option');
    optCustom.value = 'custom';
    optCustom.textContent = 'Lainnya (Tulis Manual)';
    sel.appendChild(optCustom);

    document.getElementById('form-avail').reset();
    
    // Set default value of date picker to today's date
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('avail-date').value = `${yyyy}-${mm}-${dd}`;

    document.getElementById('avail-custom-subject-wrapper').classList.add('hidden');
    document.getElementById('avail-custom-subject').required = false;

    openModal('modal-avail');
}

function toggleCustomSubject() {
    const selectVal = document.getElementById('avail-subject-select').value;
    const customWrapper = document.getElementById('avail-custom-subject-wrapper');
    const customInput = document.getElementById('avail-custom-subject');

    if (selectVal === 'custom') {
        customWrapper.classList.remove('hidden');
        customInput.required = true;
        customInput.focus();
    } else {
        customWrapper.classList.add('hidden');
        customInput.required = false;
    }
}

async function submitAvailabilityForm(e) {
    e.preventDefault();
    const date = document.getElementById('avail-date').value;
    const selectVal = document.getElementById('avail-subject-select').value;
    let subject = selectVal;
    
    if (selectVal === 'custom') {
        subject = document.getElementById('avail-custom-subject').value.trim();
        if (!subject) {
            showToast('Harap tulis mata pelajaran kustom.', 'warning');
            return;
        }
    }

    const startTime = document.getElementById('avail-start').value;
    const endTime = document.getElementById('avail-end').value;

    if (startTime >= endTime) {
        showToast('Jam selesai harus setelah jam mulai.', 'warning');
        return;
    }

    await FireDB.addAvailability(teacherId, { date, subject, startTime, endTime });
    closeModal('modal-avail');
    showToast('Ketersediaan berhasil disimpan!', 'success');
    renderAvailabilityList();
}

async function deleteAvailability(id) {
    if (!confirm('Hapus ketersediaan ini? Admin tidak akan bisa mengassign jadwal di waktu ini.')) return;
    await FireDB.deleteAvailability(id);
    showToast('Ketersediaan berhasil dihapus.', 'info');
    renderAvailabilityList();
}

// ────────────────────────────────────────────────────────────────────
//  MY SCHEDULES
// ────────────────────────────────────────────────────────────────────
function renderMySchedules() {
    const all     = DB.getSchedulesByTeacher(teacherId);
    const pending = all.filter(s => s.status === 'pending').length;

    const cnt = document.getElementById('tab-pending-count');
    if (pending > 0) {
        cnt.textContent = pending;
        cnt.style.display = 'inline-flex';
    } else {
        cnt.style.display = 'none';
    }

    setSchedulesView(activeView);
}

function setSchedulesView(view) {
    activeView = view;
    document.getElementById('btn-view-list').classList.toggle('active', view === 'list');
    document.getElementById('btn-view-grid').classList.toggle('active', view === 'grid');
    
    const listView = document.getElementById('schedules-list-view');
    const gridView = document.getElementById('schedules-grid-view');
    const tabsBar = document.querySelector('#page-myschedules .tabs-bar');
    
    if (view === 'list') {
        listView.classList.remove('hidden');
        gridView.classList.add('hidden');
        tabsBar.classList.remove('hidden');
        filterSchedules(currentFilter);
    } else {
        listView.classList.add('hidden');
        gridView.classList.remove('hidden');
        tabsBar.classList.add('hidden');
        renderWeeklyGridSchedules();
    }
}

function filterSchedules(filter) {
    currentFilter = filter;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + filter).classList.add('active');

    let list = DB.getSchedulesByTeacher(teacherId);
    if (filter !== 'all') list = list.filter(s => s.status === filter);

    list.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
    });

    const container = document.getElementById('schedules-list-container');

    if (!list.length) {
        container.innerHTML = `<div class="empty-state">
            <div class="empty-icon">${filter === 'pending' ? '⏳' : filter === 'approved' ? '✅' : filter === 'rejected' ? '❌' : '📋'}</div>
            <div class="empty-title">Tidak ada jadwal ${filter === 'all' ? '' : filter === 'pending' ? 'yang menunggu' : filter === 'approved' ? 'yang disetujui' : 'yang ditolak'}</div>
            <div class="empty-desc">Admin belum mengassign jadwal${filter !== 'all' ? ' dengan status ini' : ''} kepada Anda.</div>
        </div>`;
        return;
    }

    container.innerHTML = list.map(s => buildSchedCard(s, false)).join('');
}

function buildSchedCard(s, compact) {
    const actions = s.status === 'pending' ? `
        <div class="sched-card-actions">
            <button class="btn btn-success btn-sm" onclick="approveSchedule('${s.id}')">
                ✅ Setujui
            </button>
            <button class="btn btn-danger btn-sm" onclick="openRejectModal('${s.id}')">
                ❌ Tolak
            </button>
        </div>` : s.status === 'rejected' && s.rejectReason ? `
        <div style="font-size:.78rem;color:var(--danger);margin-top:.25rem;font-weight:600;">
            Alasan penolakan: "${s.rejectReason}"
        </div>` : '';

    const badgeClass = getSubjectBadgeClass(s.subject);
    const dayName = getDayNameFromDate(s.date);
    const formattedDate = formatDateIndo(s.date);

    return `
    <div class="sched-card ${s.status}">
        <div class="sched-card-head">
            <div>
                <div class="sched-card-title">
                    <span class="subject-tag ${badgeClass}" style="margin-right:0.5rem;">${s.subject}</span>
                    — Rombel: <b>${s.rombel}</b>
                </div>
                <div class="sched-card-meta" style="margin-top: 0.5rem;">
                    📅 <b>${dayName}, ${formattedDate}</b> · 🕒 <b>${s.startTime} – ${s.endTime}</b> · 🏫 Ruangan: <b>${s.room}</b>${s.ket ? ` · Keterangan: <b>${s.ket}</b>` : ''}
                </div>
            </div>
            ${getStatusBadge(s.status)}
        </div>
        ${s.notes ? `<div class="sched-card-body" style="padding:.5rem; background:var(--bg-sidebar); border-radius:6px; border-left:3px solid var(--info); margin-top:0.5rem;">📝 Catatan Admin: ${s.notes}</div>` : ''}
        ${actions}
    </div>`;
}

function renderWeeklyGridSchedules() {
    const weekDates = getWeekDates(currentWeekStart);
    
    // Update label
    const startStr = formatDateIndo(weekDates[0]);
    const endStr = formatDateIndo(weekDates[5]);
    document.getElementById('teacher-week-label').textContent = `${startStr} – ${endStr}`;
    
    const board = document.getElementById('schedules-weekly-board');
    board.innerHTML = '';
    
    const allSchedules = DB.getSchedulesByTeacher(teacherId);
    
    weekDates.forEach(dateStr => {
        const dayName = getDayNameFromDate(dateStr);
        const dayFormatted = formatDateIndo(dateStr);
        
        // Filter schedules for this date
        const daySchedules = allSchedules.filter(s => s.date === dateStr);
        daySchedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
        
        let cardsHTML = '';
        if (daySchedules.length === 0) {
            cardsHTML = `<div style="text-align:center; padding:2.5rem 0.5rem; color:var(--text-muted); font-size:0.75rem;">Tidak ada jadwal</div>`;
        } else {
            cardsHTML = daySchedules.map(s => {
                const badgeClass = getSubjectBadgeClass(s.subject);
                const statusBadge = getStatusBadge(s.status);
                
                const actions = s.status === 'pending' ? `
                    <div style="display:flex; gap:4px; margin-top:6px;">
                        <button class="btn btn-success btn-sm btn-block" style="padding: 2px 4px; font-size: 0.65rem;" onclick="approveSchedule('${s.id}')">Setuju</button>
                        <button class="btn btn-danger btn-sm btn-block" style="padding: 2px 4px; font-size: 0.65rem;" onclick="openRejectModal('${s.id}')">Tolak</button>
                    </div>` : s.status === 'rejected' && s.rejectReason ? `
                    <div style="font-size:0.65rem; color:var(--danger); font-weight:600; margin-top:4px; line-height:1.2;">
                        Alasan: "${s.rejectReason}"
                    </div>` : '';
                
                return `
                <div class="weekly-card ${s.status}">
                    <div class="weekly-card-title" title="${s.subject}">
                        <span class="subject-tag ${badgeClass}" style="display:inline-block; font-size:0.65rem; padding:1px 6px; margin-bottom:2px; width:100%; text-align:center;">${s.subject}</span>
                    </div>
                    <div class="weekly-card-time">🕒 ${s.startTime} – ${s.endTime}</div>
                    <div class="weekly-card-meta">
                        👥 Rombel: <b>${s.rombel}</b>${s.ket ? ` · <b>${s.ket}</b>` : ''}<br>
                        🏫 Ruang: <b>${s.room}</b>
                    </div>
                    <div style="margin-top: 4px; display: flex; align-items: center; justify-content: space-between;">
                        ${statusBadge}
                    </div>
                    ${actions}
                </div>`;
            }).join('');
        }
        
        const columnHTML = `
            <div class="weekly-column">
                <div class="weekly-column-header">
                    <div style="font-size: 0.8rem; font-weight: 800;">${dayName.toUpperCase()}</div>
                    <div style="font-size: 0.68rem; font-weight: 600; color: var(--text-secondary); margin-top: 2px;">
                        ${dayFormatted.split(' ')[0]} ${dayFormatted.split(' ')[1]}
                    </div>
                </div>
                ${cardsHTML}
            </div>
        `;
        board.innerHTML += columnHTML;
    });
}

function changeTeacherWeek(offset) {
    currentWeekStart = adjustDateDays(currentWeekStart, offset * 7);
    renderWeeklyGridSchedules();
}

// ── Approve / Reject ──
async function approveSchedule(id) {
    await FireDB.updateScheduleStatus(id, 'approved');
    showToast('Jadwal disetujui!', 'success');
    renderMySchedules();
    updatePendingBadges();
    if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
}

function openRejectModal(id) {
    document.getElementById('reject-schedule-id').value = id;
    document.getElementById('reject-reason-input').value = '';
    openModal('modal-reject');
}

async function confirmReject() {
    const id     = document.getElementById('reject-schedule-id').value;
    const reason = document.getElementById('reject-reason-input').value.trim();
    if (!reason) { showToast('Harap isi alasan penolakan.', 'warning'); return; }
    await FireDB.updateScheduleStatus(id, 'rejected', reason);
    closeModal('modal-reject');
    showToast('Jadwal ditolak.', 'info', 'Admin akan mendapat notifikasi.');
    renderMySchedules();
    updatePendingBadges();
    if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
}

// ── Pending Badges ──
function updatePendingBadges() {
    const pending = DB.getSchedulesByTeacher(teacherId).filter(s => s.status === 'pending').length;
    ['sb-pending-badge', 'header-pending-badge', 'bn-pending-badge'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (pending > 0) {
            el.textContent = pending;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

// ── Boot ──
init();
