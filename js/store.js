// ===== Data Store - localStorage + Supabase cloud sync =====
const Store = {
    KEY: 'cashflow_data',
    _syncStatus: 'idle',
    _syncTimeout: null,

    defaultData() {
        return {
            home: {
                balance: 0,
                incomes: [],
                fixedExpenses: [],
                variableExpenses: []
            },
            business: {
                balance: 0,
                incomes: [],
                fixedExpenses: [],
                variableExpenses: [],
                transfers: []
            },
            creditCards: [],
            loans: [],
            employees: [],
            savingGoals: [],
            categories: {
                home: ['קבועות', 'בית', 'ילדים', 'רפואה', 'ביטוחים', 'רכב ותחבורה', 'תקשורת', 'בילויים', 'שונות'],
                business: ['קבועות', 'שכר', 'שיווק', 'ציוד', 'תחבורה', 'שונות']
            },
            settings: { theme: 'dark', currency: '₪', creditFramework: { home: 0, business: 0 } }
        };
    },

    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (raw) {
                const data = JSON.parse(raw);
                // Merge with defaults to ensure all keys exist
                const def = this.defaultData();
                return this._deepMerge(def, data);
            }
        } catch (e) {
            console.error('Error loading data:', e);
        }
        return this.defaultData();
    },

    save(data) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Error saving data:', e);
        }
        // Sync to Supabase (debounced, async, fire-and-forget)
        this.saveToSupabase();
    },

    get() {
        if (!this._cache) this._cache = this.load();
        return this._cache;
    },

    update(fn) {
        const data = this.get();
        fn(data);
        this.save(data);
        this._cache = data;
        // Trigger re-render of current page
        if (typeof App !== 'undefined' && App.currentPage) {
            App.renderPage(App.currentPage);
        }
    },

    _deepMerge(target, source) {
        const result = { ...target };
        for (const key of Object.keys(source)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this._deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    },

    genId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },

    exportJSON() {
        const data = this.get();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cashflow_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('הנתונים יוצאו בהצלחה', 'success');
    },

    importJSON(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.save(data);
                this._cache = null;
                showToast('הנתונים יובאו בהצלחה', 'success');
                if (typeof App !== 'undefined') App.renderPage(App.currentPage);
            } catch (err) {
                showToast('שגיאה בקריאת הקובץ', 'error');
            }
        };
        reader.readAsText(file);
    },

    clearAll() {
        localStorage.removeItem(this.KEY);
        this._cache = null;
        // Also reset Supabase data
        if (typeof Auth !== 'undefined' && Auth.currentUser) {
            supabaseClient
                .from('user_data')
                .update({ data: this.defaultData() })
                .eq('user_id', Auth.currentUser.id)
                .then(() => {});
        }
        showToast('כל הנתונים נמחקו', 'info');
        if (typeof App !== 'undefined') App.renderPage(App.currentPage);
    },

    resetKeepFixed() {
        const current = this.get();
        const fresh = this.defaultData();
        // Keep fixed expenses from both accounts
        fresh.home.fixedExpenses = current.home.fixedExpenses || [];
        fresh.business.fixedExpenses = current.business.fixedExpenses || [];
        // Keep categories and settings
        fresh.categories = current.categories || fresh.categories;
        fresh.settings = current.settings || fresh.settings;

        this.save(fresh);
        this._cache = fresh;
        showToast('הנתונים אופסו - הוצאות קבועות נשמרו!', 'success');
        if (typeof App !== 'undefined') App.renderPage(App.currentPage);
    },

    // ===== Supabase Sync Methods =====

    async loadFromSupabase() {
        if (!supabaseClient || !Auth.currentUser) return;

        try {
            const { data, error } = await supabaseClient
                .from('user_data')
                .select('id, data, updated_at')
                .eq('user_id', Auth.currentUser.id)
                .maybeSingle();

            if (error) {
                console.error('Supabase load error:', error);
                showToast('שגיאה בטעינה מהענן, עובדים עם נתונים מקומיים', 'error');
                return;
            }

            if (data) {
                // Returning user - load from Supabase
                const merged = this._deepMerge(this.defaultData(), data.data);
                localStorage.setItem(this.KEY, JSON.stringify(merged));
                this._cache = merged;
                console.log('Data loaded from Supabase');
            } else {
                // First login - check localStorage for existing data to migrate
                const localData = this.load();
                const hasLocalData = localData.home.incomes.length > 0 ||
                    localData.home.fixedExpenses.length > 0 ||
                    localData.business.incomes.length > 0 ||
                    localData.creditCards.length > 0 ||
                    localData.employees.length > 0;

                const dataToSave = hasLocalData ? localData : this.defaultData();

                const { data: inserted, error: insertError } = await supabaseClient
                    .from('user_data')
                    .insert({ user_id: Auth.currentUser.id, data: dataToSave })
                    .select('id')
                    .single();

                if (insertError) {
                    console.error('Supabase insert error:', insertError);
                } else {
                    console.log('Initial data saved to Supabase');
                    if (hasLocalData) {
                        showToast('הנתונים המקומיים הועלו לענן!', 'success');
                    }
                }
                this._cache = dataToSave;
                localStorage.setItem(this.KEY, JSON.stringify(dataToSave));
            }
        } catch (err) {
            console.error('loadFromSupabase error:', err);
        }
    },

    saveToSupabase() {
        if (!supabaseClient || typeof Auth === 'undefined' || !Auth.currentUser) return;

        clearTimeout(this._syncTimeout);
        this._syncTimeout = setTimeout(async () => {
            this._syncStatus = 'syncing';
            this.updateSyncIndicator();

            try {
                const { error } = await supabaseClient
                    .from('user_data')
                    .update({ data: this._cache })
                    .eq('user_id', Auth.currentUser.id);

                if (error) {
                    this._syncStatus = 'error';
                    console.error('Sync error:', error);
                } else {
                    this._syncStatus = 'saved';
                }
            } catch (err) {
                this._syncStatus = 'error';
                console.error('Sync exception:', err);
            }

            this.updateSyncIndicator();
            setTimeout(() => {
                this._syncStatus = 'idle';
                this.updateSyncIndicator();
            }, 2000);
        }, 500);
    },

    updateSyncIndicator() {
        const el = document.getElementById('sync-status');
        if (!el) return;
        const states = {
            idle:    { text: '', icon: '' },
            syncing: { text: 'מסנכרן...', icon: '🔄' },
            saved:   { text: 'נשמר בענן', icon: '☁️' },
            error:   { text: 'שגיאת סנכרון', icon: '⚠️' }
        };
        const state = states[this._syncStatus] || states.idle;
        el.textContent = state.icon + ' ' + state.text;
        el.className = 'sync-indicator sync-' + this._syncStatus;
    },

    loadDemoData() {
        const today = new Date();
        const m = today.getMonth();
        const y = today.getFullYear();
        const d = (day) => `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const prevM = (day) => `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

        const data = this.defaultData();

        // Home incomes
        data.home.balance = 5200;
        data.home.incomes = [
            { id: this.genId(), name: 'משכורת מיכל', amount: 8500, type: 'monthly', date: d(1), category: 'משכורת' },
            { id: this.genId(), name: 'משכורת מוש', amount: 12000, type: 'monthly', date: d(1), category: 'משכורת' },
            { id: this.genId(), name: 'קצבת ילדים', amount: 269, type: 'monthly', date: d(3), category: 'קצבאות' }
        ];

        // Home fixed expenses
        data.home.fixedExpenses = [
            { id: this.genId(), name: 'שכר דירה', amount: 6400, category: 'קבועות', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'ועד בית', amount: 250, category: 'קבועות', frequency: 'monthly', chargeDate: 5, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'הלוואה ריבית', amount: 937, category: 'קבועות', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'הלוואה קרן', amount: 873, category: 'קבועות', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'גן גל', amount: 3900, category: 'ילדים', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 12, paymentsMade: 5 },
            { id: this.genId(), name: 'ביטוח בריאות משלים', amount: 361, category: 'ביטוחים', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'ביטוח חיים', amount: 116, category: 'ביטוחים', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'סלקום אינטרנט', amount: 104, category: 'תקשורת', frequency: 'monthly', chargeDate: 15, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'סלקום סלולר', amount: 105, category: 'תקשורת', frequency: 'monthly', chargeDate: 15, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'נטפליקס', amount: 55, category: 'תקשורת', frequency: 'monthly', chargeDate: 15, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'קאנטרי גבעתיים', amount: 524, category: 'רפואה', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'פנסיון רודי', amount: 1400, category: 'שונות', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 0, paymentsMade: 0 }
        ];

        // Home variable expenses
        data.home.variableExpenses = [
            { id: this.genId(), name: 'שופרסל', amount: 450, category: 'בית', date: d(3) },
            { id: this.genId(), name: 'סופר יודה', amount: 180, category: 'בית', date: d(7) },
            { id: this.genId(), name: 'דלק פז', amount: 260, category: 'רכב ותחבורה', date: d(5) },
            { id: this.genId(), name: 'אוכל בחוץ', amount: 150, category: 'בילויים', date: d(10) },
            { id: this.genId(), name: 'מספרה', amount: 70, category: 'רפואה', date: d(12) },
            { id: this.genId(), name: 'שופרסל', amount: 380, category: 'בית', date: prevM(15) },
            { id: this.genId(), name: 'דלק', amount: 230, category: 'רכב ותחבורה', date: prevM(20) }
        ];

        // Business
        data.business.balance = -44000;
        data.business.incomes = [
            { id: this.genId(), clientName: 'בית עמנואל', amount: 36600, expectedDate: d(5), status: 'received', notes: '' },
            { id: this.genId(), clientName: 'דיגיטף', amount: 6195, expectedDate: d(15), status: 'received', notes: '' },
            { id: this.genId(), clientName: 'הייטק', amount: 1500, expectedDate: d(10), status: 'received', notes: '' },
            { id: this.genId(), clientName: 'מוסדות', amount: 4500, expectedDate: `${y}-${String(m+2).padStart(2,'0')}-01`, status: 'expected', notes: 'אחרי הורדת 12%' },
            { id: this.genId(), clientName: 'דיגיטף', amount: 5800, expectedDate: `${y}-${String(m+2).padStart(2,'0')}-15`, status: 'expected', notes: '' }
        ];

        data.business.fixedExpenses = [
            { id: this.genId(), name: 'ביטוח לאומי', amount: 376, category: 'קבועות', frequency: 'monthly', chargeDate: 15, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'הלוואה ב.לאומי 21', amount: 554, category: 'קבועות', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 60, paymentsMade: 36 },
            { id: this.genId(), name: 'הלוואה ב.לאומי 22', amount: 656, category: 'קבועות', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 60, paymentsMade: 24 },
            { id: this.genId(), name: 'ביטוח מקצועי כלל', amount: 70, category: 'קבועות', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'ביטוח מקצועי פניקס', amount: 110, category: 'קבועות', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'בריין בינה', amount: 37, category: 'קבועות', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'הלוואה', amount: 4122, category: 'קבועות', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 36, paymentsMade: 12 },
            { id: this.genId(), name: 'החזר גישור', amount: 22098, category: 'קבועות', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 6, paymentsMade: 2 }
        ];

        data.business.variableExpenses = [
            { id: this.genId(), name: 'ספוטיפיי וג׳יפיטי', amount: 105, category: 'קבועות', date: d(1) },
            { id: this.genId(), name: 'קנבה', amount: 40, category: 'שיווק', date: d(1) },
            { id: this.genId(), name: 'גוגל', amount: 8, category: 'שיווק', date: d(1) }
        ];

        data.business.transfers = [
            { id: this.genId(), amount: 6400, date: d(1), notes: 'שכ"ד' },
            { id: this.genId(), amount: 3000, date: d(5), notes: 'ביט בית' }
        ];

        // Credit Cards
        data.creditCards = [
            {
                id: this.genId(), name: 'ישרכרט מיכל', account: 'home', limit: 5000, billingDate: 15,
                charges: [
                    { id: this.genId(), description: 'רופא וטרינר', totalAmount: 570, installments: 10, installmentsPaid: 4, startDate: prevM(15), monthlyAmount: 57 },
                    { id: this.genId(), description: 'חשמל', totalAmount: 491, installments: 1, installmentsPaid: 0, startDate: d(15), monthlyAmount: 491 },
                    { id: this.genId(), description: 'BIT העברה', totalAmount: 700, installments: 1, installmentsPaid: 0, startDate: d(15), monthlyAmount: 700 }
                ]
            },
            {
                id: this.genId(), name: 'ויזה חדש', account: 'home', limit: 15000, billingDate: 23,
                charges: [
                    { id: this.genId(), description: 'קופת חולים', totalAmount: 1470, installments: 10, installmentsPaid: 3, startDate: prevM(23), monthlyAmount: 147 },
                    { id: this.genId(), description: 'קאנטרי', totalAmount: 524, installments: 1, installmentsPaid: 0, startDate: d(23), monthlyAmount: 524 },
                    { id: this.genId(), description: 'ביטוחים', totalAmount: 723, installments: 1, installmentsPaid: 0, startDate: d(23), monthlyAmount: 723 }
                ]
            },
            {
                id: this.genId(), name: 'ישרכרט עסק', account: 'business', limit: 29700, billingDate: 20,
                charges: [
                    { id: this.genId(), description: 'ביטוח לאומי', totalAmount: 376, installments: 1, installmentsPaid: 0, startDate: d(20), monthlyAmount: 376 },
                    { id: this.genId(), description: 'אביץ', totalAmount: 3600, installments: 12, installmentsPaid: 2, startDate: prevM(20), monthlyAmount: 300 },
                    { id: this.genId(), description: 'אייבורי', totalAmount: 2988, installments: 12, installmentsPaid: 1, startDate: d(20), monthlyAmount: 249 }
                ]
            }
        ];

        // Employees (freelancers)
        data.employees = [
            { id: this.genId(), name: 'לירז', role: 'פרילנסר/ית', grossSalary: 160, paymentDate: 9, active: true, payments: [] },
            { id: this.genId(), name: 'ימית', role: 'פרילנסר/ית', grossSalary: 2520, paymentDate: 9, active: true, payments: [] },
            { id: this.genId(), name: 'עודד', role: 'פרילנסר/ית', grossSalary: 2340, paymentDate: 9, active: true, payments: [] },
            { id: this.genId(), name: 'נדיה', role: 'פרילנסר/ית', grossSalary: 3000, paymentDate: 9, active: true, payments: [] },
            { id: this.genId(), name: 'ליאור', role: 'פרילנסר/ית', grossSalary: 3000, paymentDate: 10, active: true, payments: [] },
            { id: this.genId(), name: 'רומי', role: 'פרילנסר/ית', grossSalary: 2040, paymentDate: 9, active: true, payments: [] }
        ];

        // Saving Goals
        data.savingGoals = [
            { id: this.genId(), name: 'קרן חירום', targetAmount: 30000, currentAmount: 5000, deadline: `${y+1}-01-01` },
            { id: this.genId(), name: 'חופשה משפחתית', targetAmount: 15000, currentAmount: 3200, deadline: `${y}-08-01` }
        ];

        this.save(data);
        this._cache = data;
        showToast('נתוני דוגמה נטענו בהצלחה!', 'success');
        if (typeof App !== 'undefined') App.renderPage(App.currentPage || 'dashboard');
    },

    // ===== Real Data - loaded from bank files Feb 2026 =====
    loadRealData() {
        const data = this.defaultData();

        // ========== HOME ACCOUNT - Beinleumi 135-24120 ==========
        data.home.balance = 9152.91; // PDF "התחייבויות ונכסים" 11.2.2026

        // --- Home Incomes ---
        data.home.incomes = [
            { id: this.genId(), name: 'משכורת מיכל - ביכמן תמר', amount: 9000, type: 'monthly', date: '2026-02-10', category: 'משכורת' },
            { id: this.genId(), name: 'משכורת מיכל - בית עמנואל', amount: 1200, type: 'monthly', date: '2026-02-10', category: 'משכורת' },
            { id: this.genId(), name: 'קצבת ילדים', amount: 276, type: 'monthly', date: '2026-02-17', category: 'קצבאות' },
            { id: this.genId(), name: 'שיק מאבא - אחרון 15K', amount: 15000, type: 'one-time', date: '2026-02-23', category: 'שונות' },
            { id: this.genId(), name: 'שיק מאבא - 5K אחרון', amount: 5000, type: 'one-time', date: '2026-03-23', category: 'שונות' }
        ];

        // --- Home Fixed Expenses (via bank, not credit card) ---
        // NOTE: Loans removed from here - they are in loans[] and daily-view reads both
        data.home.fixedExpenses = [
            { id: this.genId(), name: 'שכר דירה', amount: 6400, category: 'קבועות', frequency: 'monthly', chargeDate: 10, active: true, paymentMethod: 'check', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'ועד בית', amount: 250, category: 'קבועות', frequency: 'monthly', chargeDate: 10, active: true, paymentMethod: 'check', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'עמלת פעולות בנק', amount: 23, category: 'שונות', frequency: 'monthly', chargeDate: 30, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 0, paymentsMade: 0 }
        ];

        // --- Home Variable Expenses (recent credit card + misc) ---
        data.home.variableExpenses = [];

        // ========== BUSINESS ACCOUNT - Hapoalim 407-234551 ==========
        data.business.balance = -35426.63; // ריכוז יתרות 10.2.2026

        // --- Business Incomes ---
        data.business.incomes = [
            { id: this.genId(), clientName: 'מוסדות חינוך', amount: 31422, expectedDate: '2026-02-28', status: 'received', notes: 'תשלום חד-פעמי/שנתי' },
            { id: this.genId(), clientName: 'בית עמנואל', amount: 1987, expectedDate: '2026-02-15', status: 'received', notes: 'חודשי' },
            { id: this.genId(), clientName: 'וונדר מור', amount: 1606, expectedDate: '2026-02-05', status: 'received', notes: 'משכורת חודשית' },
            { id: this.genId(), clientName: 'סדנת AI - שלומוביץ', amount: 1180, expectedDate: '2026-02-10', status: 'received', notes: '' },
            { id: this.genId(), clientName: 'עיריית ת"א (דיגיטף)', amount: 1770, expectedDate: '2026-02-08', status: 'received', notes: 'סכום משתנה' }
        ];

        // --- Business Fixed Expenses (via bank) ---
        // NOTE: Hapoalim loan removed from here - it's in loans[]
        data.business.fixedExpenses = [
            { id: this.genId(), name: 'רו"ח קובי הוכמן', amount: 590, category: 'קבועות', frequency: 'monthly', chargeDate: 7, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'עמלת מסלול פועלים', amount: 22, category: 'שונות', frequency: 'monthly', chargeDate: 1, active: true, paymentMethod: 'bank', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            // Credit card standing orders (הו"ק)
            { id: this.genId(), name: 'ביטוח לאומי', amount: 554, category: 'קבועות', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'הפניקס ביטוח', amount: 111, category: 'ביטוחים', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'כלל רכב/דירה/עסק', amount: 70.24, category: 'ביטוחים', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'איילון ביטוח כללי', amount: 133, category: 'ביטוחים', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'פנגו', amount: 32, category: 'רכב ותחבורה', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'Microsoft 365', amount: 43, category: 'ציוד', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'Google One', amount: 74.90, category: 'ציוד', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'Canva AI', amount: 39.90, category: 'שיווק', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'Zoom', amount: 54.92, category: 'ציוד', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'Claude AI', amount: 63.51, category: 'ציוד', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'Suno AI', amount: 31.81, category: 'ציוד', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'בריין בינה', amount: 37, category: 'ציוד', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'הי ביז (poalim wonder)', amount: 15, category: 'ציוד', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 },
            { id: this.genId(), name: 'מטה קריצ\'ר - יועץ', amount: 1180, category: 'שיווק', frequency: 'monthly', chargeDate: 20, active: true, paymentMethod: 'credit', creditCardId: '', totalPayments: 0, paymentsMade: 0 }
        ];

        // --- Business Variable Expenses ---
        data.business.variableExpenses = [];

        // --- Business Transfers (business → home) ---
        data.business.transfers = [
            { id: this.genId(), amount: 6400, date: '2026-02-10', notes: 'שכ"ד' },
            { id: this.genId(), amount: 2000, date: '2026-02-10', notes: 'העברה לבית' }
        ];

        // ========== CREDIT CARDS ==========
        data.creditCards = [
            {
                id: this.genId(), name: 'ישרכרט 1899', account: 'home', limit: 5000, billingDate: 15,
                charges: [
                    // One-time charges for Feb 2026 billing cycle (total 6,286.75)
                    { id: this.genId(), description: 'חיובים שוטפים ישרכרט פברואר', totalAmount: 6286.75, installments: 1, installmentsPaid: 0, startDate: '2026-02-15', monthlyAmount: 6286.75 }
                ]
            },
            {
                id: this.genId(), name: 'ויזה כ.א.ל 8908', account: 'home', limit: 15000, billingDate: 23,
                charges: [
                    // Installment charges
                    { id: this.genId(), description: 'קאנטרי גבעתיים', totalAmount: 4680, installments: 12, installmentsPaid: 2, startDate: '2025-12-23', monthlyAmount: 390 },
                    { id: this.genId(), description: 'ביטוח חובה', totalAmount: 2044, installments: 12, installmentsPaid: 4, startDate: '2025-10-23', monthlyAmount: 170.33 },
                    { id: this.genId(), description: 'צחי טיבולי רופא שיניים', totalAmount: 690, installments: 12, installmentsPaid: 2, startDate: '2025-12-23', monthlyAmount: 57 },
                    { id: this.genId(), description: 'המרכז החדש', totalAmount: 500, installments: 10, installmentsPaid: 6, startDate: '2025-08-23', monthlyAmount: 50 },
                    { id: this.genId(), description: 'צהרון בית עמנואל', totalAmount: 1154, installments: 1, installmentsPaid: 0, startDate: '2026-02-23', monthlyAmount: 1154 }
                ]
            },
            {
                id: this.genId(), name: 'מסטרקארד 3867 עסק', account: 'business', limit: 29700, billingDate: 20,
                charges: [
                    // Installment charges
                    { id: this.genId(), description: 'פרינטר דיל', totalAmount: 1630, installments: 3, installmentsPaid: 1, startDate: '2025-12-20', monthlyAmount: 543.33 },
                    { id: this.genId(), description: 'באג גבעתיים', totalAmount: 2499, installments: 12, installmentsPaid: 3, startDate: '2025-09-20', monthlyAmount: 208 },
                    { id: this.genId(), description: 'אייבורי', totalAmount: 2489, installments: 10, installmentsPaid: 4, startDate: '2025-06-20', monthlyAmount: 248.90 },
                    { id: this.genId(), description: 'פריסת כרטיס אשראי', totalAmount: 17414.66, installments: 3, installmentsPaid: 1, startDate: '2025-12-20', monthlyAmount: 5901.42 },
                    // Tax payments (bi-monthly, entered as charges)
                    { id: this.genId(), description: 'מע"מ', totalAmount: 10043, installments: 1, installmentsPaid: 0, startDate: '2026-02-20', monthlyAmount: 10043 },
                    { id: this.genId(), description: 'מס הכנסה', totalAmount: 2562, installments: 1, installmentsPaid: 0, startDate: '2026-02-20', monthlyAmount: 2562 }
                ]
            }
        ];

        // ========== LOANS ==========
        data.loans = [
            {
                id: this.genId(), name: 'הלוואה 302 בינלאומי', account: 'home', lender: 'בנק הבינלאומי',
                originalAmount: 152550, monthlyPayment: 1777.16, interestRate: 7,
                totalInstallments: 120, installmentsPaid: 22, chargeDate: 17,
                startDate: '2024-02-19', endDate: '2034-03-17', notes: 'P+1.5%, הל.קהלי מטרה', active: true
            },
            {
                id: this.genId(), name: 'הלוואה 493 בינלאומי', account: 'home', lender: 'בנק הבינלאומי',
                originalAmount: 50000, monthlyPayment: 1014.09, interestRate: 8,
                totalInstallments: 60, installmentsPaid: 3, chargeDate: 21,
                startDate: '2025-11-21', endDate: '2030-10-21', notes: 'P+2.5%, הל.קהלי מטרה', active: true
            },
            {
                id: this.genId(), name: 'הלוואה הפועלים (ישנה)', account: 'business', lender: 'בנק הפועלים',
                originalAmount: 250000, monthlyPayment: 4029.18, interestRate: 8.1,
                totalInstallments: 84, installmentsPaid: 6, chargeDate: 8,
                startDate: '2024-07-23', endDate: '2031-07-08', notes: 'P+2.1%', active: true
            },
            {
                id: this.genId(), name: 'הלוואה הפועלים (חדשה)', account: 'business', lender: 'בנק הפועלים',
                originalAmount: 40800, monthlyPayment: 670, interestRate: 8.5,
                totalInstallments: 80, installmentsPaid: 0, chargeDate: 20,
                startDate: '2026-03-20', endDate: '2032-10-20', notes: '8.5% קבועה, מתחיל 20.3.26', active: true
            }
        ];

        // ========== EMPLOYEES (Freelancers) ==========
        data.employees = [
            { id: this.genId(), name: 'ליאור סיני', role: 'פרילנסר/ית', grossSalary: 1700, paymentDate: 10, active: true, payments: [] },
            { id: this.genId(), name: 'חן צור', role: 'פרילנסר/ית', grossSalary: 1020, paymentDate: 10, active: true, payments: [] },
            { id: this.genId(), name: 'ימית ואופיר לוינגר', role: 'פרילנסר/ית', grossSalary: 3480, paymentDate: 10, active: true, payments: [] },
            { id: this.genId(), name: 'רומי לני', role: 'פרילנסר/ית', grossSalary: 960, paymentDate: 10, active: true, payments: [] },
            { id: this.genId(), name: 'בן יוסף עודד', role: 'פרילנסר/ית', grossSalary: 2320, paymentDate: 10, active: true, payments: [] },
            { id: this.genId(), name: 'נדזידה מקרוב', role: 'פרילנסר/ית', grossSalary: 6440, paymentDate: 10, active: true, payments: [] }
        ];

        // ========== SETTINGS ==========
        data.settings.creditFramework = { home: 10000, business: 45000 };

        // ========== CATEGORIES ==========
        data.categories = {
            home: ['קבועות', 'בית', 'ילדים', 'רפואה', 'ביטוחים', 'רכב ותחבורה', 'תקשורת', 'בילויים', 'שונות'],
            business: ['קבועות', 'ביטוחים', 'שכר', 'שיווק', 'ציוד', 'רכב ותחבורה', 'שונות']
        };

        // Save and refresh
        this.save(data);
        this._cache = data;
        showToast('נתונים אמיתיים נטענו בהצלחה!', 'success');
        if (typeof App !== 'undefined') App.renderPage(App.currentPage || 'dashboard');
    }
};
