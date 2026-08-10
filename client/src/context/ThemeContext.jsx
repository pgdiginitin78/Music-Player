import { createContext, useContext, useState, useEffect } from 'react';
import { categoryThemes } from '../config/categoryThemes.js';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [activeCategorySlug, setActiveCategorySlug] = useState('default');
  
  const theme = categoryThemes[activeCategorySlug] || categoryThemes['default'];

  return (
    <ThemeContext.Provider value={{ activeCategorySlug, setActiveCategorySlug, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};
