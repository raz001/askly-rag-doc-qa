import { Sun, Moon } from "lucide-react";
import useTheme from "../hooks/useTheme.js";
import styles from "../styles/App.module.css";

function ThemeToggleButton({ className }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className={`${styles.themeToggle} ${className || ""}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
    </button>
  );
}

export default ThemeToggleButton;
