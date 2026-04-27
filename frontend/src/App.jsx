import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { CUSTOMER_CONFIG } from './customer.config';
import Login from './components/Login';
import TranslationApp from './features/translation/TranslationApp';
import ComparisonApp from './features/comparison/ComparisonApp';
import SummaryApp from './features/summary/SummaryApp';
import InteractApp from './features/interact/InteractApp';
import ExtractApp from './features/extract/ExtractApp';
import DynamicFieldsApp from './features/dynamic-fields/DynamicFieldsApp';
import RedactApp from './features/redact/RedactApp';

const FEATURE_MAP = {
  translation:     TranslationApp,
  comparison:      ComparisonApp,
  summary:         SummaryApp,
  interact:        InteractApp,
  extract:         ExtractApp,
  'dynamic-fields': DynamicFieldsApp,
  redact:           RedactApp,
};

const FEATURE_LABELS = {
  translation:     'Transliteration',
  comparison:      'Compare',
  summary:         'Summary',
  interact:        'Interact',
  extract:         'Extract',
  'dynamic-fields': 'eSign & eStamp',
  redact:           'Redact',
};

function AppShell() {
  const { brandName, tagline, enabledFeatures } = useTheme();
  const [user, setUser] = useState(null);
  const [activeFeature, setActiveFeature] = useState(enabledFeatures[0] || 'translation');

  useEffect(() => {
    const saved = localStorage.getItem('ai_translate_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem('ai_translate_user');
      }
    }
  }, []);

  const handleLogin = (session) => setUser(session);

  const handleLogout = () => {
    localStorage.removeItem('ai_translate_user');
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const ActiveComponent = FEATURE_MAP[activeFeature] || TranslationApp;
  const showTabs = enabledFeatures.length > 1;

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: "var(--color-bg)", color: "var(--color-textPrimary)" }}>
      <header className="sticky top-0 z-10 shadow-sm" style={{ backgroundColor: "var(--color-surface)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-2 sm:gap-3 overflow-hidden">
          <img src={CUSTOMER_CONFIG.logoUrl} alt={brandName} className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0" />
          <h1 className="text-lg sm:text-xl font-bold tracking-tight flex-shrink-0">
            <span className="gradient-brand">{brandName}</span>
          </h1>
          {tagline && (
            <span className="text-sm hidden sm:block" style={{ color: "var(--color-textSecondary)" }}>
              {tagline}
            </span>
          )}

          {showTabs && (
            <nav className="hidden sm:flex gap-1 ml-4">
              {enabledFeatures.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFeature(f)}
                  className="px-3 py-1.5 text-sm rounded-md font-medium transition"
                  style={
                    activeFeature === f
                      ? { backgroundColor: "var(--color-primary)", color: "white" }
                      : { color: "var(--color-textSecondary)" }
                  }
                >
                  {FEATURE_LABELS[f] || f}
                </button>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium" style={{ color: "var(--color-textPrimary)" }}>{user.username}</p>
              <p className="text-xs" style={{ color: "var(--color-textSecondary)" }}>{user.company}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm transition px-3 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600"
              style={{ color: "var(--color-textSecondary)" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {showTabs && (
          <div className="sm:hidden border-t border-gray-100 flex overflow-x-auto">
            {enabledFeatures.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFeature(f)}
                className="flex-shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition"
                style={
                  activeFeature === f
                    ? { color: "var(--color-primary)", borderColor: "var(--color-primary)" }
                    : { color: "var(--color-textSecondary)", borderColor: "transparent" }
                }
              >
                {FEATURE_LABELS[f] || f}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ActiveComponent />
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider customer={CUSTOMER_CONFIG.customerId} config={CUSTOMER_CONFIG}>
      <AppShell />
    </ThemeProvider>
  );
}

export default App;
