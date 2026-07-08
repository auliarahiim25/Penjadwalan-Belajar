/* ==========================================================================
   BRAIN ACADEMIA PINRANG — SHARED DATA STORE
   ========================================================================== */

const BA_DB_KEY = 'ba_pinrang_scheduler_v5';
const BA_SESSION_KEY = 'ba_pinrang_session';

// --- Date Helpers ---
function getDayNameFromDate(dateStr) {
    if (!dateStr) return '';
    // Use split to avoid timezone offsets causing date to shift
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[date.getDay()];
}

function getWeekDates(startDateStr) {
    const parts = startDateStr.split('-');
    let start = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(start.setDate(diff));

    const dates = [];
    for (let i = 0; i < 6; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
}

function formatDateIndo(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${parts[2]} ${months[d.getMonth()]} ${parts[0]}`;
}

function adjustDateDays(dateStr, daysOffset) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + daysOffset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}


// --- Master Data from Spreadsheet ---
const MAPEL_LIST = [
    // Mata Pelajaran Umum
    "FISIKA", "MATEMATIKA", "MATEMATIKA LANJUT", "BAHASA INDONESIA", "BAHASA INGGRIS",
    "BIOLOGI", "KIMIA", "IPA", "IPA TERPADU", "IPS TERPADU",
    "EKONOMI", "SEJARAH", "GEOGRAFI", "SOSIOLOGI", "PKN",
    // UTBK / Penalaran
    "PENGETAHUAN KUANTITATIF", "PENALARAN MATEMATIKA", "PENALARAN UMUM",
    "DASAR-DASAR NUMERASI", "DASAR-DASAR LINGUSTIK",
    "LITERASI BAHASA INGGRIS", "LITERASI BAHASA INDONESIA",
    "PPU", "PBM",
    // Kelas khusus
    "MC-SINGAPORE", "IPA-FISIKA", "IPA-BIOLOGI", "IPA-KIMIA",
    "IPS-GEOGRAFI", "IPS-SOSIOLOGI", "IPS-EKONOMI",
    "UTBK-PM", "UTBK-PK", "UTBK-PPU", "UTBK-PBM", "UTBK-LBI", "UTBK-LBE", "UTBK-PU",
    "MTK-LANJUT", "INGGRIS-LANJUT",
    "DASAR-DASAR NUMERASI", "DASAR-DASAR LINGUSTIK"
];

// Deduplicate MAPEL_LIST
const _mapelSet = new Set(MAPEL_LIST);
MAPEL_LIST.length = 0;
_mapelSet.forEach(m => MAPEL_LIST.push(m));

const KELAS_LIST = [
    "MC-SG R1", "MC-SG R2", "5 SD R1", "6 SD R1", "6 SD R2",
    "7 SMP R1", "8 SMP R1", "9 SMP R1",
    "10 SMA R1", "11 SMA R1", "12 SMA R1", "12 SNBT",
    "4 SD", "5 SD", "6 SD R1", "6 SD R2", "7 SMP", "8 SMP", "9 SMP",
    "10 SMA", "11 SMA", "12 SNBT", "SNBT MASTER", "MC-R1", "MC-R2",
    "RGP", "UTBK CHAMPS", "KPR", "RGP MC"
];
// Deduplicate KELAS_LIST
const _kelasSet = new Set(KELAS_LIST);
KELAS_LIST.length = 0;
_kelasSet.forEach(k => KELAS_LIST.push(k));

const KET_LIST = [
    "LD", "AUVI", "AUVI + LD", "TO STS-GENAP", "TO SAS- GENAP",
    "TO STS-GANJIL", "TO SAS- GANJIL", "KPR", "LCD", "RGP"
];

const RUANGAN_LIST = ["101", "102", "201", "202", "203"];

// --- Default Templates ---
const DEFAULT_TEMPLATES = [
    {
        id: 'tmpl-mcsgr1',
        rombel: 'MC-SG R1',
        days: ['Senin', 'Rabu'],
        sessions: [{ start: '15:30', end: '17:00', label: '1 Sesi' }],
        room: '201'
    },
    {
        id: 'tmpl-mcsgr2',
        rombel: 'MC-SG R2',
        days: ['Selasa', 'Kamis'],
        sessions: [{ start: '15:30', end: '17:00', label: '1 Sesi' }],
        room: '201'
    },
    {
        id: 'tmpl-5sdr1',
        rombel: '5 SD R1',
        days: ['Selasa', 'Kamis'],
        sessions: [
            { start: '16:00', end: '17:00', label: 'Sesi 1' },
            { start: '17:15', end: '18:15', label: 'Sesi 2' }
        ],
        room: '102'
    },
    {
        id: 'tmpl-6sdr1',
        rombel: '6 SD R1',
        days: ['Selasa', 'Kamis', 'Sabtu'],
        sessions: [
            { start: '19:00', end: '20:30', label: '1 Sesi' }
        ],
        room: '102'
    },
    {
        id: 'tmpl-6sdr2',
        rombel: '6 SD R2',
        days: ['Senin', 'Rabu'],
        sessions: [
            { start: '13:30', end: '14:30', label: 'Sesi 1' },
            { start: '14:45', end: '15:45', label: 'Sesi 2' }
        ],
        room: '102'
    },
    {
        id: 'tmpl-7smpr1',
        rombel: '7 SMP R1',
        days: ['Senin', 'Rabu'],
        sessions: [
            { start: '16:00', end: '17:00', label: 'Sesi 1' },
            { start: '17:15', end: '18:15', label: 'Sesi 2' }
        ],
        room: '202'
    },
    {
        id: 'tmpl-8smpr1',
        rombel: '8 SMP R1',
        days: ['Senin', 'Jumat'],
        sessions: [
            { start: '15:00', end: '16:30', label: '1 Sesi' }
        ],
        room: '102'
    },
    {
        id: 'tmpl-9smpr1',
        rombel: '9 SMP R1',
        days: ['Senin', 'Jumat'],
        sessions: [
            { start: '19:00', end: '20:30', label: '1 Sesi' }
        ],
        room: '203'
    },
    {
        id: 'tmpl-10smar1',
        rombel: '10 SMA R1',
        days: ['Selasa', 'Kamis'],
        sessions: [
            { start: '17:00', end: '18:30', label: 'Sesi 1' },
            { start: '19:00', end: '20:30', label: 'Sesi 2' }
        ],
        room: '202'
    },
    {
        id: 'tmpl-11smar1',
        rombel: '11 SMA R1',
        days: ['Rabu', 'Jumat'],
        sessions: [
            { start: '17:00', end: '18:30', label: 'Sesi 1' },
            { start: '19:00', end: '20:30', label: 'Sesi 2' }
        ],
        room: '101,202'
    },
    {
        id: 'tmpl-12smar1',
        rombel: '12 SMA R1',
        days: ['Senin', 'Kamis'],
        sessions: [
            { start: '17:00', end: '18:30', label: 'Sesi 1' },
            { start: '19:00', end: '20:30', label: 'Sesi 2' }
        ],
        room: '101'
    },
    {
        id: 'tmpl-12snbt',
        rombel: '12 SNBT',
        days: ['Rabu', 'Jumat'],
        sessions: [
            { start: '17:00', end: '18:30', label: 'Sesi 1' },
            { start: '19:00', end: '20:30', label: 'Sesi 2' }
        ],
        room: '101'
    }
];

// --- Default Seed Data ---
const DEFAULT_TEACHERS = [
    // --- PINRANG BRANCH ---
    {
        id: 'mt-astuti', branch: 'Pinrang', name: 'ASTUTI', email: '-', pin: '1234', avatarBg: '#FFF3CD', avatarColor: '#856404',
        subjects: { SD: [], SMP: ['FISIKA', 'MATEMATIKA', 'MATEMATIKA LANJUT'], SMA: ['FISIKA', 'MATEMATIKA', 'MATEMATIKA LANJUT'], UTBK: ['PENGETAHUAN KUANTITATIF', 'PENALARAN MATEMATIKA', 'PENALARAN UMUM', 'DASAR-DASAR NUMERASI'] }
    },
    {
        id: 'mt-hanifah', branch: 'Pinrang', name: 'HANIFAH SARAH', email: '-', pin: '1234', avatarBg: '#F8D7DA', avatarColor: '#842029',
        subjects: { SD: ['MATEMATIKA', 'IPA'], SMP: ['MATEMATIKA', 'EKONOMI', 'BAHASA INGGRIS', 'MATEMATIKA LANJUT'], SMA: ['MATEMATIKA', 'EKONOMI', 'BAHASA INGGRIS', 'MATEMATIKA LANJUT'], UTBK: ['DASAR-DASAR NUMERASI', 'DASAR-DASAR LINGUSTIK'] }
    },
    {
        id: 'mt-khairunnisa', branch: 'Pinrang', name: 'KHAIRUNNISA ADAM', email: '-', pin: '1234', avatarBg: '#D1ECF1', avatarColor: '#0c5460',
        subjects: { SD: ['IPA'], SMP: ['FISIKA', 'MATEMATIKA', 'IPA'], SMA: ['FISIKA', 'MATEMATIKA'], UTBK: ['PENALARAN MATEMATIKA', 'PENALARAN UMUM'] }
    },
    {
        id: 'mt-haedir', branch: 'Pinrang', name: 'HAEDIR YUNUS', email: '-', pin: '1234', avatarBg: '#D4EDDA', avatarColor: '#155724',
        subjects: { SD: [], SMP: ['BAHASA INGGRIS', 'BIOLOGI', 'KIMIA'], SMA: ['BAHASA INGGRIS', 'BIOLOGI', 'KIMIA'], UTBK: ['LITERASI BAHASA INGGRIS', 'LITERASI BAHASA INDONESIA'] }
    },
    {
        id: 'mt-sriyani', branch: 'Pinrang', name: 'SRIYANI', email: '-', pin: '1234', avatarBg: '#E8D5F5', avatarColor: '#5b21b6',
        subjects: { SD: [], SMP: ['MATEMATIKA', 'IPA TERPADU', 'IPS TERPADU', 'MATEMATIKA LANJUT'], SMA: ['MATEMATIKA', 'MATEMATIKA LANJUT'], UTBK: ['PENGETAHUAN KUANTITATIF', 'PENALARAN MATEMATIKA', 'PENALARAN UMUM', 'DASAR-DASAR NUMERASI'] }
    },
    {
        id: 'mt-putri-p', branch: 'Pinrang', name: 'PUTRI WULANDARI', email: '-', pin: '1234', avatarBg: '#D4EDDA', avatarColor: '#155724',
        subjects: { SD: ['BAHASA INDONESIA'], SMP: ['BAHASA INDONESIA'], SMA: ['BAHASA INDONESIA'], UTBK: ['LITERASI BAHASA INDONESIA', 'PPU', 'PBM', 'DASAR-DASAR LINGUSTIK'] }
    },
    {
        id: 'mt-arfandi', branch: 'Pinrang', name: 'MUH. KHAIRUL ARFANDI', email: '-', pin: '1234', avatarBg: '#F8D7DA', avatarColor: '#842029',
        subjects: { SD: [], SMP: ['MATEMATIKA', 'MATEMATIKA LANJUT'], SMA: ['MATEMATIKA', 'MATEMATIKA LANJUT'], UTBK: ['PENGETAHUAN KUANTITATIF', 'PENALARAN MATEMATIKA', 'PENALARAN UMUM', 'DASAR-DASAR NUMERASI'] }
    },
    {
        id: 'mt-muthia', branch: 'Pinrang', name: 'MUTIA TAUFIQ', email: '-', pin: '1234', avatarBg: '#FDECEA', avatarColor: '#c62828',
        subjects: { SD: [], SMP: ['BAHASA INGGRIS', 'SEJARAH', 'GEOGRAFI', 'EKONOMI', 'SOSIOLOGI'], SMA: ['BAHASA INGGRIS', 'SEJARAH', 'GEOGRAFI', 'EKONOMI', 'SOSIOLOGI'], UTBK: ['LITERASI BAHASA INGGRIS'] }
    },
    {
        id: 'mt-maryam', branch: 'Pinrang', name: 'SITI MARYAM', email: '-', pin: '1234', avatarBg: '#FFF3CD', avatarColor: '#856404',
        subjects: { SD: [], SMP: ['MATEMATIKA', 'BAHASA INDONESIA', 'IPA TERPADU', 'IPS TERPADU', 'EKONOMI', 'PKN', 'MATEMATIKA LANJUT'], SMA: ['MATEMATIKA', 'BAHASA INDONESIA', 'EKONOMI', 'PKN', 'MATEMATIKA LANJUT'], UTBK: [] }
    },
    {
        id: 'mt-ahmad', branch: 'Pinrang', name: 'AHMAD KHAIDIR', email: '-', pin: '1234', avatarBg: '#D1ECF1', avatarColor: '#0c5460',
        subjects: { SD: [], SMP: ['PKN', 'SEJARAH', 'SOSIOLOGI', 'GEOGRAFI'], SMA: ['PKN', 'SEJARAH', 'SOSIOLOGI', 'GEOGRAFI'], UTBK: [] }
    },
    {
        id: 'mt-intan', branch: 'Pinrang', name: 'NURUL INTAN', email: '-', pin: '1234', avatarBg: '#E3F2FD', avatarColor: '#1565c0',
        subjects: { SD: ['IPA'], SMP: ['BIOLOGI', 'KIMIA', 'IPA TERPADU', 'IPS TERPADU', 'MATEMATIKA'], SMA: ['BIOLOGI', 'KIMIA', 'MATEMATIKA'], UTBK: [] }
    },
    {
        id: 'mt-hikma', branch: 'Pinrang', name: 'HIKMA PRISKA', email: '-', pin: '1234', avatarBg: '#E8D5F5', avatarColor: '#5b21b6',
        subjects: { SD: [], SMP: ['KIMIA', 'MATEMATIKA', 'IPA TERPADU', 'IPS TERPADU'], SMA: ['KIMIA', 'MATEMATIKA'], UTBK: [] }
    },

    // --- PAREPARE BRANCH ---
    {
        id: 'mt-annisa-p', branch: 'Parepare', name: 'ANNISAA HANIFAH', email: '-', pin: '1234', avatarBg: '#FFE0E0', avatarColor: '#c62828',
        subjects: { SD: ['IPA TERPADU', 'IPS TERPADU', 'BAHASA INDONESIA', 'BAHASA INGGRIS'], SMP: ['BIOLOGI', 'BAHASA INDONESIA', 'BAHASA INGGRIS', 'KIMIA'], SMA: ['KIMIA', 'BIOLOGI', 'BAHASA INGGRIS', 'BAHASA INDONESIA'], UTBK: ['PPU', 'PU', 'PBM', 'LBI', 'LBE'] }
    },
    {
        id: 'mt-riswan-p', branch: 'Parepare', name: 'RISWAN', email: '-', pin: '1234', avatarBg: '#E3F2FD', avatarColor: '#1565c0',
        subjects: { SD: [], SMP: ['MATEMATIKA', 'FISIKA'], SMA: ['MATEMATIKA', 'FISIKA'], UTBK: ['PENGETAHUAN KUANTITATIF', 'PENALARAN MATEMATIKA', 'PENALARAN UMUM'] }
    },
    {
        id: 'mt-rayhana-p', branch: 'Parepare', name: 'RAYHANA', email: '-', pin: '1234', avatarBg: '#E8D5F5', avatarColor: '#5b21b6',
        subjects: { SD: ['MATEMATIKA', 'IPA'], SMP: ['FISIKA'], SMA: ['FISIKA'], UTBK: [] }
    },
    {
        id: 'mt-sulvirah-p', branch: 'Parepare', name: 'SULVIRAH RAHMI', email: '-', pin: '1234', avatarBg: '#FFF3CD', avatarColor: '#856404',
        subjects: { SD: ['MATEMATIKA'], SMP: ['MATEMATIKA'], SMA: ['MATEMATIKA'], UTBK: ['PENGETAHUAN KUANTITATIF', 'PENALARAN MATEMATIKA', 'PENALARAN UMUM'] }
    },
    {
        id: 'mt-nurgafilah-p', branch: 'Parepare', name: 'NURGAFILAH', email: '-', pin: '1234', avatarBg: '#D4EDDA', avatarColor: '#155724',
        subjects: { SD: ['BAHASA INDONESIA', 'BIOLOGI', 'FISIKA', 'PKN', 'MATEMATIKA'], SMP: ['BAHASA INDONESIA', 'BIOLOGI'], SMA: ['BAHASA INDONESIA', 'BIOLOGI'], UTBK: ['LITERASI BAHASA INDONESIA'] }
    },
    {
        id: 'mt-putri-parepare', branch: 'Parepare', name: 'PUTRI INDAH', email: '-', pin: '1234', avatarBg: '#FDECEA', avatarColor: '#c62828',
        subjects: { SD: ['BAHASA INDONESIA'], SMP: ['BAHASA INDONESIA'], SMA: ['BAHASA INDONESIA'], UTBK: ['PBM', 'LBI', 'PPU'] }
    },
    {
        id: 'mt-fitrah-p', branch: 'Parepare', name: 'FITRAH AMALIA', email: '-', pin: '1234', avatarBg: '#D1ECF1', avatarColor: '#0c5460',
        subjects: { SD: ['BAHASA INGGRIS'], SMP: ['BAHASA INGGRIS'], SMA: ['BIOLOGI', 'BAHASA INGGRIS'], UTBK: ['LITERASI BAHASA INGGRIS'] }
    },
    {
        id: 'mt-nubi-p', branch: 'Parepare', name: 'NURUL MUTMAINNAH (NUBI)', email: '-', pin: '1234', avatarBg: '#F8D7DA', avatarColor: '#842029',
        subjects: { SD: ['MATEMATIKA'], SMP: ['MATEMATIKA'], SMA: ['MATEMATIKA'], UTBK: ['PENGETAHUAN KUANTITATIF', 'PENALARAN MATEMATIKA', 'PENALARAN UMUM'] }
    },
    {
        id: 'mt-dirgahayu-p', branch: 'Parepare', name: 'DIRGAHAYU', email: '-', pin: '1234', avatarBg: '#FFE0E0', avatarColor: '#c62828',
        subjects: { SD: [], SMP: ['BAHASA INGGRIS'], SMA: ['BAHASA INGGRIS'], UTBK: ['LITERASI BAHASA INGGRIS'] }
    },
    {
        id: 'mt-debima-p', branch: 'Parepare', name: 'DEBIMA SOLLI RURUK TIPA', email: '-', pin: '1234', avatarBg: '#E3F2FD', avatarColor: '#1565c0',
        subjects: { SD: ['MATEMATIKA'], SMP: ['MATEMATIKA'], SMA: ['MATEMATIKA'], UTBK: ['PENGETAHUAN KUANTITATIF', 'PENALARAN MATEMATIKA', 'PENALARAN UMUM'] }
    },
    {
        id: 'mt-dian-p', branch: 'Parepare', name: 'DIAN MUKKARAMAH', email: '-', pin: '1234', avatarBg: '#FFF3CD', avatarColor: '#856404',
        subjects: { SD: [], SMP: [], SMA: [], UTBK: [] }
    }
];

// Availability: List of custom slot objects { id, teacherId, subject, date, startTime, endTime }
const DEFAULT_AVAILABILITY = [];

// Assigned Schedules (Admin creates these)
const DEFAULT_SCHEDULES = [];

const SESSIONS = [
    { name: 'Sesi 1', time: '07:00 – 09:00', icon: '🌅' },
    { name: 'Sesi 2', time: '10:00 – 12:00', icon: '☀️' },
    { name: 'Sesi 3', time: '16:00 – 18:00', icon: '🌆' },
];

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const ADMIN_PASSWORD_DEFAULT = 'admin123';

function getAdminPassword() {
    const saved = localStorage.getItem('ba_admin_password');
    return saved || ADMIN_PASSWORD_DEFAULT;
}

// Keep for backward compat (read-only reference to current password)
const ADMIN_PASSWORD = ADMIN_PASSWORD_DEFAULT;
const ADMIN_EMAILS = ['admin@brainacademia.id', 'admin@gmail.com']; // Add allowed admin emails here

// --- Database API ---
const DB = {
    load() {
        const saved = localStorage.getItem(BA_DB_KEY);
        if (saved) {
            try { return JSON.parse(saved); } catch(e) {}
        }
        const fresh = {
            teachers: DEFAULT_TEACHERS,
            availability: DEFAULT_AVAILABILITY,
            schedules: DEFAULT_SCHEDULES,
            templates: DEFAULT_TEMPLATES
        };
        this.save(fresh);
        return fresh;
    },

    save(data) {
        localStorage.setItem(BA_DB_KEY, JSON.stringify(data));
    },

    get() {
        return this._data || (this._data = this.load());
    },

    flush() {
        this.save(this._data);
    },

    // Teachers
    getTeachers() { return this.get().teachers; },
    getTeacher(id) { return this.get().teachers.find(t => t.id === id); },
    saveTeacher(teacher) {
        const db = this.get();
        const idx = db.teachers.findIndex(t => t.id === teacher.id);
        if (idx !== -1) db.teachers[idx] = teacher;
        else db.teachers.push(teacher);
        this.flush();
    },
    addTeacher(teacher) {
        const db = this.get();
        teacher.id = 'mt-' + Date.now();
        db.teachers.push(teacher);
        this.flush();
        return teacher;
    },
    deleteTeacher(id) {
        const db = this.get();
        db.teachers = db.teachers.filter(t => t.id !== id);
        db.availability = db.availability.filter(a => a.teacherId !== id);
        db.schedules = db.schedules.filter(s => s.teacherId !== id);
        this.flush();
    },

    // Availability
    getAvailability(teacherId) {
        return this.get().availability.filter(a => a.teacherId === teacherId);
    },
    getAllAvailability() {
        return this.get().availability;
    },
    addAvailability(teacherId, entry) {
        const db = this.get();
        entry.id = 'avail-' + Date.now() + Math.random().toString(36).substr(2, 5);
        entry.teacherId = teacherId;
        db.availability.push(entry);
        this.flush();
        return entry;
    },
    deleteAvailability(id) {
        const db = this.get();
        db.availability = db.availability.filter(a => a.id !== id);
        this.flush();
    },

    // Schedules
    getSchedules() { return this.get().schedules; },
    getSchedulesByTeacher(teacherId) {
        return this.get().schedules.filter(s => s.teacherId === teacherId);
    },
    addSchedule(schedule) {
        const db = this.get();
        schedule.id = 'sched-' + Date.now();
        schedule.status = 'pending';
        schedule.createdAt = new Date().toISOString();
        db.schedules.push(schedule);
        this.flush();
        return schedule;
    },
    updateScheduleStatus(id, status, rejectReason = '') {
        const db = this.get();
        const s = db.schedules.find(s => s.id === id);
        if (s) {
            s.status = status;
            s.rejectReason = rejectReason;
            s.respondedAt = new Date().toISOString();
        }
        this.flush();
    },
    updateSchedule(id, updates) {
        const db = this.get();
        const s = db.schedules.find(s => s.id === id);
        if (s) {
            Object.assign(s, updates);
            s.updatedAt = new Date().toISOString();
        }
        this.flush();
    },
    deleteSchedule(id) {
        const db = this.get();
        db.schedules = db.schedules.filter(s => s.id !== id);
        this.flush();
    },

    // Templates
    getTemplates() { 
        const db = this.get();
        if (!db.templates) {
            db.templates = DEFAULT_TEMPLATES;
            this.flush();
        }
        return db.templates; 
    },
    saveTemplate(tmpl) {
        const db = this.get();
        if (!db.templates) db.templates = DEFAULT_TEMPLATES;
        
        if (!tmpl.id) {
            tmpl.id = 'tmpl-' + Date.now();
            db.templates.push(tmpl);
        } else {
            const idx = db.templates.findIndex(t => t.id === tmpl.id);
            if (idx !== -1) db.templates[idx] = tmpl;
            else db.templates.push(tmpl);
        }
        this.flush();
    },
    deleteTemplate(id) {
        const db = this.get();
        if (!db.templates) db.templates = DEFAULT_TEMPLATES;
        db.templates = db.templates.filter(t => t.id !== id);
        this.flush();
    },

    // Mata Pelajaran (Mapel)
    getMapelList() {
        const db = this.get();
        if (!db.mapelList || db.mapelList.length === 0) {
            // Seed from MAPEL_LIST if not yet persisted
            db.mapelList = [...MAPEL_LIST];
            this.flush();
        }
        return db.mapelList;
    },
    addMapel(name) {
        const db = this.get();
        if (!db.mapelList) db.mapelList = [...MAPEL_LIST];
        const trimmed = name.trim().toUpperCase();
        if (!trimmed) return false;
        if (db.mapelList.map(m => m.toUpperCase()).includes(trimmed)) return false; // duplicate
        db.mapelList.push(trimmed);
        db.mapelList.sort();
        this.flush();
        // Sync MAPEL_LIST global
        MAPEL_LIST.length = 0;
        db.mapelList.forEach(m => MAPEL_LIST.push(m));
        return true;
    },
    deleteMapel(name) {
        const db = this.get();
        if (!db.mapelList) db.mapelList = [...MAPEL_LIST];
        db.mapelList = db.mapelList.filter(m => m !== name);
        this.flush();
        // Sync MAPEL_LIST global
        MAPEL_LIST.length = 0;
        db.mapelList.forEach(m => MAPEL_LIST.push(m));
    }
};

// --- Session API ---
const Session = {
    save(role, teacherId = null) {
        sessionStorage.setItem(BA_SESSION_KEY, JSON.stringify({ role, teacherId }));
    },
    get() {
        const s = sessionStorage.getItem(BA_SESSION_KEY);
        return s ? JSON.parse(s) : null;
    },
    clear() {
        sessionStorage.removeItem(BA_SESSION_KEY);
    },
    requireAdmin() {
        const s = this.get();
        if (!s || s.role !== 'admin') { window.location.href = 'index.html'; return false; }
        return true;
    },
    requireTeacher() {
        const s = this.get();
        if (!s || s.role !== 'teacher') { window.location.href = 'index.html'; return false; }
        return s.teacherId;
    }
};

// --- Utility ---
function getStatusBadge(status) {
    const map = {
        pending:  { label: 'Menunggu', cls: 'badge-pending' },
        approved: { label: 'Disetujui', cls: 'badge-approved' },
        rejected: { label: 'Ditolak',  cls: 'badge-rejected' }
    };
    const s = map[status] || map.pending;
    return `<span class="status-badge ${s.cls}">${s.label}</span>`;
}

function formatDate(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
