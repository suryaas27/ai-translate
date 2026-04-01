import { createContext, useContext, useEffect } from 'react';
import defaultTheme from './defaultTheme.json';

const ThemeContext = createContext(defaultTheme);

export function ThemeProvider({ customer, config, children }) {
  const theme = config || defaultTheme;

  useEffect(() => {
    const root = document.documentElement;
    const colors = { ...defaultTheme.colors, ...theme.colors };
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  }, [customer, theme]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
