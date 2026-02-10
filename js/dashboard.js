// ===== Dashboard Module =====
const Dashboard = {
    charts: {},

    render() {
        const data = Store.get();
        const homeIncome = sumBy(data.home.incomes.filter(i => i.type === 'monthly'), 'amount');
        const homeFixed = getMonthlyFixedTotal(data.home.fixedExpenses);
        const homeCards = getTotalCardCharges('home');
        const bizIncome = sumBy(data.business.incomes.filter(i => i.status === 'received'), 'amount');
        const bizFixed = getMonthlyFixedTotal(data.business.fixedExpenses);
        const bizCards = getTotalCardCharges('business');
        const salaryTotal = getTotalSalaryCost();
        const totalExpHome = homeFixed + homeCards;
        const totalExpBiz = bizFixed + bizCards + salaryTotal;
        const alerts = getAlerts();

        return `
            <div class="summary-grid">
                <div class="summary-card green">
                    <div class="label">יתרת בית</div>
                    <div class="value ${data.home.balance >= 0 ? 'positive' : 'negative'}">${formatCurrency(data.home.balance)}</div>
                    <div class="sub">הכנסה חודשית: ${formatCurrency(homeIncome)}</div>
                </div>
                <div class="summary-card blue">
                    <div class="label">יתרת עסק</div>
                    <div class="value ${data.business.balance >= 0 ? 'positive' : 'negative'}">${formatCurrency(data.business.balance)}</div>
                    <div class="sub">הכנסות החודש: ${formatCurrency(bizIncome)}</div>
                </div>
                <div class="summary-card purple">
                    <div class="label">סה"כ משולב</div>
                    <div class="value ${(data.home.balance + data.business.balance) >= 0 ? 'positive' : 'negative'}">${formatCurrency(data.home.balance + data.business.balance)}</div>
                    <div class="sub">שני חשבונות</div>
                </div>
                <div class="summary-card red">
                    <div class="label">הוצאות קבועות החודש</div>
                    <div class="value negative">${formatCurrency(totalExpHome + totalExpBiz)}</div>
                    <div class="sub">בית: ${formatCurrency(totalExpHome)} | עסק: ${formatCurrency(totalExpBiz)}</div>
                </div>
            </div>

            <div class="grid-2">
                <div class="card">
                    <div class="card-header">
                        <h3>📈 תחזית תזרים - 6 חודשים</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="forecast-chart"></canvas>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3>📊 הכנסות מול הוצאות - החודש</h3>
                    </div>
                    <div class="chart-container">
                        <canvas id="income-expense-chart"></canvas>
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
                        <h3>💳 כרטיסי אשראי - סיכום</h3>
                    </div>
                    ${data.creditCards.length === 0 ? '<div class="empty-state"><p>אין כרטיסים מוגדרים</p></div>' :
                    data.creditCards.map(card => {
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

            <div class="grid-2">
                <div class="card">
                    <div class="card-header">
                        <h3>💰 הכנסות צפויות מלקוחות</h3>
                    </div>
                    ${data.business.incomes.filter(i => i.status === 'expected').length === 0 ?
                    '<div class="empty-state"><p>אין הכנסות צפויות</p></div>' :
                    `<div class="table-wrapper"><table>
                        <thead><tr><th>לקוח</th><th>סכום</th><th>תאריך צפוי</th><th>סטטוס</th></tr></thead>
                        <tbody>${data.business.incomes.filter(i => i.status === 'expected' || i.status === 'late').map(i => `
                            <tr><td>${i.clientName}</td><td class="amount-positive">${formatCurrency(i.amount)}</td><td>${formatDate(i.expectedDate)}</td><td>${statusBadge(i.status)}</td></tr>
                        `).join('')}</tbody>
                    </table></div>`}
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3>🎯 יעדי חיסכון</h3>
                    </div>
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
        `;
    },

    afterRender() {
        this.renderForecastChart();
        this.renderIncomeExpenseChart();
    },

    renderForecastChart() {
        const canvas = document.getElementById('forecast-chart');
        if (!canvas) return;
        if (this.charts.forecast) this.charts.forecast.destroy();

        const forecast = getForecastData(6);
        this.charts.forecast = new Chart(canvas, {
            type: 'line',
            data: {
                labels: forecast.map(f => f.label),
                datasets: [
                    {
                        label: 'נטו בית',
                        data: forecast.map(f => f.homeNet),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16,185,129,0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'נטו עסק',
                        data: forecast.map(f => f.bizNet),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59,130,246,0.1)',
                        fill: true,
                        tension: 0.4
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

    renderIncomeExpenseChart() {
        const canvas = document.getElementById('income-expense-chart');
        if (!canvas) return;
        if (this.charts.incomeExpense) this.charts.incomeExpense.destroy();

        const data = Store.get();
        const homeIncome = sumBy(data.home.incomes.filter(i => i.type === 'monthly'), 'amount');
        const homeExp = getMonthlyFixedTotal(data.home.fixedExpenses) + getTotalCardCharges('home');
        const bizIncome = sumBy(data.business.incomes.filter(i => i.status === 'received'), 'amount');
        const bizExp = getMonthlyFixedTotal(data.business.fixedExpenses) + getTotalCardCharges('business') + getTotalSalaryCost();

        this.charts.incomeExpense = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['בית', 'עסק'],
                datasets: [
                    { label: 'הכנסות', data: [homeIncome, bizIncome], backgroundColor: '#10b981', borderRadius: 6 },
                    { label: 'הוצאות', data: [homeExp, bizExp], backgroundColor: '#ef4444', borderRadius: 6 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#8b95a8', font: { family: 'Rubik' } } }
                },
                scales: {
                    x: { ticks: { color: '#5a6478' }, grid: { display: false } },
                    y: { ticks: { color: '#5a6478', callback: v => formatCurrency(v) }, grid: { color: 'rgba(42,53,80,0.5)' } }
                }
            }
        });
    }
};
