import { useState, useEffect } from 'react';
import DocTranslation from './components/DocTranslation';
import Login from './components/Login';
import doqfyLogo from './assets/doqfy-logo.png';

function App() {
  const [user, setUser] = useState(null);

  // Restore session from localStorage on mount
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

  const handleLogin = (session) => {
    setUser(session);
  };

  const handleLogout = () => {
    localStorage.removeItem('ai_translate_user');
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <img src={doqfyLogo} alt="Doqfy" className="w-10 h-10" />
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-cyan-500">DoqfAI</span> Translate
          </h1>
          <span className="text-sm text-gray-500">Document Translation for Indic Languages</span>

          {/* User info + logout */}
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-700">{user.username}</p>
              <p className="text-xs text-gray-400">{user.company}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DocTranslation />
      </main>
    </div>
  );
}

export default App;
