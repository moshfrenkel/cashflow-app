// ===== Reports Module =====
const Reports = {
    charts: {},
    selectedMonth: new Date().getMonth(),
    selectedYear: new Date().getFullYear(),
    selectedAccount: 'home',

    render() {
        const data = Store.get();
        const months = Array.from({length: 12}, (_, i) => getMonthName(i));

        return `
            <div class="tabs">
                <div class="tab active" onclick="Reports.showTab('monthly')">דוח חודשי</div>
                <div class="tab" onclick="Reports.showTab('yearly')">סיכום שנתי</div>
            </div>

            <div class="tab-content active" id="tab-monthly">
                <div class="card" style="margin-bottom:16px;">
                    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                        <select id="report-account" onchange="Reports.selectedAccount=this.value;Reports.refreshMonthly()" style="width:auto;">
                            <option value="home" ${this.selectedAccount==='home'?'selected':''}>🏠 בית</option>
                            <option value="business" ${this.selectedAccount==='business'?'selected':''}>💼 עסק</option>
                        </select>
                        <select id="report-month" onchange="Reports.selectedMonth=+this.value;Reports.refreshMonthly()" style="width:auto;">
                            ${months.map((m, i) => `<option value="${i}" ${i===this.selectedMonth?'selected':''}>${m}</option>`).join('')}
                        </select>
                        <select id="report-year" onchange="Reports.selectedYear=+this.value;Reports.refreshMonthly()" style="width:auto;">
                            ${[2023,2024,2025,2026].map(y => `<option value="${y}" ${y===this.selectedYear?'selected':''}>${y}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div id="monthly-report-content">${this.renderMonthlyReport(data)}</div>
            </div>

            <div class="tab-content" id="tab-yearly">
                ${this.renderYearlyReport(data)}
            </div>
        `;
    },

    showTab(tab) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
        event.target.classList.add('active');
        if (tab === 'yearly') this.renderYearlyChart();
    },

    refreshMonthly() {
        const data = Store.get();
        document.getElementById('monthly-report-content').innerHTML = this.renderMonthlyReport(data);
        this.renderMonthlyChart();
    },

    renderMonthlyReport(data) {
        const acc = this.selectedAccount;
        const m = this.selectedMonth;
        const y = this.selectedYear;
        const accData = data[acc];

        // Incomes
        let incomes = [];
        if (acc === 'home') {
            incomes = accData.incomes.filter(i => i.type === 'monthly' || (new Date(i.date).getMonth() === m && new Date(i.date).getFullYear() === y));
        } else {
            incomes = accData.incomes.filter(i => {
                const d = new Date(i.expectedDate);
                return d.getMonth() === m && d.getFullYear() === y && i.status === 'received';
            });
        }

        // Fixed expenses
        const fixedTotal = getMonthlyFixedTotal(accData.fixedExpenses);

        // Variable expenses this month
        const varExpenses = accData.variableExpenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === m && d.getFullYear() === y;
        });

        // Group by category
        const catTotals = {};
        varExpenses.forEach(e => {
            if (!catTotals[e.category]) catTotals[e.category] = 0;
            catTotals[e.category] += e.amount;
        });

        const totalIncome = acc === 'home' ? sumBy(incomes, 'amount') : sumBy(incomes, 'amount');
        const totalVar = sumBy(varExpenses, 'amount');
        const cardCharges = data.creditCards.filter(c => c.account === acc).reduce((s,c) => s + getMonthlyCardCharges(c), 0);
        const salaryTotal = acc === 'business' ? getTotalSalaryCost() : 0;
        const totalExpenses = fixedTotal + totalVar + cardCharges + salaryTotal;
        const net = totalIncome - totalExpenses;

        return `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header"><h3>סיכום ${getMonthName(m)} ${y}</h3></div>
                    <div style="font-size:0.9rem;line-height:2;">
                        <div style="display:flex;justify-content:space-between;"><span>סה"כ הכנסות</span><span class="amount-positive">${formatCurrency(totalIncome)}</span></div>
                        <div style="display:flex;justify-content:space-between;"><span>הוצאות קבועות</span><span class="amount-negative">${formatCurrency(fixedTotal)}</span></div>
                        <div style="display:flex;justify-content:space-between;"><span>הוצאות משתנות</span><span class="amount-negative">${formatCurrency(totalVar)}</span></div>
                        <div style="display:flex;justify-content:space-between;"><span>כרטיסי אשראי</span><span class="amount-negative">${formatCurrency(cardCharges)}</span></div>
                        ${acc === 'business' ? `<div style="display:flex;justify-content:space-between;"><span>משכורות</span><span class="amount-negative">${formatCurrency(salaryTotal)}</span></div>` : ''}
                        <hr style="border-color:var(--border-color);margin:8px 0;">
                        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.1rem;">
                            <span>נטו</span><span class="${net >= 0 ? 'amount-positive' : 'amount-negative'}">${formatCurrency(net)}</span>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>התפלגות הוצאות</h3></div>
                    <div class="chart-container" style="height:250px;">
                        <canvas id="monthly-chart"></canvas>
                    </div>
                </div>
            </div>

            ${Object.keys(catTotals).length > 0 ? `
                <div class="card" style="margin-top:16px;">
                    <div class="card-header"><h3>פירוט הוצאות משתנות לפי קטגוריה</h3></div>
                    <div class="table-wrapper"><table>
                        <thead><tr><th>קטגוריה</th><th>סכום</th><th>אחוז מסה"כ</th></tr></thead>
                        <tbody>${Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([cat, total]) => `
                            <tr>
                                <td><span class="category-tag">${cat}</span></td>
                                <td class="amount-negative">${formatCurrency(total)}</td>
                                <td>${totalVar > 0 ? Math.round((total/totalVar)*100) : 0}%</td>
                            </tr>
                        `).join('')}</tbody>
                    </table></div>
                </div>
            ` : ''}
        `;
    },

    renderYearlyReport(data) {
        const y = this.selectedYear;
        const months = Array.from({length: 12}, (_, i) => getMonthName(i));

        // Calculate per-month data for home
        const homeMonthly = months.map((_, m) => {
            const income = sumBy(data.home.incomes.filter(i => i.type === 'monthly'), 'amount');
            const fixed = getMonthlyFixedTotal(data.home.fixedExpenses);
            return { income, expenses: fixed, net: income - fixed };
        });

        return `
            <div class="card">
                <div class="card-header"><h3>📊 סיכום שנתי ${y} - בית</h3></div>
                <div class="chart-container" style="height:300px;margin-bottom:16px;">
                    <canvas id="yearly-chart"></canvas>
                </div>
                <div class="table-wrapper"><table>
                    <thead><tr><th></th>${months.map(m => `<th style="font-size:0.7rem;">${m}</th>`).join('')}<th>סה"כ</th></tr></thead>
                    <tbody>
                        <tr>
                            <td><strong>הכנסות</strong></td>
                            ${homeMonthly.map(d => `<td class="amount-positive" style="font-size:0.75rem;">${formatCurrency(d.income)}</td>`).join('')}
                            <td class="amount-positive"><strong>${formatCurrency(homeMonthly.reduce((s,d)=>s+d.income,0))}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>הוצאות</strong></td>
                            ${homeMonthly.map(d => `<td class="amount-negative" style="font-size:0.75rem;">${formatCurrency(d.expenses)}</td>`).join('')}
                            <td class="amount-negative"><strong>${formatCurrency(homeMonthly.reduce((s,d)=>s+d.expenses,0))}</strong></td>
                        </tr>
                        <tr style="background:var(--bg-input);">
                            <td><strong>נטו</strong></td>
                            ${homeMonthly.map(d => `<td class="${d.net>=0?'amount-positive':'amount-negative'}" style="font-size:0.75rem;font-weight:600;">${formatCurrency(d.net)}</td>`).join('')}
                            <td class="${homeMonthly.reduce((s,d)=>s+d.net,0)>=0?'amount-positive':'amount-negative'}"><strong>${formatCurrency(homeMonthly.reduce((s,d)=>s+d.net,0))}</strong></td>
                        </tr>
                    </tbody>
                </table></div>
            </div>
        `;
    },

    afterRender() {
        this.renderMonthlyChart();
    },

    renderMonthlyChart() {
        const canvas = document.getElementById('monthly-chart');
        if (!canvas) return;
        if (this.charts.monthly) this.charts.monthly.destroy();

        const data = Store.get();
        const acc = this.selectedAccount;
        const fixedTotal = getMonthlyFixedTotal(data[acc].fixedExpenses);
        const cardCharges = data.creditCards.filter(c => c.account === acc).reduce((s,c) => s + getMonthlyCardCharges(c), 0);
        const salaryTotal = acc === 'business' ? getTotalSalaryCost() : 0;

        const labels = ['קבועות', 'אשראי'];
        const values = [fixedTotal, cardCharges];
        const colors = ['#ef4444', '#f59e0b'];
        if (acc === 'business') {
            labels.push('משכורות');
            values.push(salaryTotal);
            colors.push('#8b5cf6');
        }

        this.charts.monthly = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#8b95a8', font: { family: 'Rubik' }, padding: 12 } }
                }
            }
        });
    },

    renderYearlyChart() {
        const canvas = document.getElementById('yearly-chart');
        if (!canvas) return;
        if (this.charts.yearly) this.charts.yearly.destroy();

        const data = Store.get();
        const months = Array.from({length: 12}, (_, i) => getMonthName(i));
        const income = sumBy(data.home.incomes.filter(i => i.type === 'monthly'), 'amount');
        const expenses = getMonthlyFixedTotal(data.home.fixedExpenses);

        this.charts.yearly = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    { label: 'הכנסות', data: months.map(() => income), backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4 },
                    { label: 'הוצאות', data: months.map(() => expenses), backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#8b95a8', font: { family: 'Rubik' } } } },
                scales: {
                    x: { ticks: { color: '#5a6478' }, grid: { display: false } },
                    y: { ticks: { color: '#5a6478', callback: v => formatCurrency(v) }, grid: { color: 'rgba(42,53,80,0.3)' } }
                }
            }
        });
    }
};
