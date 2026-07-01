window.MtgDeckcheckerDeckInput = {
  create({
    elements,
    actions,
  }) {
    function initialize() {
      elements.fileField?.addEventListener("change", async () => {
        const [file] = elements.fileField.files ?? [];

        if (!file) {
          updateFilePickerLabel();
          return;
        }

        updateFilePickerLabel(file.name);
        const text = await file.text();
        actions.applyImportedDecklist(text, {
          importedUrl: "",
          statusMessage: `Loaded ${file.name}. Ready to analyze the deck.`,
        });
      });

      elements.importUrlButton?.addEventListener("click", async () => {
        await importFromUrl();
      });

      elements.deckUrlField?.addEventListener("keydown", async (event) => {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        await importFromUrl();
      });

      elements.form?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const sanitizedDecklist = actions.sanitizeDecklistInput(elements.decklistField.value);
        if (sanitizedDecklist !== elements.decklistField.value) {
          elements.decklistField.value = sanitizedDecklist;
          actions.syncDeckHighlight();
        }

        if (!sanitizedDecklist.trim()) {
          elements.formStatus.textContent = "Paste a decklist or load a .txt file first.";
          return;
        }

        const targetBracket = await actions.promptForTargetBracketSelection();
        if (!targetBracket) {
          elements.formStatus.textContent = "Analysis canceled. Choose a target bracket to continue.";
          return;
        }

        elements.targetBracketField.value = String(targetBracket);
        await actions.runDeckAnalysis({ targetBracket });
      });

      elements.decklistField?.addEventListener("blur", () => {
        actions.prefillLeaderFieldsFromDecklist(elements.decklistField.value);
        const intakeStatus = actions.buildDeckIntakeStatus(elements.decklistField.value);
        if (intakeStatus) {
          elements.formStatus.textContent = intakeStatus;
        }
      });

      elements.decklistField?.addEventListener("input", () => {
        actions.clearAutofilledLeaderFields();
        actions.markDeckAsEdited();
        actions.syncDeckHighlight();
      });

      elements.commanderNameField?.addEventListener("input", () => {
        actions.markLeaderFieldAsManual(elements.commanderNameField);
        actions.markDeckAsEdited();
      });

      elements.additionalCommanderNameField?.addEventListener("input", () => {
        actions.markLeaderFieldAsManual(elements.additionalCommanderNameField);
        actions.markDeckAsEdited();
      });

      elements.companionNameField?.addEventListener("input", () => {
        actions.markLeaderFieldAsManual(elements.companionNameField);
        actions.markDeckAsEdited();
      });

      elements.secretCommanderNameField?.addEventListener("input", () => {
        actions.markLeaderFieldAsManual(elements.secretCommanderNameField);
        actions.markDeckAsEdited();
      });

      elements.additionalCommanderEnabledField?.addEventListener("change", () => {
        actions.syncSupplementalLeaderFields();
        actions.prefillLeaderFieldsFromDecklist(elements.decklistField.value);
        actions.markDeckAsEdited();
      });

      elements.companionEnabledField?.addEventListener("change", () => {
        actions.syncSupplementalLeaderFields();
        actions.prefillLeaderFieldsFromDecklist(elements.decklistField.value);
        actions.markDeckAsEdited();
      });

      elements.secretCommanderEnabledField?.addEventListener("change", () => {
        actions.syncSupplementalLeaderFields();
        actions.markDeckAsEdited();
      });

      elements.decklistField?.addEventListener("scroll", () => {
        actions.syncDeckHighlight();
      });
    }

    async function importFromUrl() {
      const deckUrl = elements.deckUrlField?.value.trim() ?? "";
      if (!deckUrl) {
        elements.formStatus.textContent = "Paste an Archidekt deck URL first.";
        return false;
      }

      actions.setLoadingState(true, {
        buttonLabel: "Analyze Deck",
        importButtonLabel: "Importing...",
        title: "Importing Deck URL",
        copy: "Fetching the public deck and converting it into the deck text format used by the analyzer.",
      });
      elements.formStatus.textContent = "Importing deck URL...";
      await actions.waitForNextPaint();

      try {
        const response = await fetch("/api/edh/decklists/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: deckUrl }),
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.details || result.error || "Deck URL import failed.");
        }

        if (elements.fileField) {
          elements.fileField.value = "";
        }
        updateFilePickerLabel();
        actions.applyImportedDecklist(result.decklist, {
          importedUrl: result.canonicalUrl || deckUrl,
          statusMessage: `Imported "${result.title}" from ${result.sourceLabel}. Ready to analyze the deck.`,
        });
        return true;
      } catch (error) {
        elements.formStatus.textContent = formatImportError(deckUrl, error);
        return false;
      } finally {
        actions.setLoadingState(false);
      }
    }

    function formatImportError(deckUrl, error) {
      const message = actions.formatFetchError(error, "Deck URL import failed.");
      if (/moxfield\.com/i.test(deckUrl) && /moxfield|blocked|automated/i.test(message)) {
        return "Moxfield is blocking direct URL imports right now. In Moxfield, use Export / Copy decklist, paste the text into the decklist box here, then analyze. Archidekt URLs still import directly.";
      }

      return message;
    }

    function updateFilePickerLabel(fileName = "") {
      if (!elements.fileNameLabel) {
        return;
      }

      elements.fileNameLabel.textContent = fileName || "No file selected";
    }

    return {
      initialize,
      importFromUrl,
      updateFilePickerLabel,
    };
  },
};
