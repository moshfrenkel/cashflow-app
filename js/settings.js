// ===== Settings Module =====
const Settings = {
    render() {
        const data = Store.get();
        return `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header"><h3>⚙️ הגדרות כלליות</h3></div>
                    <div class="form-group">
                        <label>יתרת פתיחה - בית</label>
                        <input type="number" id="set-home-balance" value="${data.home.balance}" onchange="Settings.updateBalance('home', this.value)">
                    </div>
                    <div class="form-group">
                        <label>יתרת פתיחה - עסק</label>
                        <input type="number" id="set-biz-balance" value="${data.business.balance}" onchange="Settings.updateBalance('business', this.value)">
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><h3>💳 מסגרת אשראי</h3></div>
                    <div class="form-group">
                        <label>מסגרת אשראי - חשבון בית</label>
                        <input type="number" id="set-credit-home" value="${data.settings.creditFramework?.home || 0}" onchange="Settings.updateCreditFramework('home', this.value)">
                    </div>
                    <div class="form-group">
                        <label>מסגרת אשראי - חשבון עסק</label>
                        <input type="number" id="set-credit-biz" value="${data.settings.creditFramework?.business || 0}" onchange="Settings.updateCreditFramework('business', this.value)">
                    </div>
                    <p style="font-size:0.8rem;color:var(--text-muted);margin-top:8px;">מסגרת אשראי בבנק (אוברדרפט) - משמש לחישוב יתרה זמינה</p>
                </div>

                <div class="card">
                    <div class="card-header"><h3>📁 קטגוריות בית</h3></div>
                    <div id="home-cats">
                        ${data.categories.home.map((c, i) => `
                            <div style="display:flex;gap:8px;margin-bottom:6px;align-items:center;">
                                <input type="text" value="${c}" onchange="Settings.updateCategory('home',${i},this.value)" style="flex:1;">
                                <button class="btn-icon danger" onclick="Settings.removeCategory('home',${i})">✕</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-sm btn-ghost" onclick="Settings.addCategory('home')" style="margin-top:8px;">+ קטגוריה</button>
                </div>

                <div class="card">
                    <div class="card-header"><h3>📁 קטגוריות עסק</h3></div>
                    <div id="biz-cats">
                        ${data.categories.business.map((c, i) => `
                            <div style="display:flex;gap:8px;margin-bottom:6px;align-items:center;">
                                <input type="text" value="${c}" onchange="Settings.updateCategory('business',${i},this.value)" style="flex:1;">
                                <button class="btn-icon danger" onclick="Settings.removeCategory('business',${i})">✕</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-sm btn-ghost" onclick="Settings.addCategory('business')" style="margin-top:8px;">+ קטגוריה</button>
                </div>

                <div class="card">
                    <div class="card-header"><h3>💾 גיבוי ושחזור</h3></div>
                    <div style="display:flex;flex-direction:column;gap:12px;">
                        <button class="btn btn-primary" onclick="Store.exportJSON()">📤 ייצוא נתונים (JSON)</button>
                        <div>
                            <label class="btn btn-ghost" style="cursor:pointer;display:inline-flex;">
                                📥 ייבוא נתונים
                                <input type="file" accept=".json" style="display:none;" onchange="Store.importJSON(this.files[0])">
                            </label>
                        </div>
                        <hr style="border-color:var(--border-color);">
                        <button class="btn btn-danger" onclick="Settings.clearAllData()">🗑️ מחיקת כל הנתונים</button>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top:20px;">
                <div class="card-header"><h3>☁️ חשבון וסנכרון</h3></div>
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:0.85rem;color:var(--text-secondary);">מחובר כ:</span>
                        <span style="font-size:0.85rem;">${Auth.currentUser ? Auth.currentUser.email : 'מצב מקומי'}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:0.85rem;color:var(--text-secondary);">סטטוס:</span>
                        <span style="font-size:0.85rem;">
                            ${Auth.currentUser ? (Store._syncStatus === 'error' ? '⚠️ שגיאת סנכרון' : '☁️ מסונכרן לענן') : '💾 מקומי בלבד'}
                        </span>
                    </div>
                    ${Auth.currentUser ? '<hr style="border-color:var(--border-color);"><button class="btn btn-danger" onclick="Auth.logout()">התנתק</button>' : ''}
                </div>
            </div>

            <div class="card" style="margin-top:20px;">
                <div class="card-header"><h3>ℹ️ אודות</h3></div>
                <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.8;">
                    <p>אפליקציית ניהול תזרים מזומנים</p>
                    <p>גרסה: 1.1</p>
                    <p>הנתונים מסונכרנים לענן באמצעות Supabase ונשמרים גם מקומית</p>
                    <p>מומלץ לגבות את הנתונים באופן קבוע באמצעות הייצוא ל-JSON</p>
                </div>
            </div>
        `;
    },

    updateBalance(account, value) {
        Store.update(data => {
            data[account].balance = parseFloat(value) || 0;
        });
        showToast('יתרה עודכנה', 'success');
    },

    updateCreditFramework(account, value) {
        Store.update(data => {
            if (!data.settings.creditFramework) data.settings.creditFramework = { home: 0, business: 0 };
            data.settings.creditFramework[account] = parseFloat(value) || 0;
        });
        showToast('מסגרת אשראי עודכנה', 'success');
    },

    updateCategory(account, index, value) {
        Store.update(data => {
            data.categories[account][index] = value;
        });
    },

    addCategory(account) {
        Store.update(data => {
            data.categories[account].push('קטגוריה חדשה');
        });
    },

    removeCategory(account, index) {
        Store.update(data => {
            data.categories[account].splice(index, 1);
        });
    },

    clearAllData() {
        if (!confirmAction('האם אתה בטוח? כל הנתונים יימחקו!')) return;
        if (!confirmAction('בטוח בטוח? אין דרך חזרה!')) return;
        Store.clearAll();
    },

    afterRender() {}
};
