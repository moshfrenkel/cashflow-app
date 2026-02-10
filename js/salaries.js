// ===== Salaries Module =====
const Salaries = {
    render() {
        const data = Store.get();
        const activeEmps = data.employees.filter(e => e.active);
        const totalGross = sumBy(activeEmps, 'grossSalary');
        const totalEmployer = activeEmps.reduce((s, e) => s + calcEmployerCost(e.grossSalary), 0);

        return `
            <div class="summary-grid">
                <div class="summary-card blue">
                    <div class="label">עובדים פעילים</div>
                    <div class="value">${activeEmps.length}</div>
                </div>
                <div class="summary-card red">
                    <div class="label">סה"כ ברוטו</div>
                    <div class="value negative">${formatCurrency(totalGross)}</div>
                </div>
                <div class="summary-card yellow">
                    <div class="label">עלות מעסיק (~30%)</div>
                    <div class="value" style="color:var(--yellow)">${formatCurrency(totalEmployer)}</div>
                </div>
                <div class="summary-card purple">
                    <div class="label">עלות כוללת</div>
                    <div class="value negative">${formatCurrency(totalGross + totalEmployer)}</div>
                </div>
            </div>

            <div class="section-header">
                <h2>ניהול עובדים</h2>
                <button class="btn btn-primary" onclick="Salaries.openAddEmployee()">+ עובד חדש</button>
            </div>

            ${data.employees.length === 0 ?
                '<div class="empty-state"><div class="icon">👥</div><p>אין עובדים מוגדרים</p><button class="btn btn-primary" onclick="Salaries.openAddEmployee()">הוסף עובד</button></div>' :
                `<div class="card"><div class="table-wrapper"><table>
                    <thead><tr><th>שם</th><th>תפקיד</th><th>ברוטו</th><th>עלות מעסיק</th><th>עלות כוללת</th><th>יום תשלום</th><th>סטטוס</th><th>פעולות</th></tr></thead>
                    <tbody>${data.employees.map(e => {
                        const empCost = calcEmployerCost(e.grossSalary);
                        const now = new Date();
                        const curMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
                        const isPaid = e.payments && e.payments.some(p => p.month === now.getMonth() && p.year === now.getFullYear() && p.paid);
                        return `
                            <tr style="${!e.active ? 'opacity:0.4' : ''}">
                                <td><strong>${e.name}</strong></td>
                                <td>${e.role}</td>
                                <td class="amount-negative">${formatCurrency(e.grossSalary)}</td>
                                <td style="color:var(--yellow)">${formatCurrency(empCost)}</td>
                                <td class="amount-negative"><strong>${formatCurrency(e.grossSalary + empCost)}</strong></td>
                                <td>${e.paymentDate} לחודש</td>
                                <td>
                                    ${e.active ?
                                        (isPaid ? '<span class="badge badge-green">שולם החודש</span>' : '<span class="badge badge-yellow">טרם שולם</span>') :
                                        '<span class="badge badge-red">לא פעיל</span>'
                                    }
                                </td>
                                <td>
                                    ${e.active && !isPaid ? `<button class="btn btn-sm btn-success" onclick="Salaries.markPaid('${e.id}')">✓ שולם</button>` : ''}
                                    <button class="btn-icon" onclick="Salaries.editEmployee('${e.id}')">✏️</button>
                                    <button class="btn-icon" onclick="Salaries.toggleEmployee('${e.id}')">${e.active ? '⏸️' : '▶️'}</button>
                                    <button class="btn-icon danger" onclick="Salaries.deleteEmployee('${e.id}')">🗑️</button>
                                </td>
                            </tr>`;
                    }).join('')}</tbody>
                    <tfoot><tr>
                        <td colspan="2"><strong>סה"כ</strong></td>
                        <td class="amount-negative"><strong>${formatCurrency(totalGross)}</strong></td>
                        <td style="color:var(--yellow)"><strong>${formatCurrency(totalEmployer)}</strong></td>
                        <td class="amount-negative"><strong>${formatCurrency(totalGross + totalEmployer)}</strong></td>
                        <td colspan="3"></td>
                    </tr></tfoot>
                </table></div></div>`
            }

            <div class="card" style="margin-top:20px;">
                <div class="card-header"><h3>📊 פירוט עלות מעסיק</h3></div>
                <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.8;">
                    <p>חישוב עלות מעסיק (~30% מהברוטו):</p>
                    <p>• ביטוח לאומי מעסיק: ~7.5%</p>
                    <p>• פנסיה מעסיק: ~6.5%</p>
                    <p>• פיצויים: ~8.33%</p>
                    <p>• דמי הבראה, חופשה ומחלה: ~8%</p>
                    <p style="margin-top:8px;color:var(--text-muted);">* אחוזים משוערים, ייתכנו הבדלים לפי תנאי העסקה</p>
                </div>
            </div>
        `;
    },

    openAddEmployee() {
        openModal('הוספת עובד', `
            <div class="form-group"><label>שם</label><input type="text" id="emp-name"></div>
            <div class="form-row">
                <div class="form-group"><label>תפקיד</label><input type="text" id="emp-role" value="עובד/ת"></div>
                <div class="form-group"><label>שכר ברוטו</label><input type="number" id="emp-salary"></div>
            </div>
            <div class="form-group"><label>יום תשלום בחודש</label><input type="number" id="emp-paydate" min="1" max="31" value="9"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="Salaries.saveEmployee()">שמור</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    saveEmployee(editId) {
        const name = document.getElementById('emp-name').value.trim();
        const role = document.getElementById('emp-role').value.trim();
        const grossSalary = parseFloat(document.getElementById('emp-salary').value);
        const paymentDate = parseInt(document.getElementById('emp-paydate').value) || 9;
        if (!name || !grossSalary) { showToast('נא למלא שם ושכר', 'error'); return; }
        Store.update(data => {
            if (editId) {
                const emp = data.employees.find(e => e.id === editId);
                if (emp) Object.assign(emp, { name, role, grossSalary, paymentDate });
            } else {
                data.employees.push({ id: Store.genId(), name, role, grossSalary, paymentDate, active: true, payments: [] });
            }
        });
        closeModal(); showToast(editId ? 'עובד עודכן' : 'עובד נוסף', 'success');
    },

    editEmployee(id) {
        const emp = Store.get().employees.find(e => e.id === id);
        if (!emp) return;
        openModal('עריכת עובד', `
            <div class="form-group"><label>שם</label><input type="text" id="emp-name" value="${emp.name}"></div>
            <div class="form-row">
                <div class="form-group"><label>תפקיד</label><input type="text" id="emp-role" value="${emp.role}"></div>
                <div class="form-group"><label>שכר ברוטו</label><input type="number" id="emp-salary" value="${emp.grossSalary}"></div>
            </div>
            <div class="form-group"><label>יום תשלום</label><input type="number" id="emp-paydate" min="1" max="31" value="${emp.paymentDate}"></div>
            <div class="modal-actions"><button class="btn btn-primary" onclick="Salaries.saveEmployee('${id}')">עדכן</button><button class="btn btn-ghost" onclick="closeModal()">ביטול</button></div>
        `);
    },

    markPaid(id) {
        const now = new Date();
        Store.update(data => {
            const emp = data.employees.find(e => e.id === id);
            if (emp) {
                if (!emp.payments) emp.payments = [];
                emp.payments.push({ month: now.getMonth(), year: now.getFullYear(), paid: true, paidDate: now.toISOString().slice(0,10) });
            }
        });
        showToast('סומן כשולם ✓', 'success');
    },

    toggleEmployee(id) {
        Store.update(data => { const e = data.employees.find(e => e.id === id); if (e) e.active = !e.active; });
    },

    deleteEmployee(id) {
        if (!confirmAction('למחוק עובד?')) return;
        Store.update(data => { data.employees = data.employees.filter(e => e.id !== id); });
        showToast('עובד נמחק', 'info');
    },

    afterRender() {}
};
