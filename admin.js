/* ==========================================================================
   ADMIN LOGIC — BRAIN ACADEMIA PINRANG
   ========================================================================== */

// ── Auth Guard ──
if (!Session.requireAdmin()) { /* redirected */ }

const __todayAdmin = new Date();
const __adminYyyy = __todayAdmin.getFullYear();
const __adminMm = String(__todayAdmin.getMonth() + 1).padStart(2, '0');
const __adminDd = String(__todayAdmin.getDate()).padStart(2, '0');
const __defaultAdminWeekStart = getWeekDates(`${__adminYyyy}-${__adminMm}-${__adminDd}`)[0];

let currentWeekStart = __defaultAdminWeekStart;
let currentSchedWeekStart = __defaultAdminWeekStart;
let currentTimetableWeekStart = __defaultAdminWeekStart;
let adminSchedulesView = 'list';
let adminOverviewView = 'detail';
let adminCurrentBranch = 'all';

function changeAdminBranch(branch) {
    adminCurrentBranch = branch;
    const label = branch === 'all' ? 'Semua Cabang' : 'Cabang ' + branch;
    const el = document.getElementById('header-branch-label');
    if (el) el.textContent = 'Admin — ' + label;
    
    // Sinkronkan global ruangan list jika pindah cabang
    if (branch !== 'all') {
        const branchRooms = DB.getRuanganList(branch);
        RUANGAN_LIST.length = 0;
        branchRooms.forEach(r => RUANGAN_LIST.push(r));
    } else {
        const allRooms = DB.getAllRuangan();
        RUANGAN_LIST.length = 0;
        allRooms.forEach(r => RUANGAN_LIST.push(r));
    }
    
    renderAll();
    renderRuanganList(); // Update UI kelola ruangan jika di halaman setting
}

function getFilteredTeachers() {
    const all = DB.getTeachers();
    if (adminCurrentBranch === 'all') return all;
    return all.filter(t => t.branch === adminCurrentBranch);
}

function getFilteredSchedules() {
    const teachers = getFilteredTeachers().map(t => t.id);
    return DB.getSchedules().filter(s => teachers.includes(s.teacherId));
}

function getFilteredAvailability() {
    const teachers = getFilteredTeachers().map(t => t.id);
    return DB.getAllAvailability().filter(a => teachers.includes(a.teacherId));
}

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
    if (page === 'settings')  renderAdminSettings();
}

// ── Admin Profile Initialization ──
function initAdminProfile() {
    const profileRaw = localStorage.getItem('adminProfile');
    const profile = profileRaw ? JSON.parse(profileRaw) : { name: 'Admin', photoURL: null };
    
    // Update Header
    document.getElementById('header-admin-name').textContent = profile.name;
    const headerAvatar = document.getElementById('header-admin-avatar');
    if (profile.photoURL) {
        headerAvatar.innerHTML = `<img src="${profile.photoURL}" alt="${profile.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        headerAvatar.style.background = 'transparent';
    } else {
        headerAvatar.innerHTML = profile.name.charAt(0).toUpperCase();
        headerAvatar.style.background = 'var(--ba-red)';
    }
}
// Call init on load
document.addEventListener('DOMContentLoaded', initAdminProfile);

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
//  SETTINGS TAB (ADMIN)
// ────────────────────────────────────────────────────────────────────
function renderAdminSettings() {
    const profileRaw = localStorage.getItem('adminProfile');
    const profile = profileRaw ? JSON.parse(profileRaw) : { name: 'Admin', photoURL: null };
    
    document.getElementById('admin-name-input').value = profile.name;
    document.getElementById('admin-pass-input').value = '';
    document.getElementById('admin-pass-confirm').value = '';
    
    const settingsAvatar = document.getElementById('settings-admin-avatar');
    if (profile.photoURL) {
        settingsAvatar.innerHTML = `<img src="${profile.photoURL}" alt="${profile.name}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">`;
    } else {
        settingsAvatar.innerHTML = profile.name.charAt(0).toUpperCase();
    }

    renderMapelList();
    renderRuanganList();
}

// ────────────────────────────────────────────────────────────────────
//  KELOLA MATA PELAJARAN
// ────────────────────────────────────────────────────────────────────
function renderMapelList() {
    const container = document.getElementById('mapel-list-container');
    if (!container) return;

    // Ensure MAPEL_LIST is synced from persistent storage
    const list = DB.getMapelList();
    MAPEL_LIST.length = 0;
    list.forEach(m => MAPEL_LIST.push(m));

    if (list.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted);font-size:.85rem;padding:1rem 0;">Belum ada mata pelajaran. Tambahkan di atas.</div>`;
        return;
    }

    container.innerHTML = list.map(mapel => {
        const safeName = mapel.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        return `
            <div style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-sidebar);border:1px solid var(--border-color);border-radius:20px;padding:4px 10px 4px 12px;font-size:.8rem;font-weight:600;">
                <span>${mapel}</span>
                <button onclick="deleteMapelItem('${safeName}')" title="Hapus ${mapel}"
                    style="background:none;border:none;cursor:pointer;color:var(--ba-red);font-size:.85rem;padding:0 2px;line-height:1;display:flex;align-items:center;">✕</button>
            </div>`;
    }).join('');
}

