/* ==========================================================================
   REKAP JADWAL HARI INI — BRAIN ACADEMIA PINRANG
   Public page: no auth required. Shows approved schedules for today.
   ========================================================================== */

// ── Today's date ──
function getTodayStr() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function getTodayLabel() {
    const now = new Date();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

// ── Clock ──
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const el = document.getElementById('current-clock');
    if (el) el.textContent = `${h}:${m}:${s}`;
}

// ── Subject badge styling ──
function getSubjectBadgeStyle(subject) {
    if (!subject) return 'background:var(--bg-sidebar);color:var(--text-secondary);';
    const s = subject.toUpperCase();
    if (s.startsWith('SD:') || s.includes('IPA') || s.includes('IPS'))
        return 'background:#D1FAE5;color:#065F46;';
    if (s.startsWith('SMP:') || s.includes('FISIKA') || s.includes('KIMIA') || s.includes('BIOLOGI'))
        return 'background:#DBEAFE;color:#1E40AF;';
    if (s.startsWith('SMA:') || s.includes('MATEMATIKA') || s.includes('MTK'))
        return 'background:#FEF3C7;color:#92400E;';
    if (s.startsWith('UTBK:') || s.includes('UTBK') || s.includes('PENALARAN') || s.includes('LITERASI') || s.includes('PBM') || s.includes('PPU'))
        return 'background:#EDE9FE;color:#5B21B6;';
    if (s.includes('BAHASA INGGRIS') || s.includes('INGGRIS'))
        return 'background:#FCE7F3;color:#9D174D;';
    if (s.includes('BAHASA INDONESIA') || s.includes('INDONESIA'))
        return 'background:#FEE2E2;color:#991B1B;';
    return 'background:var(--bg-sidebar);color:var(--text-secondary);';
}

// ── Get live status of a schedule ──
function getScheduleLiveStatus(startTime, endTime) {
    const now = new Date();
    const hh = now.getHours();
    const mm = now.getMinutes();
    const currentMinutes = hh * 60 + mm;

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return { label: '● Berlangsung', cls: 'status-active-dot' };
    } else if (currentMinutes < startMinutes) {
        return { label: '○ Akan Datang', cls: 'status-upcoming-dot' };
    } else {
        return { label: '✓ Selesai', cls: 'status-done-dot' };
    }
}

// ── Populate room filter ──
function populateRoomFilter() {
    const sel = document.getElementById('filter-rekap-room');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Semua Ruangan</option>';
    RUANGAN_LIST.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = 'Ruangan ' + r;
        sel.appendChild(opt);
    });
    sel.value = cur;
}

