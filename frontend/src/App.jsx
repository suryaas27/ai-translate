import React from 'react';
import DocTranslation from './components/DocTranslation';
import doqfyLogo from './assets/doqfy-logo.png';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <img src={doqfyLogo} alt="Doqfy" className="w-10 h-10" />
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-cyan-500">DoqfAI</span> Translate
          </h1>
          <span className="text-sm text-gray-500">Document Translation for Indic Languages</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DocTranslation />
      </main>
    </div>
  );
}

export default App;