function addMapelFromInput() {
    const input = document.getElementById('new-mapel-input');
    if (!input) return;
    const val = input.value.trim().toUpperCase();
    if (!val) {
        showToast('Nama mata pelajaran tidak boleh kosong.', 'warning');
        return;
    }
    const added = DB.addMapel(val);
    if (!added) {
        showToast(`"${val}" sudah ada dalam daftar.`, 'warning');
        return;
    }
    input.value = '';
    renderMapelList();
    showToast(`Mata pelajaran "${val}" berhasil ditambahkan.`, 'success');
}

function deleteMapelItem(name) {
    if (!confirm(`Yakin ingin menghapus mata pelajaran "${name}"?\nMata pelajaran ini tidak akan muncul di pilihan form jadwal.`)) return;
    DB.deleteMapel(name);
    renderMapelList();
    showToast(`Mata pelajaran "${name}" berhasil dihapus.`, 'success');
}

// ────────────────────────────────────────────────────────────────────
//  KELOLA RUANGAN
// ────────────────────────────────────────────────────────────────────
function renderRuanganList() {
    const container = document.getElementById('ruangan-list-container');
    const subtitle = document.getElementById('ruangan-branch-subtitle');
    if (!container) return;

    if (adminCurrentBranch === 'all') {
        container.innerHTML = `<div style="color:var(--text-muted);font-size:.85rem;padding:1rem 0;">Pilih cabang spesifik (Pinrang/Parepare) di menu atas untuk mengelola ruangan.</div>`;
        if (subtitle) subtitle.textContent = 'Pilih cabang spesifik untuk mengelola ruangan';
        document.getElementById('new-ruangan-input').disabled = true;
        return;
    }

    document.getElementById('new-ruangan-input').disabled = false;
    if (subtitle) subtitle.textContent = `Kelola ruangan untuk Cabang ${adminCurrentBranch}`;

    const list = DB.getRuanganList(adminCurrentBranch);

    if (list.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted);font-size:.85rem;padding:1rem 0;">Belum ada ruangan. Tambahkan di atas.</div>`;
        return;
    }

    container.innerHTML = list.map(ruangan => {
        const safeName = ruangan.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
        return `
            <div style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-sidebar);border:1px solid var(--border-color);border-radius:20px;padding:4px 10px 4px 12px;font-size:.8rem;font-weight:600;">
                <span>${ruangan}</span>
                <button onclick="deleteRuanganItem('${safeName}')" title="Hapus ${ruangan}"
                    style="background:none;border:none;cursor:pointer;color:var(--ba-red);font-size:.85rem;padding:0 2px;line-height:1;display:flex;align-items:center;">✕</button>
            </div>`;
    }).join('');
}

function addRuanganFromInput() {
    if (adminCurrentBranch === 'all') {
        showToast('Pilih cabang spesifik terlebih dahulu.', 'warning');
        return;
    }
    const input = document.getElementById('new-ruangan-input');
    if (!input) return;
    const val = input.value.trim().toUpperCase();
    if (!val) {
        showToast('Nama ruangan tidak boleh kosong.', 'warning');
        return;
    }
    const added = DB.addRuangan(adminCurrentBranch, val);
    if (!added) {
        showToast(`Ruangan "${val}" sudah ada dalam daftar.`, 'warning');
        return;
    }
    input.value = '';
    renderRuanganList();
    showToast(`Ruangan "${val}" berhasil ditambahkan.`, 'success');
}

function deleteRuanganItem(name) {
    if (!confirm(`Yakin ingin menghapus ruangan "${name}"?\nRuangan ini tidak akan muncul di pilihan form jadwal.`)) return;
    DB.deleteRuangan(adminCurrentBranch, name);
    renderRuanganList();
    showToast(`Ruangan "${name}" berhasil dihapus.`, 'success');
}


async function submitAdminSettings(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-admin-settings');
    btn.disabled = true;
    btn.innerHTML = '<div class="fb-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></div> Menyimpan...';
    
    try {
        const profileRaw = localStorage.getItem('adminProfile');
        const profile = profileRaw ? JSON.parse(profileRaw) : { name: 'Admin', photoURL: null };
        
        profile.name = document.getElementById('admin-name-input').value.trim() || 'Admin';
        
        const newPass = document.getElementById('admin-pass-input').value;
        if (newPass.length > 0) {
            if (newPass.length < 4) {
                showToast('Password minimal 4 karakter.', 'warning');
                btn.disabled = false;
                btn.innerHTML = '💾 Simpan Perubahan';
                return;
            }
            const confirmPass = document.getElementById('admin-pass-confirm').value;
            if (newPass !== confirmPass) {
                showToast('Konfirmasi password tidak cocok.', 'error');
                btn.disabled = false;
                btn.innerHTML = '💾 Simpan Perubahan';
                return;
            }
            localStorage.setItem('ba_admin_password', newPass);
            showToast('Password admin berhasil diubah!', 'success');
        }
        
        const fileInput = document.getElementById('admin-photo-input');
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) {
                showToast('Ukuran foto terlalu besar. Maksimal 2MB.', 'error');
                btn.disabled = false;
                btn.innerHTML = '💾 Simpan Perubahan';
                return;
            }
            if (typeof FireDB !== 'undefined' && await FireDB.isReady()) {
                const url = await FireDB.uploadProfilePicture(file, 'admin');
                if (url) {
                    profile.photoURL = url;
                } else {
                    showToast('Gagal mengunggah foto profil.', 'error');
                }
            } else {
                showToast('Firebase belum terhubung. Tidak dapat mengunggah foto.', 'warning');
            }
        }
        
        localStorage.setItem('adminProfile', JSON.stringify(profile));
        initAdminProfile();
        renderAdminSettings();
        showToast('Pengaturan profil berhasil disimpan!', 'success');
        
    } catch (err) {
        console.error(err);
        showToast('Terjadi kesalahan saat menyimpan pengaturan.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '💾 Simpan Perubahan';
    }
}


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
    
    if (adminOverviewView === 'detail') {
        renderOverviewTable();
    } else {
        renderRecapTable();
    }
    updatePendingBadge();
}

