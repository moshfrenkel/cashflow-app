// ===== Utility Functions =====

function formatCurrency(num) {
    if (num === null || num === undefined || isNaN(num)) return '₪0';
    const abs = Math.abs(num);
    const formatted = abs.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (num < 0 ? '-' : '') + '₪' + formatted;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

function getMonthName(monthIndex) {
    const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    return months[monthIndex];
}

function getCurrentMonth() {
    const d = new Date();
    return { month: d.getMonth(), year: d.getFullYear() };
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2500);
    setTimeout(() => toast.remove(), 3000);
}

function openModal(title, bodyHTML) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('show');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function confirmAction(msg) {
    return confirm(msg);
}

// Calculate totals for arrays
function sumBy(arr, key) {
    return arr.reduce((sum, item) => sum + (parseFloat(item[key]) || 0), 0);
}

// Get month's fixed expenses total
function getMonthlyFixedTotal(expenses) {
    return expenses.filter(e => e.active).reduce((sum, e) => {
        switch (e.frequency) {
            case 'monthly': return sum + e.amount;
            case 'bimonthly': return sum + e.amount / 2;
            case 'quarterly': return sum + e.amount / 3;
            case 'yearly': return sum + e.amount / 12;
            default: return sum + e.amount;
        }
    }, 0);
}

// Get current month's credit card charges
function getMonthlyCardCharges(card) {
    return card.charges.reduce((sum, ch) => {
        const remaining = ch.installments - ch.installmentsPaid;
        if (remaining > 0) return sum + ch.monthlyAmount;
        return sum;
    }, 0);
}

// Get total credit usage for a card
function getCardUsage(card) {
    return card.charges.reduce((sum, ch) => {
        const remaining = ch.installments - ch.installmentsPaid;
        return sum + (remaining * ch.monthlyAmount);
    }, 0);
}

// Get all active monthly charges across all cards for an account
function getTotalCardCharges(account) {
    const data = Store.get();
    return data.creditCards
        .filter(c => c.account === account)
        .reduce((sum, card) => sum + getMonthlyCardCharges(card), 0);
}

// Calculate employer cost (~30% on top)
function calcEmployerCost(gross) {
    return Math.round(gross * 0.3);
}

// Get total monthly salary cost
function getTotalSalaryCost() {
    const data = Store.get();
    return data.employees.filter(e => e.active).reduce((sum, e) => {
        return sum + e.grossSalary + calcEmployerCost(e.grossSalary);
    }, 0);
}

// Frequency label
function freqLabel(freq) {
    const labels = { monthly: 'חודשי', bimonthly: 'דו-חודשי', quarterly: 'רבעוני', yearly: 'שנתי' };
    return labels[freq] || freq;
}

// Status label
function statusLabel(status) {
    const labels = { expected: 'צפוי', received: 'התקבל', late: 'באיחור' };
    return labels[status] || status;
}

function statusBadge(status) {
    const colors = { expected: 'yellow', received: 'green', late: 'red' };
    return `<span class="badge badge-${colors[status] || 'blue'}">${statusLabel(status)}</span>`;
}

// Get forecast data for N months ahead
function getForecastData(months = 6) {
    const data = Store.get();
    const result = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
        const m = (now.getMonth() + i) % 12;
        const y = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);

        // Home
        const homeIncome = sumBy(data.home.incomes.filter(inc => inc.type === 'monthly'), 'amount');
        const homeFixed = getMonthlyFixedTotal(data.home.fixedExpenses);
        const homeCards = data.creditCards.filter(c => c.account === 'home').reduce((s, c) => s + getMonthlyCardCharges(c), 0);

        // Business
        const bizFixedIncome = data.business.incomes
            .filter(inc => {
                const d = new Date(inc.expectedDate);
                return d.getMonth() === m && d.getFullYear() === y;
            })
            .reduce((s, inc) => s + inc.amount, 0);
        const bizFixed = getMonthlyFixedTotal(data.business.fixedExpenses);
        const bizCards = data.creditCards.filter(c => c.account === 'business').reduce((s, c) => s + getMonthlyCardCharges(c), 0);
        const salaries = getTotalSalaryCost();

        result.push({
            month: m,
            year: y,
            label: getMonthName(m),
            homeIncome,
            homeExpenses: homeFixed + homeCards,
            homeNet: homeIncome - homeFixed - homeCards,
            bizIncome: bizFixedIncome || sumBy(data.business.incomes.filter(inc => inc.status === 'received'), 'amount') / Math.max(1, i + 1),
            bizExpenses: bizFixed + bizCards + salaries,
            bizNet: (bizFixedIncome || 0) - bizFixed - bizCards - salaries
        });
    }
    return result;
}

// Generate alerts
function getAlerts() {
    const data = Store.get();
    const alerts = [];
    const now = new Date();
    const dayOfMonth = now.getDate();

    // Low balance warnings
    if (data.home.balance < 0) {
        alerts.push({ type: 'danger', icon: '⚠️', text: `חשבון הבית ביתרת חובה: ${formatCurrency(data.home.balance)}` });
    }
    if (data.business.balance < 0) {
        alerts.push({ type: 'danger', icon: '⚠️', text: `חשבון העסק ביתרת חובה: ${formatCurrency(data.business.balance)}` });
    }

    // Upcoming payments (within 5 days)
    data.home.fixedExpenses.filter(e => e.active).forEach(e => {
        const diff = e.chargeDate - dayOfMonth;
        if (diff > 0 && diff <= 5) {
            alerts.push({ type: 'info', icon: '📅', text: `${e.name} - ${formatCurrency(e.amount)} ב-${e.chargeDate} לחודש` });
        }
    });

    // Credit card limit warnings
    data.creditCards.forEach(card => {
        const usage = getMonthlyCardCharges(card);
        const pct = (usage / card.limit) * 100;
        if (pct > 80) {
            alerts.push({ type: 'warning', icon: '💳', text: `${card.name}: ניצול ${Math.round(pct)}% מהמסגרת (${formatCurrency(usage)} / ${formatCurrency(card.limit)})` });
        }
    });

    // Late client payments
    data.business.incomes.filter(inc => inc.status === 'late').forEach(inc => {
        alerts.push({ type: 'danger', icon: '🔴', text: `תשלום באיחור מ-${inc.clientName}: ${formatCurrency(inc.amount)}` });
    });

    // Expected payments today
    data.business.incomes.filter(inc => {
        if (inc.status !== 'expected') return false;
        const d = new Date(inc.expectedDate);
        return d.toDateString() === now.toDateString();
    }).forEach(inc => {
        alerts.push({ type: 'info', icon: '💰', text: `צפוי היום מ-${inc.clientName}: ${formatCurrency(inc.amount)}` });
    });

    return alerts;
}
