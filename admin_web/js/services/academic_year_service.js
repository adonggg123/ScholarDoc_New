// js/services/academic_year_service.js
/**
 * AcademicYearService
 * Centralized service to manage, persist, query, and synchronize
 * academic years and semesters between Super Admin and Registrar interfaces.
 */

const STORAGE_KEY = 'scholardoc_custom_terms';
const DEFAULT_TERM_KEY = 'scholardoc_system_default_term';
const BROADCAST_CHANNEL = 'scholardoc_terms_sync_channel';
const CUSTOM_EVENT_NAME = 'scholardoc:terms_updated';
const DEFAULT_TERM_EVENT_NAME = 'scholardoc:default_term_updated';

const DEFAULT_ACADEMIC_YEARS = [
    '2026-2027',
    '2025-2026',
    '2024-2025',
    '2023-2024',
    '2022-2023',
    '2021-2022'
];

const DEFAULT_SEMESTERS = [
    '1st Semester',
    '2nd Semester',
    'Summer / Midyear'
];

let broadcastChannel = null;
try {
    if (typeof BroadcastChannel !== 'undefined') {
        broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL);
    }
} catch (_) { }

export class AcademicYearService {
    /**
     * Retrieves stored custom terms from localStorage
     */
    static getStoredTerms() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { academicYears: [], semesters: [] };
            const parsed = JSON.parse(raw);
            return {
                academicYears: Array.isArray(parsed?.academicYears) ? parsed.academicYears : [],
                semesters: Array.isArray(parsed?.semesters) ? parsed.semesters : []
            };
        } catch (_) {
            return { academicYears: [], semesters: [] };
        }
    }

    /**
     * Saves custom terms to localStorage and broadcasts update event
     */
    static saveStoredTerms(terms) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(terms));
            if (broadcastChannel) {
                broadcastChannel.postMessage({ type: 'TERMS_UPDATED', terms });
            }
            window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: terms }));
        } catch (e) {
            console.warn('Error saving custom terms to localStorage:', e);
        }
    }

    /**
     * Gets the system default academic term (Academic Year & Semester)
     */
    static getDefaultTerm() {
        try {
            const raw = localStorage.getItem(DEFAULT_TERM_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                const ay = parsed?.academicYear ? String(parsed.academicYear).trim() : null;
                const sem = parsed?.semester ? String(parsed.semester).trim() : null;
                if (ay && sem && ay !== 'All' && sem !== 'All') {
                    return { academicYear: ay, semester: sem };
                }
            }
        } catch (_) { }

        // Fallback default
        return {
            academicYear: '2026-2027',
            semester: '1st Semester'
        };
    }

    /**
     * Saves the chosen values as system defaults and synchronizes across all systems:
     * - localStorage (persists in browser)
     * - BroadcastChannel & CustomEvent (cross-tab & cross-interface sync)
     * - Backend REST API /api/academic-term/update (persists on server & mobile OCR sync)
     * - Supabase system_settings table (persists in database)
     */
    static setDefaultTerm(academicYear, semester, { broadcast = true, syncApi = true } = {}) {
        if (!academicYear || !semester) return null;

        let cleanAy = String(academicYear).trim().replace(/\s*-\s*/g, '-').replace(/\s+/g, '-');
        let cleanSem = String(semester).trim();

        if (cleanAy === 'All' || cleanAy === 'custom' || cleanSem === 'All' || cleanSem === 'custom') {
            return null;
        }

        // Auto-save to custom terms list if not standard
        if (!DEFAULT_ACADEMIC_YEARS.includes(cleanAy)) {
            const stored = this.getStoredTerms();
            if (!stored.academicYears.includes(cleanAy)) {
                stored.academicYears.push(cleanAy);
                this.saveStoredTerms(stored);
            }
        }
        if (!DEFAULT_SEMESTERS.includes(cleanSem)) {
            const stored = this.getStoredTerms();
            if (!stored.semesters.includes(cleanSem)) {
                stored.semesters.push(cleanSem);
                this.saveStoredTerms(stored);
            }
        }

        const termData = {
            academicYear: cleanAy,
            semester: cleanSem,
            updated_at: new Date().toISOString()
        };

        try {
            localStorage.setItem(DEFAULT_TERM_KEY, JSON.stringify(termData));
        } catch (e) {
            console.warn('AcademicYearService: could not set default term in localStorage:', e);
        }

        if (broadcast) {
            if (broadcastChannel) {
                broadcastChannel.postMessage({ type: 'DEFAULT_TERM_UPDATED', term: termData });
            }
            window.dispatchEvent(new CustomEvent(DEFAULT_TERM_EVENT_NAME, { detail: termData }));
            window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: termData }));
        }

        if (syncApi) {
            try {
                fetch('/api/academic-term/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ academicYear: cleanAy, semester: cleanSem })
                }).catch(() => {});
            } catch (_) { }

            // Also persist to Supabase system_settings if client exists
            try {
                const supabase = window.supabaseClient;
                if (supabase) {
                    supabase.from('system_settings').upsert({
                        key: 'academic_term',
                        value: {
                            academic_year: cleanAy,
                            semester: cleanSem,
                            updated_at: new Date().toISOString()
                        }
                    }).catch(() => {});

                    supabase.from('system_settings').upsert([
                        { key: 'current_academic_year', value: cleanAy },
                        { key: 'current_semester', value: cleanSem }
                    ]).catch(() => {});
                }
            } catch (_) { }
        }

        return termData;
    }

    /**
     * Fetches current default academic term from backend or database if available
     */
    static async fetchSystemDefaultTerm() {
        try {
            const res = await fetch('/api/academic-term/current', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data.academicYear && data.semester) {
                    this.setDefaultTerm(data.academicYear, data.semester, { broadcast: false, syncApi: false });
                    return { academicYear: data.academicYear, semester: data.semester };
                }
            }
        } catch (_) { }

        return this.getDefaultTerm();
    }

    /**
     * Returns all combined, deduplicated, and sorted academic years
     * (Defaults + Custom additions + Distinct values in Supabase)
     */
    static async getAcademicYears() {
        const yearSet = new Set(DEFAULT_ACADEMIC_YEARS);

        // Include locally saved custom academic years
        const stored = this.getStoredTerms();
        stored.academicYears.forEach(y => {
            if (y && String(y).trim()) yearSet.add(String(y).trim());
        });

        // Include default term academic year
        const def = this.getDefaultTerm();
        if (def && def.academicYear) yearSet.add(def.academicYear);

        // Query distinct values from Supabase tables
        try {
            const supabase = window.supabaseClient;
            if (supabase) {
                const [resF2, resF3, resSG, resMaster] = await Promise.all([
                    supabase.from('annex_form_2').select('academic_year').limit(500),
                    supabase.from('annex_form_3').select('academic_year').limit(500),
                    supabase.from('student_grantees').select('academic_year').limit(500),
                    supabase.from('new_grantees_masterlist').select('academic_year').limit(500)
                ]);

                (resF2.data || []).forEach(r => { if (r.academic_year) yearSet.add(String(r.academic_year).trim()); });
                (resF3.data || []).forEach(r => { if (r.academic_year) yearSet.add(String(r.academic_year).trim()); });
                (resSG.data || []).forEach(r => { if (r.academic_year) yearSet.add(String(r.academic_year).trim()); });
                (resMaster.data || []).forEach(r => { if (r.academic_year) yearSet.add(String(r.academic_year).trim()); });
            }
        } catch (e) {
            console.warn('AcademicYearService: Could not query distinct academic years from database:', e);
        }

        // Clean, filter placeholders, and sort descending
        const cleaned = Array.from(yearSet).filter(y => y && y !== 'All' && y !== 'custom' && y.length >= 4);
        cleaned.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
        return cleaned;
    }

    /**
     * Returns all combined, deduplicated, and sorted semesters
     * (Defaults + Custom additions + Distinct values in Supabase)
     */
    static async getSemesters() {
        const semSet = new Set(DEFAULT_SEMESTERS);

        // Include locally saved custom semesters
        const stored = this.getStoredTerms();
        stored.semesters.forEach(s => {
            if (s && String(s).trim()) semSet.add(String(s).trim());
        });

        // Include default term semester
        const def = this.getDefaultTerm();
        if (def && def.semester) semSet.add(def.semester);

        // Query distinct values from Supabase tables
        try {
            const supabase = window.supabaseClient;
            if (supabase) {
                const [resF2, resF3, resSG] = await Promise.all([
                    supabase.from('annex_form_2').select('semester').limit(500),
                    supabase.from('annex_form_3').select('semester').limit(500),
                    supabase.from('student_grantees').select('semester').limit(500)
                ]);

                (resF2.data || []).forEach(r => { if (r.semester) semSet.add(String(r.semester).trim()); });
                (resF3.data || []).forEach(r => { if (r.semester) semSet.add(String(r.semester).trim()); });
                (resSG.data || []).forEach(r => { if (r.semester) semSet.add(String(r.semester).trim()); });
            }
        } catch (e) {
            console.warn('AcademicYearService: Could not query distinct semesters from database:', e);
        }

        const cleaned = Array.from(semSet).filter(s => s && s !== 'All' && s !== 'custom' && s.length >= 2);
        return cleaned;
    }

    /**
     * Adds a new custom academic year (e.g. "2026-2027")
     */
    static async addCustomAcademicYear(yearStr) {
        if (!yearStr) return null;
        let clean = String(yearStr).trim();
        // Auto-format "2026 - 2027" or "2026 2027" to "2026-2027"
        clean = clean.replace(/\s*-\s*/g, '-').replace(/\s+/g, '-');

        const stored = this.getStoredTerms();
        if (!stored.academicYears.includes(clean)) {
            stored.academicYears.push(clean);
            this.saveStoredTerms(stored);
        }
        return clean;
    }

    /**
     * Adds a new custom semester (e.g. "3rd Trimester" or "Midyear Term")
     */
    static async addCustomSemester(semStr) {
        if (!semStr) return null;
        const clean = String(semStr).trim();

        const stored = this.getStoredTerms();
        if (!stored.semesters.includes(clean)) {
            stored.semesters.push(clean);
            this.saveStoredTerms(stored);
        }
        return clean;
    }

    /**
     * Cross-interface terms update listener (custom terms or term list changed)
     */
    static onTermsUpdated(callback) {
        if (typeof callback !== 'function') return;

        window.addEventListener(CUSTOM_EVENT_NAME, (e) => {
            callback(e.detail);
        });

        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY) {
                callback(this.getStoredTerms());
            }
        });

        if (broadcastChannel) {
            broadcastChannel.onmessage = (event) => {
                if (event.data?.type === 'TERMS_UPDATED') {
                    callback(event.data.terms);
                } else if (event.data?.type === 'DEFAULT_TERM_UPDATED') {
                    callback(event.data.term);
                }
            };
        }
    }

    /**
     * Listener for system default term updates (selected AY and Semester changed)
     */
    static onDefaultTermUpdated(callback) {
        if (typeof callback !== 'function') return;

        window.addEventListener(DEFAULT_TERM_EVENT_NAME, (e) => {
            callback(e.detail);
        });

        window.addEventListener('storage', (e) => {
            if (e.key === DEFAULT_TERM_KEY) {
                callback(this.getDefaultTerm());
            }
        });

        if (broadcastChannel) {
            const originalOnMessage = broadcastChannel.onmessage;
            broadcastChannel.addEventListener('message', (event) => {
                if (event.data?.type === 'DEFAULT_TERM_UPDATED') {
                    callback(event.data.term);
                }
            });
        }
    }
}