function changeAdminWeek(offset) {
    currentWeekStart = adjustDateDays(currentWeekStart, offset * 7);
    renderOverview();
}

function setOverviewView(view) {
    adminOverviewView = view;
    document.getElementById('btn-overview-detail').classList.toggle('active', view === 'detail');
    document.getElementById('btn-overview-recap').classList.toggle('active', view === 'recap');
    
    if (view === 'detail') {
        document.getElementById('overview-detail-view').classList.remove('hidden');
        document.getElementById('overview-recap-view').classList.add('hidden');
        renderOverviewTable();
    } else {
        document.getElementById('overview-detail-view').classList.add('hidden');
        document.getElementById('overview-recap-view').classList.remove('hidden');
        renderRecapTable();
    }
}

function renderRecapTable() {
    const teachers = getFilteredTeachers();
    const tbody = document.getElementById('recap-tbody');
    
    if (!teachers.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding:2rem;">Belum ada data Master Teacher.</td></tr>`;
        return;
    }
    
    const weekDates = getWeekDates(currentWeekStart);
    const sundayDate = adjustDateDays(weekDates[5], 1);
    const fullWeek = [...weekDates, sundayDate];
    
    let html = '';
    
    teachers.forEach(t => {
        const avails = DB.getAvailability(t.id);
        let totalMins = 0;
        
        let rowHtml = `<tr>
            <td style="text-align:left;font-weight:700;">
                <div style="display:flex;align-items:center;gap:.6rem;">
                    <div style="width:28px;height:28px;border-radius:6px;background:${t.avatarBg};color:${t.avatarColor};
                                display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.65rem;flex-shrink:0;">
                        ${t.name.split(' ').map(w => w[0]).join('').slice(0,2)}
                    </div>
                    <span>${t.name}</span>
                </div>
            </td>`;
        
        fullWeek.forEach(date => {
            const dayAvails = avails.filter(a => a.date === date);
            if (dayAvails.length === 0) {
                rowHtml += `<td style="color:var(--text-muted);font-size:.8rem;">-</td>`;
            } else {
                const slotsStr = dayAvails.map(a => `<div style="font-size:0.75rem; white-space:nowrap; background:rgba(40,167,69,0.1); color:var(--success); padding:2px 6px; border-radius:4px; margin:2px; display:inline-block; border:1px solid rgba(40,167,69,0.3);">${a.startTime}-${a.endTime}</div>`).join(' ');
                rowHtml += `<td style="vertical-align:middle; line-height:1.4;">${slotsStr}</td>`;
                
                dayAvails.forEach(a => {
                    const sParts = a.startTime.split(':').map(Number);
                    const eParts = a.endTime.split(':').map(Number);
                    totalMins += (eParts[0]*60 + eParts[1]) - (sParts[0]*60 + sParts[1]);
                });
            }
        });
        
        const totalHours = (totalMins / 60).toFixed(1);
        rowHtml += `<td style="font-weight:800;font-size:.9rem;background:var(--bg-sidebar);color:var(--text-primary);vertical-align:middle;">${totalHours} Jam</td></tr>`;
        
        html += rowHtml;
    });
    
    tbody.innerHTML = html;
}

