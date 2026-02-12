// ===== Business Cashflow Module =====
const BusinessCashflow = {
    activeTab: 'clients',

    render() {
        const data = Store.get();
        const bizReceived = sumBy(data.business.incomes.filter(i => i.status === 'received'), 'amount');
        const bizExpected = sumBy(data.business.incomes.filter(i => i.status === 'expected'), 'amount');
        const bizFixed = getMonthlyFixedTotal(data.business.fixedExpenses);
        const bizCards = getTotalCardCharges('business');
        const salaries = getTotalSalaryCost();
        const transfers = sumBy(data.business.transfers.filter(t => {
            const d = new Date(t.date); const n = new Date();
            return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
        }), 'amount');

        return `
            <div class="summary-grid">
                <div class="summary-card green">
                    <div class="label">הכנסות שהתקבלו</div>
                    <div class="value positive">${formatCurrency(bizReceived)}</div>
                </div>
                <div class="summary-card yellow">
                    <div class="label">הכנסות צפויות</div>
                    <div class="value" style="color:var(--yellow)">${formatCurrency(bizExpected)}</div>
                </div>
                <div class="summary-card red">
                    <div class="label">הוצאות + שכר</div>
                    <div class="value negative">${formatCurrency(bizFixed + bizCards + salaries)}</div>
                </div>
                <div class="summary-card purple">
                    <div class="label">העברות לבית</div>
                    <div class="value" style="color:var(--purple)">${formatCurrency(transfers)}</div>
                </div>
            </div>

            <div class="tabs">
                <div class="tab ${this.activeTab === 'clients' ? 'active' : ''}" onclick="BusinessCashflow.switchTab('clients')">הכנסות מלקוחות</div>
                <div class="tab ${this.activeTab === 'fixed' ? 'active' : ''}" onclick="BusinessCashflow.switchTab('fixed')">הוצאות קבועות</div>
                <div class="tab ${this.activeTab === 'variable' ? 'active' : ''}" onclick="BusinessCashflow.switchTab('variable')">הוצאות משתנות</div>
                <div class="tab ${this.activeTab === 'transfers' ? 'active' : ''}" onclick="BusinessCashflow.switchTab('transfers')">העברות לבית</div>
            </div>

            <div class="tab-content ${this.activeTab === 'clients' ? 'active' : ''}" id="tab-clients">${this.renderClients(data)}</div>
            <div class="tab-content ${this.activeTab === 'fixed' ? 'active' : ''}" id="tab-fixed">${this.renderFixed(data)}</div>
            <div class="tab-content ${this.activeTab === 'variable' ? 'active' : ''}" id="tab-variable">${this.renderVariable(data)}</div>
            <div class="tab-content ${this.activeTab === 'transfers' ? 'active' : ''}" id="tab-transfers">${this.renderTransfers(data)}</div>
        `;
    },

    switchTab(tab) {
        this.activeTab = tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab-content#tab-${tab}`).classList.add('active');
        document.querySelector(`.tab[onclick*="${tab}"]`).classList.add('active');
    },

    renderClients(data) {
        return `
            <div class="section-header">
                <h2>הכנסות מלקוחות</h2>
                <button class="btn btn-primary" onclick="BusinessCashflow.openAddClient()">+ הוספת הכנסה</button>
            </div>
            ${data.business.incomes.length === 0 ?
                '<div class="empty-state"><div class="icon">💼</div><p>אין הכנסות מלקוחות</p><button class="btn btn-primary" onclick="BusinessCashflow.openAddClient()">הוסף הכנסה ראשונה</button></div>' :
                `<div class="card"><div class="table-wrapper"><table>
                    <thead><tr><th>לקוח</th><th>סכום</th><th>תאריך צפוי</th><th>סטטוס</th><th>הערות</th><th>פעולות</th></tr></thead>
                    <tbody>${data.business.incomes.sort((a,b) => new Date(a.expectedDate) - new Date(b.expectedDate)).map(i => `
                        <tr>
                            <td><strong>${i.clientName}</strong></td>
                            <td class="amount-positive">${formatCurrency(i.amount)}</td>
                            <td>${formatDate(i.expectedDate)}</td>
                            <td>${statusBadge(i.status)}</td>
                            <td style="color:var(--text-muted);font-size:0.8rem;">${i.notes || ''}</td>
                            <td>
                                ${i.status === 'expected' ? `<button class="btn btn-sm btn-success" onclick="BusinessCashflow.markReceived('${i.id}')">✓ התקבל</button>` : ''}
                                <button class="btn-icon" onclick="BusinessCashflow.editClient('${i.id}')">✏️</button>
                                <button class="btn-icon danger" onclick="BusinessCashflow.deleteClient('${i.id}')">🗑️</button>
                            </td>
                        </tr>
                    `).join('')}</tbody>
                </table></div></div>`
            }
        `;
    },

    renderFixed(data) {
        const grouped = {};
        data.business.fixedExpenses.forEach(e => {
            if (!grouped[e.category]) grouped[e.category] = [];
            grouped[e.category].push(e);
        });

        return `
            <div class="section-header">
                <h2>הוצאות קבועות עסקיות</h2>
                <button class="btn btn-primary" onclick="BusinessCashflow.openAddFixed()">+ הוספת הוצאה</button>
            </div>
            ${data.business.fixedExpenses.length === 0 ?
                '<div class="empty-state"><div class="icon">📋</div><p>אין הוצאות קבועות</p></div>' :
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
                                        <button class="btn-icon" onclick="BusinessCashflow.editFixed('${e.id}')">✏️</button>
                                        <button class="btn-icon" onclick="BusinessCashflow.toggleFixed('${e.id}')">${e.active ? '⏸️' : '▶️'}</button>
                                        <button class="btn-icon danger" onclick="BusinessCashflow.deleteFixed('${e.id}')">🗑️</button>
                                    </td>
                                </tr>
                            `}).join('')}</tbody>
                        </table></div>
                    </div>
                `).join('')
            }
            <div class="card" style="margin-top:12px;text-align:center;padding:14px;">
                <strong>סה"כ הוצאות קבועות חודשיות: <span class="amount-negative">${formatCurrency(getMonthlyFixedTotal(data.business.fixedExpenses))}</span></strong>
            </div>
        `;
    },

    renderVariable(data) {
        const now = new Date();
        const thisMonth = data.business.variableExpenses.filter(e => {
            const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const cats = Store.get().categories.business;
        return `
            <div class="section-header">
                <h2>הוצאות משתנות - ${getMonthName(now.getMonth())}</h2>
                <button class="btn btn-primary" onclick="BusinessCashflow.openAddVariable()">+ הוספת הוצאה</button>
            </div>
            ${thisMonth.length === 0 ?
                '<div class="empty-state"><div class="icon">🧾</div><p>אין הוצאות משתנות החודש</p></div>' :
                `<div class="card"><div class="table-wrapper"><table>
                    <thead><tr><th>שם</th><th>סכום</th><th>קטגוריה</th><th>תאריך</th><th>פעולות</th></tr></thead>
                    <tbody>${thisMonth.map(e => `
                        <tr><td>${e.name}</td><td class="amount-negative">${formatCurrency(e.amount)}</td><td><span class="category-tag">${e.category}</span></td><td>${formatDate(e.date)}</td>
                        <td><button class="btn-icon" onclick="BusinessCashflow.editVariable('${e.id}')">✏️</button><button class="btn-icon danger" onclick="BusinessCashflow.deleteVariable('${e.id}')">🗑️</button></td></tr>
                    `).join('')}</tbody>
                    <tfoot><tr><td><strong>סה"כ</strong></td><td class="amount-negative"><strong>${formatCurrency(sumBy(thisMonth,'amount'))}</strong></td><td colspan="3"></td></tr></tfoot>
                </table></div></div>`
            }
        `;
    },

    renderTransfers(data) {
        return `
            <div class="section-header">
                <h2>העברות לבית</h2>
                <button class="btn btn-primary" onclick="BusinessCashflow.openAddTransfer()">+ העברה חדשה</button>
            </div>
            ${data.business.transfers.length === 0 ?
                '<div class="empty-state"><div class="icon">↔️</div><p>אין העברות</p></div>' :
                `<div class="card"><div class="table-wrapper"><table>
                    <thead><tr><th>סכום</th><th>תאריך</th><th>הערות</th><th>פעולות</th></tr></thead>
                    <tbody>${data.business.transfers.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t => `
                        <tr><td class="amount-negative">${formatCurrency(t.amount)}</td><td>${formatDate(t.date)}</td><td style="color:var(--text-muted)">${t.notes||''}</td>
                        <td><button class="btn-icon" onclick="BusinessCashflow.editTransfer('${t.id}')">✏️</button><button class="btn-icon danger" onclick="BusinessCashflow.deleteTransfer('${t.id}')">🗑️</button></td></tr>
                    `).join('')}</tbody>
                    <tfoot><tr><td class="amount-negative"><strong>${formatCurrency(sumBy(data.business.transfers,'amount'))}</strong></td><td colspan="3"><strong>סה"כ</strong></td></tr></tfoot>
                </table></div></div>`
            }
        `;
    },

    _paymentMethodFields(selected, creditCardId) {
        const data = Store.get();
        const cards = data.creditCards.filter(c => c.account === 'business');
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

    // === CRUD ===
    openAddClient() {
        openModal('הוספת הכנסה מלקוח', `
            <div class="form-group"><label>שם לקוח</label><input type="text" id="cl-name"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום</label><input type="number" id="cl-amount"></div>
                <div class="form-group"><label>סטטוס</label><select id="cl-status"><option value="expected">צפוי</option><option value="received">התקבל</option><option value="late">באיחור</option></select></div>
            </div>
            <div class="form-group"><label>תאריך צפוי</label><input type="date" id="cl-date" value="${new Date().toISOString().slice(0,10)}"></div>
            <div class="form-group"><label>הערות</label><input type="text" id="cl-notes"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="BusinessCashflow.saveClient()">שמור</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    saveClient(editId) {
        const clientName = document.getElementById('cl-name').value.trim();
        const amount = parseFloat(document.getElementById('cl-amount').value);
        const status = document.getElementById('cl-status').value;
        const expectedDate = document.getElementById('cl-date').value;
        const notes = document.getElementById('cl-notes').value.trim();
        if (!clientName || !amount) { showToast('נא למלא שם וסכום', 'error'); return; }
        Store.update(data => {
            if (editId) {
                const idx = data.business.incomes.findIndex(i => i.id === editId);
                if (idx >= 0) Object.assign(data.business.incomes[idx], { clientName, amount, status, expectedDate, notes });
            } else {
                data.business.incomes.push({ id: Store.genId(), clientName, amount, expectedDate, status, notes });
            }
        });
        closeModal(); showToast(editId ? 'עודכן' : 'נוסף', 'success');
    },

    editClient(id) {
        const item = Store.get().business.incomes.find(i => i.id === id);
        if (!item) return;
        openModal('עריכת הכנסה מלקוח', `
            <div class="form-group"><label>שם לקוח</label><input type="text" id="cl-name" value="${item.clientName}"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום</label><input type="number" id="cl-amount" value="${item.amount}"></div>
                <div class="form-group"><label>סטטוס</label><select id="cl-status"><option value="expected" ${item.status==='expected'?'selected':''}>צפוי</option><option value="received" ${item.status==='received'?'selected':''}>התקבל</option><option value="late" ${item.status==='late'?'selected':''}>באיחור</option></select></div>
            </div>
            <div class="form-group"><label>תאריך צפוי</label><input type="date" id="cl-date" value="${item.expectedDate}"></div>
            <div class="form-group"><label>הערות</label><input type="text" id="cl-notes" value="${item.notes||''}"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="BusinessCashflow.saveClient('${id}')">עדכן</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    markReceived(id) {
        Store.update(data => {
            const item = data.business.incomes.find(i => i.id === id);
            if (item) item.status = 'received';
        });
        showToast('סומן כהתקבל ✓', 'success');
    },

    deleteClient(id) {
        if (!confirmAction('למחוק?')) return;
        Store.update(data => { data.business.incomes = data.business.incomes.filter(i => i.id !== id); });
    },

    openAddFixed() {
        const cats = Store.get().categories.business;
        openModal('הוספת הוצאה קבועה עסקית', `
            <div class="form-group"><label>שם</label><input type="text" id="fix-name"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום</label><input type="number" id="fix-amount"></div>
                <div class="form-group"><label>קטגוריה</label><select id="fix-category">${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
            </div>
            <div class="form-group"><label>תדירות</label><select id="fix-freq"><option value="monthly">חודשי</option><option value="bimonthly">דו-חודשי</option><option value="quarterly">רבעוני</option><option value="yearly">שנתי</option></select></div>
            ${this._paymentMethodFields()}
            <div class="modal-actions"><button class="btn btn-primary" onclick="BusinessCashflow.saveFixed()">שמור</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
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
                const idx = data.business.fixedExpenses.findIndex(e => e.id === editId);
                if (idx >= 0) Object.assign(data.business.fixedExpenses[idx], { name, amount, category, frequency, chargeDate, paymentMethod, creditCardId, totalPayments, paymentsMade });
            } else {
                data.business.fixedExpenses.push({ id: Store.genId(), name, amount, category, frequency, chargeDate, active: true, paymentMethod, creditCardId, totalPayments, paymentsMade });
            }
        });
        closeModal(); showToast(editId ? 'עודכן' : 'נוסף', 'success');
    },

    editFixed(id) {
        const item = Store.get().business.fixedExpenses.find(e => e.id === id);
        if (!item) return;
        const cats = Store.get().categories.business;
        const pmFields = this._paymentMethodFields(item.paymentMethod, item.creditCardId);
        openModal('עריכת הוצאה קבועה', `
            <div class="form-group"><label>שם</label><input type="text" id="fix-name" value="${item.name}"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום</label><input type="number" id="fix-amount" value="${item.amount}"></div>
                <div class="form-group"><label>קטגוריה</label><select id="fix-category">${cats.map(c=>`<option value="${c}" ${c===item.category?'selected':''}>${c}</option>`).join('')}</select></div>
            </div>
            <div class="form-group"><label>תדירות</label><select id="fix-freq"><option value="monthly" ${item.frequency==='monthly'?'selected':''}>חודשי</option><option value="bimonthly" ${item.frequency==='bimonthly'?'selected':''}>דו-חודשי</option><option value="quarterly" ${item.frequency==='quarterly'?'selected':''}>רבעוני</option><option value="yearly" ${item.frequency==='yearly'?'selected':''}>שנתי</option></select></div>
            ${pmFields}
            <div class="modal-actions"><button class="btn btn-primary" onclick="BusinessCashflow.saveFixed('${id}')">עדכן</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
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
        Store.update(data => { const item = data.business.fixedExpenses.find(e => e.id === id); if (item) item.active = !item.active; });
    },

    deleteFixed(id) {
        if (!confirmAction('למחוק?')) return;
        Store.update(data => { data.business.fixedExpenses = data.business.fixedExpenses.filter(e => e.id !== id); });
    },

    openAddVariable() {
        const cats = Store.get().categories.business;
        openModal('הוספת הוצאה משתנה', `
            <div class="form-group"><label>שם</label><input type="text" id="var-name"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום</label><input type="number" id="var-amount"></div>
                <div class="form-group"><label>קטגוריה</label><select id="var-category">${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
            </div>
            <div class="form-group"><label>תאריך</label><input type="date" id="var-date" value="${new Date().toISOString().slice(0,10)}"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="BusinessCashflow.saveVariable()">שמור</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
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
                const idx = data.business.variableExpenses.findIndex(e => e.id === editId);
                if (idx >= 0) Object.assign(data.business.variableExpenses[idx], { name, amount, category, date });
            } else {
                data.business.variableExpenses.push({ id: Store.genId(), name, amount, category, date });
            }
        });
        closeModal(); showToast(editId ? 'עודכן' : 'נוסף', 'success');
    },

    editVariable(id) {
        const item = Store.get().business.variableExpenses.find(e => e.id === id);
        if (!item) return;
        const cats = Store.get().categories.business;
        openModal('עריכת הוצאה', `
            <div class="form-group"><label>שם</label><input type="text" id="var-name" value="${item.name}"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום</label><input type="number" id="var-amount" value="${item.amount}"></div>
                <div class="form-group"><label>קטגוריה</label><select id="var-category">${cats.map(c=>`<option value="${c}" ${c===item.category?'selected':''}>${c}</option>`).join('')}</select></div>
            </div>
            <div class="form-group"><label>תאריך</label><input type="date" id="var-date" value="${item.date}"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="BusinessCashflow.saveVariable('${id}')">עדכן</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    deleteVariable(id) {
        if (!confirmAction('למחוק?')) return;
        Store.update(data => { data.business.variableExpenses = data.business.variableExpenses.filter(e => e.id !== id); });
    },

    openAddTransfer() {
        openModal('העברה לבית', `
            <div class="form-group"><label>סכום</label><input type="number" id="tr-amount"></div>
            <div class="form-group"><label>תאריך</label><input type="date" id="tr-date" value="${new Date().toISOString().slice(0,10)}"></div>
            <div class="form-group"><label>הערות</label><input type="text" id="tr-notes"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="BusinessCashflow.saveTransfer()">שמור</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    saveTransfer(editId) {
        const amount = parseFloat(document.getElementById('tr-amount').value);
        const date = document.getElementById('tr-date').value;
        const notes = document.getElementById('tr-notes').value.trim();
        if (!amount) { showToast('נא למלא סכום', 'error'); return; }
        Store.update(data => {
            if (editId) {
                const item = data.business.transfers.find(t => t.id === editId);
                if (item) Object.assign(item, { amount, date, notes });
            } else {
                data.business.transfers.push({ id: Store.genId(), amount, date, notes });
            }
        });
        closeModal(); showToast(editId ? 'העברה עודכנה' : 'העברה נוספה', 'success');
    },

    editTransfer(id) {
        const item = Store.get().business.transfers.find(t => t.id === id);
        if (!item) return;
        openModal('עריכת העברה', `
            <div class="form-group"><label>סכום</label><input type="number" id="tr-amount" value="${item.amount}"></div>
            <div class="form-group"><label>תאריך</label><input type="date" id="tr-date" value="${item.date}"></div>
            <div class="form-group"><label>הערות</label><input type="text" id="tr-notes" value="${item.notes || ''}"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="BusinessCashflow.saveTransfer('${id}')">עדכן</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    deleteTransfer(id) {
        if (!confirmAction('למחוק?')) return;
        Store.update(data => { data.business.transfers = data.business.transfers.filter(t => t.id !== id); });
    },

    afterRender() {}
};
