// ===== Authentication Module - Magic Link =====
const Auth = {
    currentUser: null,

    async init() {
        if (!supabaseClient) {
            console.warn('Supabase not available - offline mode');
            App.showApp();
            return;
        }

        // Listen for auth state changes (handles magic link callback)
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session && !Auth.currentUser) {
                Auth.currentUser = session.user;
                Auth.onLoginSuccess();
            }
        });

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session && session.user) {
                Auth.currentUser = session.user;
                await Auth.onLoginSuccess();
            } else {
                Auth.renderAuthScreen();
            }
        } catch (err) {
            console.error('Auth init error:', err);
            // Fallback to local mode
            App.showApp();
        }
    },

    renderAuthScreen() {
        const existing = document.getElementById('auth-screen');
        if (existing) existing.remove();

        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('main-content').classList.add('hidden');

        const div = document.createElement('div');
        div.id = 'auth-screen';
        div.className = 'auth-screen';
        div.innerHTML = `
            <div class="auth-container">
                <div class="auth-header">
                    <div class="auth-logo">₪</div>
                    <h1>ניהול תזרים</h1>
                    <p>ניהול תזרים מזומנים - בית ועסק</p>
                </div>
                <div id="auth-form-email" class="auth-form active">
                    <p style="text-align:center;color:var(--text-secondary);font-size:0.9rem;margin-bottom:20px;">
                        הזן את כתובת האימייל שלך וקבל קישור כניסה
                    </p>
                    <div id="auth-error" class="auth-error"></div>
                    <div class="form-group">
                        <label>אימייל</label>
                        <input type="email" id="auth-email" required placeholder="your@email.com" dir="ltr">
                    </div>
                    <button type="button" class="auth-btn" id="auth-submit-btn" onclick="Auth.handleMagicLink()">שלח קישור כניסה</button>
                </div>
                <div id="auth-check-email" class="auth-form" style="text-align:center;">
                    <div style="font-size:2.5rem;margin-bottom:16px;">📧</div>
                    <h3 style="margin-bottom:8px;">בדוק את האימייל שלך</h3>
                    <p id="auth-sent-to" style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:20px;"></p>
                    <p style="color:var(--text-secondary);font-size:0.85rem;">לחץ על הקישור שנשלח אליך כדי להתחבר</p>
                    <button type="button" class="auth-btn" style="margin-top:20px;background:var(--bg-input);color:var(--text-primary);" onclick="Auth.showEmailForm()">שלח שוב</button>
                </div>
            </div>
        `;
        document.body.prepend(div);

        // Allow Enter key to submit
        const emailInput = document.getElementById('auth-email');
        if (emailInput) {
            emailInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') Auth.handleMagicLink();
            });
            emailInput.focus();
        }
    },

    removeAuthScreen() {
        const screen = document.getElementById('auth-screen');
        if (screen) screen.remove();
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('main-content').classList.remove('hidden');
    },

    showEmailForm() {
        document.getElementById('auth-form-email').classList.add('active');
        document.getElementById('auth-check-email').classList.remove('active');
        Auth.hideError();
    },

    showError(msg) {
        const el = document.getElementById('auth-error');
        if (el) {
            el.textContent = msg;
            el.classList.add('show');
        }
    },

    hideError() {
        const el = document.getElementById('auth-error');
        if (el) el.classList.remove('show');
    },

    setLoading(loading) {
        const btn = document.getElementById('auth-submit-btn');
        if (!btn) return;
        btn.disabled = loading;
        btn.textContent = loading ? '...שולח' : 'שלח קישור כניסה';
    },

    async handleMagicLink() {
        Auth.hideError();
        const emailInput = document.getElementById('auth-email');
        const email = emailInput ? emailInput.value.trim() : '';

        if (!email) {
            Auth.showError('יש להזין כתובת אימייל');
            return;
        }

        Auth.setLoading(true);
        try {
            const { error } = await supabaseClient.auth.signInWithOtp({
                email: email,
                options: {
                    emailRedirectTo: window.location.origin + window.location.pathname
                }
            });
            Auth.setLoading(false);

            if (error) {
                const errorMap = {
                    'For security purposes, you can only request this once every 60 seconds': 'ניתן לשלוח קישור פעם ב-60 שניות, נסה שוב בעוד רגע',
                    'Unable to validate email address: invalid format': 'פורמט אימייל לא תקין'
                };
                Auth.showError(errorMap[error.message] || 'שגיאה: ' + error.message);
                return;
            }

            // Show "check your email" message
            document.getElementById('auth-form-email').classList.remove('active');
            document.getElementById('auth-check-email').classList.add('active');
            document.getElementById('auth-sent-to').textContent = 'שלחנו קישור כניסה ל-' + email;

        } catch (err) {
            Auth.setLoading(false);
            Auth.showError('שגיאת חיבור לשרת');
            console.error('Magic link error:', err);
        }
    },

    async onLoginSuccess() {
        Auth.removeAuthScreen();
        await Store.loadFromSupabase();
        App.showApp();
    },

    async logout() {
        if (supabaseClient) {
            try { await supabaseClient.auth.signOut(); } catch(e) {}
        }
        Auth.currentUser = null;
        Store._cache = null;
        Auth.renderAuthScreen();
    }
};
