window.MtgDeckcheckerDecklistIntake = {
  inspectSections(decklistText) {
    const lines = decklistText.split(/\r?\n/);
    let currentSection = "mainboard";
    const explicitCommanderCards = [];
    const fallbackCards = [];
    const companionCards = [];

    for (const rawLine of lines) {
      const trimmedLine = rawLine.trim();
      if (!trimmedLine) {
        if (currentSection === "commander" || currentSection === "companion") {
          currentSection = "mainboard";
        }
        continue;
      }

      const sectionHeader = normalizeSectionHeader(trimmedLine);
      if (sectionHeader) {
        currentSection = sectionHeader;
        continue;
      }

      if (isStandaloneBracketSectionLine(trimmedLine)) {
        currentSection = "mainboard";
        continue;
      }

      if (trimmedLine.startsWith("#") || trimmedLine.startsWith("//")) {
        continue;
      }

      const prefixedLine = extractSectionPrefix(trimmedLine);
      const cleanedName = cleanupDeckEntryName(prefixedLine.line);

      if (!cleanedName) {
        continue;
      }

      if (prefixedLine.section === "companion" || currentSection === "companion") {
        companionCards.push(cleanedName);
        continue;
      }

      if (prefixedLine.section === "commander" || currentSection === "commander") {
        explicitCommanderCards.push(cleanedName);
        continue;
      }

      fallbackCards.push(cleanedName);
    }

    return {
      commanderCards: explicitCommanderCards,
      fallbackCards,
      companion: companionCards[0] ?? "",
    };
  },

  getLeaderPackageFromSummary(summary) {
    if (summary.commanderCards.length > 0) {
      return {
        commander: summary.commanderCards[0] ?? "",
        secondary: summary.commanderCards[1] ?? "",
      };
    }

    return {
      commander: summary.fallbackCards[0] ?? "",
      secondary: summary.fallbackCards[1] ?? "",
    };
  },

  buildDeckIntakeStatus(decklistText) {
    if (!decklistText.trim()) {
      return "";
    }

    const summary = this.inspectSections(decklistText);
    const leaderGuess = this.getLeaderPackageFromSummary(summary);
    if (summary.commanderCards.length > 0) {
      return `Detected commander: ${leaderGuess.commander}. Ready to analyze.`;
    }

    if (leaderGuess.commander) {
      return `No commander section found. Using first listed card as commander guess: ${leaderGuess.commander}.`;
    }

    return "";
  },

  sanitizeDecklistInput(decklistText) {
    const sanitizedLines = decklistText
      .split(/\r?\n/)
      .filter((line) => !isRemovableDeckSectionLine(line));

    return sanitizedLines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
  },

  createLeaderFieldsController({
    fields,
    toggles,
    wraps,
  }) {
    function prefillFromDecklist(decklistText, options = {}) {
      const summary = window.MtgDeckcheckerDecklistIntake.inspectSections(decklistText);
      const leaderGuess = window.MtgDeckcheckerDecklistIntake.getLeaderPackageFromSummary(summary);

      if (leaderGuess.commander && fields.commander.dataset.autofilled !== "false") {
        setAutofilledField(fields.commander, leaderGuess.commander);
      }

      if (
        options.allowAdditionalCommanderAutoEnable &&
        leaderGuess.secondary &&
        fields.additionalCommander.dataset.autofilled !== "false"
      ) {
        toggles.additionalCommander.checked = true;
        setAutofilledField(fields.additionalCommander, leaderGuess.secondary);
      }

      if (
        options.allowCompanionAutoEnable &&
        summary.companion &&
        fields.companion.dataset.autofilled !== "false"
      ) {
        toggles.companion.checked = true;
        setAutofilledField(fields.companion, summary.companion);
      }

      syncSupplementalFields();
    }

    function syncSupplementalFields() {
      wraps.additionalCommander.classList.toggle("hidden", !toggles.additionalCommander.checked);
      wraps.companion.classList.toggle("hidden", !toggles.companion.checked);
      wraps.secretCommander.classList.toggle("hidden", !toggles.secretCommander.checked);

      if (!toggles.additionalCommander.checked) {
        resetField(fields.additionalCommander);
      }

      if (!toggles.companion.checked) {
        resetField(fields.companion);
      }

      if (!toggles.secretCommander.checked) {
        resetField(fields.secretCommander);
      }
    }

    function setAutofilledField(field, value) {
      field.value = value;
      field.dataset.autofilled = "true";
    }

    function markFieldAsManual(field) {
      if (field.value.trim()) {
        field.dataset.autofilled = "false";
        return;
      }

      delete field.dataset.autofilled;
    }

    function resetField(field) {
      field.value = "";
      delete field.dataset.autofilled;
    }

    function clearAutofilledFields() {
      [
        fields.commander,
        fields.additionalCommander,
        fields.companion,
        fields.secretCommander,
      ].forEach((field) => {
        if (field.dataset.autofilled === "true") {
          resetField(field);
        }
      });
    }

    return {
      clearAutofilledFields,
      markFieldAsManual,
      prefillFromDecklist,
      resetField,
      syncSupplementalFields,
    };
  },
};

