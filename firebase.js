/* ==========================================================================
   FIREBASE SERVICE — BRAIN ACADEMIA PINRANG
   Handles Firestore read/write. Replaces localStorage-only DB.
   ========================================================================== */

// Firestore collection names
const FS_COLLECTIONS = {
    teachers:     'teachers',
    availability: 'availability',
    schedules:    'schedules'
};

let _db = null;       // Firestore instance
let _app = null;      // Firebase app instance
let _fbReady = false; // true once Firebase initialised
let _fbError = false; // true if Firebase failed to init

// ── Status overlay ─────────────────────────────────────────────────────────
function _showFbStatus(msg, type = 'info') {
    let overlay = document.getElementById('fb-status-toast');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'fb-status-toast';
        overlay.style.cssText = [
            'position:fixed;bottom:80px;left:50%;transform:translateX(-50%)',
            'background:var(--bg-sidebar,#1e2033);color:var(--text-primary,#fff)',
            'padding:.6rem 1.2rem;border-radius:30px;font-size:.78rem;font-weight:600',
            'box-shadow:0 4px 20px rgba(0,0,0,.3);z-index:9999',
            'display:flex;align-items:center;gap:.5rem;white-space:nowrap'
        ].join(';');
        document.body.appendChild(overlay);
    }
    const icons = { info: '🔥', success: '✅', warning: '⚠️', error: '❌' };
    overlay.textContent = `${icons[type] || 'ℹ️'} ${msg}`;
    overlay.style.opacity = '1';
    setTimeout(() => { overlay.style.opacity = '0'; }, 4000);
}

// ── Firebase Initialisation ─────────────────────────────────────────────────
async function initFirebase() {
    try {
        const cfg = window.FIREBASE_CONFIG;
        if (!cfg || cfg.apiKey === 'YOUR_API_KEY') {
            console.warn('[Firebase] Config not set — using localStorage fallback.');
            _fbError = true;
            return false;
        }

        // Dynamically import Firebase modules from CDN
        const { initializeApp, getApps } = await import(
            'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'
        );
        const { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot, query, where } = await import(
            'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
        );
        const { getAuth, signInWithPopup, GoogleAuthProvider, signOut } = await import(
            'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'
        );
        const { getStorage, ref, uploadBytes, getDownloadURL } = await import(
            'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js'
        );

        // Expose Firebase helpers globally so FireDB can use them
        window._FS = { collection, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot, query, where };
        window._Auth = { signInWithPopup, GoogleAuthProvider, signOut };
        window._Storage = { ref, uploadBytes, getDownloadURL };

        if (!getApps().length) {
            _app = initializeApp(cfg);
        } else {
            _app = getApps()[0];
        }
        _db = getFirestore(_app);
        window._firestoreDb = _db;
        window._firebaseAuth = getAuth(_app);
        window._firebaseStorage = getStorage(_app);

        _fbReady = true;
        console.log('[Firebase] Connected to Firestore ✅');
        _showFbStatus('Terhubung ke Firebase 🔥', 'success');
        return true;
    } catch (err) {
        console.error('[Firebase] Init failed:', err);
        _fbError = true;
        _showFbStatus('Firebase gagal — mode lokal aktif', 'warning');
        return false;
    }
}

