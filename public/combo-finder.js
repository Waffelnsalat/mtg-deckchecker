(function () {
  const state = {
    result: null,
    activeFilter: "complete",
    search: "",
  };

  const elements = {
    form: document.querySelector("#combo-form"),
    deckUrl: document.querySelector("#combo-deck-url"),
    importButton: document.querySelector("#combo-import-url-button"),
    fileField: document.querySelector("#combo-deck-file"),
    fileName: document.querySelector("#combo-deck-file-name"),
    decklist: document.querySelector("#combo-decklist"),
    submitButton: document.querySelector("#combo-submit-button"),
    clearButton: document.querySelector("#combo-clear-button"),
    status: document.querySelector("#combo-form-status"),
    emptyState: document.querySelector("#combo-empty-state"),
    results: document.querySelector("#combo-results"),
    sourceBadge: document.querySelector("#combo-source-badge"),
    countComplete: document.querySelector("#combo-count-complete"),
    countMissing: document.querySelector("#combo-count-missing"),
    countColor: document.querySelector("#combo-count-color"),
    countCommander: document.querySelector("#combo-count-commander"),
    summary: document.querySelector("#combo-summary"),
    filters: [...document.querySelectorAll(".combo-filter")],
    search: document.querySelector("#combo-search"),
    lines: document.querySelector("#combo-lines"),
  };

  elements.fileField?.addEventListener("change", async () => {
    const [file] = elements.fileField.files ?? [];
    if (!file) {
      updateFileName();
      return;
    }

    updateFileName(file.name);
    elements.decklist.value = await file.text();
    setStatus(`Loaded ${file.name}. Ready to find combos.`);
  });

  elements.importButton?.addEventListener("click", importDeckUrl);
  elements.deckUrl?.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    await importDeckUrl();
  });

  elements.form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await findCombos();
  });

  elements.clearButton?.addEventListener("click", () => {
    elements.deckUrl.value = "";
    elements.decklist.value = "";
    elements.fileField.value = "";
    updateFileName();
    state.result = null;
    state.search = "";
    elements.search.value = "";
    render();
    setStatus("Waiting for a decklist.");
  });

  elements.filters.forEach((button) => {
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.filter;
      render();
    });
  });

  elements.search?.addEventListener("input", () => {
    state.search = elements.search.value.trim().toLowerCase();
    renderLines();
  });

  function updateFileName(fileName = "") {
    if (elements.fileName) {
      elements.fileName.textContent = fileName || "No file selected";
    }
  }

  async function importDeckUrl() {
    const url = elements.deckUrl.value.trim();
    if (!url) {
      setStatus("Paste an Archidekt deck URL first.");
      return;
    }

    setLoading(true, { importLabel: "Importing..." });
    setStatus("Importing deck URL...");

    try {
      const response = await fetch("/api/edh/decklists/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || "Deck URL import failed.");
      }

      elements.decklist.value = result.decklist;
      elements.fileField.value = "";
      updateFileName();
      setStatus(`Imported "${result.title}" from ${result.sourceLabel}. Ready to find combos.`);
    } catch (error) {
      setStatus(formatError(error, "Deck URL import failed."));
    } finally {
      setLoading(false);
    }
  }

  async function findCombos() {
    const decklist = sanitizeDecklist(elements.decklist.value).trim();
    if (!decklist) {
      setStatus("Paste a decklist, import a URL, or upload a text file first.");
      return;
    }

    elements.decklist.value = decklist;
    setLoading(true, { submitLabel: "Finding..." });
    setStatus("Resolving deck and checking Commander Spellbook combos...");

    try {
      const response = await fetch("/api/edh/combos/find", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ decklist }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || "Combo lookup failed.");
      }

      state.result = result;
      state.activeFilter = chooseInitialFilter(result.combos);
      setStatus(buildResultStatus(result));
      render();
    } catch (error) {
      setStatus(formatError(error, "Combo lookup failed."));
    } finally {
      setLoading(false);
    }
  }

  function chooseInitialFilter(combos) {
    if ((combos?.complete?.length ?? 0) > 0) {
      return "complete";
    }

    if ((combos?.missingOne?.length ?? 0) > 0) {
      return "missingOne";
    }

    return "colorLocked";
  }

  function buildResultStatus(result) {
    const unresolved = result.document?.result?.unresolvedCount ?? 0;
    const warning = unresolved > 0 ? ` ${unresolved} unresolved card${unresolved === 1 ? "" : "s"} ignored.` : "";
    return `${result.combos?.summary ?? "Combo lookup finished."}${warning}`;
  }

  function sanitizeDecklist(value) {
    return window.MtgDeckcheckerDecklistIntake?.sanitizeDecklistInput(value) ?? value;
  }

  function setLoading(isLoading, labels = {}) {
    const submitLabel = labels.submitLabel ?? "Find Combos";
    const importLabel = labels.importLabel ?? "Import";
    elements.submitButton.disabled = isLoading;
    elements.importButton.disabled = isLoading;
    elements.clearButton.disabled = isLoading;
    elements.submitButton.textContent = submitLabel;
    elements.importButton.textContent = importLabel;
  }

  function setStatus(message) {
    if (elements.status) {
      elements.status.textContent = message;
    }
  }

  function render() {
    const combos = state.result?.combos;
    elements.emptyState.hidden = Boolean(combos);
    elements.results.hidden = !combos;

    if (!combos) {
      return;
    }

    elements.sourceBadge.textContent = combos.lookupStatus === "ok" ? combos.source : "Lookup unavailable";
    elements.countComplete.textContent = String(combos.counts?.complete ?? 0);
    elements.countMissing.textContent = String(combos.counts?.missingOne ?? 0);
    elements.countColor.textContent = String(combos.counts?.colorLocked ?? 0);
    elements.countCommander.textContent = String(combos.counts?.commanderSwap ?? 0);
    elements.summary.textContent = combos.summary ?? "";

    elements.filters.forEach((button) => {
      const isActive = button.dataset.filter === state.activeFilter;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    renderLines();
  }

  function renderLines() {
    const combos = state.result?.combos;
    if (!combos) {
      elements.lines.innerHTML = "";
      return;
    }

    const lines = (combos[state.activeFilter] ?? []).filter(matchesSearch);

    if (lines.length === 0) {
      elements.lines.innerHTML = `<div class="empty-state">No ${getFilterLabel(state.activeFilter).toLowerCase()} lines match this view.</div>`;
      return;
    }

    elements.lines.innerHTML = lines.map(renderComboLine).join("");
  }

  function matchesSearch(line) {
    if (!state.search) {
      return true;
    }

    return [
      ...line.cardNames,
      ...line.missingCardNames,
      ...line.missingTemplates,
      ...line.outcomeNames,
      line.description,
    ]
      .join(" ")
      .toLowerCase()
      .includes(state.search);
  }

  function renderComboLine(line) {
    const missing = [...line.missingCardNames, ...line.missingTemplates];
    const statusClass = getLineStatusClass(line.status);
    return `
      <article class="combo-line-card ${statusClass}">
        <div class="combo-line-header">
          <div>
            <p class="panel-kicker">${escapeHtml(line.statusLabel)}</p>
            <h3>${escapeHtml(line.cardNames.join(" + "))}</h3>
          </div>
          <div class="combo-line-badges">
            <span class="tag-chip">${line.lineType === "finisher" ? "Win line" : "Engine"}</span>
            ${line.commanderInvolved ? '<span class="tag-chip">Commander</span>' : ""}
            ${line.manaNeeded ? `<span class="tag-chip">${escapeHtml(line.manaNeeded)}</span>` : ""}
          </div>
        </div>

        ${missing.length > 0 ? `<p class="combo-missing"><span>Missing</span>${missing.map(escapeHtml).join(", ")}</p>` : ""}

        <div class="combo-card-strip">
          ${line.cards.map(renderComboCard).join("")}
        </div>

        <div class="combo-detail-grid">
          <div>
            <span class="meta-label">Produces</span>
            <p>${line.outcomeNames.length > 0 ? line.outcomeNames.map(escapeHtml).join(", ") : "Unspecified combo output"}</p>
          </div>
          <div>
            <span class="meta-label">Setup</span>
            <p>${renderSetupText(line)}</p>
          </div>
        </div>

        ${renderSteps(line.steps)}
      </article>
    `;
  }

  function renderComboCard(card) {
    const image = card.imageUri
      ? `<img src="${escapeAttribute(card.imageUri)}" alt="${escapeAttribute(card.name)}" loading="lazy" decoding="async" />`
      : `<div class="combo-card-placeholder">${escapeHtml(card.name)}</div>`;
    const scryfallUri = card.scryfallUri || `https://scryfall.com/search?q=${encodeURIComponent(`!"${card.name}"`)}`;
    return `
      <figure class="combo-card-preview ${card.inDeck ? "is-owned" : "is-missing"}">
        <a class="combo-card-link" href="${escapeAttribute(scryfallUri)}" target="_blank" rel="noopener noreferrer">
          ${image}
          <figcaption>
            <strong>${escapeHtml(card.name)}</strong>
            <span>${card.inDeck ? "In deck" : "Missing"}</span>
          </figcaption>
        </a>
      </figure>
    `;
  }

  function renderSetupText(line) {
    const setup = [
      line.notablePrerequisites?.join(", "),
      line.variantCount > 1 ? `${line.variantCount} variants` : "",
      line.bracketTag ? `Spellbook tag ${line.bracketTag}` : "",
    ].filter(Boolean);

    return setup.length > 0 ? setup.map(escapeHtml).join(" &middot; ") : "No notable prerequisites listed.";
  }

  function renderSteps(steps) {
    if (!steps?.length) {
      return "";
    }

    return `
      <ol class="combo-steps">
        ${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ol>
    `;
  }

  function getFilterLabel(filter) {
    const labels = {
      complete: "Complete",
      missingOne: "Missing One",
      colorLocked: "Color Locked",
      commanderSwap: "Commander Swap",
    };
    return labels[filter] ?? "Combo";
  }

  function getLineStatusClass(status) {
    const classes = {
      complete: "combo-line-complete",
      missing_one: "combo-line-missing",
      color_locked: "combo-line-color",
      commander_swap: "combo-line-commander",
    };
    return classes[status] ?? "combo-line-neutral";
  }

  function formatError(error, fallback) {
    return error instanceof Error ? error.message : fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  render();
})();