function renderStats() {
    const teachers  = getFilteredTeachers();
    const schedules = getFilteredSchedules();
    const pending   = schedules.filter(s => s.status === 'pending').length;
    const approved  = schedules.filter(s => s.status === 'approved').length;

    const totalAvail = getFilteredAvailability().length;

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
            <div style="display:flex;gap:1px;">
                <button class="sched-chip-delete-btn" onclick="event.stopPropagation(); editSchedule('${s.id}')" title="Edit Jadwal" style="color:var(--warning);">✏️</button>
                <button class="sched-chip-delete-btn" onclick="event.stopPropagation(); deleteSchedule('${s.id}')" title="Hapus Jadwal">×</button>
            </div>
        </div>
        <div class="sched-chip-meta">
            <span>🏫 ${s.room} · 👥 ${s.rombel}${s.ket ? ` · 🏷️ ${s.ket}` : ''}</span>
        </div>
    </div>`;
}

function renderOverviewTable() {
    const teachers = getFilteredTeachers();
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
                    const subjStr = a.subject ? ` | ${a.subject}` : '';
                    chipsHtml += `
                    <span class="avail-chip" onclick="quickAssign('${t.id}','${dateStr}','${a.subject}','${a.startTime}','${a.endTime}')" data-tooltip="Klik untuk assign jadwal">
                        ➕ ${a.startTime}–${a.endTime}${subjStr}
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

// Download Recap CSV for current week
function downloadAvailCSV() {
    const teachers = getFilteredTeachers();
    const weekDates = getWeekDates(currentWeekStart);
    const sundayDate = adjustDateDays(weekDates[5], 1);
    const fullWeek = [...weekDates, sundayDate];
    
    const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nama MT," + dayNames.join(",") + ",Total Jam\n";
    
    teachers.forEach(t => {
        const avails = DB.getAvailability(t.id);
        let row = `"${t.name}",`;
        let totalMins = 0;
        
        fullWeek.forEach(date => {
            const dayAvails = avails.filter(a => a.date === date);
            if (dayAvails.length === 0) {
                row += '"-",';
            } else {
                const slotsStr = dayAvails.map(a => `${a.startTime}-${a.endTime}`).join('; ');
                row += `"${slotsStr}",`;
                
                dayAvails.forEach(a => {
                    const sParts = a.startTime.split(':').map(Number);
                    const eParts = a.endTime.split(':').map(Number);
                    totalMins += (eParts[0]*60 + eParts[1]) - (sParts[0]*60 + sParts[1]);
                });
            }
        });
        
        const totalHours = (totalMins / 60).toFixed(1);
        row += `"${totalHours} Jam"\n`;
        csvContent += row;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Ketersediaan_${currentWeekStart}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

// View availability detail for a teacher
function viewAvailDetail(teacherId) {
    const teacher  = DB.getTeacher(teacherId);
    const avails   = DB.getAvailability(teacherId);
    const schedules = DB.getSchedulesByTeacher(teacherId);

    document.getElementById('avail-detail-name').textContent = `Ketersediaan: ${teacher.name}`;

    const weekDates = getWeekDates(currentWeekStart);
    const sundayDate = adjustDateDays(weekDates[5], 1);
    const fullWeek = [...weekDates, sundayDate];

    const availGridState = {};
    const schedGridState = {};
    fullWeek.forEach(d => {
        availGridState[d] = new Set();
        schedGridState[d] = new Map();
    });

    avails.forEach(a => {
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

    schedules.forEach(s => {
        if (schedGridState[s.date]) {
            let current = s.startTime;
            while (current < s.endTime && current <= '20:30') {
                schedGridState[s.date].set(current, s);
                let [h, m] = current.split(':').map(Number);
                m += 30;
                if (m >= 60) { h++; m -= 60; }
                current = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
            }
        }
    });

    const timeSlots = [];
    for(let h=10; h<=20; h++) {
        timeSlots.push(`${String(h).padStart(2,'0')}:00`);
        timeSlots.push(`${String(h).padStart(2,'0')}:30`);
    }

    let html = `<div class="avail-grid-wrap" style="max-height: 450px; overflow-y: auto;">
        <div class="avail-grid" style="min-width:700px;">
            <div class="avail-grid-header">
                <div class="grid-h-cell" style="position:sticky;left:0;background:var(--bg-sidebar);z-index:2;display:flex;align-items:center;justify-content:center;">Time</div>`;
    
    const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    fullWeek.forEach((date, i) => {
        const parts = date.split('-');
        html += `<div class="grid-h-cell">${dayNames[i]}<br><span style="font-weight:600;font-size:.68rem;opacity:.8;">${parts[2]}/${parts[1]}</span></div>`;
    });
    html += `</div>`;

    timeSlots.forEach(time => {
        html += `<div class="avail-grid-row">
            <div class="avail-grid-time" style="position:sticky;left:0;background:var(--bg-sidebar);z-index:1;">${time}</div>`;
        
        fullWeek.forEach(date => {
            let cellStyle = "background: var(--bg-card);";
            let content = "";
            if (schedGridState[date].has(time)) {
                const s = schedGridState[date].get(time);
                if (s.status === 'approved') cellStyle = "background: rgba(40, 167, 69, 0.2); border: 1px solid rgba(40, 167, 69, 0.4);";
                else if (s.status === 'pending') cellStyle = "background: rgba(255, 193, 7, 0.2); border: 1px solid rgba(255, 193, 7, 0.4);";
                else cellStyle = "background: rgba(220, 53, 69, 0.2); border: 1px solid rgba(220, 53, 69, 0.4);";
                
                if (time === s.startTime) {
                    content = `<div style="font-size:0.6rem;font-weight:bold;color:var(--text-primary);padding:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.rombel}</div>`;
                }
            } else if (availGridState[date].has(time)) {
                cellStyle = "background: rgba(227, 30, 36, 0.2); border: 1px solid rgba(227, 30, 36, 0.4);";
            }
            
            html += `<div class="avail-grid-cell" style="${cellStyle}; pointer-events:none;">${content}</div>`;
        });
        html += `</div>`;
    });
    
    html += `</div></div>`;
    html += `
    <div style="margin-top:1rem; display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
        <span style="font-size:.75rem;"><span style="display:inline-block;width:12px;height:12px;background:rgba(227,30,36,0.2);border:1px solid rgba(227,30,36,0.4);vertical-align:middle;"></span> Tersedia</span>
        <span style="font-size:.75rem;"><span style="display:inline-block;width:12px;height:12px;background:rgba(40,167,69,0.2);border:1px solid rgba(40,167,69,0.4);vertical-align:middle;"></span> Jadwal Aktif (Disetujui)</span>
        <span style="font-size:.75rem;"><span style="display:inline-block;width:12px;height:12px;background:rgba(255,193,7,0.2);border:1px solid rgba(255,193,7,0.4);vertical-align:middle;"></span> Jadwal Menunggu</span>
    </div>
    `;

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
    const pending = getFilteredSchedules().filter(s => s.status === 'pending').length;
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
    getFilteredTeachers().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
}

function getDynamicRombelList() {
    let templates = DB.getTemplates();
    if (adminCurrentBranch !== 'all') {
        templates = templates.filter(t => t.branch === adminCurrentBranch || !t.branch);
    }
    let uniqueKelas = [...new Set(templates.map(t => t.rombel))].filter(Boolean);
    uniqueKelas.sort((a, b) => getRombelGradeWeight(a) - getRombelGradeWeight(b));
    return uniqueKelas.length > 0 ? uniqueKelas : KELAS_LIST;
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
        const currentRombelList = getDynamicRombelList();
        currentRombelList.forEach(k => {
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
        const slotsStr = avails.map(a => `<b>${a.startTime}–${a.endTime}</b>`).join(', ');
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

    const allSchedules = getFilteredSchedules();
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

    const isDraft = document.getElementById('assign-as-draft') ? document.getElementById('assign-as-draft').checked : true;
    const status = isDraft ? 'draft' : 'pending';

    await FireDB.addSchedule({ teacherId, date, startTime, endTime, room, subject, rombel, notes, ket, status });
    closeModal('modal-assign');
    showToast(isDraft ? 'Jadwal tersimpan sebagai Draft!' : 'Jadwal berhasil dikirim!', 'success', `${teacher.name} — ${dayName} ${formatDateIndo(date)}, ${startTime}–${endTime}`);
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

    let list = getFilteredSchedules();

    // Filter by week
    const weekDates = getWeekDates(currentSchedWeekStart);
    const sundayDate = adjustDateDays(weekDates[5], 1);
    const fullWeek = [...weekDates, sundayDate];
    list = list.filter(s => fullWeek.includes(s.date));

    // Update label
    const startStr = formatDateIndo(weekDates[0]);
    const endStr   = formatDateIndo(weekDates[5]);
    const labelEl = document.getElementById('admin-sched-week-label');
    if (labelEl) labelEl.textContent = `${startStr} – ${endStr}`;

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
                    <button class="btn btn-icon btn-sm" title="Edit jadwal ini"
                        onclick="editSchedule('${s.id}')">✏️</button>
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

    const allSchedules = getFilteredSchedules();
    const allTeachers  = getFilteredTeachers();

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
                        <div style="display:flex;gap:2px;">
                            <button class="btn btn-icon btn-sm" style="padding:1px 4px;font-size:.65rem;" onclick="editSchedule('${s.id}')" title="Edit">✏️</button>
                            <button class="btn btn-icon btn-sm" style="padding:1px 4px;font-size:.65rem;" onclick="deleteSchedule('${s.id}')" title="Hapus">🗑️</button>
                        </div>
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
    if (adminSchedulesView === 'list') {
        renderSchedulesList();
    } else {
        renderWeeklyGridSchedulesAdmin();
    }
}

function populateSchedulesFilter() {
    const sel = document.getElementById('filter-sched-teacher');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Semua MT</option>';
    getFilteredTeachers().forEach(t => {
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
//  EDIT SCHEDULE (Admin can edit approved/pending/rejected schedules)
// ────────────────────────────────────────────────────────────────────
function populateEditScheduleSelects() {
    // Populate MASTER TEACHER
    const teacherSel = document.getElementById('edit-sched-teacher');
    teacherSel.innerHTML = '<option value="">— Pilih MT —</option>';
    getFilteredTeachers().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        teacherSel.appendChild(opt);
    });

    // Populate MAPEL
    const subSel = document.getElementById('edit-sched-subject');
    subSel.innerHTML = '<option value="">— Pilih Mapel —</option>';
    MAPEL_LIST.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        subSel.appendChild(opt);
    });

    // Populate KELAS
    const rombelSel = document.getElementById('edit-sched-rombel');
    rombelSel.innerHTML = '<option value="">— Pilih Kelas —</option>';
    const currentRombelList = getDynamicRombelList();
    currentRombelList.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        rombelSel.appendChild(opt);
    });

    // Populate KET
    const ketSel = document.getElementById('edit-sched-ket');
    ketSel.innerHTML = '<option value="">— Pilih Keterangan —</option>';
    KET_LIST.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        ketSel.appendChild(opt);
    });

    // Populate RUANGAN
    const roomSel = document.getElementById('edit-sched-room');
    roomSel.innerHTML = '<option value="">— Pilih Ruangan —</option>';
    RUANGAN_LIST.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        roomSel.appendChild(opt);
    });
}

function editSchedule(id) {
    const s = DB.getSchedules().find(sc => sc.id === id);
    if (!s) { showToast('Jadwal tidak ditemukan.', 'error'); return; }

    const teacher = DB.getTeacher(s.teacherId);
    const dayName = getDayNameFromDate(s.date);
    const dateFormatted = formatDateIndo(s.date);

    populateEditScheduleSelects();

    // Fill hidden ID
    document.getElementById('edit-sched-id').value = s.id;

    // Info display
    document.getElementById('edit-sched-date-label').textContent = `${dayName}, ${dateFormatted}`;
    document.getElementById('edit-sched-status-badge').innerHTML = getStatusBadge(s.status);

    // Set current teacher in dropdown
    const teacherSel = document.getElementById('edit-sched-teacher');
    if (s.teacherId && !Array.from(teacherSel.options).some(o => o.value === s.teacherId)) {
        const opt = document.createElement('option');
        opt.value = s.teacherId;
        opt.textContent = teacher ? teacher.name : s.teacherId;
        teacherSel.appendChild(opt);
    }
    teacherSel.value = s.teacherId || '';

    // Ensure current values exist in dropdowns (in case they were custom)
    const subSel = document.getElementById('edit-sched-subject');
    if (s.subject && !Array.from(subSel.options).some(o => o.value === s.subject)) {
        const opt = document.createElement('option');
        opt.value = s.subject;
        opt.textContent = s.subject;
        subSel.appendChild(opt);
    }
    subSel.value = s.subject || '';

    const rombelSel = document.getElementById('edit-sched-rombel');
    if (s.rombel && !Array.from(rombelSel.options).some(o => o.value === s.rombel)) {
        const opt = document.createElement('option');
        opt.value = s.rombel;
        opt.textContent = s.rombel;
        rombelSel.appendChild(opt);
    }
    rombelSel.value = s.rombel || '';

    const ketSel = document.getElementById('edit-sched-ket');
    if (s.ket && !Array.from(ketSel.options).some(o => o.value === s.ket)) {
        const opt = document.createElement('option');
        opt.value = s.ket;
        opt.textContent = s.ket;
        ketSel.appendChild(opt);
    }
    ketSel.value = s.ket || '';

    const roomSel = document.getElementById('edit-sched-room');
    if (s.room && !Array.from(roomSel.options).some(o => o.value === s.room)) {
        const opt = document.createElement('option');
        opt.value = s.room;
        opt.textContent = s.room;
        roomSel.appendChild(opt);
    }
    roomSel.value = s.room || '';

    // Time fields
    document.getElementById('edit-sched-start-time').value = s.startTime || '';
    document.getElementById('edit-sched-end-time').value = s.endTime || '';

    openModal('modal-edit-schedule');
}

async function submitEditSchedule(e) {
    e.preventDefault();

    const id = document.getElementById('edit-sched-id').value;
    const teacherId = document.getElementById('edit-sched-teacher').value;
    const subject = document.getElementById('edit-sched-subject').value.trim();
    const rombel = document.getElementById('edit-sched-rombel').value.trim();
    const ket = document.getElementById('edit-sched-ket').value;
    const room = document.getElementById('edit-sched-room').value;
    const startTime = document.getElementById('edit-sched-start-time').value;
    const endTime = document.getElementById('edit-sched-end-time').value;

    if (!teacherId) {
        showToast('Pilih Master Teacher terlebih dahulu.', 'warning');
        return;
    }

    if (startTime >= endTime) {
        showToast('Jam selesai harus setelah jam mulai.', 'warning');
        return;
    }

    const updates = { teacherId, subject, rombel, ket, room, startTime, endTime };

    await FireDB.updateSchedule(id, updates);
    closeModal('modal-edit-schedule');
    showToast('Jadwal berhasil diperbarui!', 'success');
    renderAll();
}

// ────────────────────────────────────────────────────────────────────
//  TEACHER MANAGEMENT TAB
// ────────────────────────────────────────────────────────────────────
function renderTeacherMgmt() {
    const grid = document.getElementById('teacher-mgmt-grid');
    const teachers = getFilteredTeachers();

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
    if (adminCurrentBranch !== 'all') {
        document.getElementById('mt-branch').value = adminCurrentBranch;
    } else {
        document.getElementById('mt-branch').value = 'Pinrang';
    }
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
    document.getElementById('mt-branch').value = t.branch || 'Pinrang';
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
    const branch = document.getElementById('mt-branch').value;

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
        await FireDB.saveTeacher({ ...existing, name, email, pin, branch, subjects });
        showToast('Data MT berhasil diperbarui.', 'success');
    } else {
        // Add new
        await FireDB.addTeacher({ name, email, pin, branch, subjects, avatarBg: rnd[0], avatarColor: rnd[1] });
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

function getRombelGradeWeight(rombel) {
    if (!rombel) return 99;
    const r = rombel.toUpperCase();
    if (r.includes('SD')) {
        const match = r.match(/(\d+)\s*SD/);
        return match ? parseInt(match[1], 10) : 6;
    }
    if (r.includes('SMP')) {
        const match = r.match(/(\d+)\s*SMP/);
        return match ? parseInt(match[1], 10) : 9;
    }
    if (r.includes('SMA')) {
        const match = r.match(/(\d+)\s*SMA/);
        return match ? parseInt(match[1], 10) : 12;
    }
    if (r.includes('SNBT')) return 13;
    if (r.startsWith('MC')) return 14;
    return 99;
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

    const allSchedules = getFilteredSchedules();
    const allTeachers  = getFilteredTeachers();

    // Filter templates by room and branch, then sort by grade
    let templates = DB.getTemplates();
    
    if (adminCurrentBranch !== 'all') {
        templates = templates.filter(t => t.branch === adminCurrentBranch || !t.branch);
    }
    
    if (curRoom) {
        templates = templates.filter(t => t.room.split(',').map(r=>r.trim()).includes(curRoom));
    }
    
    templates.sort((a, b) => getRombelGradeWeight(a.rombel) - getRombelGradeWeight(b.rombel));

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
                    const statusClass = s.status === 'draft' ? 'tt-slot-draft' :
                                       s.status === 'approved' ? 'tt-slot-approved' :
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

                    if (s.status === 'rejected') {
                        const rejectTooltip = s.rejectReason ? ` data-tooltip="Alasan ditolak: ${s.rejectReason}"` : '';
                        html += `<td class="tt-day-cell">
                            <div class="tt-slot-chip tt-slot-assigned ${statusClass}${conflictClass}" ${rejectTooltip}>
                                <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:2px;">
                                    <span class="tt-chip-teacher" style="text-decoration:line-through;">❌ ${t?.name||'?'}</span>
                                    <div style="display:flex; gap:2px;">
                                        <button class="sched-chip-delete-btn" onclick="event.stopPropagation(); replaceRejectedSchedule('${s.id}')" title="Ganti MT (Hapus & Assign Baru)">🔄</button>
                                        <button class="sched-chip-delete-btn" onclick="event.stopPropagation(); deleteSchedule('${s.id}')" title="Hapus Jadwal Ditolak">×</button>
                                    </div>
                                </div>
                                <span style="font-size:.6rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block;">${s.subject || '–'}</span>
                                ${hasConflict ? '<span style="font-size:.6rem;color:#ef4444;">⚠️ Bentrok!</span>' : ''}
                            </div>
                        </td>`;
                    } else {
                        html += `<td class="tt-day-cell">
                            <div class="tt-slot-chip tt-slot-assigned ${statusClass}${conflictClass}" title="${t?.name||'?'} • ${s.subject}" onclick="editSchedule('${s.id}')" style="cursor:pointer;">
                                <span class="tt-chip-teacher">${t?.name||'?'}</span>
                                <span style="font-size:.6rem;">${s.subject || '–'}</span>
                                ${hasConflict ? '<span style="font-size:.6rem;color:#ef4444;">⚠️ Bentrok!</span>' : ''}
                            </div>
                        </td>`;
                    }
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

            if (sIdx === 0) {
                html += `<td rowspan="${totalRows}" style="text-align:center; vertical-align:middle;">
                    <button class="btn btn-secondary btn-sm" style="margin-bottom:4px;width:100%;padding:4px;font-size:0.75rem;" onclick="openTemplateModal('${tmpl.id}')">✏️ Edit</button>
                    <button class="btn btn-secondary btn-sm" style="width:100%;color:var(--ba-red);padding:4px;font-size:0.75rem;" onclick="deleteTemplate('${tmpl.id}')">🗑️ Hapus</button>
                </td>`;
            }

            html += '</tr>';
        });

        // Separator between rombels
        if (tmplIdx < templates.length - 1) {
            html += '<tr class="tt-separator-row"><td colspan="11"></td></tr>';
        }
    });

    if (!templates.length) {
        html = '<tr><td colspan="11" class="text-center text-muted" style="padding:2rem;">Tidak ada template jadwal untuk filter ini.</td></tr>';
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

async function replaceRejectedSchedule(id) {
    const s = DB.getSchedules().find(sc => sc.id === id);
    if (!s) return;

    if (!confirm('Hapus jadwal yang ditolak ini dan pilih MT baru?')) return;

    // Delete existing rejected schedule
    await FireDB.deleteSchedule(id);

    // Open quick assign with existing schedule parameters
    populateAssignSelects();
    document.getElementById('assign-teacher').value = '';
    document.getElementById('assign-date').value = s.date;
    document.getElementById('assign-start-time').value = s.startTime;
    document.getElementById('assign-end-time').value = s.endTime;
    document.getElementById('assign-rombel').value = s.rombel;
    document.getElementById('assign-subject').value = s.subject || '';
    document.getElementById('assign-ket').value = s.ket || '';
    document.getElementById('assign-notes').value = s.notes || '';

    const roomSel = document.getElementById('assign-room');
    if (s.room) {
        const firstRoom = s.room.split(',')[0].trim();
        roomSel.value = firstRoom;
    }

    const isDraftCb = document.getElementById('assign-as-draft');
    if (isDraftCb) isDraftCb.checked = true;

    updateAvailHint();
    openModal('modal-assign');
    document.getElementById('assign-teacher').focus();
    showToast('Jadwal ditolak telah dihapus. Silakan pilih MT baru.', 'info');
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

async function sendAllDraftsThisWeek() {
    const weekDates = getWeekDates(currentTimetableWeekStart);
    const drafts = getFilteredSchedules().filter(s => s.status === 'draft' && weekDates.includes(s.date));
    
    if (drafts.length === 0) {
        showToast('Tidak ada jadwal draft di minggu ini.', 'info');
        return;
    }
    
    if (!confirm(`Kirim ${drafts.length} jadwal draft ke MT sekarang? MT akan melihat jadwal ini sebagai "Menunggu" dan bisa meresponnya.`)) return;
    
    const btn = event.target;
    if (btn) {
        btn.dataset.oldText = btn.innerHTML;
        btn.innerHTML = 'Mengirim...';
        btn.disabled = true;
    }
    
    try {
        for (const s of drafts) {
            await FireDB.updateScheduleStatus(s.id, 'pending');
        }
        showToast(`${drafts.length} jadwal berhasil dikirim ke MT!`, 'success');
        renderAll();
    } catch (e) {
        showToast('Gagal mengirim jadwal.', 'error');
    } finally {
        if (btn) {
            btn.innerHTML = btn.dataset.oldText;
            btn.disabled = false;
        }
    }
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

    // Sync MAPEL_LIST from persistent storage
    const persistedMapel = DB.getMapelList();
    MAPEL_LIST.length = 0;
    persistedMapel.forEach(m => MAPEL_LIST.push(m));

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

// ==========================================
// PETA JADWAL (TEMPLATE) CRUD
// ==========================================

function renderSessionInputs(presetSessions = {}) {
    const container = document.getElementById('tmpl-sessions-container');
    if (!container) return;
    container.innerHTML = '';
    const daysNodes = document.querySelectorAll('input[name="tmpl-days"]:checked');
    if (daysNodes.length === 0) return;
    
    daysNodes.forEach(cb => {
        const day = cb.value;
        const val = presetSessions[day] || '';
        const html = `
            <div class="form-group" style="margin-top:0.75rem; padding:0.75rem; background:var(--bg-body); border-radius:8px; border:1px solid var(--border-color);">
                <label class="form-label" style="color:var(--primary-color);">🕒 Sesi / Waktu ${day} (Format: HH:MM-HH:MM)</label>
                <input type="text" id="tmpl-sessions-${day}" class="form-control" placeholder="15:00-16:30, 17:00-18:30" value="${val}" required>
                <small style="color:var(--text-muted); display:block; margin-top:4px;">Pisahkan dengan koma jika ada lebih dari 1 sesi.</small>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function openTemplateModal(tmplId = null) {
    const form = document.getElementById('form-template');
    form.reset();
    document.getElementById('tmpl-id').value = '';
    document.getElementById('template-modal-title').textContent = 'Tambah Rombel Baru';

    // Default branch selection
    const branchSelect = document.getElementById('tmpl-branch');
    if (branchSelect) {
        branchSelect.value = (adminCurrentBranch !== 'all') ? adminCurrentBranch : 'Pinrang';
    }

    // Clear checkboxes
    document.querySelectorAll('input[name="tmpl-days"]').forEach(cb => cb.checked = false);
    renderSessionInputs();

    if (tmplId) {
        const tmpl = DB.getTemplates().find(t => t.id === tmplId);
        if (tmpl) {
            document.getElementById('template-modal-title').textContent = 'Edit Rombel';
            document.getElementById('tmpl-id').value = tmpl.id;
            const branchSelect = document.getElementById('tmpl-branch');
            if (branchSelect && tmpl.branch) branchSelect.value = tmpl.branch;
            document.getElementById('tmpl-rombel').value = tmpl.rombel;
            document.getElementById('tmpl-room').value = tmpl.room;
            
            let presetSessions = {};
            tmpl.days.forEach(day => {
                const cb = document.querySelector(`input[name="tmpl-days"][value="${day}"]`);
                if (cb) cb.checked = true;
                presetSessions[day] = tmpl.sessions.map(s => `${s.start}-${s.end}`).join(', ');
            });
            renderSessionInputs(presetSessions);
        }
    }
    openModal('modal-template');
}

async function submitTemplate(e) {
    e.preventDefault();
    
    const id = document.getElementById('tmpl-id').value;
    const branchSelect = document.getElementById('tmpl-branch');
    const branch = branchSelect ? branchSelect.value : 'Pinrang';
    const rombel = document.getElementById('tmpl-rombel').value.trim();
    const room = document.getElementById('tmpl-room').value.trim();
    
    const daysNodes = document.querySelectorAll('input[name="tmpl-days"]:checked');
    const days = Array.from(daysNodes).map(cb => cb.value);
    
    if (days.length === 0) {
        showToast('Pilih minimal 1 hari', 'error');
        return;
    }
    
    const templatesToSave = [];
    for (let day of days) {
        const sessionsStr = document.getElementById(`tmpl-sessions-${day}`).value.trim();
        const sessionsArr = sessionsStr.split(',').map(s => s.trim()).filter(s => s);
        const sessions = [];
        
        for (let i = 0; i < sessionsArr.length; i++) {
            const parts = sessionsArr[i].split('-');
            if (parts.length !== 2) {
                showToast(`Format sesi tidak valid pada hari ${day}. Gunakan HH:MM-HH:MM`, 'error');
                return;
            }
            sessions.push({
                start: parts[0].trim(),
                end: parts[1].trim(),
                label: `Sesi ${i+1}`
            });
        }
        
        templatesToSave.push({
            branch,
            rombel,
            days: [day], // Split into 1 template per day
            sessions,
            room
        });
    }
    
    // If editing, delete the old one
    if (id) {
        await FireDB.deleteTemplate(id);
    }
    
    for (const tmpl of templatesToSave) {
        await FireDB.saveTemplate(tmpl);
    }
    
    closeModal('modal-template');
    showToast('Peta jadwal berhasil disimpan', 'success');
    renderTimetable();
}

async function deleteTemplate(id) {
    if (confirm('Yakin ingin menghapus rombel ini dari peta jadwal?')) {
        await FireDB.deleteTemplate(id);
        showToast('Rombel berhasil dihapus', 'success');
        renderTimetable();
    }
}

async function resetTemplatesToDefault() {
    if (!confirm('PERINGATAN: Aksi ini akan menghapus semua template yang ada dan menggantinya dengan template default (Gambar 1 & Gambar 2). Lanjutkan?')) return;
    
    // Show loading toast
    showToast('Mereset peta jadwal...', 'info');
    
    // Delete all current templates
    const currentTemplates = DB.getTemplates();
    for (const t of currentTemplates) {
        await FireDB.deleteTemplate(t.id);
    }
    
    // Add default templates
    for (const t of DEFAULT_TEMPLATES) {
        await FireDB.saveTemplate(t);
    }
    
    // Update local version flag just in case
    const db = DB.get();
    db.templateVersion = 2; // match CURRENT_TEMPLATE_VERSION if used
    DB.flush();
    
    showToast('Peta jadwal berhasil direset ke default!', 'success');
    renderTimetable();
}

