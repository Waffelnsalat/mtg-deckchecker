window.MtgDeckcheckerRecommendations = {
  create({
    elements,
    topics,
    helpers,
    getRenderToken,
  }) {
    function render(recommendations, renderToken = getRenderToken()) {
      const topicMap = new Map((recommendations?.topics ?? []).map((topic) => [topic.key, topic]));
      const resolvedTopics = topics.map((topic) => {
        return (
          topicMap.get(topic.key) ?? {
            key: topic.key,
            label: topic.label,
            summary: "No card suggestion stands out here right now.",
            cards: [],
          }
        );
      });

      renderInto(elements.summary, elements.list, resolvedTopics, recommendations, renderToken);
      renderInto(
        elements.summaryAdvanced,
        elements.listAdvanced,
        resolvedTopics,
        recommendations,
        renderToken,
      );
    }

    function renderInto(summaryElement, listElement, resolvedTopics, recommendations, renderToken) {
      if (!summaryElement || !listElement) {
        return;
      }

      summaryElement.textContent =
        recommendations?.summary ?? "Bracket-directed card suggestions appear here after analysis.";
      listElement.replaceChildren(
        ...resolvedTopics.map((topic) => createTopicCard(topic, renderToken)),
      );
    }

    function createTopicCard(topic, renderToken) {
      const article = document.createElement("article");
      article.className = "recommendation-topic-card";

      const header = document.createElement("div");
      header.className = "recommendation-topic-header";

      const title = document.createElement("strong");
      title.className = "recommendation-topic-title";
      title.textContent = topic.label;

      const state = document.createElement("span");
      const direction = topic.cards[0]?.direction ?? null;
      state.className = `recommendation-topic-state recommendation-topic-state-${direction ?? "neutral"}`;
      state.textContent =
        direction === "up" ? "Push Up" : direction === "down" ? "Pull Down" : "Stable";
      header.append(title, state);

      const summary = document.createElement("p");
      summary.className = "recommendation-topic-summary";
      summary.textContent = topic.summary;

      article.append(header, summary);

      if (!topic.cards?.length) {
        const empty = document.createElement("p");
        empty.className = "recommendation-topic-empty";
        empty.textContent = "No card suggestion stands out here right now.";
        article.append(empty);
        return article;
      }

      const cardList = document.createElement("div");
      cardList.className = "recommendation-topic-card-list";
      cardList.append(
        ...topic.cards.map((card, index) =>
          createSuggestionVisual(card, renderToken, index, topic.cards.length),
        ),
      );
      article.append(cardList);
      return article;
    }

    function createSuggestionVisual(card, renderToken, index = 0, totalCards = 1) {
      const article = document.createElement("article");
      const strength = getStrength(index, totalCards);
      article.className = `recommendation-suggestion recommendation-suggestion-${card.direction} recommendation-suggestion-strength-${strength.level}`;

      const visual = document.createElement("a");
      visual.className = "recommendation-suggestion-visual";
      visual.href = helpers.buildScryfallSearchUrl(card.name);
      visual.target = "_blank";
      visual.rel = "noreferrer noopener";
      visual.title = `Open ${card.name} on Scryfall`;

      const image = document.createElement("img");
      image.className = "recommendation-suggestion-image hidden";
      image.alt = `${card.name} card image`;
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";

      const placeholder = document.createElement("span");
      placeholder.className = "recommendation-suggestion-placeholder";
      placeholder.textContent = buildCardInitials(card.name);

      const direction = document.createElement("span");
      direction.className = `recommendation-direction-badge recommendation-direction-badge-${card.direction}`;
      direction.textContent = getDirectionBadgeLabel(card.direction);
      direction.setAttribute(
        "aria-label",
        card.direction === "up"
          ? "This card would push the deck upward in power."
          : "This card would pull the deck downward in power.",
      );
      visual.append(image, placeholder, direction);

      const copy = document.createElement("div");
      copy.className = "recommendation-suggestion-copy";

      const title = document.createElement("strong");
      title.className = "recommendation-suggestion-title";
      title.textContent = card.name;

      const meta = document.createElement("div");
      meta.className = "recommendation-suggestion-meta";

      const strengthBadge = document.createElement("span");
      strengthBadge.className = `recommendation-strength-chip recommendation-strength-chip-${strength.level}`;
      strengthBadge.textContent = strength.label;

      meta.append(strengthBadge);
      const sourceChip = createSourceChip(card);
      if (sourceChip) {
        meta.append(sourceChip);
      }

      const reason = document.createElement("p");
      reason.className = "recommendation-suggestion-reason";
      reason.textContent = card.reason;

      copy.append(title, meta, reason);
      article.append(visual, copy);
      hydrateSuggestionVisual(card, { visual, image, placeholder }, renderToken);
      return article;
    }

    function buildCardInitials(name) {
      const words = String(name || "")
        .split(/[\s,/-]+/)
        .filter(Boolean)
        .slice(0, 2);

      return words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "?";
    }

    function getDirectionBadgeLabel(direction) {
      return direction === "up" ? "ADD" : "ADD-";
    }

    function getStrength(levelIndex, totalCards) {
      if (levelIndex <= 0) {
        return {
          level: "high",
          label: totalCards <= 1 ? "Top Pick" : "Best Fit",
        };
      }

      if (levelIndex === 1) {
        return {
          level: "medium",
          label: "Solid Fit",
        };
      }

      return {
        level: "low",
        label: "Optional",
      };
    }

    function createSourceChip(card) {
      const label = card.sourceLabel ?? buildSourceLabel(card);
      if (!label) {
        return null;
      }

      const chip = document.createElement("span");
      chip.className = `recommendation-source-chip recommendation-source-chip-${card.source ?? "library"}`;
      chip.textContent = label;
      return chip;
    }

    function buildSourceLabel(card) {
      if (Number.isFinite(card.recommanderRank) && Number.isFinite(card.recommanderScore)) {
        return `Recommander #${card.recommanderRank} - ${Math.round(card.recommanderScore * 100)}%`;
      }

      if (card.source === "recommander") {
        return "Recommander";
      }

      return "";
    }

    async function hydrateSuggestionVisual(card, elements, renderToken) {
      const visualData = await helpers.getCardVisual(card.name);
      if (
        renderToken !== getRenderToken() ||
        !elements.visual.isConnected ||
        !visualData?.imageUrl
      ) {
        return;
      }

      elements.visual.href = visualData.scryfallUrl ?? helpers.buildScryfallSearchUrl(card.name);
      elements.visual.title = `Open ${visualData.name ?? card.name} on Scryfall`;
      elements.image.src = visualData.imageUrl;
      elements.image.alt = `${visualData.name ?? card.name} card image`;
      elements.image.classList.remove("hidden");
      elements.placeholder.classList.add("hidden");
    }

    return {
      render,
    };
  },
};
