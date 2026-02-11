// ===== Salaries Module (Freelancers / Team) =====
const Salaries = {
    render() {
        const data = Store.get();
        const activeMembers = data.employees.filter(e => e.active);
        const totalPayments = sumBy(activeMembers, 'grossSalary');

        return `
            <div class="summary-grid">
                <div class="summary-card blue">
                    <div class="label">חברי צוות פעילים</div>
                    <div class="value">${activeMembers.length}</div>
                </div>
                <div class="summary-card red">
                    <div class="label">סה"כ תשלומים חודשיים</div>
                    <div class="value negative">${formatCurrency(totalPayments)}</div>
                </div>
            </div>

            <div class="section-header">
                <h2>ניהול צוות</h2>
                <button class="btn btn-primary" onclick="Salaries.openAddEmployee()">+ חבר צוות חדש</button>
            </div>

            ${data.employees.length === 0 ?
                '<div class="empty-state"><div class="icon">👥</div><p>אין חברי צוות מוגדרים</p><button class="btn btn-primary" onclick="Salaries.openAddEmployee()">הוסף חבר צוות</button></div>' :
                `<div class="card"><div class="table-wrapper"><table>
                    <thead><tr><th>שם</th><th>תפקיד</th><th>תשלום חודשי</th><th>יום תשלום</th><th>סטטוס</th><th>פעולות</th></tr></thead>
                    <tbody>${data.employees.map(e => {
                        const now = new Date();
                        const isPaid = e.payments && e.payments.some(p => p.month === now.getMonth() && p.year === now.getFullYear() && p.paid);
                        return `
                            <tr style="${!e.active ? 'opacity:0.4' : ''}">
                                <td><strong>${e.name}</strong></td>
                                <td>${e.role}</td>
                                <td class="amount-negative">${formatCurrency(e.grossSalary)}</td>
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
                        <td class="amount-negative"><strong>${formatCurrency(totalPayments)}</strong></td>
                        <td colspan="3"></td>
                    </tr></tfoot>
                </table></div></div>`
            }
        `;
    },

    openAddEmployee() {
        openModal('הוספת חבר צוות', `
            <div class="form-group"><label>שם</label><input type="text" id="emp-name"></div>
            <div class="form-row">
                <div class="form-group"><label>תפקיד</label><input type="text" id="emp-role" value="פרילנסר/ית"></div>
                <div class="form-group"><label>תשלום חודשי</label><input type="number" id="emp-salary"></div>
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
        if (!name || !grossSalary) { showToast('נא למלא שם וסכום תשלום', 'error'); return; }
        Store.update(data => {
            if (editId) {
                const emp = data.employees.find(e => e.id === editId);
                if (emp) Object.assign(emp, { name, role, grossSalary, paymentDate });
            } else {
                data.employees.push({ id: Store.genId(), name, role, grossSalary, paymentDate, active: true, payments: [] });
            }
        });
        closeModal(); showToast(editId ? 'חבר צוות עודכן' : 'חבר צוות נוסף', 'success');
    },

    editEmployee(id) {
        const emp = Store.get().employees.find(e => e.id === id);
        if (!emp) return;
        openModal('עריכת חבר צוות', `
            <div class="form-group"><label>שם</label><input type="text" id="emp-name" value="${emp.name}"></div>
            <div class="form-row">
                <div class="form-group"><label>תפקיד</label><input type="text" id="emp-role" value="${emp.role}"></div>
                <div class="form-group"><label>תשלום חודשי</label><input type="number" id="emp-salary" value="${emp.grossSalary}"></div>
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
        if (!confirmAction('למחוק חבר צוות?')) return;
        Store.update(data => { data.employees = data.employees.filter(e => e.id !== id); });
        showToast('חבר צוות נמחק', 'info');
    },

    afterRender() {}
};