// ── Firestore DB API ────────────────────────────────────────────────────────
// Mirrors the synchronous DB API in data.js but reads/writes Firestore.
// All public methods are async. Pages should await them.
const FireDB = {
    async isReady() { return _fbReady && !_fbError; },

    // ── SEED: push DEFAULT_TEACHERS if Firestore teachers collection is empty ──
    async seedIfEmpty() {
        if (!await this.isReady()) return;
        const { getDocs, collection } = window._FS;
        const snap = await getDocs(collection(_db, FS_COLLECTIONS.teachers));
        if (snap.empty && typeof DEFAULT_TEACHERS !== 'undefined') {
            console.log('[Firebase] Seeding default teachers…');
            for (const t of DEFAULT_TEACHERS) {
                const { setDoc, doc } = window._FS;
                await setDoc(doc(_db, FS_COLLECTIONS.teachers, t.id), t);
            }
            console.log('[Firebase] Seed complete.');
        }
    },

    // ── TEACHERS ────────────────────────────────────────────────────────────
    async getTeachers() {
        if (!await this.isReady()) return DB.getTeachers();
        const { getDocs, collection } = window._FS;
        const snap = await getDocs(collection(_db, FS_COLLECTIONS.teachers));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getTeacher(id) {
        if (!await this.isReady()) return DB.getTeacher(id);
        const { getDoc, doc } = window._FS;
        const snap = await getDoc(doc(_db, FS_COLLECTIONS.teachers, id));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },

    async saveTeacher(teacher) {
        if (!await this.isReady()) { DB.saveTeacher(teacher); return; }
        const { setDoc, doc } = window._FS;
        const { id, ...data } = teacher;
        await setDoc(doc(_db, FS_COLLECTIONS.teachers, id), data, { merge: true });
        // Also update local cache
        DB.saveTeacher(teacher);
    },

    async addTeacher(teacher) {
        const id = 'mt-' + Date.now();
        teacher.id = id;
        if (!await this.isReady()) { DB.addTeacher(teacher); return teacher; }
        const { setDoc, doc } = window._FS;
        const { id: _id, ...data } = teacher;
        await setDoc(doc(_db, FS_COLLECTIONS.teachers, id), data);
        DB.addTeacher({ ...teacher, id }); // keep local in sync
        return teacher;
    },

    async deleteTeacher(id) {
        if (!await this.isReady()) { DB.deleteTeacher(id); return; }
        const { deleteDoc, doc, getDocs, collection, query, where } = window._FS;
        // Delete teacher doc
        await deleteDoc(doc(_db, FS_COLLECTIONS.teachers, id));
        // Delete related availability
        const availSnap = await getDocs(query(
            collection(_db, FS_COLLECTIONS.availability),
            where('teacherId', '==', id)
        ));
        for (const d of availSnap.docs) await deleteDoc(d.ref);
        // Delete related schedules
        const schedSnap = await getDocs(query(
            collection(_db, FS_COLLECTIONS.schedules),
            where('teacherId', '==', id)
        ));
        for (const d of schedSnap.docs) await deleteDoc(d.ref);
        // Keep local in sync
        DB.deleteTeacher(id);
    },

    // ── AVAILABILITY ─────────────────────────────────────────────────────────
    async getAllAvailability() {
        if (!await this.isReady()) return DB.getAllAvailability();
        const { getDocs, collection } = window._FS;
        const snap = await getDocs(collection(_db, FS_COLLECTIONS.availability));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getAvailability(teacherId) {
        if (!await this.isReady()) return DB.getAvailability(teacherId);
        const { getDocs, collection, query, where } = window._FS;
        const snap = await getDocs(query(
            collection(_db, FS_COLLECTIONS.availability),
            where('teacherId', '==', teacherId)
        ));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async addAvailability(teacherId, entry) {
        if (!await this.isReady()) { return DB.addAvailability(teacherId, entry); }
        const { addDoc, collection } = window._FS;
        entry.teacherId = teacherId;
        const ref = await addDoc(collection(_db, FS_COLLECTIONS.availability), entry);
        entry.id = ref.id;
        // Update local
        const db = DB.get();
        db.availability.push(entry);
        DB.flush();
        return entry;
    },

    async deleteAvailability(id) {
        if (!await this.isReady()) { DB.deleteAvailability(id); return; }
        const { deleteDoc, doc } = window._FS;
        await deleteDoc(doc(_db, FS_COLLECTIONS.availability, id));
        DB.deleteAvailability(id);
    },

    // ── SCHEDULES ────────────────────────────────────────────────────────────
    async getSchedules() {
        if (!await this.isReady()) return DB.getSchedules();
        const { getDocs, collection } = window._FS;
        const snap = await getDocs(collection(_db, FS_COLLECTIONS.schedules));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getSchedulesByTeacher(teacherId) {
        if (!await this.isReady()) return DB.getSchedulesByTeacher(teacherId);
        const { getDocs, collection, query, where } = window._FS;
        const snap = await getDocs(query(
            collection(_db, FS_COLLECTIONS.schedules),
            where('teacherId', '==', teacherId)
        ));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async addSchedule(schedule) {
        if (!await this.isReady()) { return DB.addSchedule(schedule); }
        const { addDoc, collection } = window._FS;
        schedule.status = 'pending';
        schedule.createdAt = new Date().toISOString();
        const ref = await addDoc(collection(_db, FS_COLLECTIONS.schedules), schedule);
        schedule.id = ref.id;
        // Update local
        const db = DB.get();
        db.schedules.push(schedule);
        DB.flush();
        return schedule;
    },

    async updateScheduleStatus(id, status, rejectReason = '') {
        if (!await this.isReady()) { DB.updateScheduleStatus(id, status, rejectReason); return; }
        const { updateDoc, doc } = window._FS;
        await updateDoc(doc(_db, FS_COLLECTIONS.schedules, id), {
            status,
            rejectReason,
            respondedAt: new Date().toISOString()
        });
        DB.updateScheduleStatus(id, status, rejectReason);
    },

    async updateSchedule(id, updates) {
        updates.updatedAt = new Date().toISOString();
        if (!await this.isReady()) { DB.updateSchedule(id, updates); return; }
        const { updateDoc, doc } = window._FS;
        await updateDoc(doc(_db, FS_COLLECTIONS.schedules, id), updates);
        DB.updateSchedule(id, updates);
    },

    async deleteSchedule(id) {
        if (!await this.isReady()) { DB.deleteSchedule(id); return; }
        const { deleteDoc, doc } = window._FS;
        await deleteDoc(doc(_db, FS_COLLECTIONS.schedules, id));
        DB.deleteSchedule(id);
    },

    // ── AUTHENTICATION ─────────────────────────────────────────────────────────
    async loginWithGoogle() {
        if (!await this.isReady()) return null;
        const auth = window._firebaseAuth;
        const provider = new window._Auth.GoogleAuthProvider();
        try {
            const result = await window._Auth.signInWithPopup(auth, provider);
            return result.user; // Contains email, displayName, photoURL
        } catch (error) {
            console.error('[Firebase] Google login failed:', error);
            return null;
        }
    },

    // ── STORAGE ─────────────────────────────────────────────────────────────
    async uploadProfilePicture(file, userId) {
        if (!await this.isReady()) return null;
        try {
            const storage = window._firebaseStorage;
            const ext = file.name.split('.').pop();
            const filePath = `profile_pictures/${userId}_${Date.now()}.${ext}`;
            const storageRef = window._Storage.ref(storage, filePath);
            await window._Storage.uploadBytes(storageRef, file);
            const url = await window._Storage.getDownloadURL(storageRef);
            return url;
        } catch (error) {
            console.error('[Firebase] Upload failed:', error);
            return null;
        }
    },

    // ── SYNC: pull Firestore data into localStorage cache ───────────────────
    async syncToLocal() {
        if (!await this.isReady()) return;
        try {
            const [teachers, availability, schedules] = await Promise.all([
                this.getTeachers(),
                this.getAllAvailability(),
                this.getSchedules()
            ]);
            const db = DB.get();
            db.teachers     = teachers;
            db.availability = availability;
            db.schedules    = schedules;
            DB.flush();
            console.log('[Firebase] Local cache synced from Firestore.');
        } catch (err) {
            console.error('[Firebase] Sync failed:', err);
        }
    },

    // ── PUSH: push localStorage data to Firestore (for initial migration) ───
    async pushLocalToFirestore() {
        if (!await this.isReady()) return;
        const db = DB.get();
        const { setDoc, doc, addDoc, collection } = window._FS;
        _showFbStatus('Meng-upload data lokal ke Firestore…', 'info');

        // Push teachers
        for (const t of db.teachers) {
            const { id, ...data } = t;
            await setDoc(doc(_db, FS_COLLECTIONS.teachers, id), data);
        }
        // Push availability
        for (const a of db.availability) {
            const { id, ...data } = a;
            if (id && !id.startsWith('avail-')) {
                await setDoc(doc(_db, FS_COLLECTIONS.availability, id), data);
            } else {
                await addDoc(collection(_db, FS_COLLECTIONS.availability), data);
            }
        }
        // Push schedules
        for (const s of db.schedules) {
            const { id, ...data } = s;
            if (id && !id.startsWith('sched-')) {
                await setDoc(doc(_db, FS_COLLECTIONS.schedules, id), data);
            } else {
                await addDoc(collection(_db, FS_COLLECTIONS.schedules), data);
            }
        }
        _showFbStatus('Upload selesai ✅', 'success');
        console.log('[Firebase] Local data pushed to Firestore.');
    }
};

// ── Bootstrap: init Firebase on page load ───────────────────────────────────
// Pages call this, then call FireDB.syncToLocal() before rendering.
window.firebaseReady = initFirebase();
