/* ==========================================================================
   TEACHER PORTAL LOGIC — BRAIN ACADEMIA PINRANG
   ========================================================================== */

// ── Auth Guard ──
const teacherId = Session.requireTeacher();
if (!teacherId) { /* redirected */ }

const __todayTeacher = new Date();
const __teacherYyyy = __todayTeacher.getFullYear();
const __teacherMm = String(__todayTeacher.getMonth() + 1).padStart(2, '0');
const __teacherDd = String(__todayTeacher.getDate()).padStart(2, '0');
const __defaultTeacherWeekStart = getWeekDates(`${__teacherYyyy}-${__teacherMm}-${__teacherDd}`)[0];

let teacher = null;
let currentFilter = 'all';
let activeView = 'list';
let currentWeekStart = __defaultTeacherWeekStart;

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
    if (page === 'availability') initAvailGrid();
    if (page === 'myschedules')  renderMySchedules();
    if (page === 'settings')     renderTeacherSettings();
}

function updateTeacherAvatarUI(teacherData) {
    const headerAvatar = document.getElementById('header-avatar');
    const dashAvatar = document.getElementById('dash-avatar');
    
    if (teacherData.photoURL) {
        const imgHtml = `<img src="${teacherData.photoURL}" alt="${teacherData.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        if (headerAvatar) {
            headerAvatar.innerHTML = imgHtml;
            headerAvatar.style.background = 'transparent';
        }
        if (dashAvatar) {
            dashAvatar.innerHTML = imgHtml;
            dashAvatar.style.background = 'transparent';
        }
    } else {
        const initials = teacherData.name.split(' ').map(w => w[0]).join('').slice(0, 2);
        if (headerAvatar) {
            headerAvatar.innerHTML = initials;
            headerAvatar.style.background = 'var(--ba-red)';
        }
        if (dashAvatar) {
            dashAvatar.innerHTML = initials;
            dashAvatar.style.background = 'rgba(255,255,255,0.15)';
        }
    }
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
    updateTeacherAvatarUI(teacher);
    document.getElementById('header-name').textContent = teacher.name;
    
    const branchLabel = document.getElementById('header-branch-label');
    if (branchLabel) {
        branchLabel.textContent = `Portal Master Teacher — Cabang ${teacher.branch || 'Pinrang'}`;
    }

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
    updateTeacherAvatarUI(teacher);
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
//  WEEKLY AVAILABILITY GRID (REDESIGNED)
// ────────────────────────────────────────────────────────────────────
let currentAvailWeekStart = ''; 
let availGridState = {}; // map of date -> Set of startTimes
let isDraggingAvail = false;
let dragAvailMode = true; // true = selecting, false = deselecting
let copiedAvailState = null;

function initAvailGrid() {
    if (!currentAvailWeekStart) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        currentAvailWeekStart = getWeekDates(`${yyyy}-${mm}-${dd}`)[0];
    }
    renderWeeklyAvailabilityGrid();
}

function renderWeeklyAvailabilityGrid() {
    const weekDates = getWeekDates(currentAvailWeekStart);
    const sundayDate = adjustDateDays(weekDates[5], 1);
    const fullWeek = [...weekDates, sundayDate];
    
    // Update label
    const startStr = formatDateIndo(fullWeek[0]);
    const endStr = formatDateIndo(fullWeek[6]);
    document.getElementById('avail-week-label').textContent = `${startStr.split(' ').slice(0,2).join(' ')} – ${endStr}`;
    
    const container = document.getElementById('avail-grid-container');
    container.innerHTML = '';

    // Generate timeslots from 10:00 to 20:30
    const timeSlots = [];
    for(let h=10; h<=20; h++) {
        timeSlots.push(`${String(h).padStart(2,'0')}:00`);
        timeSlots.push(`${String(h).padStart(2,'0')}:30`);
    }

    // Get current DB availability and parse it
    const dbAvails = DB.getAvailability(teacherId);
    availGridState = {};
    fullWeek.forEach(d => availGridState[d] = new Set());
    
    dbAvails.forEach(a => {
        if (availGridState[a.date]) {
            let current = a.startTime;
            while (current < a.endTime && current <= '20:30') {
                availGridState[a.date].add(current);
                let [h, m] = current.split(':').map(Number);
                m += 30;
                if (m >= 60) { h++; m -= 60; }
                current = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
            }
        }
    });

    const grid = document.createElement('div');
    grid.className = 'avail-grid';

    // Header Row
    let headerHTML = `<div class="avail-grid-header"><div class="grid-h-cell" style="display:flex;align-items:center;justify-content:center;">Time</div>`;
    const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    fullWeek.forEach((date, i) => {
        const parts = date.split('-');
        headerHTML += `<div class="grid-h-cell">${dayNames[i]}<br><span style="font-weight:600;font-size:.68rem;opacity:.8;">${parts[2]}/${parts[1]}</span></div>`;
    });
    headerHTML += `</div>`;
    grid.innerHTML = headerHTML;

    // Body Rows
    timeSlots.forEach(time => {
        const row = document.createElement('div');
        row.className = 'avail-grid-row';
        
        const timeCell = document.createElement('div');
        timeCell.className = 'avail-grid-time';
        timeCell.textContent = time;
        row.appendChild(timeCell);

        fullWeek.forEach(date => {
            const cell = document.createElement('div');
            cell.className = 'avail-grid-cell';
            cell.dataset.date = date;
            cell.dataset.time = time;
            if (availGridState[date].has(time)) {
                cell.classList.add('selected');
            }

            // Events for drag to select
            cell.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isDraggingAvail = true;
                dragAvailMode = !cell.classList.contains('selected');
                toggleCell(cell);
            });
            cell.addEventListener('mouseenter', (e) => {
                if (isDraggingAvail) toggleCell(cell, true);
            });
            
            row.appendChild(cell);
        });
        grid.appendChild(row);
    });

    document.addEventListener('mouseup', () => { isDraggingAvail = false; }, { once: false });

    container.appendChild(grid);
}

function toggleCell(cell, forceDrag = false) {
    if (forceDrag) {
        if (dragAvailMode) cell.classList.add('selected');
        else cell.classList.remove('selected');
    } else {
        cell.classList.toggle('selected');
    }
    
    const date = cell.dataset.date;
    const time = cell.dataset.time;
    if (cell.classList.contains('selected')) {
        availGridState[date].add(time);
    } else {
        availGridState[date].delete(time);
    }
}

function changeAvailWeek(offset) {
    currentAvailWeekStart = adjustDateDays(currentAvailWeekStart, offset * 7);
    renderWeeklyAvailabilityGrid();
}
function setAvailToThisWeek() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    currentAvailWeekStart = getWeekDates(`${yyyy}-${mm}-${dd}`)[0];
    renderWeeklyAvailabilityGrid();
}
function setAvailToNextWeek() {
    setAvailToThisWeek();
    changeAvailWeek(1);
}
function copyLastWeekAvail() {
    // Look back 7 days from currentAvailWeekStart to find previously saved patterns
    const prevWeekStart = adjustDateDays(currentAvailWeekStart, -7);
    const prevWeekDates = getWeekDates(prevWeekStart);
    const prevSunday = adjustDateDays(prevWeekDates[5], 1);
    const prevFullWeek = [...prevWeekDates, prevSunday];
    
    const dbAvails = DB.getAvailability(teacherId);
    
    // Check if there's any availability last week
    const lastWeekAvails = dbAvails.filter(a => prevFullWeek.includes(a.date));
    
    if (lastWeekAvails.length === 0) {
        showToast('Tidak ada jadwal minggu lalu.', 'warning');
        return;
    }

    // Build the grid state from last week
    const lastWeekGridState = {};
    prevFullWeek.forEach(d => lastWeekGridState[d] = new Set());
    lastWeekAvails.forEach(a => {
        let current = a.startTime;
        while (current < a.endTime && current <= '20:30') {
            lastWeekGridState[a.date].add(current);
            let [h, m] = current.split(':').map(Number);
            m += 30;
            if (m >= 60) { h++; m -= 60; }
            current = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        }
    });

    // Copy to this week
    const weekDates = getWeekDates(currentAvailWeekStart);
    const sundayDate = adjustDateDays(weekDates[5], 1);
    const fullWeek = [...weekDates, sundayDate];

    fullWeek.forEach((date, i) => {
        const prevDate = prevFullWeek[i];
        if (lastWeekGridState[prevDate]) {
            lastWeekGridState[prevDate].forEach(t => availGridState[date].add(t));
        }
    });

    renderWeeklyAvailabilityGrid();
    showToast('Jadwal minggu lalu berhasil di-copy', 'success');
}
function copyCurrentWeekAvail() {
    copiedAvailState = {};
    const weekDates = getWeekDates(currentAvailWeekStart);
    const sundayDate = adjustDateDays(weekDates[5], 1);
    const fullWeek = [...weekDates, sundayDate];

    fullWeek.forEach((date, i) => {
        copiedAvailState[i] = Array.from(availGridState[date]);
    });
    document.getElementById('btn-paste-avail').disabled = false;
    showToast('Jadwal minggu ini disalin', 'info');
}
function pasteAvail() {
    if (!copiedAvailState) return;
    const weekDates = getWeekDates(currentAvailWeekStart);
    const sundayDate = adjustDateDays(weekDates[5], 1);
    const fullWeek = [...weekDates, sundayDate];
    
    fullWeek.forEach((date, i) => {
        if (copiedAvailState[i]) {
            copiedAvailState[i].forEach(t => availGridState[date].add(t));
        }
    });
    renderWeeklyAvailabilityGrid();
    showToast('Jadwal berhasil di-paste', 'success');
}
function resetThisWeekAvail() {
    const weekDates = getWeekDates(currentAvailWeekStart);
    const sundayDate = adjustDateDays(weekDates[5], 1);
    const fullWeek = [...weekDates, sundayDate];
    fullWeek.forEach(d => availGridState[d] = new Set());
    renderWeeklyAvailabilityGrid();
}

async function saveWeeklyAvailability() {
    const btn = document.getElementById('btn-save-avail');
    btn.disabled = true;
    btn.innerHTML = '<div class="fb-spinner" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;border-width:2px;"></div> Menyimpan...';

    const oldAvails = DB.getAvailability(teacherId);
    
    const weekDates = getWeekDates(currentAvailWeekStart);
    const sundayDate = adjustDateDays(weekDates[5], 1);
    const fullWeek = [...weekDates, sundayDate];
    
    const availsToDelete = oldAvails.filter(a => fullWeek.includes(a.date));
    
    for (const a of availsToDelete) {
        if (typeof FireDB !== 'undefined' && await FireDB.isReady()) {
            await FireDB.deleteAvailability(a.id);
        } else {
            DB.deleteAvailability(a.id);
        }
    }
    
    for (const date of fullWeek) {
        const times = Array.from(availGridState[date]).sort();
        if (!times.length) continue;
        
        let blockStart = times[0];
        let blockEnd = add30Mins(blockStart);
        
        for (let i = 1; i < times.length; i++) {
            if (times[i] === blockEnd) {
                blockEnd = add30Mins(times[i]);
            } else {
                if (typeof FireDB !== 'undefined' && await FireDB.isReady()) {
                    await FireDB.addAvailability(teacherId, { date, subject: '', startTime: blockStart, endTime: blockEnd });
                } else {
                    DB.addAvailability(teacherId, { date, subject: '', startTime: blockStart, endTime: blockEnd });
                }
                blockStart = times[i];
                blockEnd = add30Mins(times[i]);
            }
        }
        if (typeof FireDB !== 'undefined' && await FireDB.isReady()) {
            await FireDB.addAvailability(teacherId, { date, subject: '', startTime: blockStart, endTime: blockEnd });
        } else {
            DB.addAvailability(teacherId, { date, subject: '', startTime: blockStart, endTime: blockEnd });
        }
    }

    btn.disabled = false;
    btn.innerHTML = '💾 Save Changes';
    showToast('Ketersediaan berhasil disimpan!', 'success');
}

function add30Mins(timeStr) {
    let [h, m] = timeStr.split(':').map(Number);
    m += 30;
    if (m >= 60) { h++; m -= 60; }
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
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

// ── Google Calendar Sync ──
let tokenClient;
let gcalSchedulesToSync = [];

function syncToGoogleCalendar() {
    if (!window.GOOGLE_CLIENT_ID || window.GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID_HERE") {
        showToast('Google Client ID belum dikonfigurasi.', 'error', 'Hubungi Admin untuk mensetting Client ID di file konfigurasi.');
        return;
    }

    const approved = DB.getSchedulesByTeacher(teacherId).filter(s => s.status === 'approved');
    if (!approved.length) {
        showToast('Tidak ada jadwal disetujui yang bisa di-sync.', 'warning');
        return;
    }

    gcalSchedulesToSync = approved;

    if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: window.GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/calendar.events',
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    processGoogleCalendarSync(tokenResponse.access_token);
                }
            },
        });
    }

    // Trigger OAuth popup
    tokenClient.requestAccessToken();
}

async function processGoogleCalendarSync(accessToken) {
    showToast('Memulai sinkronisasi jadwal...', 'info', 'Mohon tunggu sebentar.');
    let successCount = 0;
    let failCount = 0;

    for (const sched of gcalSchedulesToSync) {
        const event = {
            summary: `Mengajar: ${sched.subject}`,
            location: `Brain Academia Pinrang (Ruang: ${sched.room})`,
            description: `Mata Pelajaran: ${sched.subject}\nRombel: ${sched.rombel}\nKeterangan: ${sched.ket || '-'}`,
            start: {
                dateTime: `${sched.date}T${sched.startTime}:00`,
                timeZone: 'Asia/Makassar'
            },
            end: {
                dateTime: `${sched.date}T${sched.endTime}:00`,
                timeZone: 'Asia/Makassar'
            }
        };

        try {
            const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
            });

            if (res.ok) {
                successCount++;
            } else {
                console.error('Gagal sync jadwal', await res.text());
                failCount++;
            }
        } catch (e) {
            console.error('Error saat sync:', e);
            failCount++;
        }
    }

    if (successCount > 0) {
        showToast(`${successCount} jadwal berhasil ditambahkan ke Google Calendar!`, 'success');
    }
    if (failCount > 0) {
        showToast(`${failCount} jadwal gagal disinkronkan.`, 'error');
    }
}

// ────────────────────────────────────────────────────────────────────
//  SETTINGS TAB (TEACHER)
// ────────────────────────────────────────────────────────────────────
function renderTeacherSettings() {
    document.getElementById('teacher-name-input').value = teacher.name || '';
    document.getElementById('teacher-email-input').value = teacher.email && teacher.email !== '-' ? teacher.email : '';
    document.getElementById('teacher-pin-input').value = '';
    
    const settingsAvatar = document.getElementById('settings-teacher-avatar');
    if (teacher.photoURL) {
        settingsAvatar.innerHTML = `<img src="${teacher.photoURL}" alt="${teacher.name}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">`;
    } else {
        settingsAvatar.innerHTML = teacher.name.split(' ').map(w => w[0]).join('').slice(0, 2);
    }
}

async function submitTeacherSettings(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-teacher-settings');
    btn.disabled = true;
    btn.innerHTML = '<div class="fb-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></div> Menyimpan...';
    
    try {
        const newName = document.getElementById('teacher-name-input').value.trim();
        const newEmail = document.getElementById('teacher-email-input').value.trim();
        const newPin = document.getElementById('teacher-pin-input').value;
        
        teacher.name = newName || teacher.name;
        teacher.email = newEmail || '-';
        if (newPin && newPin.length === 4) {
            teacher.pin = newPin;
        }
        
        const fileInput = document.getElementById('teacher-photo-input');
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) {
                showToast('Ukuran foto terlalu besar. Maksimal 2MB.', 'error');
                btn.disabled = false;
                btn.innerHTML = '💾 Simpan Perubahan';
                return;
            }
            if (typeof FireDB !== 'undefined' && await FireDB.isReady()) {
                const url = await FireDB.uploadProfilePicture(file, teacherId);
                if (url) {
                    teacher.photoURL = url;
                } else {
                    showToast('Gagal mengunggah foto profil.', 'error');
                }
            } else {
                showToast('Firebase belum terhubung. Tidak dapat mengunggah foto.', 'warning');
            }
        }
        
        // Save to Firebase (or local)
        if (typeof FireDB !== 'undefined' && await FireDB.isReady()) {
            await FireDB.saveTeacher(teacher);
        } else {
            DB.saveTeacher(teacher);
        }
        
        // Update UI
        updateTeacherAvatarUI(teacher);
        document.getElementById('header-name').textContent = teacher.name;
        renderProfileCard(); // To update dash-name
        renderTeacherSettings();
        
        showToast('Pengaturan profil berhasil disimpan!', 'success');
        
    } catch (err) {
        console.error(err);
        showToast('Terjadi kesalahan saat menyimpan pengaturan.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '💾 Simpan Perubahan';
    }
}

// ── Boot ──
init();
