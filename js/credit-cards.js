// ===== Credit Cards Module =====
const CreditCards = {
    render() {
        const data = Store.get();
        const totalMonthly = data.creditCards.reduce((s, c) => s + getMonthlyCardCharges(c), 0);

        return `
            <div class="summary-grid">
                <div class="summary-card red">
                    <div class="label">סה"כ חיוב חודשי</div>
                    <div class="value negative">${formatCurrency(totalMonthly)}</div>
                </div>
                <div class="summary-card blue">
                    <div class="label">כרטיסים פעילים</div>
                    <div class="value">${data.creditCards.length}</div>
                </div>
                <div class="summary-card yellow">
                    <div class="label">חיוב בית</div>
                    <div class="value negative">${formatCurrency(data.creditCards.filter(c=>c.account==='home').reduce((s,c)=>s+getMonthlyCardCharges(c),0))}</div>
                </div>
                <div class="summary-card purple">
                    <div class="label">חיוב עסק</div>
                    <div class="value negative">${formatCurrency(data.creditCards.filter(c=>c.account==='business').reduce((s,c)=>s+getMonthlyCardCharges(c),0))}</div>
                </div>
            </div>

            <div class="section-header">
                <h2>כרטיסי אשראי</h2>
                <button class="btn btn-primary" onclick="CreditCards.openAddCard()">+ כרטיס חדש</button>
            </div>

            ${data.creditCards.length === 0 ?
                '<div class="empty-state"><div class="icon">💳</div><p>אין כרטיסי אשראי</p><button class="btn btn-primary" onclick="CreditCards.openAddCard()">הוסף כרטיס</button></div>' :
                data.creditCards.map(card => {
                    const monthlyCharge = getMonthlyCardCharges(card);
                    const pct = Math.min(100, Math.round((monthlyCharge / card.limit) * 100));
                    const color = pct > 80 ? 'red' : pct > 50 ? 'yellow' : 'green';
                    return `
                        <div class="card" style="margin-bottom:16px;">
                            <div class="card-header">
                                <h3>💳 ${card.name} <span class="badge badge-${card.account === 'home' ? 'green' : 'blue'}">${card.account === 'home' ? 'בית' : 'עסק'}</span></h3>
                                <div style="display:flex;gap:8px;">
                                    <button class="btn btn-sm btn-primary" onclick="CreditCards.openAddCharge('${card.id}')">+ חיוב</button>
                                    <button class="btn-icon" onclick="CreditCards.editCard('${card.id}')">✏️</button>
                                    <button class="btn-icon danger" onclick="CreditCards.deleteCard('${card.id}')">🗑️</button>
                                </div>
                            </div>
                            <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.85rem;">
                                <span>מסגרת: ${formatCurrency(card.limit)}</span>
                                <span>חיוב חודשי: <strong class="amount-negative">${formatCurrency(monthlyCharge)}</strong></span>
                                <span>תאריך חיוב: ${card.billingDate} לחודש</span>
                            </div>
                            <div class="progress-bar" style="margin-bottom:16px;"><div class="fill ${color}" style="width:${pct}%"></div></div>

                            ${card.charges.length === 0 ? '<p style="color:var(--text-muted);text-align:center;padding:12px;">אין חיובים</p>' :
                            `<div class="table-wrapper"><table>
                                <thead><tr><th>תיאור</th><th>סכום כולל</th><th>חודשי</th><th>תשלומים</th><th>נותרו</th><th>פעולות</th></tr></thead>
                                <tbody>${card.charges.map(ch => {
                                    const remaining = ch.installments - ch.installmentsPaid;
                                    return `
                                        <tr ${remaining <= 0 ? 'style="opacity:0.4"' : ''}>
                                            <td>${ch.description}</td>
                                            <td>${formatCurrency(ch.totalAmount)}</td>
                                            <td class="amount-negative">${formatCurrency(ch.monthlyAmount)}</td>
                                            <td>${ch.installments === 1 ? 'רגיל' : ch.installments + ' תשלומים'}</td>
                                            <td>${remaining <= 0 ? '<span class="badge badge-green">הסתיים</span>' : `<span class="badge badge-yellow">${remaining} נותרו</span>`}</td>
                                            <td>
                                                ${remaining > 0 ? `<button class="btn btn-sm btn-ghost" onclick="CreditCards.payInstallment('${card.id}','${ch.id}')">שולם</button>` : ''}
                                                <button class="btn-icon" onclick="CreditCards.editCharge('${card.id}','${ch.id}')">✏️</button>
                                                <button class="btn-icon danger" onclick="CreditCards.deleteCharge('${card.id}','${ch.id}')">🗑️</button>
                                            </td>
                                        </tr>`;
                                }).join('')}</tbody>
                            </table></div>`}
                        </div>`;
                }).join('')
            }
        `;
    },

    openAddCard() {
        openModal('כרטיס אשראי חדש', `
            <div class="form-group"><label>שם הכרטיס</label><input type="text" id="card-name" placeholder="לדוגמה: ישרכרט"></div>
            <div class="form-row">
                <div class="form-group"><label>חשבון</label><select id="card-account"><option value="home">בית</option><option value="business">עסק</option></select></div>
                <div class="form-group"><label>מסגרת</label><input type="number" id="card-limit"></div>
            </div>
            <div class="form-group"><label>תאריך חיוב (יום בחודש)</label><input type="number" id="card-billing" min="1" max="31" value="15"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="CreditCards.saveCard()">שמור</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    saveCard(editId) {
        const name = document.getElementById('card-name').value.trim();
        const account = document.getElementById('card-account').value;
        const limit = parseFloat(document.getElementById('card-limit').value);
        const billingDate = parseInt(document.getElementById('card-billing').value);
        if (!name || !limit) { showToast('נא למלא שם ומסגרת', 'error'); return; }
        Store.update(data => {
            if (editId) {
                const card = data.creditCards.find(c => c.id === editId);
                if (card) Object.assign(card, { name, account, limit, billingDate });
            } else {
                data.creditCards.push({ id: Store.genId(), name, account, limit, billingDate, charges: [] });
            }
        });
        closeModal(); showToast(editId ? 'כרטיס עודכן' : 'כרטיס נוסף', 'success');
    },

    editCard(id) {
        const card = Store.get().creditCards.find(c => c.id === id);
        if (!card) return;
        openModal('עריכת כרטיס', `
            <div class="form-group"><label>שם</label><input type="text" id="card-name" value="${card.name}"></div>
            <div class="form-row">
                <div class="form-group"><label>חשבון</label><select id="card-account"><option value="home" ${card.account==='home'?'selected':''}>בית</option><option value="business" ${card.account==='business'?'selected':''}>עסק</option></select></div>
                <div class="form-group"><label>מסגרת</label><input type="number" id="card-limit" value="${card.limit}"></div>
            </div>
            <div class="form-group"><label>תאריך חיוב</label><input type="number" id="card-billing" min="1" max="31" value="${card.billingDate}"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="CreditCards.saveCard('${id}')">עדכן</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    deleteCard(id) {
        if (!confirmAction('למחוק כרטיס זה וכל החיובים שלו?')) return;
        Store.update(data => { data.creditCards = data.creditCards.filter(c => c.id !== id); });
        showToast('כרטיס נמחק', 'info');
    },

    openAddCharge(cardId) {
        openModal('חיוב חדש', `
            <div class="form-group"><label>תיאור</label><input type="text" id="ch-desc"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום כולל</label><input type="number" id="ch-total"></div>
                <div class="form-group"><label>מספר תשלומים</label><input type="number" id="ch-inst" value="1" min="1"></div>
            </div>
            <div class="form-group"><label>תאריך התחלה</label><input type="date" id="ch-start" value="${new Date().toISOString().slice(0,10)}"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="CreditCards.saveCharge('${cardId}')">שמור</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    saveCharge(cardId, editChargeId) {
        const description = document.getElementById('ch-desc').value.trim();
        const totalAmount = parseFloat(document.getElementById('ch-total').value);
        const installments = parseInt(document.getElementById('ch-inst').value) || 1;
        const startDate = document.getElementById('ch-start').value;
        if (!description || !totalAmount) { showToast('נא למלא תיאור וסכום', 'error'); return; }
        const monthlyAmount = Math.round((totalAmount / installments) * 100) / 100;
        Store.update(data => {
            const card = data.creditCards.find(c => c.id === cardId);
            if (!card) return;
            if (editChargeId) {
                const ch = card.charges.find(c => c.id === editChargeId);
                if (ch) Object.assign(ch, { description, totalAmount, installments, startDate, monthlyAmount });
            } else {
                card.charges.push({ id: Store.genId(), description, totalAmount, installments, installmentsPaid: 0, startDate, monthlyAmount });
            }
        });
        closeModal(); showToast(editChargeId ? 'חיוב עודכן' : 'חיוב נוסף', 'success');
    },

    editCharge(cardId, chargeId) {
        const data = Store.get();
        const card = data.creditCards.find(c => c.id === cardId);
        if (!card) return;
        const ch = card.charges.find(c => c.id === chargeId);
        if (!ch) return;
        openModal('עריכת חיוב', `
            <div class="form-group"><label>תיאור</label><input type="text" id="ch-desc" value="${ch.description}"></div>
            <div class="form-row">
                <div class="form-group"><label>סכום כולל</label><input type="number" id="ch-total" value="${ch.totalAmount}"></div>
                <div class="form-group"><label>מספר תשלומים</label><input type="number" id="ch-inst" value="${ch.installments}" min="1"></div>
            </div>
            <div class="form-group"><label>תאריך התחלה</label><input type="date" id="ch-start" value="${ch.startDate || ''}"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="CreditCards.saveCharge('${cardId}', '${chargeId}')">עדכן</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    payInstallment(cardId, chargeId) {
        Store.update(data => {
            const card = data.creditCards.find(c => c.id === cardId);
            if (card) {
                const ch = card.charges.find(c => c.id === chargeId);
                if (ch && ch.installmentsPaid < ch.installments) ch.installmentsPaid++;
            }
        });
        showToast('תשלום סומן', 'success');
    },

    deleteCharge(cardId, chargeId) {
        if (!confirmAction('למחוק חיוב?')) return;
        Store.update(data => {
            const card = data.creditCards.find(c => c.id === cardId);
            if (card) card.charges = card.charges.filter(c => c.id !== chargeId);
        });
    },

    afterRender() {}
};
