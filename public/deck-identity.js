window.MtgDeckcheckerDeckIdentity = {
  create({
    elements,
    helpers,
  }) {
    function render({
      deckDocument,
      analysis,
      fallbackCommanderName,
      fallbackCompanionName,
      fallbackSecretCommanderName,
      validation,
      sources,
    }) {
      const commanderCards = deckDocument.result.resolvedCards
        .filter((item) => item.section === "commander");
      const companionCard = deckDocument.result.resolvedCards
        .find((item) => item.section === "companion");

      elements.commanderDisplay.textContent =
        commanderCards.map((item) => item.card.name).join(" + ") ||
        fallbackCommanderName ||
        "Commander not detected";
      elements.companionDisplay.textContent =
        companionCard?.card.name || fallbackCompanionName || "-";
      elements.secretCommanderDisplay.textContent = fallbackSecretCommanderName || "-";

      renderCommanderVisuals(commanderCards);
      renderAnalysisStatus(analysis, validation, sources);
    }

    function reset() {
      clearCommanderVisuals();
      clearAnalysisStatus();
    }

    function renderCommanderVisuals(commanderCards) {
      if (!elements.commanderVisuals) {
        return;
      }

      const visuals = commanderCards
        .map((deckCard) => createCommanderVisual(deckCard.card))
        .filter(Boolean);

      elements.commanderVisuals.replaceChildren(...visuals);
      elements.commanderVisuals.classList.toggle("hidden", visuals.length === 0);
    }

    function clearCommanderVisuals() {
      elements.commanderVisuals?.replaceChildren();
      elements.commanderVisuals?.classList.add("hidden");
    }

    function createCommanderVisual(card) {
      const imageUrl = helpers.getCardImageUrl(card);
      if (!imageUrl) {
        return null;
      }

      const figure = document.createElement("figure");
      figure.className = "commander-visual";

      const link = document.createElement("a");
      link.className = "commander-visual-link";
      link.href = card.scryfall_uri;
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      link.title = `Open ${card.name} on Scryfall`;

      const image = document.createElement("img");
      image.className = "commander-visual-image";
      image.src = imageUrl;
      image.alt = `${card.name} card image`;
      image.loading = "lazy";
      image.decoding = "async";
      link.append(image);

      const caption = document.createElement("figcaption");
      caption.className = "commander-visual-caption";
      caption.textContent = card.name;

      figure.append(link, caption);
      return figure;
    }

    function renderAnalysisStatus(analysis, validation, sources) {
      if (!elements.analysisStatus) {
        return;
      }

      const validationIssueCount = validation?.issues?.length ?? 0;
      const sourceStates = Object.values(sources ?? {});
      const limitedSources = sourceStates.filter((source) => source.status !== "ok");
      const sourceCount = sourceStates.length;
      const statusCards = [
        {
          label: "Confidence",
          value: validation?.isValid === false || limitedSources.length > 0 ? "Limited" : "Checked",
          note: buildConfidenceNote(validationIssueCount, limitedSources.length),
          tone: validation?.isValid === false || limitedSources.length > 0 ? "warning" : "good",
        },
        {
          label: "Sources",
          value: limitedSources.length > 0 ? "Limited" : "Ready",
          note: limitedSources.length > 0
            ? `${sourceCount - limitedSources.length}/${sourceCount} sources ready`
            : `${sourceCount}/${sourceCount} sources ready`,
          tone: limitedSources.length > 0 ? "warning" : "good",
        },
        {
          label: "Bracket",
          value: analysis.bracket.recommendedLabel,
          note: analysis.bracket.targetLabel
            ? `Target: ${analysis.bracket.targetLabel}`
            : analysis.bracket.recommendedName,
        },
        {
          label: "Power",
          value: `${analysis.power.powerScore.toFixed(1)} / 10`,
          note: analysis.power.powerTier,
        },
        {
          label: "Strategy",
          value: analysis.strategy.mainStrategy?.label ?? "Unclear",
          note: analysis.strategy.subStrategies.length > 0
            ? `Side plan: ${analysis.strategy.subStrategies[0].label}`
            : "No strong side plan detected",
        },
        {
          label: "Win Plan",
          value: analysis.winStrategy.primaryPlan?.label ?? "Unclear",
          note: analysis.winStrategy.backupPlans.length > 0
            ? `Backup: ${analysis.winStrategy.backupPlans[0].label}`
            : analysis.winConditions.summary,
        },
      ];

      elements.analysisStatus.replaceChildren(...statusCards.map(createAnalysisStatusCard));
    }

    function buildConfidenceNote(validationIssueCount, sourceIssueCount) {
      const parts = [];

      if (validationIssueCount > 0) {
        parts.push(`${validationIssueCount} deck issue${validationIssueCount === 1 ? "" : "s"}`);
      }

      if (sourceIssueCount > 0) {
        parts.push(`${sourceIssueCount} source warning${sourceIssueCount === 1 ? "" : "s"}`);
      }

      return parts.length > 0 ? parts.join(", ") : "Deck and sources checked";
    }

    function clearAnalysisStatus() {
      elements.analysisStatus?.replaceChildren();
    }

    function createAnalysisStatusCard(card) {
      const article = document.createElement("article");
      article.className = "analysis-status-card";
      if (card.tone) {
        article.classList.add(`analysis-status-card-${card.tone}`);
      }

      const label = document.createElement("span");
      label.textContent = card.label;

      const value = document.createElement("strong");
      value.textContent = card.value;

      const note = document.createElement("p");
      note.textContent = card.note;

      article.append(label, value, note);
      return article;
    }

    return {
      render,
      reset,
    };
  },
};
