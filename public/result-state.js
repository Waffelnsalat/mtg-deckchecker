window.MtgDeckcheckerResultState = {
  create({
    elements,
    controllers,
    actions,
  }) {
    function resetResultState() {
      actions.clearIssueAnchors();
      actions.clearResolvedCards();
      actions.clearAnalysisState();
      actions.resetResultsViewMode();
      actions.resetAdvancedTab();
      actions.syncDeckHighlight();

      elements.issuesBox.classList.add("hidden");
      elements.successContent.classList.add("hidden");
      elements.resultContent.classList.add("hidden");
      elements.resultEmpty.classList.remove("hidden");
      elements.issuesList.replaceChildren();

      controllers.structureOverview.reset();
      controllers.strategyRenderer.reset();
      controllers.metricDetails.reset();
      controllers.summaryPanels.reset();
      controllers.quickRead.reset();
      clearTaggedLists();
      clearRecommendations();
      clearCardBreakdown();
      controllers.deckIdentity.reset();
      controllers.taggedCardSections.clearPreviews();

      actions.syncWorkspaceMode(true);
      actions.syncResultsView();
    }

    function markDeckAsEdited() {
      elements.successContent.classList.add("hidden");
      controllers.deckIdentity.reset();
      controllers.quickRead.clearChart();
      controllers.taggedCardSections.clearPreviews();
      controllers.strategyRenderer.resetSelection();
      actions.clearResolvedCards();
      actions.clearAnalysisState();
      actions.resetResultsViewMode();
      actions.resetAdvancedTab();

      if (!elements.issuesBox.classList.contains("hidden") && elements.issuesList.childElementCount > 0) {
        elements.resultEmpty.classList.add("hidden");
        elements.resultContent.classList.remove("hidden");
        actions.syncWorkspaceMode(false);
      } else {
        elements.resultContent.classList.add("hidden");
        elements.resultEmpty.classList.remove("hidden");
        actions.syncWorkspaceMode(true);
      }

      if (elements.decklistField.value.trim()) {
        elements.formStatus.textContent =
          "Decklist changed. Run the analysis again to refresh the ranking data.";
      }

      actions.syncResultsView();
    }

    function prepareForNewScan(options = {}) {
      const { preserveSelectedStrategy = false, preserveResultsView = false } = options;

      elements.successContent.classList.add("hidden");
      elements.issuesBox.classList.add("hidden");
      elements.resultContent.classList.add("hidden");
      elements.resultEmpty.classList.remove("hidden");
      controllers.deckIdentity.reset();
      controllers.taggedCardSections.clearPreviews();
      actions.clearResolvedCards();
      actions.clearAnalysisState();
      if (!preserveSelectedStrategy) {
        controllers.strategyRenderer.resetSelection();
      }
      if (!preserveResultsView) {
        actions.resetResultsViewMode();
      }
      actions.resetAdvancedTab();
      actions.syncWorkspaceMode(true);
      actions.syncResultsView();
    }

    function showAnalysisResults() {
      elements.issuesBox.classList.add("hidden");
      elements.successContent.classList.remove("hidden");
      elements.resultEmpty.classList.add("hidden");
      elements.resultContent.classList.remove("hidden");
      actions.syncWorkspaceMode(false);
      actions.syncResultsView();
    }

    function showValidationIssues() {
      elements.successContent.classList.add("hidden");
      elements.resultEmpty.classList.add("hidden");
      elements.resultContent.classList.remove("hidden");
      elements.issuesBox.classList.remove("hidden");
      actions.syncWorkspaceMode(false);
      actions.syncResultsView();
    }

    function clearTaggedLists() {
      Object.values(elements.taggedLists).forEach((list) => list?.replaceChildren());
    }

    function clearRecommendations() {
      elements.recommendationsList.replaceChildren();
      elements.recommendationsSummary.textContent =
        "Bracket-directed card suggestions appear here after analysis.";
      elements.recommendationsListAdvanced?.replaceChildren();
      if (elements.recommendationsSummaryAdvanced) {
        elements.recommendationsSummaryAdvanced.textContent =
          "Bracket-directed card suggestions appear here after analysis.";
      }
    }

    function clearCardBreakdown() {
      elements.cardBreakdownBody?.replaceChildren();
      if (elements.cardBreakdownCount) {
        elements.cardBreakdownCount.textContent = "0 cards";
      }
      if (elements.cardBreakdownSummary) {
        elements.cardBreakdownSummary.textContent =
          "Card-level role detection appears here after analysis.";
      }
    }

    return {
      resetResultState,
      markDeckAsEdited,
      prepareForNewScan,
      showAnalysisResults,
      showValidationIssues,
    };
  },
};
