import { Languages } from 'lucide-react';

const TransliterationApp = () => {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
           style={{ backgroundColor: 'var(--color-primaryLight, #ede9fe)' }}>
        <Languages className="w-8 h-8" style={{ color: 'var(--color-primary, #7c3aed)' }} />
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Transliteration</h2>
      <p className="text-gray-500 max-w-md">
        Convert document scripts without changing meaning — e.g. Latin to Devanagari.
        Coming soon.
      </p>
    </div>
  );
};

export default TransliterationApp;
