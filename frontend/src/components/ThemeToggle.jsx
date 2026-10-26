import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../ThemeContext.jsx";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const Icon = next === "light" ? Sun : Moon;
  const label = `Switch to ${next} theme`;

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      <Icon size={15} aria-hidden="true" />
      <span className="toggle-label">{next === "light" ? "Light" : "Dark"}</span>
    </button>
  );
}