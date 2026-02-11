// ===== Loans Module =====
const Loans = {
    filterAccount: 'all', // 'all', 'home', 'business'

    render() {
        const data = Store.get();
        const loans = data.loans || [];
        const activeLoans = loans.filter(l => l.active);
        const homeLoans = activeLoans.filter(l => l.account === 'home');
        const bizLoans = activeLoans.filter(l => l.account === 'business');

        const totalDebt = activeLoans.reduce((s, l) => s + this._remainingBalance(l), 0);
        const totalMonthlyHome = homeLoans.reduce((s, l) => s + l.monthlyPayment, 0);
        const totalMonthlyBiz = bizLoans.reduce((s, l) => s + l.monthlyPayment, 0);
        const totalMonthly = totalMonthlyHome + totalMonthlyBiz;

        const filtered = this.filterAccount === 'all' ? loans :
            loans.filter(l => l.account === this.filterAccount);

        return `
            <div class="summary-grid">
                <div class="summary-card red">
                    <div class="label">🏦 סה"כ חוב פעיל</div>
                    <div class="value negative">${formatCurrency(totalDebt)}</div>
                </div>
                <div class="summary-card yellow">
                    <div class="label">💸 תשלום חודשי כולל</div>
                    <div class="value negative">${formatCurrency(totalMonthly)}</div>
                </div>
                <div class="summary-card green">
                    <div class="label">🏠 חודשי בית</div>
                    <div class="value negative">${formatCurrency(totalMonthlyHome)}</div>
                </div>
                <div class="summary-card blue">
                    <div class="label">💼 חודשי עסק</div>
                    <div class="value negative">${formatCurrency(totalMonthlyBiz)}</div>
                </div>
            </div>

            <div class="section-header">
                <h2>הלוואות</h2>
                <div style="display:flex;gap:8px;align-items:center;">
                    <select class="btn btn-ghost" onchange="Loans.setFilter(this.value)" style="padding:6px 12px;border-radius:8px;background:var(--card-bg);color:var(--text-primary);border:1px solid var(--border-color);">
                        <option value="all" ${this.filterAccount === 'all' ? 'selected' : ''}>הכל</option>
                        <option value="home" ${this.filterAccount === 'home' ? 'selected' : ''}>בית</option>
                        <option value="business" ${this.filterAccount === 'business' ? 'selected' : ''}>עסק</option>
                    </select>
                    <button class="btn btn-primary" onclick="Loans.openAdd()">+ הלוואה חדשה</button>
                </div>
            </div>

            ${filtered.length === 0 ?
                '<div class="empty-state"><div class="icon">🏦</div><p>אין הלוואות מוגדרות</p><button class="btn btn-primary" onclick="Loans.openAdd()">הוסף הלוואה</button></div>' :
                `<div class="card"><div class="table-wrapper"><table>
                    <thead><tr>
                        <th>שם</th>
                        <th>מלווה</th>
                        <th>חשבון</th>
                        <th>יתרה לתשלום</th>
                        <th>תשלום חודשי</th>
                        <th>תשלומים</th>
                        <th>יום חיוב</th>
                        <th>התקדמות</th>
                        <th>פעולות</th>
                    </tr></thead>
                    <tbody>${filtered.map(loan => {
                        const remaining = loan.totalInstallments - loan.installmentsPaid;
                        const pct = loan.totalInstallments > 0 ? Math.round((loan.installmentsPaid / loan.totalInstallments) * 100) : 0;
                        const balance = this._remainingBalance(loan);
                        const color = pct >= 75 ? 'green' : pct >= 40 ? 'yellow' : 'red';
                        return `
                            <tr style="${!loan.active ? 'opacity:0.4' : ''}">
                                <td><strong>${loan.name}</strong></td>
                                <td>${loan.lender}</td>
                                <td><span class="badge badge-${loan.account === 'home' ? 'green' : 'blue'}">${loan.account === 'home' ? 'בית' : 'עסק'}</span></td>
                                <td class="amount-negative">${formatCurrency(balance)}</td>
                                <td class="amount-negative">${formatCurrency(loan.monthlyPayment)}</td>
                                <td>
                                    ${remaining <= 0 ?
                                        '<span class="badge badge-green">הסתיים</span>' :
                                        `<span class="badge badge-yellow">${loan.installmentsPaid}/${loan.totalInstallments}</span>`
                                    }
                                </td>
                                <td>${loan.chargeDate} לחודש</td>
                                <td style="min-width:120px;">
                                    <div class="progress-bar"><div class="fill ${color}" style="width:${pct}%"></div></div>
                                    <div style="text-align:center;font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${pct}%</div>
                                </td>
                                <td>
                                    <div style="display:flex;gap:4px;">
                                        ${loan.active && remaining > 0 ? `<button class="btn btn-sm btn-ghost" onclick="Loans.payInstallment('${loan.id}')" title="סמן תשלום">✓</button>` : ''}
                                        <button class="btn-icon" onclick="Loans.openEdit('${loan.id}')" title="עריכה">✏️</button>
                                        <button class="btn-icon" onclick="Loans.toggleActive('${loan.id}')" title="${loan.active ? 'השהה' : 'הפעל'}">${loan.active ? '⏸️' : '▶️'}</button>
                                        <button class="btn-icon danger" onclick="Loans.deleteLoan('${loan.id}')" title="מחיקה">🗑️</button>
                                    </div>
                                </td>
                            </tr>`;
                    }).join('')}</tbody>
                    <tfoot><tr>
                        <td colspan="3"><strong>סה"כ</strong></td>
                        <td class="amount-negative"><strong>${formatCurrency(filtered.filter(l => l.active).reduce((s, l) => s + this._remainingBalance(l), 0))}</strong></td>
                        <td class="amount-negative"><strong>${formatCurrency(filtered.filter(l => l.active).reduce((s, l) => s + l.monthlyPayment, 0))}</strong></td>
                        <td colspan="4"></td>
                    </tr></tfoot>
                </table></div></div>`
            }

            ${activeLoans.length > 0 ? `
                <div class="card" style="margin-top:20px;">
                    <div class="card-header"><h3>📊 סיכום הלוואות</h3></div>
                    <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.8;">
                        <p>🏦 סה"כ סכום מקורי: <strong>${formatCurrency(activeLoans.reduce((s, l) => s + l.originalAmount, 0))}</strong></p>
                        <p>💰 סה"כ שולם עד כה: <strong>${formatCurrency(activeLoans.reduce((s, l) => s + (l.installmentsPaid * l.monthlyPayment), 0))}</strong></p>
                        <p>📉 סה"כ נותר לתשלום: <strong class="amount-negative">${formatCurrency(totalDebt)}</strong></p>
                        <p>📅 ריבית ממוצעת: <strong>${activeLoans.length > 0 ? (activeLoans.reduce((s, l) => s + l.interestRate, 0) / activeLoans.length).toFixed(2) : 0}%</strong></p>
                    </div>
                </div>
            ` : ''}
        `;
    },

    // --- Helper ---
    _remainingBalance(loan) {
        const remaining = loan.totalInstallments - loan.installmentsPaid;
        return Math.max(0, remaining * loan.monthlyPayment);
    },

    // --- Filter ---
    setFilter(account) {
        this.filterAccount = account;
        App.renderPage('loans');
    },

    // --- CRUD ---
    openAdd() {
        openModal('הלוואה חדשה', `
            <div class="form-group"><label>שם ההלוואה</label><input type="text" id="loan-name" placeholder="לדוגמה: הלוואה ב.לאומי 21"></div>
            <div class="form-row">
                <div class="form-group"><label>חשבון</label><select id="loan-account"><option value="home">בית</option><option value="business">עסק</option></select></div>
                <div class="form-group"><label>מלווה / בנק</label><input type="text" id="loan-lender" placeholder="לדוגמה: בנק לאומי"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>סכום מקורי</label><input type="number" id="loan-original" placeholder="0"></div>
                <div class="form-group"><label>תשלום חודשי</label><input type="number" id="loan-monthly" placeholder="0"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>ריבית שנתית %</label><input type="number" id="loan-interest" step="0.01" value="0" placeholder="0"></div>
                <div class="form-group"><label>סה"כ תשלומים</label><input type="number" id="loan-total-inst" placeholder="0" min="1"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>תשלומים ששולמו</label><input type="number" id="loan-paid-inst" value="0" min="0"></div>
                <div class="form-group"><label>יום חיוב בחודש</label><input type="number" id="loan-charge-date" min="1" max="31" value="1"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>תאריך תחילה</label><input type="date" id="loan-start" value="${new Date().toISOString().slice(0,10)}"></div>
            </div>
            <div class="form-group"><label>הערות</label><input type="text" id="loan-notes" placeholder="הערות (אופציונלי)"></div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="Loans.saveLoan()">שמור</button>
                <button class="btn btn-ghost" onclick="closeModal()">ביטול</button>
            </div>
        `);
    },

    saveLoan(editId) {
        const name = document.getElementById('loan-name').value.trim();
        const account = document.getElementById('loan-account').value;
        const lender = document.getElementById('loan-lender').value.trim();
        const originalAmount = parseFloat(document.getElementById('loan-original').value) || 0;
        const monthlyPayment = parseFloat(document.getElementById('loan-monthly').value) || 0;
        const interestRate = parseFloat(document.getElementById('loan-interest').value) || 0;
        const totalInstallments = parseInt(document.getElementById('loan-total-inst').value) || 0;
        const installmentsPaid = parseInt(document.getElementById('loan-paid-inst').value) || 0;
        const chargeDate = parseInt(document.getElementById('loan-charge-date').value) || 1;
        const startDate = document.getElementById('loan-start').value;
        const notes = document.getElementById('loan-notes').value.trim();

        if (!name || !monthlyPayment || !totalInstallments) {
            showToast('נא למלא שם, תשלום חודשי ומספר תשלומים', 'error');
            return;
        }

        Store.update(data => {
            if (!data.loans) data.loans = [];
            if (editId) {
                const loan = data.loans.find(l => l.id === editId);
                if (loan) {
                    Object.assign(loan, { name, account, lender, originalAmount, monthlyPayment, interestRate, totalInstallments, installmentsPaid, chargeDate, startDate, notes });
                }
            } else {
                data.loans.push({
                    id: Store.genId(),
                    name,
                    account,
                    lender,
                    originalAmount,
                    monthlyPayment,
                    interestRate,
                    totalInstallments,
                    installmentsPaid,
                    chargeDate,
                    startDate,
                    notes,
                    active: true
                });
            }
        });
        closeModal();
        showToast(editId ? 'הלוואה עודכנה' : 'הלוואה נוספה', 'success');
    },

    openEdit(id) {
        const data = Store.get();
        const loan = (data.loans || []).find(l => l.id === id);
        if (!loan) return;

        openModal('עריכת הלוואה', `
            <div class="form-group"><label>שם ההלוואה</label><input type="text" id="loan-name" value="${loan.name}"></div>
            <div class="form-row">
                <div class="form-group"><label>חשבון</label><select id="loan-account"><option value="home" ${loan.account === 'home' ? 'selected' : ''}>בית</option><option value="business" ${loan.account === 'business' ? 'selected' : ''}>עסק</option></select></div>
                <div class="form-group"><label>מלווה / בנק</label><input type="text" id="loan-lender" value="${loan.lender}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>סכום מקורי</label><input type="number" id="loan-original" value="${loan.originalAmount}"></div>
                <div class="form-group"><label>תשלום חודשי</label><input type="number" id="loan-monthly" value="${loan.monthlyPayment}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>ריבית שנתית %</label><input type="number" id="loan-interest" step="0.01" value="${loan.interestRate}"></div>
                <div class="form-group"><label>סה"כ תשלומים</label><input type="number" id="loan-total-inst" value="${loan.totalInstallments}" min="1"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>תשלומים ששולמו</label><input type="number" id="loan-paid-inst" value="${loan.installmentsPaid}" min="0"></div>
                <div class="form-group"><label>יום חיוב בחודש</label><input type="number" id="loan-charge-date" min="1" max="31" value="${loan.chargeDate}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>תאריך תחילה</label><input type="date" id="loan-start" value="${loan.startDate}"></div>
            </div>
            <div class="form-group"><label>הערות</label><input type="text" id="loan-notes" value="${loan.notes || ''}"></div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="Loans.saveLoan('${id}')">עדכן</button>
                <button class="btn btn-ghost" onclick="closeModal()">ביטול</button>
            </div>
        `);
    },

    payInstallment(id) {
        Store.update(data => {
            if (!data.loans) return;
            const loan = data.loans.find(l => l.id === id);
            if (loan && loan.installmentsPaid < loan.totalInstallments) {
                loan.installmentsPaid++;
            }
        });
        showToast('תשלום סומן', 'success');
    },

    toggleActive(id) {
        Store.update(data => {
            if (!data.loans) return;
            const loan = data.loans.find(l => l.id === id);
            if (loan) loan.active = !loan.active;
        });
    },

    deleteLoan(id) {
        if (!confirmAction('למחוק הלוואה זו?')) return;
        Store.update(data => {
            if (!data.loans) return;
            data.loans = data.loans.filter(l => l.id !== id);
        });
        showToast('הלוואה נמחקה', 'info');
    },

    afterRender() {}
};