function normalizeSectionHeader(line) {
  const normalized = normalizeHeaderLabel(line);

  if (
    [
      "commander",
      "commanders",
      "partner",
      "partners",
      "background",
      "backgrounds",
      "doctor's companion",
      "doctors companion",
    ].includes(normalized)
  ) {
    return "commander";
  }

  if (["deck", "main", "mainboard"].includes(normalized)) {
    return "mainboard";
  }

  if (normalized === "companion") {
    return "companion";
  }

  if (["sideboard", "side"].includes(normalized)) {
    return "sideboard";
  }

  if (["maybeboard", "maybe"].includes(normalized)) {
    return "maybeboard";
  }

  return null;
}

function normalizeHeaderLabel(line) {
  return line
    .replace(/^(\/\/+|#+)\s*/, "")
    .replace(/^\[(.+)\]$/, "$1")
    .toLowerCase()
    .replace(/\(\d+\)/g, "")
    .replace(/[:\-]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function isRemovableDeckSectionLine(line) {
  if (isStandaloneBracketSectionLine(line.trim())) {
    return true;
  }

  const normalized = normalizeHeaderLabel(line.trim());

  if (!normalized) {
    return false;
  }

  return new Set([
    "commander",
    "commanders",
    "partner",
    "partners",
    "background",
    "backgrounds",
    "doctor's companion",
    "doctors companion",
    "deck",
    "main",
    "mainboard",
    "creature",
    "creatures",
    "artifact",
    "artifacts",
    "enchantment",
    "enchantments",
    "instant",
    "instants",
    "sorcery",
    "sorceries",
    "land",
    "lands",
    "planeswalker",
    "planeswalkers",
    "battle",
    "battles",
    "spell",
    "spells",
    "sideboard",
    "side",
    "maybeboard",
    "maybe",
  ]).has(normalized);
}

function isStandaloneBracketSectionLine(line) {
  const cleanedLine = line
    .replace(/^(\/\/+|#+)\s*/, "")
    .trim();

  return /^\[[^[\]]+\]\s*(?:\(\d+\))?$/u.test(cleanedLine);
}

function extractSectionPrefix(line) {
  const match = line.match(/^(?<prefix>[A-Za-z]+):\s*(?<rest>.+)$/);
  if (!match?.groups) {
    return { section: null, line };
  }

  const prefixMap = {
    cmdr: "commander",
    cmndr: "commander",
    commander: "commander",
    partner: "commander",
    partners: "commander",
    background: "commander",
    backgrounds: "commander",
    "doctor's companion": "commander",
    "doctors companion": "commander",
    companion: "companion",
    deck: "mainboard",
    main: "mainboard",
    mainboard: "mainboard",
    mb: "mainboard",
    sb: "sideboard",
    sideboard: "sideboard",
    maybe: "maybeboard",
    maybeboard: "maybeboard",
  };

  return {
    section: prefixMap[match.groups.prefix.toLowerCase()] ?? null,
    line: match.groups.rest.trim(),
  };
}

function cleanupDeckEntryName(line) {
  const quantityMatch = line.match(/^(?<quantity>\d+)\s*x?\s+(?<card>.+)$/i);
  const workingLine = quantityMatch?.groups?.card?.trim() ?? line.trim();

  return workingLine
    .replace(/^\[[^[\]]+\]\s*/, "")
    .replace(/\s+\*[^*]+\*\s*$/, "")
    .replace(/\s+\[[A-Za-z0-9]{2,6}\]\s*$/, "")
    .replace(/\s+\([A-Za-z0-9]{2,6}\)(?:\s+[A-Za-z0-9-]+)?\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
