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

function getTodayLabel(dateStr) {
    const now = dateStr ? new Date(dateStr) : new Date();
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
function getScheduleLiveStatus(scheduleDateStr, startTime, endTime) {
    const todayStr = getTodayStr();
    if (scheduleDateStr < todayStr) {
        return { label: '✓ Selesai', cls: 'status-done-dot' };
    } else if (scheduleDateStr > todayStr) {
        return { label: '○ Akan Datang', cls: 'status-upcoming-dot' };
    }

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

// ── Get score for rombel sorting ──
function getRombelScore(rombel) {
    if (!rombel) return 999;
    const r = rombel.toUpperCase();
    let score = 0;
    if (r.includes('SD')) score = 100;
    else if (r.includes('SMP')) score = 200;
    else if (r.includes('SMA')) score = 300;
    else if (r.includes('SNBT') || r.includes('UTBK')) score = 400;
    else score = 500;
    
    const match = r.match(/(\d+)/);
    if (match) score += parseInt(match[1]);
    return score;
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
    const dateInput = document.getElementById('filter-rekap-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = getTodayStr();
    }
    const targetDateStr = dateInput ? dateInput.value : getTodayStr();
    const branchFilter = document.getElementById('filter-rekap-branch')?.value || 'all';
    const roomFilter = document.getElementById('filter-rekap-room')?.value || '';

    // Update date label
    document.getElementById('rekap-date-label').textContent = getTodayLabel(targetDateStr);

    // Get all data
    let teachers = DB.getTeachers();
    if (branchFilter !== 'all') {
        teachers = teachers.filter(t => t.branch === branchFilter);
    }
    const teacherIds = teachers.map(t => t.id);

    // Filter schedules: target date + (approved or pending) + matching branch
    let schedules = DB.getSchedules().filter(s =>
        s.date === targetDateStr &&
        (s.status === 'approved' || s.status === 'pending') &&
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
        const status = getScheduleLiveStatus(s.date, s.startTime, s.endTime);
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
        <tr><td colspan="4">
            <div class="rekap-empty">
                <div class="rekap-empty-icon">📭</div>
                <div class="rekap-empty-title">Tidak Ada Jadwal</div>
                <div class="rekap-empty-desc">Belum ada jadwal untuk tanggal ini${branchFilter !== 'all' ? ' di cabang ' + branchFilter : ''}.</div>
            </div>
        </td></tr>`;
        return;
    }

    // Group schedules by rombel
    const rombelGroups = {};
    schedules.forEach(s => {
        const key = s.rombel || 'Lainnya';
        if (!rombelGroups[key]) rombelGroups[key] = [];
        rombelGroups[key].push(s);
    });

    const sortedRombelKeys = Object.keys(rombelGroups).sort((a, b) => getRombelScore(a) - getRombelScore(b));

    let html = '';

    sortedRombelKeys.forEach(rombelKey => {
        const groupScheds = rombelGroups[rombelKey];
        // Sort inside group by time
        groupScheds.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));

        // Background color logic for the Kelas column (similar to image)
        let rowBgClass = '';
        if (rombelKey.toUpperCase().includes('SD')) rowBgClass = 'background: rgba(226, 232, 240, 0.6);';
        else if (rombelKey.toUpperCase().includes('SMP')) rowBgClass = 'background: rgba(219, 234, 254, 0.6);';
        else if (rombelKey.toUpperCase().includes('SMA')) rowBgClass = 'background: rgba(254, 243, 199, 0.6);';
        else if (rombelKey.toUpperCase().includes('UTBK')) rowBgClass = 'background: rgba(237, 233, 254, 0.6);';

        groupScheds.forEach((s, index) => {
            const t = teachers.find(x => x.id === s.teacherId);
            const subjectStyle = getSubjectBadgeStyle(s.subject);
            const pendingMark = s.status === 'pending' ? `<span style="font-size:0.65rem;background:#FEF3C7;color:#92400E;padding:2px 6px;border-radius:12px;margin-left:6px;font-weight:bold;">⏳ Menunggu</span>` : '';
            
            // For the first row, we render the 'KELAS' cell with rowspan
            html += `<tr>`;
            if (index === 0) {
                html += `
                <td rowspan="${groupScheds.length}" style="text-align:center; font-weight:800; font-size:1rem; border-right:1px solid var(--border-color); ${rowBgClass}">
                    ${rombelKey}
                </td>`;
            }

            html += `
                <td style="text-align:center; border-right:1px solid var(--border-color);">
                    <div style="font-weight:700; color:var(--ba-red); font-size:0.85rem;">
                        ${s.startTime} – ${s.endTime}
                    </div>
                </td>
                <td style="border-right:1px solid var(--border-color);">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div>
                            <span class="rekap-subject-badge" style="${subjectStyle}">
                                ${s.subject || '—'}
                            </span>
                        </div>
                        <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem;">
                            👨‍🏫 ${t?.name || '—'} ${pendingMark}
                        </div>
                        ${t?.branch ? `<div style="font-size:0.65rem;color:var(--text-muted);font-weight:600;">📍 ${t.branch}</div>` : ''}
                    </div>
                </td>
                <td style="text-align:center; font-weight:700; color:var(--text-primary); border-right:1px solid var(--border-color);">
                    ${s.room || '—'}
                </td>
                <td style="text-align:center; font-size:0.8rem; font-weight:600; color:var(--text-secondary);">
                    ${s.ket || '—'}
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
