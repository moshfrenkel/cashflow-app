// ===== Daily Cashflow View =====
const DailyView = {
    currentMonth: null,
    currentYear: null,
    activeAccount: 'home', // 'home' or 'business'

    init() {
        const now = new Date();
        this.currentMonth = now.getMonth();
        this.currentYear = now.getFullYear();
    },

    render() {
        if (this.currentMonth === null) this.init();
        const data = Store.get();
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const today = new Date();
        const isCurrentMonth = today.getMonth() === this.currentMonth && today.getFullYear() === this.currentYear;
        const todayDate = today.getDate();

        // Build daily entries
        const days = [];
        let runningHome = data.home.balance;
        let runningBiz = data.business.balance;

        // If viewing a future/past month, we'd need to adjust opening balances
        // For now, use stored balances as opening for current month

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const entries = this._getEntriesForDay(data, day, dateStr);

            const dayIncomeHome = entries.filter(e => e.account === 'home' && e.type === 'income').reduce((s, e) => s + e.amount, 0);
            const dayExpenseHome = entries.filter(e => e.account === 'home' && e.type === 'expense').reduce((s, e) => s + e.amount, 0);
            const dayIncomeBiz = entries.filter(e => e.account === 'business' && e.type === 'income').reduce((s, e) => s + e.amount, 0);
            const dayExpenseBiz = entries.filter(e => e.account === 'business' && e.type === 'expense').reduce((s, e) => s + e.amount, 0);

            runningHome += dayIncomeHome - dayExpenseHome;
            runningBiz += dayIncomeBiz - dayExpenseBiz;

            days.push({
                day,
                dateStr,
                entries,
                balanceHome: runningHome,
                balanceBiz: runningBiz,
                totalIncomeHome: dayIncomeHome,
                totalExpenseHome: dayExpenseHome,
                totalIncomeBiz: dayIncomeBiz,
                totalExpenseBiz: dayExpenseBiz,
                isToday: isCurrentMonth && day === todayDate,
                isPast: isCurrentMonth ? day < todayDate : (this.currentYear < today.getFullYear() || (this.currentYear === today.getFullYear() && this.currentMonth < today.getMonth())),
                isFuture: isCurrentMonth ? day > todayDate : (this.currentYear > today.getFullYear() || (this.currentYear === today.getFullYear() && this.currentMonth > today.getMonth()))
            });
        }

        const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

        return `
            <div class="daily-view-header">
                <div class="daily-nav">
                    <button class="btn btn-ghost" onclick="DailyView.prevMonth()">→</button>
                    <h2>${getMonthName(this.currentMonth)} ${this.currentYear}</h2>
                    <button class="btn btn-ghost" onclick="DailyView.nextMonth()">←</button>
                </div>
                <div class="daily-filters">
                    <button class="btn ${this.activeAccount === 'home' ? 'btn-primary' : 'btn-ghost'}" onclick="DailyView.setAccount('home')">בית</button>
                    <button class="btn ${this.activeAccount === 'business' ? 'btn-primary' : 'btn-ghost'}" onclick="DailyView.setAccount('business')">עסק</button>
                </div>
            </div>

            <div class="daily-summary-bar">
                <div class="daily-summary-item">
                    <span class="daily-summary-label">יתרת פתיחה</span>
                    <span class="daily-summary-value ${this._balanceClass(this._getOpeningBalance())}">${formatCurrency(this._getOpeningBalance())}</span>
                </div>
                <div class="daily-summary-item">
                    <span class="daily-summary-label">סה"כ הכנסות</span>
                    <span class="daily-summary-value positive">${formatCurrency(days.reduce((s, d) => s + (this.activeAccount === 'business' ? d.totalIncomeBiz : d.totalIncomeHome), 0))}</span>
                </div>
                <div class="daily-summary-item">
                    <span class="daily-summary-label">סה"כ הוצאות</span>
                    <span class="daily-summary-value negative">${formatCurrency(days.reduce((s, d) => s + (this.activeAccount === 'business' ? d.totalExpenseBiz : d.totalExpenseHome), 0))}</span>
                </div>
                <div class="daily-summary-item">
                    <span class="daily-summary-label">יתרת סגירה</span>
                    <span class="daily-summary-value ${this._balanceClass(days[days.length - 1][this._balanceKey()])}">${formatCurrency(days[days.length - 1][this._balanceKey()])}</span>
                </div>
            </div>

            <div class="daily-timeline">
                ${days.map(d => {
                    const filteredEntries = this._filterEntries(d.entries);
                    const hasEntries = filteredEntries.length > 0;
                    const dayOfWeek = new Date(this.currentYear, this.currentMonth, d.day).getDay();
                    const balance = d[this._balanceKey()];

                    if (!hasEntries && !d.isToday) return `
                        <div class="daily-row daily-row-empty ${d.isToday ? 'today' : ''} ${d.isPast ? 'past' : ''}">
                            <div class="daily-date">
                                <span class="daily-day-num">${d.day}</span>
                                <span class="daily-day-name">${dayNames[dayOfWeek]}</span>
                            </div>
                            <div class="daily-entries-empty">
                                <button class="btn-add-entry" onclick="DailyView.openAddEntry('${d.dateStr}', ${d.day})">+</button>
                            </div>
                            <div class="daily-balance ${this._balanceClass(balance)}">${formatCurrency(balance)}</div>
                        </div>`;

                    return `
                        <div class="daily-row ${d.isToday ? 'today' : ''} ${d.isPast ? 'past' : ''} ${dayOfWeek === 6 ? 'shabbat' : ''}">
                            <div class="daily-date">
                                <span class="daily-day-num">${d.day}</span>
                                <span class="daily-day-name">${dayNames[dayOfWeek]}</span>
                            </div>
                            <div class="daily-entries">
                                ${filteredEntries.map(e => `
                                    <div class="daily-entry ${e.type}">
                                        <span class="entry-icon">${e.icon}</span>
                                        <span class="entry-name">${e.name}</span>
                                        <span class="entry-amount ${e.type === 'income' ? 'amount-positive' : 'amount-negative'}">${e.type === 'income' ? '+' : '-'}${formatCurrency(e.amount)}</span>
                                        <span class="entry-source badge badge-${e.account === 'home' ? 'green' : 'blue'}">${e.account === 'home' ? 'בית' : 'עסק'}</span>
                                        ${e.editable ? `<button class="btn-inline-edit" onclick="DailyView.editEntry('${e.sourceType}', '${e.sourceId}', '${e.account}')" title="עריכה">✏️</button>` : ''}
                                    </div>
                                `).join('')}
                                <button class="btn-add-entry" onclick="DailyView.openAddEntry('${d.dateStr}', ${d.day})">+ הוסף</button>
                            </div>
                            <div class="daily-balance ${this._balanceClass(balance)}">${formatCurrency(balance)}</div>
                        </div>`;
                }).join('')}
            </div>
        `;
    },

    _getOpeningBalance() {
        const data = Store.get();
        if (this.activeAccount === 'business') return data.business.balance;
        return data.home.balance;
    },

    _balanceKey() {
        if (this.activeAccount === 'business') return 'balanceBiz';
        return 'balanceHome';
    },

    _balanceClass(val) {
        return val >= 0 ? 'positive' : 'negative';
    },

    _filterEntries(entries) {
        return entries.filter(e => e.account === this.activeAccount);
    },

    _getEntriesForDay(data, dayOfMonth, dateStr) {
        const entries = [];

        // --- HOME ---
        // Home incomes by date
        data.home.incomes.forEach(inc => {
            if (this._dateMatchesDay(inc.date, dateStr)) {
                entries.push({ name: inc.name, amount: inc.amount, type: 'income', account: 'home', icon: '💰', sourceType: 'home-income', sourceId: inc.id, editable: true });
            }
        });

        // Home fixed expenses by chargeDate
        data.home.fixedExpenses.filter(e => e.active).forEach(e => {
            if (e.chargeDate === dayOfMonth && this._frequencyApplies(e.frequency, this.currentMonth)) {
                entries.push({ name: e.name, amount: e.amount, type: 'expense', account: 'home', icon: '📋', sourceType: 'home-fixed', sourceId: e.id, editable: true });
            }
        });

        // Home variable expenses by date
        data.home.variableExpenses.forEach(e => {
            if (this._dateMatchesDay(e.date, dateStr)) {
                entries.push({ name: e.name, amount: e.amount, type: 'expense', account: 'home', icon: '🧾', sourceType: 'home-variable', sourceId: e.id, editable: true });
            }
        });

        // --- BUSINESS ---
        // Business incomes by expectedDate
        data.business.incomes.forEach(inc => {
            if (this._dateMatchesDay(inc.expectedDate, dateStr)) {
                const statusIcon = inc.status === 'received' ? '✅' : inc.status === 'late' ? '🔴' : '⏳';
                entries.push({ name: inc.clientName, amount: inc.amount, type: 'income', account: 'business', icon: statusIcon, sourceType: 'biz-income', sourceId: inc.id, editable: true, status: inc.status });
            }
        });

        // Business fixed expenses by chargeDate
        data.business.fixedExpenses.filter(e => e.active).forEach(e => {
            if (e.chargeDate === dayOfMonth && this._frequencyApplies(e.frequency, this.currentMonth)) {
                entries.push({ name: e.name, amount: e.amount, type: 'expense', account: 'business', icon: '📋', sourceType: 'biz-fixed', sourceId: e.id, editable: true });
            }
        });

        // Business variable expenses by date
        data.business.variableExpenses.forEach(e => {
            if (this._dateMatchesDay(e.date, dateStr)) {
                entries.push({ name: e.name, amount: e.amount, type: 'expense', account: 'business', icon: '🧾', sourceType: 'biz-variable', sourceId: e.id, editable: true });
            }
        });

        // Business transfers by date (expense for business)
        data.business.transfers.forEach(t => {
            if (this._dateMatchesDay(t.date, dateStr)) {
                entries.push({ name: 'העברה לבית' + (t.notes ? ` (${t.notes})` : ''), amount: t.amount, type: 'expense', account: 'business', icon: '↔️', sourceType: 'biz-transfer', sourceId: t.id, editable: true });
            }
        });

        // Transfer sync: business transfers also appear as home income
        data.business.transfers.forEach(t => {
            if (this._dateMatchesDay(t.date, dateStr)) {
                entries.push({ name: 'העברה מעסק' + (t.notes ? ` (${t.notes})` : ''), amount: t.amount, type: 'income', account: 'home', icon: '↔️', sourceType: 'biz-transfer', sourceId: t.id, editable: false });
            }
        });

        // --- LOANS ---
        (data.loans || []).filter(l => l.active && (l.totalInstallments - l.installmentsPaid) > 0).forEach(loan => {
            if (loan.chargeDate === dayOfMonth) {
                entries.push({ name: loan.name, amount: loan.monthlyPayment, type: 'expense', account: loan.account, icon: '🏦', sourceType: 'loan', sourceId: loan.id, editable: false });
            }
        });

        // --- CREDIT CARDS ---
        data.creditCards.forEach(card => {
            if (card.billingDate === dayOfMonth) {
                const monthlyCharge = getMonthlyCardCharges(card);
                if (monthlyCharge > 0) {
                    entries.push({ name: card.name, amount: monthlyCharge, type: 'expense', account: card.account, icon: '💳', sourceType: 'credit-card', sourceId: card.id, editable: false });
                }
            }
        });

        return entries;
    },

    _dateMatchesDay(dateField, dateStr) {
        if (!dateField) return false;
        return dateField === dateStr;
    },

    _frequencyApplies(frequency, month) {
        // For simplicity, monthly always applies
        // bimonthly: even months, quarterly: every 3, yearly: january
        if (frequency === 'monthly') return true;
        if (frequency === 'bimonthly') return month % 2 === 0;
        if (frequency === 'quarterly') return month % 3 === 0;
        if (frequency === 'yearly') return month === 0;
        return true;
    },

    // --- Navigation ---
    prevMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
        App.renderPage('daily-view');
    },

    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
        App.renderPage('daily-view');
    },

    setAccount(account) {
        this.activeAccount = account;
        App.renderPage('daily-view');
    },

    // --- Add Entry ---
    openAddEntry(dateStr, dayOfMonth) {
        const cats = Store.get().categories;
        const isHome = this.activeAccount === 'home';
        const defaultCats = isHome ? cats.home : cats.business;
        openModal('הוספת רשומה', `
            <div class="form-row">
                <div class="form-group">
                    <label>סוג</label>
                    <select id="de-type" onchange="DailyView._onTypeChange()">
                        ${isHome ? `
                        <option value="home-variable">הוצאה בית</option>
                        <option value="home-income">הכנסה בית</option>
                        <option value="biz-variable">הוצאה עסק</option>
                        <option value="biz-income">הכנסה עסק</option>
                        <option value="biz-transfer">העברה לבית</option>
                        ` : `
                        <option value="biz-variable">הוצאה עסק</option>
                        <option value="biz-income">הכנסה עסק</option>
                        <option value="biz-transfer">העברה לבית</option>
                        <option value="home-variable">הוצאה בית</option>
                        <option value="home-income">הכנסה בית</option>
                        `}
                    </select>
                </div>
                <div class="form-group">
                    <label>תאריך</label>
                    <input type="date" id="de-date" value="${dateStr}">
                </div>
            </div>
            <div class="form-group"><label>שם / תיאור</label><input type="text" id="de-name"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום</label><input type="number" id="de-amount"></div>
                <div class="form-group" id="de-category-group">
                    <label>קטגוריה</label>
                    <select id="de-category">
                        ${defaultCats.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group" id="de-status-group" style="display:none;">
                <label>סטטוס</label>
                <select id="de-status">
                    <option value="expected">צפוי</option>
                    <option value="received">התקבל</option>
                </select>
            </div>
            <div class="form-group" id="de-notes-group" style="display:none;">
                <label>הערות</label>
                <input type="text" id="de-notes">
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="DailyView.saveEntry()">שמור</button>
                <button class="btn btn-ghost" onclick="closeModal()">ביטול</button>
            </div>
        `);
    },

    _onTypeChange() {
        const type = document.getElementById('de-type').value;
        const catGroup = document.getElementById('de-category-group');
        const statusGroup = document.getElementById('de-status-group');
        const notesGroup = document.getElementById('de-notes-group');
        const catSelect = document.getElementById('de-category');
        const cats = Store.get().categories;

        // Update categories
        if (type.startsWith('home')) {
            catSelect.innerHTML = cats.home.map(c => `<option value="${c}">${c}</option>`).join('');
        } else {
            catSelect.innerHTML = cats.business.map(c => `<option value="${c}">${c}</option>`).join('');
        }

        // Show/hide fields
        statusGroup.style.display = type === 'biz-income' ? 'block' : 'none';
        notesGroup.style.display = (type === 'biz-income' || type === 'biz-transfer') ? 'block' : 'none';
        catGroup.style.display = type === 'biz-transfer' ? 'none' : 'block';
    },

    saveEntry() {
        const type = document.getElementById('de-type').value;
        const date = document.getElementById('de-date').value;
        const name = document.getElementById('de-name').value.trim();
        const amount = parseFloat(document.getElementById('de-amount').value);
        const category = document.getElementById('de-category').value;
        const status = document.getElementById('de-status').value;
        const notes = (document.getElementById('de-notes').value || '').trim();

        if (!name || !amount) { showToast('נא למלא שם וסכום', 'error'); return; }

        Store.update(data => {
            switch (type) {
                case 'home-income':
                    data.home.incomes.push({ id: Store.genId(), name, amount, type: 'one-time', date, category });
                    break;
                case 'home-variable':
                    data.home.variableExpenses.push({ id: Store.genId(), name, amount, category, date });
                    break;
                case 'biz-income':
                    data.business.incomes.push({ id: Store.genId(), clientName: name, amount, expectedDate: date, status, notes });
                    break;
                case 'biz-variable':
                    data.business.variableExpenses.push({ id: Store.genId(), name, amount, category, date });
                    break;
                case 'biz-transfer':
                    data.business.transfers.push({ id: Store.genId(), amount, date, notes: name });
                    break;
            }
        });
        closeModal();
        showToast('נוסף בהצלחה', 'success');
    },

    // --- Edit Entry (reuse existing module modals) ---
    editEntry(sourceType, sourceId, account) {
        switch (sourceType) {
            case 'home-income': HomeCashflow.editIncome(sourceId); break;
            case 'home-fixed': HomeCashflow.editFixed(sourceId); break;
            case 'home-variable': HomeCashflow.editVariable(sourceId); break;
            case 'biz-income': BusinessCashflow.editClient(sourceId); break;
            case 'biz-fixed': BusinessCashflow.editFixed(sourceId); break;
            case 'biz-variable': BusinessCashflow.editVariable(sourceId); break;
        }
    },

    afterRender() {
        // Scroll to today if visible
        const todayEl = document.querySelector('.daily-row.today');
        if (todayEl) {
            setTimeout(() => todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        }
    }
};