// ── Main render ──
function renderRekap() {
    const todayStr = getTodayStr();
    const branchFilter = document.getElementById('filter-rekap-branch')?.value || 'all';
    const roomFilter = document.getElementById('filter-rekap-room')?.value || '';

    // Update date label
    document.getElementById('rekap-date-label').textContent = getTodayLabel();

    // Get all data
    let teachers = DB.getTeachers();
    if (branchFilter !== 'all') {
        teachers = teachers.filter(t => t.branch === branchFilter);
    }
    const teacherIds = teachers.map(t => t.id);

    // Filter schedules: today + approved + matching branch
    let schedules = DB.getSchedules().filter(s =>
        s.date === todayStr &&
        s.status === 'approved' &&
        teacherIds.includes(s.teacherId)
    );

    // Room filter
    if (roomFilter) {
        schedules = schedules.filter(s =>
            s.room && s.room.split(',').map(r => r.trim()).includes(roomFilter)
        );
    }

    // Sort by start time
    schedules.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));

    // Render stats
    const totalSchedules = schedules.length;
    const uniqueTeachers = new Set(schedules.map(s => s.teacherId)).size;
    const uniqueRooms = new Set(schedules.flatMap(s => s.room ? s.room.split(',').map(r => r.trim()) : [])).size;
    const activeNow = schedules.filter(s => {
        const status = getScheduleLiveStatus(s.startTime, s.endTime);
        return status.cls === 'status-active-dot';
    }).length;

    document.getElementById('rekap-stats').innerHTML = `
        <div class="rekap-stat-pill">
            📋 Total Jadwal: <span class="stat-value">${totalSchedules}</span>
        </div>
        <div class="rekap-stat-pill">
            👨‍🏫 MT Aktif: <span class="stat-value">${uniqueTeachers}</span>
        </div>
        <div class="rekap-stat-pill">
            🏫 Ruangan: <span class="stat-value">${uniqueRooms}</span>
        </div>
        <div class="rekap-stat-pill" style="${activeNow > 0 ? 'border-color:var(--success);background:var(--success-light);' : ''}">
            🟢 Berlangsung: <span class="stat-value" style="${activeNow > 0 ? 'color:var(--success);' : ''}">${activeNow}</span>
        </div>
    `;

    // Render table
    const tbody = document.getElementById('rekap-tbody');

    if (schedules.length === 0) {
        tbody.innerHTML = `
        <tr><td colspan="8">
            <div class="rekap-empty">
                <div class="rekap-empty-icon">📭</div>
                <div class="rekap-empty-title">Tidak Ada Jadwal Hari Ini</div>
                <div class="rekap-empty-desc">Belum ada jadwal yang disetujui untuk hari ini${branchFilter !== 'all' ? ' di cabang ' + branchFilter : ''}.</div>
            </div>
        </td></tr>`;
        return;
    }

    // Group schedules by time session for visual grouping
    const timeGroups = {};
    schedules.forEach(s => {
        const key = `${s.startTime}–${s.endTime}`;
        if (!timeGroups[key]) timeGroups[key] = [];
        timeGroups[key].push(s);
    });

    let html = '';
    let no = 1;

    Object.entries(timeGroups).forEach(([timeKey, groupScheds]) => {
        // Session divider
        html += `
        <tr class="session-divider-row">
            <td colspan="8">🕐 Sesi ${timeKey} (${groupScheds.length} jadwal)</td>
        </tr>`;

        groupScheds.forEach(s => {
            const t = teachers.find(x => x.id === s.teacherId);
            const initials = t ? t.name.split(' ').map(w => w[0]).join('').slice(0, 2) : '?';
            const liveStatus = getScheduleLiveStatus(s.startTime, s.endTime);
            const subjectStyle = getSubjectBadgeStyle(s.subject);

            html += `
            <tr>
                <td style="text-align:center;color:var(--text-muted);font-weight:700;font-size:0.78rem;">${no++}</td>
                <td>
                    <div class="rekap-teacher-cell">
                        <div class="rekap-teacher-avatar" style="background:${t?.avatarBg || '#E2E8F0'};color:${t?.avatarColor || '#475569'};">
                            ${initials}
                        </div>
                        <div>
                            <div class="rekap-teacher-name">${t?.name || '—'}</div>
                            ${t?.branch ? `<div style="font-size:0.68rem;color:var(--text-muted);font-weight:500;">📍 ${t.branch}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <div class="rekap-time-cell">
                        <span class="time-icon">🕒</span>
                        ${s.startTime} – ${s.endTime}
                    </div>
                </td>
                <td>
                    <span class="rekap-subject-badge" style="${subjectStyle}">
                        ${s.subject || '—'}
                    </span>
                </td>
                <td class="rekap-rombel-cell">
                    👥 ${s.rombel || '—'}
                </td>
                <td class="rekap-ket-cell">
                    ${s.ket ? `🏷️ ${s.ket}` : '<span style="color:var(--text-muted);">—</span>'}
                </td>
                <td class="rekap-room-cell">
                    🏫 ${s.room || '—'}
                </td>
                <td>
                    <span class="${liveStatus.cls}">${liveStatus.label}</span>
                </td>
            </tr>`;
        });
    });

    tbody.innerHTML = html;
}

// ── Auto-refresh ──
const REFRESH_INTERVAL = 60; // seconds
let refreshCountdown = REFRESH_INTERVAL;

function startRefreshTimer() {
    const bar = document.getElementById('refresh-bar');
    refreshCountdown = REFRESH_INTERVAL;

    setInterval(() => {
        refreshCountdown--;
        if (bar) {
            const pct = ((REFRESH_INTERVAL - refreshCountdown) / REFRESH_INTERVAL) * 100;
            bar.style.width = pct + '%';
        }

        if (refreshCountdown <= 0) {
            refreshCountdown = REFRESH_INTERVAL;
            if (bar) bar.style.width = '0%';
            refreshData();
        }
    }, 1000);
}

async function refreshData() {
    try {
        if (typeof FireDB !== 'undefined' && await FireDB.isReady()) {
            await FireDB.syncToLocal();
        }
        DB._data = null;
        DB.load();
    } catch (e) {
        console.warn('[Rekap] Refresh error:', e);
    }
    renderRekap();
}

// ── Init ──
(async function init() {
    const overlay = document.getElementById('fb-loading-overlay');

    try {
        if (typeof window.firebaseReady !== 'undefined') {
            await window.firebaseReady;
            if (typeof FireDB !== 'undefined') {
                await FireDB.syncToLocal();
            }
        }
    } catch (e) {
        console.warn('[Rekap] Firebase init error, using local data.', e);
    } finally {
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => overlay.remove(), 500);
        }
    }

    populateRoomFilter();
    renderRekap();
    startRefreshTimer();

    // Update clock every second
    updateClock();
    setInterval(updateClock, 1000);

    // Re-render every 30 seconds to update live statuses
    setInterval(renderRekap, 30000);
})();
