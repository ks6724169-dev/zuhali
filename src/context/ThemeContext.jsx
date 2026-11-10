import React, { createContext, useContext, useEffect, useState } from 'react';
import { ACCENT_COLORS } from '../constants';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('zuhali_theme') || 'System');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('zuhali_accent') || 'Blue');

  const currentAccent = ACCENT_COLORS.find(
    (c) => c.name.toLowerCase() === (accentColor || '').toLowerCase() || c.value.toLowerCase() === (accentColor || '').toLowerCase()
  ) || ACCENT_COLORS[0];

  useEffect(() => {
    localStorage.setItem('zuhali_theme', theme);

    const applyTheme = () => {
      const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const effectiveDark = theme === 'Dark' || ((theme === 'System' || theme === 'System Default') && isSystemDark);

      document.documentElement.setAttribute('data-theme', effectiveDark ? 'dark' : 'light');
      if (effectiveDark) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    };

    applyTheme();

    if (theme === 'System' || theme === 'System Default') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('zuhali_accent', accentColor);
    document.documentElement.style.setProperty('--accent-color', currentAccent.value);
  }, [accentColor, currentAccent]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accentColor, setAccentColor, currentAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
