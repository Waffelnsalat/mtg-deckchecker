(function () {
  const storageKey = "mtg-deckchecker-theme";
  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)") ?? null;
  const toggles = [...document.querySelectorAll("[data-theme-toggle]")];

  function initialize() {
    applyTheme(getPreferredTheme());

    for (const toggle of toggles) {
      toggle.addEventListener("click", () => {
        const nextTheme = getActiveTheme() === "dark" ? "light" : "dark";
        window.localStorage.setItem(storageKey, nextTheme);
        applyTheme(nextTheme);
      });
    }

    mediaQuery?.addEventListener?.("change", (event) => {
      if (getStoredTheme() !== null) {
        return;
      }

      applyTheme(event.matches ? "dark" : "light");
    });
  }

  function getStoredTheme() {
    const storedTheme = window.localStorage.getItem(storageKey);
    return storedTheme === "dark" || storedTheme === "light" ? storedTheme : null;
  }

  function getPreferredTheme() {
    return getStoredTheme() ?? (mediaQuery?.matches ? "dark" : "light");
  }

  function getActiveTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;

    for (const toggle of toggles) {
      const nextModeLabel = theme === "dark" ? "Light mode" : "Dark mode";
      toggle.textContent = nextModeLabel;
      toggle.setAttribute("aria-pressed", String(theme === "dark"));
      toggle.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);
    }
  }

  initialize();
})();
