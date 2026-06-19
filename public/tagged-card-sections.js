window.MtgDeckcheckerTaggedCardSections = {
  create({
    elements,
    config,
    helpers,
  }) {
    const tagLabels = config.tagLabels ?? {};
    const previewLimit = config.previewLimit ?? 4;
    const getCardImageUrl = helpers.getCardImageUrl;
    const findResolvedCardForTaggedName = helpers.findResolvedCardForTaggedName;

    function createListItem(text) {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }

    function renderTaggedCardSection({
      listElement,
      previewElement,
      taggedCards,
      emptyMessage,
      formatItem,
      getLookupName,
    }) {
      renderTaggedCardPreviewStrip(previewElement, taggedCards, { getLookupName });

      const items =
        taggedCards.length > 0
          ? taggedCards.map((taggedCard) => formatItem(taggedCard))
          : [createListItem(emptyMessage)];

      listElement.replaceChildren(...items);
    }

    function renderTaggedCardPreviewStrip(previewElement, taggedCards, options = {}) {
      if (!previewElement) {
        return;
      }

      const previews = taggedCards
        .map((taggedCard, index) => buildTaggedCardPreviewData(taggedCard, index, options))
        .filter(Boolean)
        .sort((left, right) => (
          right.priority - left.priority ||
          right.quantity - left.quantity ||
          left.index - right.index
        ))
        .slice(0, previewLimit)
        .map((preview) => createTaggedCardPreview(preview));

      previewElement.replaceChildren(...previews);
      previewElement.classList.toggle("hidden", previews.length === 0);
    }

    function buildTaggedCardPreviewData(taggedCard, index, options) {
      const lookupName = options.getLookupName?.(taggedCard) ?? taggedCard.name;
      const resolvedCard =
        findResolvedCardForTaggedName(lookupName) ?? findResolvedCardForTaggedName(taggedCard.name);
      const imageUrl = resolvedCard ? getCardImageUrl(resolvedCard.card) : null;

      if (!resolvedCard || !imageUrl) {
        return null;
      }

      return {
        index,
        imageUrl,
        priority: getTaggedCardPriority(taggedCard),
        quantity: Math.max(1, Number(taggedCard.quantity) || 1),
        resolvedCard,
      };
    }

    function getTaggedCardPriority(taggedCard) {
      const directValue = [
        "roleValue",
        "landValue",
        "rampValue",
        "drawValue",
        "consistencyValue",
        "protectionValue",
        "recursionValue",
        "finisherValue",
        "removalValue",
        "interactionValue",
      ]
        .map((key) => taggedCard[key])
        .find((value) => typeof value === "number");

      if (typeof directValue === "number") {
        return directValue;
      }

      if (Array.isArray(taggedCard.hits)) {
        return taggedCard.hits.reduce((sum, hit) => sum + (Number(hit.weight) || 0), 0);
      }

      return 0;
    }

    function createTaggedCardPreview(preview) {
      const {
        imageUrl,
        quantity,
        resolvedCard: { card },
      } = preview;

      const figure = document.createElement("figure");
      figure.className = "tagged-card-preview";

      const link = document.createElement("a");
      link.className = "tagged-card-preview-link";
      link.href = card.scryfall_uri;
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      link.title = `Open ${card.name} on Scryfall`;

      const image = document.createElement("img");
      image.className = "tagged-card-preview-image";
      image.src = imageUrl;
      image.alt = `${card.name} card image`;
      image.loading = "lazy";
      image.decoding = "async";
      link.append(image);

      if (quantity > 1) {
        const badge = document.createElement("span");
        badge.className = "tagged-card-preview-badge";
        badge.textContent = `${quantity}x`;
        link.append(badge);
      }

      const caption = document.createElement("figcaption");
      caption.className = "tagged-card-preview-caption";
      caption.textContent = card.name;

      figure.append(link, caption);
      return figure;
    }

    function formatTag(group, tag) {
      if (group === "tutor") {
        switch (tag) {
          case "direct_tutor":
            return "direct";
          case "restricted_tutor":
            return "restricted";
          case "repeatable_tutor":
            return "repeatable";
          case "land_tutor":
            return "land";
          default:
            return tag;
        }
      }

      return tagLabels[group]?.[tag] ?? tag;
    }

    function formatHitLabels(card, group) {
      return card.hits.map((hit) => formatTag(group, hit.tag)).join(", ");
    }

    function renderBasicCards({
      taggedCards,
      elements: sectionElements,
      tagGroup,
      emptyMessage,
    }) {
      renderTaggedCardSection({
        listElement: sectionElements.list,
        previewElement: sectionElements.preview,
        taggedCards,
        emptyMessage,
        formatItem: (card) => createListItem(
          `${card.quantity}x ${card.name} [${formatHitLabels(card, tagGroup)}]`,
        ),
      });
    }

    function renderRampCards(taggedCards) {
      renderBasicCards({
        taggedCards,
        elements: elements.ramp,
        tagGroup: "ramp",
        emptyMessage: "No ramp cards were detected from the wording rules.",
      });
    }

    function renderLandBaseCards(taggedCards) {
      renderBasicCards({
        taggedCards,
        elements: elements.landBase,
        tagGroup: "landBase",
        emptyMessage: "No special land traits were detected from the wording rules.",
      });
    }

    function renderCommanderCards(taggedCards) {
      renderTaggedCardSection({
        listElement: elements.commander.list,
        previewElement: elements.commander.preview,
        taggedCards,
        emptyMessage: "No major command-zone engine roles were detected from the wording rules.",
        formatItem: (card) => createListItem(
          `${card.name} [${formatHitLabels(card, "commanderRole")}]`,
        ),
      });
    }

    function renderCommanderProfiles(profiles = []) {
      const listElement = elements.commanderProfiles;
      if (!listElement) {
        return;
      }

      listElement.replaceChildren();

      if (!profiles.length) {
        const empty = document.createElement("p");
        empty.className = "muted-inline";
        empty.textContent = "No specific commander build-around profile was detected yet.";
        listElement.append(empty);
        return;
      }

      profiles.slice(0, 4).forEach((profile) => {
        const card = document.createElement("article");
        card.className = "commander-profile-card";

        const header = document.createElement("div");
        header.className = "commander-profile-header";

        const titleWrap = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = profile.label;
        const commander = document.createElement("span");
        commander.textContent = profile.commanderName;
        titleWrap.append(title, commander);

        const confidence = document.createElement("span");
        confidence.className = `profile-confidence ${getProfileConfidenceClass(profile.confidence)}`;
        confidence.textContent = `${Math.round(profile.confidence)}%`;

        header.append(titleWrap, confidence);

        const meter = document.createElement("div");
        meter.className = "profile-meter";
        const fill = document.createElement("span");
        fill.style.width = `${Math.max(4, Math.min(100, profile.confidence))}%`;
        meter.append(fill);

        const body = document.createElement("p");
        body.textContent = `${profile.supportCount}/${profile.supportTarget} support cards, ${profile.coreCount} core pieces. ${profile.supportReason}`;

        const chips = document.createElement("div");
        chips.className = "profile-chip-row";
        (profile.supportCards ?? []).slice(0, 5).forEach((name) => {
          const chip = document.createElement("span");
          chip.className = "role-chip";
          chip.textContent = name;
          chips.append(chip);
        });

        if (profile.missingPieces?.length) {
          const missing = document.createElement("div");
          missing.className = "profile-missing";
          missing.textContent = `Needs: ${profile.missingPieces.join(", ")}`;
          card.append(header, meter, body, chips, missing);
        } else {
          card.append(header, meter, body, chips);
        }

        listElement.append(card);
      });
    }

    function getProfileConfidenceClass(value) {
      if (value >= 72) {
        return "profile-confidence-good";
      }
      if (value >= 52) {
        return "profile-confidence-note";
      }
      return "profile-confidence-warning";
    }

    function renderDrawCards(taggedCards) {
      renderBasicCards({
        taggedCards,
        elements: elements.draw,
        tagGroup: "draw",
        emptyMessage: "No card-flow cards were detected from the wording rules.",
      });
    }

    function renderConsistencyCards(taggedCards) {
      renderBasicCards({
        taggedCards,
        elements: elements.consistency,
        tagGroup: "tutor",
        emptyMessage: "No tutors were detected from the wording rules.",
      });
    }

    function renderGameChangerCards(taggedCards) {
      renderTaggedCardSection({
        listElement: elements.gameChanger.list,
        previewElement: elements.gameChanger.preview,
        taggedCards,
        emptyMessage:
          "No official Game Changers were found in the commander, mainboard, or companion slot.",
        getLookupName: (card) => card.matchedName,
        formatItem: (card) => {
          const displayName =
            card.name === card.matchedName ? card.name : `${card.matchedName} (${card.name})`;
          return createListItem(
            `${card.quantity}x ${displayName} [${formatTag("deckSection", card.section)}]`,
          );
        },
      });
    }

    function renderRemovalCards(taggedCards) {
      renderBasicCards({
        taggedCards,
        elements: elements.removal,
        tagGroup: "removal",
        emptyMessage: "No removal cards were detected from the wording rules.",
      });
    }

    function renderProtectionCards(taggedCards) {
      renderBasicCards({
        taggedCards,
        elements: elements.protection,
        tagGroup: "protection",
        emptyMessage: "No protection cards were detected from the wording rules.",
      });
    }

    function renderRecursionCards(taggedCards) {
      renderBasicCards({
        taggedCards,
        elements: elements.recursion,
        tagGroup: "recursion",
        emptyMessage: "No recursion cards were detected from the wording rules.",
      });
    }

    function renderFinisherCards(taggedCards) {
      renderBasicCards({
        taggedCards,
        elements: elements.finisher,
        tagGroup: "finisher",
        emptyMessage: "No finishers were detected from the wording rules.",
      });
    }

    function renderComboLines(comboLookup) {
      const listElement = elements.comboLines;

      if (comboLookup.lookupStatus !== "ok") {
        listElement.replaceChildren(
          createListItem(
            comboLookup.error
              ? `Commander Spellbook combo lookup was unavailable for this scan. (${comboLookup.error})`
              : "Commander Spellbook combo lookup was unavailable for this scan.",
          ),
        );
        return;
      }

      if (comboLookup.exact.length === 0) {
        listElement.replaceChildren(
          createListItem("No exact infinite combo lines were found."),
        );
        return;
      }

      const items = comboLookup.exact.map((combo) => {
        const typeLabel = combo.lineType === "finisher" ? "finisher" : "engine";
        const outcomeLabel =
          combo.outcomeNames.length > 0 ? ` -> ${combo.outcomeNames.join("; ")}` : "";
        return createListItem(
          `[${typeLabel}] ${combo.cardNames.join(" + ")}${outcomeLabel}`,
        );
      });

      listElement.replaceChildren(...items);
    }

    function renderSpellInteractionCards(taggedCards) {
      renderBasicCards({
        taggedCards,
        elements: elements.spellInteraction,
        tagGroup: "spellInteraction",
        emptyMessage: "No spell-interaction cards were detected from the wording rules.",
      });
    }

    function render(analysis) {
      renderCommanderCards(analysis.commander.taggedCommanders);
      renderCommanderProfiles(analysis.commander.profiles);
      renderRampCards(analysis.ramp.taggedCards);
      renderLandBaseCards(analysis.landBase.taggedCards);
      renderDrawCards(analysis.draw.taggedCards);
      renderConsistencyCards(analysis.consistency.taggedCards);
      renderGameChangerCards(analysis.gameChangers.taggedCards);
      renderProtectionCards(analysis.protection.taggedCards);
      renderRecursionCards(analysis.recursion.taggedCards);
      renderFinisherCards(analysis.winConditions.taggedCards);
      renderComboLines(analysis.winConditions.combos);
      renderRemovalCards(analysis.removal.taggedCards);
      renderSpellInteractionCards(analysis.spellInteraction.taggedCards);
    }

    function clearPreviews() {
      [
        elements.commander.preview,
        elements.gameChanger.preview,
        elements.landBase.preview,
        elements.ramp.preview,
        elements.draw.preview,
        elements.consistency.preview,
        elements.removal.preview,
        elements.spellInteraction.preview,
        elements.protection.preview,
        elements.recursion.preview,
        elements.finisher.preview,
      ]
        .filter(Boolean)
        .forEach((previewElement) => {
          previewElement.replaceChildren();
          previewElement.classList.add("hidden");
        });
    }

    return {
      clearPreviews,
      render,
      renderCommanderCards,
      renderCommanderProfiles,
      renderConsistencyCards,
      renderDrawCards,
      renderFinisherCards,
      renderGameChangerCards,
      renderLandBaseCards,
      renderRampCards,
      renderRecursionCards,
      renderRemovalCards,
      renderComboLines,
      renderProtectionCards,
      renderSpellInteractionCards,
    };
  },
};
