// ===== Main Application =====
const App = {
    currentPage: 'daily-view',

    pages: {
        'daily-view': { title: 'תצוגה יומית', module: () => DailyView },
        'dashboard': { title: 'דשבורד', module: () => Dashboard },
        'home-cashflow': { title: 'תזרים בית', module: () => HomeCashflow },
        'business-cashflow': { title: 'תזרים עסק', module: () => BusinessCashflow },
        'credit-cards': { title: 'כרטיסי אשראי', module: () => CreditCards },
        'loans': { title: 'הלוואות', module: () => Loans },
        'salaries': { title: 'משכורות', module: () => Salaries },
        'forecast': { title: 'תחזית ותכנון', module: () => Forecast },
        'reports': { title: 'דוחות', module: () => Reports },
        'settings': { title: 'הגדרות', module: () => Settings }
    },

    init() {
        // Set current date
        const now = new Date();
        document.getElementById('current-date').textContent =
            now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        // Navigation click handlers
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.navigate(page);
            });
        });

        // Close sidebar on mobile when clicking main content
        document.getElementById('main-content').addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
                const overlay = document.getElementById('sidebar-overlay');
                if (overlay) overlay.classList.remove('show');
            }
        });

        // Hide app UI until auth resolves
        document.getElementById('sidebar').classList.add('hidden');
        document.getElementById('main-content').classList.add('hidden');

        // Start auth flow (will call App.showApp() when ready)
        Auth.init();
    },

    showApp() {
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        if (!Store._cache) Store._cache = Store.load();
        this.renderPage(this.currentPage || 'dashboard');
    },

    navigate(page) {
        if (!this.pages[page]) return;
        this.currentPage = page;

        // Update active nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Update title
        document.getElementById('page-title').textContent = this.pages[page].title;

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
            const overlay = document.getElementById('sidebar-overlay');
            if (overlay) overlay.classList.remove('show');
        }

        this.renderPage(page);
    },

    renderPage(page) {
        const pageConfig = this.pages[page];
        if (!pageConfig) return;

        const container = document.getElementById('page-container');
        const module = pageConfig.module();

        // Re-render
        container.innerHTML = module.render();

        // Run afterRender for charts etc.
        if (module.afterRender) {
            setTimeout(() => module.afterRender(), 50);
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
