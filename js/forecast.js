// ===== Forecast & Planning Module =====
const Forecast = {
    charts: {},

    render() {
        const data = Store.get();
        const forecast = getForecastData(12);

        return `
            <div class="card" style="margin-bottom:20px;">
                <div class="card-header"><h3>📈 תחזית 12 חודשים</h3></div>
                <div class="chart-container" style="height:350px;">
                    <canvas id="forecast-12-chart"></canvas>
                </div>
            </div>

            <div class="grid-2">
                <div class="card">
                    <div class="card-header"><h3>📅 פירוט חודשי</h3></div>
                    <div class="table-wrapper"><table>
                        <thead><tr><th>חודש</th><th>הכנסות בית</th><th>הוצאות בית</th><th>נטו בית</th><th>הכנסות עסק</th><th>הוצאות עסק</th><th>נטו עסק</th></tr></thead>
                        <tbody>${forecast.map(f => `
                            <tr>
                                <td><strong>${f.label}</strong></td>
                                <td class="amount-positive">${formatCurrency(f.homeIncome)}</td>
                                <td class="amount-negative">${formatCurrency(f.homeExpenses)}</td>
                                <td class="${f.homeNet >= 0 ? 'amount-positive' : 'amount-negative'}">${formatCurrency(f.homeNet)}</td>
                                <td class="amount-positive">${formatCurrency(f.bizIncome)}</td>
                                <td class="amount-negative">${formatCurrency(f.bizExpenses)}</td>
                                <td class="${f.bizNet >= 0 ? 'amount-positive' : 'amount-negative'}">${formatCurrency(f.bizNet)}</td>
                            </tr>
                        `).join('')}</tbody>
                    </table></div>
                </div>

                <div class="card">
                    <div class="card-header"><h3>📊 התפלגות הוצאות יומית</h3></div>
                    <div class="chart-container">
                        <canvas id="daily-flow-chart"></canvas>
                    </div>
                    <div style="margin-top:16px;">
                        <div class="card-header"><h3>🧪 סימולציית "מה אם"</h3></div>
                        <div class="form-group">
                            <label>הוספת עובד (שכר ברוטו)</label>
                            <input type="number" id="sim-employee" placeholder="0" oninput="Forecast.updateSim()">
                        </div>
                        <div class="form-group">
                            <label>שינוי שכ"ד / משכנתה</label>
                            <input type="number" id="sim-rent" placeholder="0" oninput="Forecast.updateSim()">
                        </div>
                        <div class="form-group">
                            <label>הלוואה חדשה (החזר חודשי)</label>
                            <input type="number" id="sim-loan" placeholder="0" oninput="Forecast.updateSim()">
                        </div>
                        <div id="sim-result" style="margin-top:12px;padding:12px;border-radius:8px;background:var(--bg-input);"></div>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top:20px;">
                <div class="card-header">
                    <h3>🎯 יעדי חיסכון</h3>
                    <button class="btn btn-primary btn-sm" onclick="Forecast.openAddGoal()">+ יעד חדש</button>
                </div>
                ${data.savingGoals.length === 0 ?
                    '<div class="empty-state"><p>לא הוגדרו יעדי חיסכון</p></div>' :
                    data.savingGoals.map(g => {
                        const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                        const remaining = g.targetAmount - g.currentAmount;
                        const deadlineDate = new Date(g.deadline);
                        const monthsLeft = Math.max(1, Math.ceil((deadlineDate - new Date()) / (1000*60*60*24*30)));
                        const monthlyNeeded = remaining / monthsLeft;
                        return `
                            <div style="padding:16px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:12px;">
                                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                                    <strong>${g.name}</strong>
                                    <div>
                                        <button class="btn btn-sm btn-success" onclick="Forecast.addToGoal('${g.id}')">+ הפקדה</button>
                                        <button class="btn-icon btn-sm" onclick="Forecast.editGoal('${g.id}')">✏️</button>
                                        <button class="btn-icon btn-sm danger" onclick="Forecast.deleteGoal('${g.id}')">🗑️</button>
                                    </div>
                                </div>
                                <div class="progress-bar" style="height:12px;"><div class="fill blue" style="width:${pct}%"></div></div>
                                <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:0.8rem;color:var(--text-secondary);">
                                    <span>${formatCurrency(g.currentAmount)} / ${formatCurrency(g.targetAmount)} (${pct}%)</span>
                                    <span>נדרש: ${formatCurrency(monthlyNeeded)}/חודש</span>
                                    <span>יעד: ${formatDate(g.deadline)}</span>
                                </div>
                            </div>`;
                    }).join('')
                }
            </div>
        `;
    },

    afterRender() {
        this.renderForecast12Chart();
        this.renderDailyFlowChart();
        this.updateSim();
    },

    renderForecast12Chart() {
        const canvas = document.getElementById('forecast-12-chart');
        if (!canvas) return;
        if (this.charts.forecast12) this.charts.forecast12.destroy();

        const forecast = getForecastData(12);
        this.charts.forecast12 = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: forecast.map(f => f.label),
                datasets: [
                    { label: 'הכנסות בית', data: forecast.map(f => f.homeIncome), backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4 },
                    { label: 'הוצאות בית', data: forecast.map(f => -f.homeExpenses), backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 },
                    { label: 'הכנסות עסק', data: forecast.map(f => f.bizIncome), backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 4 },
                    { label: 'הוצאות עסק', data: forecast.map(f => -f.bizExpenses), backgroundColor: 'rgba(245,158,11,0.7)', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#8b95a8', font: { family: 'Rubik' } } } },
                scales: {
                    x: { ticks: { color: '#5a6478' }, grid: { display: false } },
                    y: { ticks: { color: '#5a6478', callback: v => formatCurrency(v) }, grid: { color: 'rgba(42,53,80,0.5)' } }
                }
            }
        });
    },

    renderDailyFlowChart() {
        const canvas = document.getElementById('daily-flow-chart');
        if (!canvas) return;
        if (this.charts.daily) this.charts.daily.destroy();

        const data = Store.get();
        const dailyOutflow = new Array(31).fill(0);

        // Fixed expenses by charge date
        [...data.home.fixedExpenses, ...data.business.fixedExpenses].filter(e => e.active).forEach(e => {
            const day = Math.min(30, (e.chargeDate || 1) - 1);
            dailyOutflow[day] += e.amount;
        });

        // Credit card billing dates
        data.creditCards.forEach(card => {
            const day = Math.min(30, (card.billingDate || 1) - 1);
            dailyOutflow[day] += getMonthlyCardCharges(card);
        });

        // Salary dates
        data.employees.filter(e => e.active).forEach(e => {
            const day = Math.min(30, (e.paymentDate || 1) - 1);
            dailyOutflow[day] += e.grossSalary + calcEmployerCost(e.grossSalary);
        });

        this.charts.daily = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: Array.from({length: 31}, (_, i) => i + 1),
                datasets: [{
                    label: 'הוצאות צפויות',
                    data: dailyOutflow,
                    backgroundColor: dailyOutflow.map(v => v > 5000 ? 'rgba(239,68,68,0.8)' : v > 1000 ? 'rgba(245,158,11,0.7)' : 'rgba(59,130,246,0.5)'),
                    borderRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#5a6478', font: { size: 9 } }, grid: { display: false } },
                    y: { ticks: { color: '#5a6478', callback: v => formatCurrency(v) }, grid: { color: 'rgba(42,53,80,0.3)' } }
                }
            }
        });
    },

    updateSim() {
        const empSalary = parseFloat(document.getElementById('sim-employee')?.value) || 0;
        const rentChange = parseFloat(document.getElementById('sim-rent')?.value) || 0;
        const loanPayment = parseFloat(document.getElementById('sim-loan')?.value) || 0;
        const resultDiv = document.getElementById('sim-result');
        if (!resultDiv) return;

        const totalAdded = empSalary + calcEmployerCost(empSalary) + rentChange + loanPayment;
        const data = Store.get();
        const currentHomeNet = sumBy(data.home.incomes.filter(i => i.type === 'monthly'), 'amount') - getMonthlyFixedTotal(data.home.fixedExpenses) - getTotalCardCharges('home');
        const newNet = currentHomeNet - totalAdded;

        resultDiv.innerHTML = `
            <div style="font-size:0.9rem;">
                <p>עלות חודשית נוספת: <strong class="amount-negative">${formatCurrency(totalAdded)}</strong></p>
                ${empSalary ? `<p style="font-size:0.8rem;color:var(--text-muted);">שכר: ${formatCurrency(empSalary)} + עלות מעסיק: ${formatCurrency(calcEmployerCost(empSalary))} = ${formatCurrency(empSalary + calcEmployerCost(empSalary))}</p>` : ''}
                <p style="margin-top:8px;">נטו חודשי חדש: <strong class="${newNet >= 0 ? 'amount-positive' : 'amount-negative'}">${formatCurrency(newNet)}</strong></p>
                <p style="font-size:0.8rem;color:var(--text-muted);">לעומת ${formatCurrency(currentHomeNet)} כיום</p>
            </div>
        `;
    },

    openAddGoal() {
        openModal('יעד חיסכון חדש', `
            <div class="form-group"><label>שם היעד</label><input type="text" id="goal-name"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום יעד</label><input type="number" id="goal-target"></div>
                <div class="form-group"><label>סכום נוכחי</label><input type="number" id="goal-current" value="0"></div>
            </div>
            <div class="form-group"><label>תאריך יעד</label><input type="date" id="goal-deadline"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="Forecast.saveGoal()">שמור</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    saveGoal(editId) {
        const name = document.getElementById('goal-name').value.trim();
        const targetAmount = parseFloat(document.getElementById('goal-target').value);
        const currentAmount = parseFloat(document.getElementById('goal-current').value) || 0;
        const deadline = document.getElementById('goal-deadline').value;
        if (!name || !targetAmount) { showToast('נא למלא שם וסכום יעד', 'error'); return; }
        Store.update(data => {
            if (editId) {
                const g = data.savingGoals.find(g => g.id === editId);
                if (g) Object.assign(g, { name, targetAmount, currentAmount, deadline });
            } else {
                data.savingGoals.push({ id: Store.genId(), name, targetAmount, currentAmount, deadline });
            }
        });
        closeModal(); showToast(editId ? 'יעד עודכן' : 'יעד נוסף', 'success');
    },

    editGoal(id) {
        const g = Store.get().savingGoals.find(g => g.id === id);
        if (!g) return;
        openModal('עריכת יעד', `
            <div class="form-group"><label>שם</label><input type="text" id="goal-name" value="${g.name}"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום יעד</label><input type="number" id="goal-target" value="${g.targetAmount}"></div>
                <div class="form-group"><label>סכום נוכחי</label><input type="number" id="goal-current" value="${g.currentAmount}"></div>
            </div>
            <div class="form-group"><label>תאריך יעד</label><input type="date" id="goal-deadline" value="${g.deadline}"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="Forecast.saveGoal('${id}')">עדכן</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    addToGoal(id) {
        openModal('הפקדה ליעד', `
            <div class="form-group"><label>סכום הפקדה</label><input type="number" id="deposit-amount"></div>
            <div class="modal-actions"><button class="btn btn-success" onclick="Forecast.saveDeposit('${id}')">הפקד</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    saveDeposit(id) {
        const amount = parseFloat(document.getElementById('deposit-amount').value);
        if (!amount) { showToast('נא למלא סכום', 'error'); return; }
        Store.update(data => {
            const g = data.savingGoals.find(g => g.id === id);
            if (g) g.currentAmount += amount;
        });
        closeModal(); showToast(`הופקד ${formatCurrency(amount)}`, 'success');
    },

    deleteGoal(id) {
        if (!confirmAction('למחוק יעד?')) return;
        Store.update(data => { data.savingGoals = data.savingGoals.filter(g => g.id !== id); });
    }
};
