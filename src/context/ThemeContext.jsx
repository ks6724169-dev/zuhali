import React, { createContext, useContext, useEffect, useState } from 'react';
import { ACCENT_COLORS } from '../constants';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('zuhali_theme') || 'Light');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('zuhali_accent') || 'Green');

  const currentAccent = ACCENT_COLORS.find(
    (c) => c.name.toLowerCase() === (accentColor || '').toLowerCase() || c.value.toLowerCase() === (accentColor || '').toLowerCase()
  ) || ACCENT_COLORS[1];

  useEffect(() => {
    localStorage.setItem('zuhali_theme', theme);
    document.documentElement.setAttribute('data-theme', theme.toLowerCase());
    if (theme === 'Dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
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
