window.MtgDeckcheckerReportDialog = {
  create({
    elements,
    getContext,
  }) {
    let activeReportType = "";
    let activeWebsiteReportKind = "";

    function initialize() {
      elements.openButton?.addEventListener("click", () => {
        open();
      });

      elements.closeButton?.addEventListener("click", () => {
        close();
      });

      elements.cancelButton?.addEventListener("click", () => {
        close();
      });

      elements.overlay?.addEventListener("click", (event) => {
        if (event.target === elements.overlay) {
          close();
        }
      });

      elements.typeButtons.forEach((button) => {
        button.addEventListener("click", () => {
          setActiveType(button.dataset.reportType ?? "");
        });
      });

      elements.websiteKindButtons.forEach((button) => {
        button.addEventListener("click", () => {
          activeWebsiteReportKind = button.dataset.websiteKind ?? "";
          sync();
        });
      });

      elements.evaluationCategoryFields.forEach((field) => {
        field.addEventListener("change", () => {
          sync();
        });
      });

      elements.commentField?.addEventListener("input", () => {
        sync();
      });

      elements.submitButton?.addEventListener("click", async () => {
        await submit();
      });

      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && isOpen()) {
          close();
        }
      });
    }

    function open() {
      sync();
      elements.overlay?.classList.remove("hidden");
      elements.overlay?.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-active");
      const activeButton =
        elements.typeButtons.find((button) => button.dataset.reportType === activeReportType) ??
        elements.typeButtons[0];
      activeButton?.focus();
    }

    function close() {
      elements.overlay?.classList.add("hidden");
      elements.overlay?.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-active");
      elements.openButton?.focus();
    }

    function reset() {
      activeReportType = "";
      activeWebsiteReportKind = "";
      if (elements.commentField) {
        elements.commentField.value = "";
      }
      elements.evaluationCategoryFields.forEach((field) => {
        field.checked = false;
      });
      if (elements.status) {
        elements.status.textContent = "";
      }
      sync();
    }

    function setActiveType(type) {
      activeReportType = ["website", "deck_evaluation", "other"].includes(type) ? type : "";
      activeWebsiteReportKind = "";
      elements.websiteKindButtons.forEach((button) => {
        button.classList.remove("is-active");
      });
      sync();
      if (activeReportType && elements.commentField) {
        elements.commentField.focus();
      }
    }

    function sync() {
      elements.typeButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.reportType === activeReportType);
      });

      elements.websiteKindButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.websiteKind === activeWebsiteReportKind);
      });

      elements.websitePanel?.classList.toggle("hidden", activeReportType !== "website");
      elements.evaluationPanel?.classList.toggle("hidden", activeReportType !== "deck_evaluation");

      if (elements.submitButton) {
        elements.submitButton.disabled = Boolean(getDraftError());
      }
    }

    function getDraftError() {
      const comment = elements.commentField?.value.trim() ?? "";
      const categories = getSelectedCategories();

      if (!activeReportType) {
        return "Choose a report type.";
      }

      if (activeReportType === "website") {
        if (!activeWebsiteReportKind) {
          return "Choose issue or feedback.";
        }

        return comment ? "" : "Add a short website report comment.";
      }

      if (activeReportType === "deck_evaluation") {
        return comment || categories.length > 0
          ? ""
          : "Choose an evaluation category or add a comment.";
      }

      return comment ? "" : "Add a short comment.";
    }

    function getSelectedCategories() {
      return elements.evaluationCategoryFields
        .filter((field) => field.checked)
        .map((field) => field.value)
        .filter(Boolean);
    }

    async function submit() {
      const draftError = getDraftError();
      if (draftError) {
        if (elements.status) {
          elements.status.textContent = draftError;
        }
        return false;
      }

      const originalLabel = elements.submitButton?.textContent ?? "Submit Report";
      if (elements.submitButton) {
        elements.submitButton.disabled = true;
        elements.submitButton.textContent = "Submitting...";
      }
      if (elements.status) {
        elements.status.textContent = "Saving report...";
      }
      let submittedSuccessfully = false;

      try {
        const response = await fetch("/api/reports", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildPayload()),
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.details || result.error || "Report could not be saved.");
        }

        if (elements.status) {
          elements.status.textContent = `Report saved as ${result.fileName}.`;
        }
        submittedSuccessfully = true;
        window.setTimeout(() => {
          close();
          reset();
        }, 850);
        return true;
      } catch (error) {
        if (elements.status) {
          elements.status.textContent = error instanceof Error ? error.message : "Report could not be saved.";
        }
        return false;
      } finally {
        if (elements.submitButton) {
          elements.submitButton.textContent = originalLabel;
          if (!submittedSuccessfully) {
            sync();
          }
        }
      }
    }

    function buildPayload() {
      return {
        reportType: activeReportType,
        websiteKind: activeReportType === "website" ? activeWebsiteReportKind : undefined,
        evaluationCategories:
          activeReportType === "deck_evaluation" ? getSelectedCategories() : [],
        comment: elements.commentField?.value.trim() ?? "",
        context: buildContext(),
      };
    }

    function buildContext() {
      const context = getContext();
      return {
        ...context,
        analysisSummary: buildAnalysisSummary(context.analysis),
      };
    }

    function buildAnalysisSummary(analysis) {
      if (!analysis) {
        return null;
      }

      const powerDimensions = analysis.power?.dimensions ?? [];

      return {
        power: {
          score: analysis.power?.powerScore,
          tier: analysis.power?.powerTier,
          dimensions: powerDimensions,
          dimensionScores: Object.fromEntries(
            powerDimensions.map((dimension) => [dimension.key, dimension.score]),
          ),
        },
        bracket: {
          recommended: analysis.bracket?.recommendedBracket,
          recommendedLabel: analysis.bracket?.recommendedLabel,
          target: analysis.bracket?.targetBracket,
          targetAlignment: analysis.bracket?.targetAlignment,
          rulesFloor: analysis.bracket?.rulesFloor,
        },
        strategy: {
          main: analysis.strategy?.mainStrategy,
          subStrategies: analysis.strategy?.subStrategies,
          synergy: analysis.strategy?.synergy,
        },
        winStrategy: {
          primaryPlan: analysis.winStrategy?.primaryPlan,
          backupPlans: analysis.winStrategy?.backupPlans,
        },
        scores: {
          shell: analysis.structure?.structureScore,
          landBase: analysis.landBase?.landBaseScore,
          ramp: analysis.ramp?.rampScore,
          cardFlow: analysis.draw?.drawScore,
          consistency: analysis.consistency?.consistencyScore,
          protection: analysis.protection?.protectionScore,
          recursion: analysis.recursion?.recursionScore,
          winConditions: analysis.winConditions?.finisherScore,
          removal: analysis.removal?.removalScore,
          spellInteraction: analysis.spellInteraction?.interactionScore,
        },
      };
    }

    function isOpen() {
      return Boolean(elements.overlay && !elements.overlay.classList.contains("hidden"));
    }

    return {
      initialize,
      isOpen,
    };
  },
};
