// ===== Home Cashflow Module =====
const HomeCashflow = {
    activeTab: 'incomes',

    render() {
        const data = Store.get();
        const homeIncome = sumBy(data.home.incomes.filter(i => i.type === 'monthly'), 'amount');
        const homeFixed = getMonthlyFixedTotal(data.home.fixedExpenses);
        const homeCards = getTotalCardCharges('home');
        const homeVar = sumBy(data.home.variableExpenses.filter(e => {
            const d = new Date(e.date);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }), 'amount');

        return `
            <div class="summary-grid">
                <div class="summary-card green">
                    <div class="label">הכנסות חודשיות</div>
                    <div class="value positive">${formatCurrency(homeIncome)}</div>
                </div>
                <div class="summary-card red">
                    <div class="label">הוצאות קבועות</div>
                    <div class="value negative">${formatCurrency(homeFixed)}</div>
                </div>
                <div class="summary-card yellow">
                    <div class="label">כרטיסי אשראי</div>
                    <div class="value negative">${formatCurrency(homeCards)}</div>
                </div>
                <div class="summary-card blue">
                    <div class="label">נטו חודשי</div>
                    <div class="value ${(homeIncome - homeFixed - homeCards - homeVar) >= 0 ? 'positive' : 'negative'}">${formatCurrency(homeIncome - homeFixed - homeCards - homeVar)}</div>
                </div>
            </div>

            <div class="tabs">
                <div class="tab ${this.activeTab === 'incomes' ? 'active' : ''}" onclick="HomeCashflow.switchTab('incomes')">הכנסות</div>
                <div class="tab ${this.activeTab === 'fixed' ? 'active' : ''}" onclick="HomeCashflow.switchTab('fixed')">הוצאות קבועות</div>
                <div class="tab ${this.activeTab === 'variable' ? 'active' : ''}" onclick="HomeCashflow.switchTab('variable')">הוצאות משתנות</div>
            </div>

            <div class="tab-content ${this.activeTab === 'incomes' ? 'active' : ''}" id="tab-incomes">
                ${this.renderIncomes(data)}
            </div>
            <div class="tab-content ${this.activeTab === 'fixed' ? 'active' : ''}" id="tab-fixed">
                ${this.renderFixed(data)}
            </div>
            <div class="tab-content ${this.activeTab === 'variable' ? 'active' : ''}" id="tab-variable">
                ${this.renderVariable(data)}
            </div>
        `;
    },

    switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab-content#tab-${tab}`).classList.add('active');
        document.querySelector(`.tab[onclick*="${tab}"]`).classList.add('active');
    },

    renderIncomes(data) {
        return `
            <div class="section-header">
                <h2>הכנסות</h2>
                <button class="btn btn-primary" onclick="HomeCashflow.openAddIncome()">+ הוספת הכנסה</button>
            </div>
            ${data.home.incomes.length === 0 ?
                '<div class="empty-state"><div class="icon">💰</div><p>אין הכנסות מוגדרות</p><button class="btn btn-primary" onclick="HomeCashflow.openAddIncome()">הוסף הכנסה ראשונה</button></div>' :
                `<div class="card"><div class="table-wrapper"><table>
                    <thead><tr><th>שם</th><th>סכום</th><th>סוג</th><th>תאריך</th><th>פעולות</th></tr></thead>
                    <tbody>${data.home.incomes.map(i => `
                        <tr>
                            <td>${i.name}</td>
                            <td class="amount-positive">${formatCurrency(i.amount)}</td>
                            <td><span class="badge badge-${i.type === 'monthly' ? 'green' : 'blue'}">${i.type === 'monthly' ? 'חודשי' : 'חד-פעמי'}</span></td>
                            <td>${formatDate(i.date)}</td>
                            <td>
                                <button class="btn-icon" onclick="HomeCashflow.editIncome('${i.id}')" title="עריכה">✏️</button>
                                <button class="btn-icon danger" onclick="HomeCashflow.deleteIncome('${i.id}')" title="מחיקה">🗑️</button>
                            </td>
                        </tr>
                    `).join('')}</tbody>
                    <tfoot><tr><td><strong>סה"כ חודשי</strong></td><td class="amount-positive"><strong>${formatCurrency(sumBy(data.home.incomes.filter(i=>i.type==='monthly'),'amount'))}</strong></td><td colspan="3"></td></tr></tfoot>
                </table></div></div>`
            }
        `;
    },

    renderFixed(data) {
        const grouped = {};
        data.home.fixedExpenses.forEach(e => {
            if (!grouped[e.category]) grouped[e.category] = [];
            grouped[e.category].push(e);
        });

        return `
            <div class="section-header">
                <h2>הוצאות קבועות</h2>
                <button class="btn btn-primary" onclick="HomeCashflow.openAddFixed()">+ הוספת הוצאה</button>
            </div>
            ${data.home.fixedExpenses.length === 0 ?
                '<div class="empty-state"><div class="icon">📋</div><p>אין הוצאות קבועות</p><button class="btn btn-primary" onclick="HomeCashflow.openAddFixed()">הוסף הוצאה ראשונה</button></div>' :
                Object.entries(grouped).map(([cat, expenses]) => `
                    <div class="card" style="margin-bottom:12px;">
                        <div class="card-header">
                            <h3>${cat}</h3>
                            <span style="color:var(--red);font-weight:600;">${formatCurrency(expenses.filter(e=>e.active).reduce((s,e)=>s+e.amount,0))}</span>
                        </div>
                        <div class="table-wrapper"><table>
                            <thead><tr><th>שם</th><th>סכום</th><th>תדירות</th><th>יום בחודש</th><th>שיטת תשלום</th><th>תשלומים</th><th>סטטוס</th><th>פעולות</th></tr></thead>
                            <tbody>${expenses.map(e => {
                                const pmLabels = {bank:'הו"ק בבנק',check:'צ\'ק',credit:'הו"ק בכרטיס',cash:'מזומן',other:'אחר'};
                                const pmColors = {bank:'blue',check:'yellow',credit:'purple',cash:'green',other:'blue'};
                                const pm = e.paymentMethod || 'bank';
                                const ccName = pm === 'credit' && e.creditCardId ? (data.creditCards.find(c => c.id === e.creditCardId) || {}).name || '' : '';
                                const pmDisplay = ccName ? pmLabels[pm] + ' (' + ccName + ')' : (pmLabels[pm] || pm);
                                const installDisplay = e.totalPayments > 0 ? (e.paymentsMade || 0) + '/' + e.totalPayments + ' תשלומים' : 'קבוע';
                                return `
                                <tr style="${!e.active ? 'opacity:0.4' : ''}">
                                    <td>${e.name}</td>
                                    <td class="amount-negative">${formatCurrency(e.amount)}</td>
                                    <td>${freqLabel(e.frequency)}</td>
                                    <td>${e.chargeDate}</td>
                                    <td><span class="badge badge-${pmColors[pm] || 'blue'}">${pmDisplay}</span></td>
                                    <td><span class="badge badge-${e.totalPayments > 0 ? 'yellow' : 'blue'}">${installDisplay}</span></td>
                                    <td><span class="badge badge-${e.active ? 'green' : 'red'}">${e.active ? 'פעיל' : 'מושהה'}</span></td>
                                    <td>
                                        <button class="btn-icon" onclick="HomeCashflow.editFixed('${e.id}')" title="עריכה">✏️</button>
                                        <button class="btn-icon" onclick="HomeCashflow.toggleFixed('${e.id}')" title="${e.active ? 'השהה' : 'הפעל'}">${e.active ? '⏸️' : '▶️'}</button>
                                        <button class="btn-icon danger" onclick="HomeCashflow.deleteFixed('${e.id}')" title="מחיקה">🗑️</button>
                                    </td>
                                </tr>
                            `}).join('')}</tbody>
                        </table></div>
                    </div>
                `).join('')
            }
            <div class="card" style="margin-top:12px;text-align:center;padding:14px;">
                <strong>סה"כ הוצאות קבועות חודשיות: <span class="amount-negative">${formatCurrency(getMonthlyFixedTotal(data.home.fixedExpenses))}</span></strong>
            </div>
        `;
    },

    renderVariable(data) {
        const now = new Date();
        const thisMonth = data.home.variableExpenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        return `
            <div class="section-header">
                <h2>הוצאות משתנות - ${getMonthName(now.getMonth())} ${now.getFullYear()}</h2>
                <button class="btn btn-primary" onclick="HomeCashflow.openAddVariable()">+ הוספת הוצאה</button>
            </div>
            ${thisMonth.length === 0 ?
                '<div class="empty-state"><div class="icon">🧾</div><p>אין הוצאות משתנות החודש</p><button class="btn btn-primary" onclick="HomeCashflow.openAddVariable()">הוסף הוצאה</button></div>' :
                `<div class="card"><div class="table-wrapper"><table>
                    <thead><tr><th>שם</th><th>סכום</th><th>קטגוריה</th><th>תאריך</th><th>פעולות</th></tr></thead>
                    <tbody>${thisMonth.sort((a,b) => new Date(b.date) - new Date(a.date)).map(e => `
                        <tr>
                            <td>${e.name}</td>
                            <td class="amount-negative">${formatCurrency(e.amount)}</td>
                            <td><span class="category-tag">${e.category}</span></td>
                            <td>${formatDate(e.date)}</td>
                            <td>
                                <button class="btn-icon" onclick="HomeCashflow.editVariable('${e.id}')" title="עריכה">✏️</button>
                                <button class="btn-icon danger" onclick="HomeCashflow.deleteVariable('${e.id}')" title="מחיקה">🗑️</button>
                            </td>
                        </tr>
                    `).join('')}</tbody>
                    <tfoot><tr><td><strong>סה"כ</strong></td><td class="amount-negative"><strong>${formatCurrency(sumBy(thisMonth,'amount'))}</strong></td><td colspan="3"></td></tr></tfoot>
                </table></div></div>`
            }
        `;
    },

    // === CRUD Operations ===
    openAddIncome() {
        openModal('הוספת הכנסה', `
            <div class="form-group"><label>שם</label><input type="text" id="inc-name" placeholder="לדוגמה: משכורת"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום</label><input type="number" id="inc-amount" placeholder="0"></div>
                <div class="form-group"><label>סוג</label><select id="inc-type"><option value="monthly">חודשי קבוע</option><option value="one-time">חד-פעמי</option></select></div>
            </div>
            <div class="form-group"><label>תאריך</label><input type="date" id="inc-date" value="${new Date().toISOString().slice(0,10)}"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="HomeCashflow.saveIncome()">שמור</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    saveIncome(editId) {
        const name = document.getElementById('inc-name').value.trim();
        const amount = parseFloat(document.getElementById('inc-amount').value);
        const type = document.getElementById('inc-type').value;
        const date = document.getElementById('inc-date').value;
        if (!name || !amount) { showToast('נא למלא שם וסכום', 'error'); return; }

        Store.update(data => {
            if (editId) {
                const idx = data.home.incomes.findIndex(i => i.id === editId);
                if (idx >= 0) Object.assign(data.home.incomes[idx], { name, amount, type, date });
            } else {
                data.home.incomes.push({ id: Store.genId(), name, amount, type, date, category: 'הכנסה' });
            }
        });
        closeModal();
        showToast(editId ? 'הכנסה עודכנה' : 'הכנסה נוספה', 'success');
    },

    editIncome(id) {
        const data = Store.get();
        const item = data.home.incomes.find(i => i.id === id);
        if (!item) return;
        openModal('עריכת הכנסה', `
            <div class="form-group"><label>שם</label><input type="text" id="inc-name" value="${item.name}"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום</label><input type="number" id="inc-amount" value="${item.amount}"></div>
                <div class="form-group"><label>סוג</label><select id="inc-type"><option value="monthly" ${item.type==='monthly'?'selected':''}>חודשי קבוע</option><option value="one-time" ${item.type==='one-time'?'selected':''}>חד-פעמי</option></select></div>
            </div>
            <div class="form-group"><label>תאריך</label><input type="date" id="inc-date" value="${item.date}"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="HomeCashflow.saveIncome('${id}')">עדכן</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    deleteIncome(id) {
        if (!confirmAction('למחוק הכנסה זו?')) return;
        Store.update(data => { data.home.incomes = data.home.incomes.filter(i => i.id !== id); });
        showToast('הכנסה נמחקה', 'info');
    },

    _paymentMethodFields(selected, creditCardId) {
        const data = Store.get();
        const cards = data.creditCards.filter(c => c.account === 'home');
        const pm = selected || 'bank';
        return `
            <div class="form-row">
                <div class="form-group"><label>שיטת תשלום</label>
                    <select id="fix-pm" onchange="document.getElementById('fix-cc-row').style.display=this.value==='credit'?'block':'none'">
                        <option value="bank" ${pm==='bank'?'selected':''}>הו"ק בבנק</option>
                        <option value="check" ${pm==='check'?'selected':''}>צ'ק</option>
                        <option value="credit" ${pm==='credit'?'selected':''}>הו"ק בכרטיס אשראי</option>
                        <option value="cash" ${pm==='cash'?'selected':''}>מזומן</option>
                        <option value="other" ${pm==='other'?'selected':''}>אחר</option>
                    </select>
                </div>
                <div class="form-group"><label>יום חיוב בחודש</label><input type="number" id="fix-date" min="1" max="31" value="1"></div>
            </div>
            <div id="fix-cc-row" class="form-group" style="display:${pm==='credit'?'block':'none'}">
                <label>כרטיס אשראי</label>
                <select id="fix-cc">${cards.map(c=>`<option value="${c.id}" ${c.id===creditCardId?'selected':''}>${c.name}</option>`).join('')}${cards.length===0?'<option value="">אין כרטיסים</option>':''}</select>
            </div>
            <div class="form-row">
                <div class="form-group"><label>סה"כ תשלומים (0=קבוע)</label><input type="number" id="fix-total-payments" min="0" value="0"></div>
                <div class="form-group"><label>תשלומים ששולמו</label><input type="number" id="fix-payments-made" min="0" value="0"></div>
            </div>`;
    },

    openAddFixed() {
        const cats = Store.get().categories.home;
        openModal('הוספת הוצאה קבועה', `
            <div class="form-group"><label>שם</label><input type="text" id="fix-name" placeholder="לדוגמה: שכר דירה"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום</label><input type="number" id="fix-amount" placeholder="0"></div>
                <div class="form-group"><label>קטגוריה</label><select id="fix-category">${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
            </div>
            <div class="form-group"><label>תדירות</label><select id="fix-freq"><option value="monthly">חודשי</option><option value="bimonthly">דו-חודשי</option><option value="quarterly">רבעוני</option><option value="yearly">שנתי</option></select></div>
            ${this._paymentMethodFields()}
            <div class="modal-actions"><button class="btn btn-primary" onclick="HomeCashflow.saveFixed()">שמור</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    saveFixed(editId) {
        const name = document.getElementById('fix-name').value.trim();
        const amount = parseFloat(document.getElementById('fix-amount').value);
        const category = document.getElementById('fix-category').value;
        const frequency = document.getElementById('fix-freq').value;
        const chargeDate = parseInt(document.getElementById('fix-date').value) || 1;
        const paymentMethod = document.getElementById('fix-pm').value;
        const creditCardId = paymentMethod === 'credit' ? (document.getElementById('fix-cc')?.value || '') : '';
        const totalPayments = parseInt(document.getElementById('fix-total-payments').value) || 0;
        const paymentsMade = parseInt(document.getElementById('fix-payments-made').value) || 0;
        if (!name || !amount) { showToast('נא למלא שם וסכום', 'error'); return; }

        Store.update(data => {
            if (editId) {
                const idx = data.home.fixedExpenses.findIndex(e => e.id === editId);
                if (idx >= 0) Object.assign(data.home.fixedExpenses[idx], { name, amount, category, frequency, chargeDate, paymentMethod, creditCardId, totalPayments, paymentsMade });
            } else {
                data.home.fixedExpenses.push({ id: Store.genId(), name, amount, category, frequency, chargeDate, active: true, paymentMethod, creditCardId, totalPayments, paymentsMade });
            }
        });
        closeModal();
        showToast(editId ? 'הוצאה עודכנה' : 'הוצאה נוספה', 'success');
    },

    editFixed(id) {
        const data = Store.get();
        const item = data.home.fixedExpenses.find(e => e.id === id);
        if (!item) return;
        const cats = data.categories.home;
        const pmFields = this._paymentMethodFields(item.paymentMethod, item.creditCardId);
        openModal('עריכת הוצאה קבועה', `
            <div class="form-group"><label>שם</label><input type="text" id="fix-name" value="${item.name}"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום</label><input type="number" id="fix-amount" value="${item.amount}"></div>
                <div class="form-group"><label>קטגוריה</label><select id="fix-category">${cats.map(c=>`<option value="${c}" ${c===item.category?'selected':''}>${c}</option>`).join('')}</select></div>
            </div>
            <div class="form-group"><label>תדירות</label><select id="fix-freq"><option value="monthly" ${item.frequency==='monthly'?'selected':''}>חודשי</option><option value="bimonthly" ${item.frequency==='bimonthly'?'selected':''}>דו-חודשי</option><option value="quarterly" ${item.frequency==='quarterly'?'selected':''}>רבעוני</option><option value="yearly" ${item.frequency==='yearly'?'selected':''}>שנתי</option></select></div>
            ${pmFields}
            <div class="modal-actions"><button class="btn btn-primary" onclick="HomeCashflow.saveFixed('${id}')">עדכן</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
        // Set values after modal renders
        setTimeout(() => {
            const dateEl = document.getElementById('fix-date');
            const tpEl = document.getElementById('fix-total-payments');
            const pmEl = document.getElementById('fix-payments-made');
            if (dateEl) dateEl.value = item.chargeDate;
            if (tpEl) tpEl.value = item.totalPayments || 0;
            if (pmEl) pmEl.value = item.paymentsMade || 0;
        }, 10);
    },

    toggleFixed(id) {
        Store.update(data => {
            const item = data.home.fixedExpenses.find(e => e.id === id);
            if (item) item.active = !item.active;
        });
    },

    deleteFixed(id) {
        if (!confirmAction('למחוק הוצאה זו?')) return;
        Store.update(data => { data.home.fixedExpenses = data.home.fixedExpenses.filter(e => e.id !== id); });
        showToast('הוצאה נמחקה', 'info');
    },

    openAddVariable() {
        const cats = Store.get().categories.home;
        openModal('הוספת הוצאה משתנה', `
            <div class="form-group"><label>שם</label><input type="text" id="var-name" placeholder="לדוגמה: סופרמרקט"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום</label><input type="number" id="var-amount" placeholder="0"></div>
                <div class="form-group"><label>קטגוריה</label><select id="var-category">${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
            </div>
            <div class="form-group"><label>תאריך</label><input type="date" id="var-date" value="${new Date().toISOString().slice(0,10)}"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="HomeCashflow.saveVariable()">שמור</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    saveVariable(editId) {
        const name = document.getElementById('var-name').value.trim();
        const amount = parseFloat(document.getElementById('var-amount').value);
        const category = document.getElementById('var-category').value;
        const date = document.getElementById('var-date').value;
        if (!name || !amount) { showToast('נא למלא שם וסכום', 'error'); return; }

        Store.update(data => {
            if (editId) {
                const idx = data.home.variableExpenses.findIndex(e => e.id === editId);
                if (idx >= 0) Object.assign(data.home.variableExpenses[idx], { name, amount, category, date });
            } else {
                data.home.variableExpenses.push({ id: Store.genId(), name, amount, category, date });
            }
        });
        closeModal();
        showToast(editId ? 'הוצאה עודכנה' : 'הוצאה נוספה', 'success');
    },

    editVariable(id) {
        const data = Store.get();
        const item = data.home.variableExpenses.find(e => e.id === id);
        if (!item) return;
        const cats = data.categories.home;
        openModal('עריכת הוצאה', `
            <div class="form-group"><label>שם</label><input type="text" id="var-name" value="${item.name}"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום</label><input type="number" id="var-amount" value="${item.amount}"></div>
                <div class="form-group"><label>קטגוריה</label><select id="var-category">${cats.map(c=>`<option value="${c}" ${c===item.category?'selected':''}>${c}</option>`).join('')}</select></div>
            </div>
            <div class="form-group"><label>תאריך</label><input type="date" id="var-date" value="${item.date}"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="HomeCashflow.saveVariable('${id}')">עדכן</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    deleteVariable(id) {
        if (!confirmAction('למחוק הוצאה זו?')) return;
        Store.update(data => { data.home.variableExpenses = data.home.variableExpenses.filter(e => e.id !== id); });
        showToast('הוצאה נמחקה', 'info');
    },

    afterRender() {}
};
