window.MtgDeckcheckerStrategyRenderer = {
  create({
    elements,
    actions,
  }) {
    let selectedPerspectiveKey = null;

    function getSelectedPerspectiveKey() {
      return selectedPerspectiveKey;
    }

    function resetSelection() {
      selectedPerspectiveKey = null;
    }

    function reset() {
      elements.switcher.replaceChildren();
      elements.switcherWrap.classList.add("hidden");
      elements.synergyFindingsList.replaceChildren();
      elements.mainCardsList.replaceChildren();
      elements.subStrategiesList.replaceChildren();
      elements.winCardsList.replaceChildren();
      elements.winReasonsList.replaceChildren();
      elements.winBackupsList.replaceChildren();
      resetSelection();
    }

    function ensureSelection(strategy) {
      if (
        !selectedPerspectiveKey ||
        !strategy.perspectives?.some((perspective) => perspective.strategy.key === selectedPerspectiveKey)
      ) {
        selectedPerspectiveKey =
          strategy.mainStrategy?.key ?? strategy.perspectives?.[0]?.strategy.key ?? null;
      }
    }

    function render(strategy, winStrategy) {
      ensureSelection(strategy);
      renderStrategy(strategy);
      renderWinStrategy(strategy, winStrategy);
    }

    function getActivePerspective(strategy) {
      ensureSelection(strategy);

      return (
        strategy.perspectives?.find(
          (perspective) => perspective.strategy.key === selectedPerspectiveKey,
        ) ?? null
      );
    }

    function renderWinStrategy(strategy, winStrategy) {
      const activePerspective = getActivePerspective(strategy);
      const activeWinPerspective =
        winStrategy.perspectives?.find(
          (perspective) => perspective.strategyKey === activePerspective?.strategy.key,
        ) ?? null;
      const primaryPlan = activeWinPerspective?.primaryPlan ?? winStrategy.primaryPlan;
      const backupPlans = activeWinPerspective?.backupPlans ?? winStrategy.backupPlans ?? [];
      const perspectiveLabel =
        activeWinPerspective?.strategyLabel ??
        activePerspective?.strategy.label ??
        strategy.mainStrategy?.label ??
        "-";

      elements.winPrimary.textContent = primaryPlan?.label ?? "No clear closing plan";
      elements.winBackupCount.textContent = String(backupPlans.length);
      elements.winPerspective.textContent = perspectiveLabel;
      elements.winSummary.textContent =
        buildWinStrategySummary(winStrategy, primaryPlan, backupPlans, perspectiveLabel);

      const reasonItems =
        primaryPlan?.reasons?.length
          ? primaryPlan.reasons.map((reason) => createListItem(reason))
          : [createListItem("No singular closing plan stands out yet. The shell still looks mixed or setup-heavy.")];
      const keyCardItems =
        primaryPlan?.keyCards?.length
          ? primaryPlan.keyCards.map((card) => createListItem(card))
          : [createListItem("No key closing cards were isolated for this perspective yet.")];
      const backupItems =
        backupPlans.length > 0
          ? backupPlans.map((plan) => createListItem(`${plan.label} | ${plan.summary}`))
          : [createListItem("No strong backup win plans were detected.")];

      elements.winReasonsList.replaceChildren(...reasonItems);
      elements.winCardsList.replaceChildren(...keyCardItems);
      elements.winBackupsList.replaceChildren(...backupItems);
    }

    function renderStrategy(strategy) {
      const activePerspective = getActivePerspective(strategy);
      const activeStrategy = activePerspective?.strategy ?? strategy.mainStrategy;
      const activeSubStrategies = activePerspective?.subStrategies ?? strategy.subStrategies;
      const activeSynergy = activePerspective?.synergy ?? strategy.synergy;
      const detectedMainStrategy = getDetectedMainStrategy(strategy);
      const reviewingAlternateMain =
        !!activeStrategy &&
        !!detectedMainStrategy &&
        activeStrategy.key !== detectedMainStrategy.key;

      elements.summary.textContent = buildStrategySummary(
        strategy,
        activeStrategy,
        detectedMainStrategy,
        reviewingAlternateMain,
      );
      elements.mainName.textContent = activeStrategy?.label ?? "Mixed Shell";
      elements.subStrategyCount.textContent = String(activeSubStrategies.length);
      elements.synergyScore.textContent = String(activeSynergy?.synergyScore ?? 0);
      elements.supportCount.textContent = String(activeSynergy?.supportCards ?? 0);
      elements.coreCount.textContent = String(activeSynergy?.coreCards ?? 0);
      elements.focusScore.textContent = `${activeSynergy?.focusScore ?? 0}%`;
      elements.commanderFit.textContent = activeSynergy
        ? activeSynergy.commanderAligned
          ? "Aligned"
          : "Light"
        : "-";
      elements.finisherFit.textContent = activeSynergy
        ? activeSynergy.finisherAligned
          ? "Aligned"
          : "Mixed"
        : "-";
      elements.synergySummary.textContent =
        activeSynergy?.summary ?? "Strategy support is checked after the main archetype is detected.";

      renderStrategySwitcher(strategy, activePerspective);
      applyScoreTone(elements.synergyScore, activeSynergy?.synergyScore ?? 0);

      const synergyFindings =
        activeSynergy?.findings?.length
          ? activeSynergy.findings
          : [
              {
                title: "No main strategy yet",
                status: "note",
                message: "Synergy needs a clearer main strategy before the shell can be judged against it.",
              },
            ];
      const mainCards =
        activeStrategy?.keyCards?.length
          ? activeStrategy.keyCards.map((card) => createListItem(card))
          : [createListItem("No clear support cards were isolated for the main strategy yet.")];

      const subItems =
        activeSubStrategies.length > 0
          ? activeSubStrategies.map((entry) =>
              createListItem(
                `${entry.label}${
                  entry.keyCards.length > 0 ? ` | ${entry.keyCards.join(", ")}` : ""
                }`,
              ),
            )
          : [createListItem("No strong secondary strategy was detected.")];

      elements.mainCardsList.replaceChildren(...mainCards);
      elements.subStrategiesList.replaceChildren(...subItems);
      renderFindings(synergyFindings, elements.synergyFindingsList);
    }

    function renderStrategySwitcher(strategy, activePerspective) {
      const perspectives = strategy.perspectives ?? [];
      const detectedMainStrategy = getDetectedMainStrategy(strategy);
      if (perspectives.length <= 1) {
        elements.switcher.replaceChildren();
        elements.switcherWrap.classList.add("hidden");
        return;
      }

      const buttons = perspectives.map((perspective) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "strategy-chip";

        if (perspective.strategy.key === activePerspective?.strategy.key) {
          button.classList.add("strategy-chip-active");
        }

        if (perspective.strategy.key === detectedMainStrategy?.key) {
          button.classList.add("strategy-chip-detected");
        }

        const label = document.createElement("span");
        label.textContent = perspective.strategy.label;
        button.append(label);

        if (perspective.strategy.key === detectedMainStrategy?.key) {
          const badge = document.createElement("span");
          badge.className = "strategy-chip-badge";
          badge.textContent = "Detected";
          button.append(badge);
        }

        button.addEventListener("click", async () => {
          if (actions.isSubmitDisabled() || selectedPerspectiveKey === perspective.strategy.key) {
            return;
          }

          const previousKey = selectedPerspectiveKey;
          selectedPerspectiveKey = perspective.strategy.key;
          const success = await actions.runDeckAnalysis({
            preferredStrategyKey: perspective.strategy.key,
            preserveCurrentView: true,
            statusMessage: `Re-scoring the deck as ${perspective.strategy.label}...`,
            successMessage: `Deck re-scored as ${perspective.strategy.label}.`,
            loadingTitleText: "Recalculating Strategy",
            loadingCopyText: `Re-scoring the deck with ${perspective.strategy.label} as the main plan.`,
          });

          if (!success) {
            selectedPerspectiveKey = previousKey;
            renderStrategy(strategy);
            const currentAnalysis = actions.getCurrentAnalysis();
            if (currentAnalysis?.winStrategy) {
              renderWinStrategy(strategy, currentAnalysis.winStrategy);
            }
          }
        });

        return button;
      });

      elements.switcher.replaceChildren(...buttons);
      elements.switcherWrap.classList.remove("hidden");
    }

    function buildWinStrategySummary(winStrategy, primaryPlan, backupPlans, perspectiveLabel) {
      if (!primaryPlan) {
        return winStrategy.summary;
      }

      if (backupPlans.length === 0) {
        return `${perspectiveLabel} currently looks like it mainly closes through ${primaryPlan.label.toLowerCase()}.`;
      }

      if (backupPlans.length === 1) {
        return `${perspectiveLabel} currently looks like it mainly closes through ${primaryPlan.label.toLowerCase()}, with ${backupPlans[0].label.toLowerCase()} as the clearest backup plan.`;
      }

      return `${perspectiveLabel} currently looks like it mainly closes through ${primaryPlan.label.toLowerCase()}, with ${backupPlans[0].label.toLowerCase()} and ${backupPlans[1].label.toLowerCase()} as backup plans.`;
    }

    function getDetectedMainStrategy(strategy) {
      return strategy.detectedMainStrategy ?? strategy.mainStrategy;
    }

    function buildStrategySummary(strategy, activeStrategy, detectedMainStrategy, reviewingAlternateMain) {
      if (!activeStrategy) {
        return strategy.summary;
      }

      if (!reviewingAlternateMain || !detectedMainStrategy) {
        return strategy.summary;
      }

      return `Viewing ${activeStrategy.label} as the main plan. Detected main strategy remains ${detectedMainStrategy.label}.`;
    }

    function renderFindings(findings, container) {
      const cards = findings.map((finding) => {
        const article = document.createElement("article");
        article.className = `finding-card finding-${finding.status}`;

        const header = document.createElement("div");
        header.className = "finding-header";

        const title = document.createElement("strong");
        title.textContent = finding.title;

        const badge = document.createElement("span");
        badge.className = `finding-badge finding-badge-${finding.status}`;
        badge.textContent = finding.status;

        header.append(title, badge);

        const body = document.createElement("p");
        body.textContent = finding.message;

        article.append(header, body);
        return article;
      });

      container.replaceChildren(...cards);
    }

    function createListItem(text) {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }

    function applyScoreTone(element, score) {
      applyToneToCard(element, getScoreTone(score));
    }

    function getScoreTone(score) {
      if (score >= 70) {
        return "good";
      }

      if (score >= 40) {
        return "watch";
      }

      return "risk";
    }

    function applyToneToCard(element, tone) {
      const card = element.closest(".future-stat, .stat-card");

      if (!card) {
        return;
      }

      card.classList.remove(
        "score-card",
        "score-card-good",
        "score-card-healthy",
        "score-card-watch",
        "score-card-risk",
      );

      if (!tone) {
        return;
      }

      card.classList.add("score-card", `score-card-${tone}`);
    }

    return {
      ensureSelection,
      getSelectedPerspectiveKey,
      render,
      renderStrategy,
      renderWinStrategy,
      reset,
      resetSelection,
    };
  },
};
