"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { MoonIcon, SunIcon } from "lucide-react";

const STORAGE_KEY = "phcw-theme";

/** Toggles the .dark class on <html>; the choice persists in localStorage. */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private mode etc. — the toggle still works for this session.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
