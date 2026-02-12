// ===== Dashboard Module =====
const Dashboard = {
    charts: {},
    activeAccount: 'home', // 'home' or 'business'

    render() {
        const data = Store.get();
        const isHome = this.activeAccount === 'home';

        const now = new Date();
        const curMonth = now.getMonth();
        const curYear = now.getFullYear();

        // Home calculations
        const homeMonthlyIncome = sumBy(data.home.incomes.filter(i => i.type === 'monthly'), 'amount');
        const homeOneTimeIncome = sumBy(data.home.incomes.filter(i => {
            if (i.type === 'monthly') return false;
            const d = new Date(i.date);
            return d.getMonth() === curMonth && d.getFullYear() === curYear;
        }), 'amount');
        const homeIncome = homeMonthlyIncome + homeOneTimeIncome;
        const homeFixed = getMonthlyFixedTotal(data.home.fixedExpenses);
        const homeCards = getTotalCardChargesForMonth('home', curYear, curMonth);
        const homeVar = sumBy(data.home.variableExpenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === curMonth && d.getFullYear() === curYear;
        }), 'amount');
        const homeTransfersIn = sumBy(data.business.transfers.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === curMonth && d.getFullYear() === curYear;
        }), 'amount');

        // Loans per account (with startDate check)
        const homeLoans = (data.loans || []).filter(l => l.active && l.account === 'home' && (l.totalInstallments - l.installmentsPaid) > 0)
            .filter(l => !l.startDate || new Date(l.startDate) <= new Date(curYear, curMonth + 1, 0));
        const bizLoans = (data.loans || []).filter(l => l.active && l.account === 'business' && (l.totalInstallments - l.installmentsPaid) > 0)
            .filter(l => !l.startDate || new Date(l.startDate) <= new Date(curYear, curMonth + 1, 0));
        const homeLoansMonthly = homeLoans.reduce((s, l) => s + l.monthlyPayment, 0);
        const bizLoansMonthly = bizLoans.reduce((s, l) => s + l.monthlyPayment, 0);

        const totalExpHome = homeFixed + homeCards + homeVar + homeLoansMonthly;
        const homeNetMonthly = homeIncome + homeTransfersIn - totalExpHome;

        // Business calculations
        const bizReceived = sumBy(data.business.incomes.filter(i => i.status === 'received'), 'amount');
        const bizExpected = sumBy(data.business.incomes.filter(i => i.status === 'expected'), 'amount');
        const bizFixed = getMonthlyFixedTotal(data.business.fixedExpenses);
        const bizCards = getTotalCardChargesForMonth('business', curYear, curMonth);
        const bizVar = sumBy(data.business.variableExpenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === curMonth && d.getFullYear() === curYear;
        }), 'amount');
        const salaryTotal = getTotalSalaryCost();
        const bizTransfersOut = sumBy(data.business.transfers.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === curMonth && d.getFullYear() === curYear;
        }), 'amount');
        const totalExpBiz = bizFixed + bizCards + bizVar + salaryTotal + bizTransfersOut + bizLoansMonthly;
        const bizNetMonthly = bizReceived - totalExpBiz;

        // Credit framework
        const creditFramework = data.settings.creditFramework || { home: 0, business: 0 };
        const availableHome = data.home.balance + (creditFramework.home || 0);
        const availableBiz = data.business.balance + (creditFramework.business || 0);

        const alerts = getAlerts();

        // Cards per account
        const accountCards = data.creditCards.filter(c => c.account === this.activeAccount);

        return `
            <div class="daily-filters" style="margin-bottom:16px;display:flex;gap:8px;">
                <button class="btn ${this.activeAccount === 'home' ? 'btn-primary' : 'btn-ghost'}" onclick="Dashboard.setAccount('home')">🏠 בית</button>
                <button class="btn ${this.activeAccount === 'business' ? 'btn-primary' : 'btn-ghost'}" onclick="Dashboard.setAccount('business')">💼 עסק</button>
            </div>

            ${isHome ? this._renderHomeSummary(data, homeIncome, homeFixed, homeCards, homeVar, homeTransfersIn, homeLoansMonthly, homeNetMonthly, availableHome, creditFramework) :
                        this._renderBizSummary(data, bizReceived, bizExpected, bizFixed, bizCards, bizVar, salaryTotal, bizTransfersOut, bizLoansMonthly, bizNetMonthly, availableBiz, creditFramework)}

            <div class="grid-2">
                <div class="card">
                    <div class="card-header">
                        <h3>📈 תחזית תזרים - 6 חודשים ${isHome ? '(בית)' : '(עסק)'}</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="forecast-chart"></canvas>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3>📊 פירוט הוצאות - החודש</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="expense-breakdown-chart"></canvas>
                    </div>
                </div>
            </div>

            <div class="grid-2">
                <div class="card">
                    <div class="card-header">
                        <h3>🔔 התראות</h3>
                    </div>
                    ${alerts.length === 0 ? '<div class="empty-state"><p>אין התראות כרגע 👍</p></div>' :
                    alerts.map(a => `<div class="alert-item ${a.type}">${a.icon} ${a.text}</div>`).join('')}
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3>💳 כרטיסי אשראי ${isHome ? '- בית' : '- עסק'}</h3>
                    </div>
                    ${accountCards.length === 0 ? '<div class="empty-state"><p>אין כרטיסים לחשבון זה</p></div>' :
                    accountCards.map(card => {
                        const usage = getMonthlyCardCharges(card);
                        const pct = Math.min(100, Math.round((usage / card.limit) * 100));
                        const color = pct > 80 ? 'red' : pct > 50 ? 'yellow' : 'green';
                        return `
                            <div style="margin-bottom:12px;">
                                <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px;">
                                    <span>${card.name}</span>
                                    <span>${formatCurrency(usage)} / ${formatCurrency(card.limit)}</span>
                                </div>
                                <div class="progress-bar"><div class="fill ${color}" style="width:${pct}%"></div></div>
                            </div>`;
                    }).join('')}
                </div>
            </div>

            ${isHome ? `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header"><h3>🏦 הלוואות בית</h3></div>
                    ${homeLoans.length === 0 ? '<div class="empty-state"><p>אין הלוואות פעילות</p></div>' :
                    homeLoans.map(l => {
                        const remaining = l.totalInstallments - l.installmentsPaid;
                        const pct = Math.round((l.installmentsPaid / l.totalInstallments) * 100);
                        return `
                            <div style="margin-bottom:14px;">
                                <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px;">
                                    <span>${l.name}</span>
                                    <span>${formatCurrency(l.monthlyPayment)} | נותרו ${remaining} תשלומים</span>
                                </div>
                                <div class="progress-bar"><div class="fill green" style="width:${pct}%"></div></div>
                            </div>`;
                    }).join('')}
                </div>
                <div class="card">
                    <div class="card-header"><h3>🎯 יעדי חיסכון</h3></div>
                    ${data.savingGoals.length === 0 ? '<div class="empty-state"><p>לא הוגדרו יעדים</p></div>' :
                    data.savingGoals.map(g => {
                        const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                        return `
                            <div style="margin-bottom:14px;">
                                <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px;">
                                    <span>${g.name}</span>
                                    <span>${pct}% - ${formatCurrency(g.currentAmount)} / ${formatCurrency(g.targetAmount)}</span>
                                </div>
                                <div class="progress-bar"><div class="fill blue" style="width:${pct}%"></div></div>
                            </div>`;
                    }).join('')}
                </div>
            </div>
            ` : `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header"><h3>💰 הכנסות צפויות מלקוחות</h3></div>
                    ${data.business.incomes.filter(i => i.status === 'expected' || i.status === 'late').length === 0 ?
                    '<div class="empty-state"><p>אין הכנסות צפויות</p></div>' :
                    '<div class="table-wrapper"><table><thead><tr><th>לקוח</th><th>סכום</th><th>תאריך צפוי</th><th>סטטוס</th></tr></thead><tbody>' +
                    data.business.incomes.filter(i => i.status === 'expected' || i.status === 'late').map(i =>
                        '<tr><td>' + i.clientName + '</td><td class="amount-positive">' + formatCurrency(i.amount) + '</td><td>' + formatDate(i.expectedDate) + '</td><td>' + statusBadge(i.status) + '</td></tr>'
                    ).join('') + '</tbody></table></div>'}
                </div>
                <div class="card">
                    <div class="card-header"><h3>🏦 הלוואות עסק</h3></div>
                    ${bizLoans.length === 0 ? '<div class="empty-state"><p>אין הלוואות פעילות</p></div>' :
                    bizLoans.map(l => {
                        const remaining = l.totalInstallments - l.installmentsPaid;
                        const pct = Math.round((l.installmentsPaid / l.totalInstallments) * 100);
                        return `
                            <div style="margin-bottom:14px;">
                                <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:4px;">
                                    <span>${l.name}</span>
                                    <span>${formatCurrency(l.monthlyPayment)} | נותרו ${remaining} תשלומים</span>
                                </div>
                                <div class="progress-bar"><div class="fill green" style="width:${pct}%"></div></div>
                            </div>`;
                    }).join('')}
                </div>
            </div>
            `}
        `;
    },

    _renderHomeSummary(data, income, fixed, cards, variable, transfersIn, loansMonthly, netMonthly, available, creditFramework) {
        return `
            <div class="summary-grid">
                <div class="summary-card green">
                    <div class="label">יתרת בנק</div>
                    <div class="value ${data.home.balance >= 0 ? 'positive' : 'negative'}">${formatCurrency(data.home.balance)}</div>
                    <div class="sub">${creditFramework.home > 0 ? 'זמין: ' + formatCurrency(available) : ''}</div>
                </div>
                <div class="summary-card blue">
                    <div class="label">הכנסות חודשיות</div>
                    <div class="value positive">${formatCurrency(income)}</div>
                    <div class="sub">${transfersIn > 0 ? '+ העברות מעסק: ' + formatCurrency(transfersIn) : ''}</div>
                </div>
                <div class="summary-card red">
                    <div class="label">הוצאות החודש</div>
                    <div class="value negative">${formatCurrency(fixed + cards + variable + loansMonthly)}</div>
                    <div class="sub">קבועות: ${formatCurrency(fixed)} | כרטיסים: ${formatCurrency(cards)}${loansMonthly > 0 ? ' | הלוואות: ' + formatCurrency(loansMonthly) : ''}</div>
                </div>
                <div class="summary-card ${netMonthly >= 0 ? 'green' : 'red'}">
                    <div class="label">נטו חודשי</div>
                    <div class="value ${netMonthly >= 0 ? 'positive' : 'negative'}">${formatCurrency(netMonthly)}</div>
                    <div class="sub">הכנסות: ${formatCurrency(income)}${transfersIn > 0 ? ' + העברות: ' + formatCurrency(transfersIn) : ''}</div>
                </div>
            </div>`;
    },

    _renderBizSummary(data, received, expected, fixed, cards, variable, salaries, transfersOut, loansMonthly, netMonthly, available, creditFramework) {
        return `
            <div class="summary-grid">
                <div class="summary-card blue">
                    <div class="label">יתרת בנק</div>
                    <div class="value ${data.business.balance >= 0 ? 'positive' : 'negative'}">${formatCurrency(data.business.balance)}</div>
                    <div class="sub">${creditFramework.business > 0 ? 'זמין: ' + formatCurrency(available) : ''}</div>
                </div>
                <div class="summary-card green">
                    <div class="label">הכנסות שהתקבלו</div>
                    <div class="value positive">${formatCurrency(received)}</div>
                    <div class="sub">צפוי: ${formatCurrency(expected)}</div>
                </div>
                <div class="summary-card red">
                    <div class="label">הוצאות החודש</div>
                    <div class="value negative">${formatCurrency(fixed + cards + variable + salaries + loansMonthly)}</div>
                    <div class="sub">קבועות: ${formatCurrency(fixed)} | שכר: ${formatCurrency(salaries)}${loansMonthly > 0 ? ' | הלוואות: ' + formatCurrency(loansMonthly) : ''}</div>
                </div>
                <div class="summary-card ${netMonthly >= 0 ? 'green' : 'red'}">
                    <div class="label">נטו חודשי</div>
                    <div class="value ${netMonthly >= 0 ? 'positive' : 'negative'}">${formatCurrency(netMonthly)}</div>
                    <div class="sub">העברות לבית: ${formatCurrency(transfersOut)}</div>
                </div>
            </div>`;
    },

    setAccount(account) {
        this.activeAccount = account;
        App.renderPage('dashboard');
    },

    afterRender() {
        this.renderForecastChart();
        this.renderExpenseBreakdownChart();
    },

    renderForecastChart() {
        const canvas = document.getElementById('forecast-chart');
        if (!canvas) return;
        if (this.charts.forecast) this.charts.forecast.destroy();

        const forecast = getForecastData(6);
        const isHome = this.activeAccount === 'home';

        this.charts.forecast = new Chart(canvas, {
            type: 'line',
            data: {
                labels: forecast.map(f => f.label),
                datasets: [
                    {
                        label: isHome ? 'הכנסות בית' : 'הכנסות עסק',
                        data: forecast.map(f => isHome ? f.homeIncome : f.bizIncome),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16,185,129,0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: isHome ? 'הוצאות בית' : 'הוצאות עסק',
                        data: forecast.map(f => isHome ? f.homeExpenses : f.bizExpenses),
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239,68,68,0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'נטו',
                        data: forecast.map(f => isHome ? f.homeNet : f.bizNet),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59,130,246,0.05)',
                        fill: false,
                        tension: 0.4,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#8b95a8', font: { family: 'Rubik' } } }
                },
                scales: {
                    x: { ticks: { color: '#5a6478' }, grid: { color: 'rgba(42,53,80,0.5)' } },
                    y: { ticks: { color: '#5a6478', callback: v => formatCurrency(v) }, grid: { color: 'rgba(42,53,80,0.5)' } }
                }
            }
        });
    },

    renderExpenseBreakdownChart() {
        const canvas = document.getElementById('expense-breakdown-chart');
        if (!canvas) return;
        if (this.charts.expenseBreakdown) this.charts.expenseBreakdown.destroy();

        const data = Store.get();
        const isHome = this.activeAccount === 'home';

        let labels, values, colors;

        const n = new Date();
        const cm = n.getMonth();
        const cy = n.getFullYear();

        if (isHome) {
            const fixed = getMonthlyFixedTotal(data.home.fixedExpenses);
            const cards = getTotalCardChargesForMonth('home', cy, cm);
            const variable = sumBy(data.home.variableExpenses.filter(e => {
                const d = new Date(e.date);
                return d.getMonth() === cm && d.getFullYear() === cy;
            }), 'amount');
            const loans = (data.loans || []).filter(l => l.active && l.account === 'home' && (l.totalInstallments - l.installmentsPaid) > 0)
                .filter(l => !l.startDate || new Date(l.startDate) <= new Date(cy, cm + 1, 0))
                .reduce((s, l) => s + l.monthlyPayment, 0);
            labels = ['הוצאות קבועות', 'כרטיסי אשראי', 'הוצאות משתנות', 'הלוואות'];
            values = [fixed, cards, variable, loans];
            colors = ['#ef4444', '#a855f7', '#f59e0b', '#6366f1'];
        } else {
            const fixed = getMonthlyFixedTotal(data.business.fixedExpenses);
            const cards = getTotalCardChargesForMonth('business', cy, cm);
            const salaries = getTotalSalaryCost();
            const variable = sumBy(data.business.variableExpenses.filter(e => {
                const d = new Date(e.date);
                return d.getMonth() === cm && d.getFullYear() === cy;
            }), 'amount');
            const transfers = sumBy(data.business.transfers.filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === cm && d.getFullYear() === cy;
            }), 'amount');
            const loans = (data.loans || []).filter(l => l.active && l.account === 'business' && (l.totalInstallments - l.installmentsPaid) > 0)
                .filter(l => !l.startDate || new Date(l.startDate) <= new Date(cy, cm + 1, 0))
                .reduce((s, l) => s + l.monthlyPayment, 0);
            labels = ['הוצאות קבועות', 'כרטיסי אשראי', 'שכר צוות', 'הוצאות משתנות', 'העברות לבית', 'הלוואות'];
            values = [fixed, cards, salaries, variable, transfers, loans];
            colors = ['#ef4444', '#a855f7', '#3b82f6', '#f59e0b', '#8b5cf6', '#6366f1'];
        }

        this.charts.expenseBreakdown = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#8b95a8', font: { family: 'Rubik', size: 12 }, padding: 16 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return ctx.label + ': ' + formatCurrency(ctx.raw);
                            }
                        }
                    }
                }
            }
        });
    }
};
