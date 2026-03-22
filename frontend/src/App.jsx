import React from 'react';
import DocTranslation from './components/DocTranslation';
import { Languages } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Languages className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">AI Translate</h1>
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
