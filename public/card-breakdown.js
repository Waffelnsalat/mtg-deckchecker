window.MtgDeckcheckerCardBreakdown = {
  create({
    elements,
    config,
    helpers,
    getCurrentAnalysis,
  }) {
    let searchText = "";
    let sectionMode = "all";
    let roleMode = "all";
    let sortMode = "value_desc";

    const synergyLabels = config.synergyLabels;
    const lowSignalLandTags = config.lowSignalLandTags;
    const hiddenTagStats = new Set(
      [...(config.hiddenTagStats ?? [])].map((tag) => helpers.normalizeText(tag)),
    );
    const tagStatAliases = buildTagStatAliasMap(config.tagStatAliases ?? {});
    const rolePriority = config.rolePriority;
    const maxRoles = config.maxRoles;
    const maxRoleDetails = config.maxRoleDetails ?? 4;

    function initializeControls() {
      elements.search?.addEventListener("input", () => {
        searchText = elements.search.value;
        rerender();
      });

      elements.sectionFilter?.addEventListener("change", () => {
        sectionMode = elements.sectionFilter.value || "all";
        rerender();
      });

      elements.roleFilter?.addEventListener("change", () => {
        roleMode = elements.roleFilter.value || "all";
        rerender();
      });

      elements.sort?.addEventListener("change", () => {
        sortMode = elements.sort.value || "value_desc";
        rerender();
      });
    }

    function rerender() {
      const current = getCurrentAnalysis();
      if (!current.document || !current.analysis) {
        return;
      }

      render(current.document, current.analysis);
    }

    function render(deckDocument, analysis) {
      if (!elements.body) {
        return;
      }

      const rows = buildRows(deckDocument, analysis);
      const filteredRows = sortRows(filterRows(rows));
      const roleRows = filteredRows.filter((row) => row.roles.length > 0).length;
      const totalEntries = filteredRows.reduce((sum, row) => sum + row.quantity, 0);
      const totalRows = rows.length;
      const totalCards = rows.reduce((sum, row) => sum + row.quantity, 0);

      if (elements.count) {
        elements.count.textContent = `${filteredRows.length} entries / ${totalEntries} cards`;
      }

      if (elements.summary) {
        elements.summary.textContent =
          rows.length > 0
            ? `${roleRows} of ${filteredRows.length} shown entries have meaningful roles. Showing ${filteredRows.length} of ${totalRows} entries and ${totalEntries} of ${totalCards} cards. Baseline mana-source lands are hidden unless they affect speed, fixing, or utility.`
            : "Card-level role detection appears here after analysis.";
      }

      renderTagStats(buildTagStats(analysis));

      const renderedRows = filteredRows.map((row) => createRow(row));
      if (renderedRows.length === 0) {
        const emptyState = document.createElement("p");
        emptyState.className = "card-breakdown-empty";
        emptyState.textContent = rows.length === 0
          ? "No resolved cards are available yet."
          : "No cards match the current search and filter settings.";
        elements.body.replaceChildren(emptyState);
        return;
      }

      elements.body.replaceChildren(...renderedRows);
    }

    function buildRows(deckDocument, analysis) {
      const roleIndex = buildRoleIndex(analysis);

      return (deckDocument?.result?.resolvedCards ?? [])
        .filter((deckCard) => ["commander", "mainboard", "companion"].includes(deckCard.section))
        .map((deckCard, index) => {
          const lookupKey = getLookupKey(deckCard);
          const mergedRoles = mergeRoles(
            roleIndex.get(lookupKey) ?? [],
            roleIndex.get(getNameKey(deckCard.card.name)) ?? [],
          );
          const displayRoles = limitRoles(mergedRoles);

          return {
            index,
            name: deckCard.card.name,
            section: deckCard.section,
            quantity: deckCard.quantity,
            manaValue: deckCard.card.cmc ?? 0,
            typeLine: deckCard.card.type_line ?? "-",
            colors: deckCard.card.color_identity ?? [],
            imageUrl: helpers.getCardImageUrl(deckCard.card),
            scryfallUri: deckCard.card.scryfall_uri,
            roles: displayRoles,
          };
        })
        .sort((left, right) => {
          const sectionOrder = getSectionSortOrder(left.section) - getSectionSortOrder(right.section);
          if (sectionOrder !== 0) {
            return sectionOrder;
          }

          const roleOrder = right.roles.length - left.roles.length;
          if (roleOrder !== 0 && left.section !== "commander") {
            return roleOrder;
          }

          return left.index - right.index;
        });
    }

    function filterRows(rows) {
      const query = helpers.normalizeText(searchText);

      return rows.filter((row) => {
        if (sectionMode !== "all" && row.section !== sectionMode) {
          return false;
        }

        const impact = getImpact(row);
        if (roleMode === "tagged" && row.roles.length === 0) {
          return false;
        }
        if (roleMode === "none" && row.roles.length > 0) {
          return false;
        }
        if (["strong", "useful", "minor"].includes(roleMode) && impact.tier !== roleMode) {
          return false;
        }

        if (!query) {
          return true;
        }

        return getSearchText(row).includes(query);
      });
    }

    function sortRows(rows) {
      const sortedRows = [...rows];
      sortedRows.sort((left, right) => {
        switch (sortMode) {
          case "value_asc":
            return getOverall(left.roles).score - getOverall(right.roles).score ||
              left.name.localeCompare(right.name);
          case "name_asc":
            return left.name.localeCompare(right.name);
          case "name_desc":
            return right.name.localeCompare(left.name);
          case "mv_asc":
            return left.manaValue - right.manaValue || left.name.localeCompare(right.name);
          case "mv_desc":
            return right.manaValue - left.manaValue || left.name.localeCompare(right.name);
          case "section":
            return getSectionSortOrder(left.section) - getSectionSortOrder(right.section) ||
              left.index - right.index;
          case "value_desc":
          default:
            return getOverall(right.roles).score - getOverall(left.roles).score ||
              left.name.localeCompare(right.name);
        }
      });
      return sortedRows;
    }

    function getSearchText(row) {
      return helpers.normalizeText([
        row.name,
        row.section,
        row.typeLine,
        row.colors.join(" "),
        ...row.roles.flatMap((role) => [role.label, ...(role.tags ?? [])]),
      ].join(" "));
    }

    function buildRoleIndex(analysis) {
      const roleIndex = new Map();

      addTaggedCards(roleIndex, analysis?.commander?.taggedCommanders, {
        label: "Commander",
        valueKey: "roleValue",
      });
      addTaggedCards(roleIndex, analysis?.gameChangers?.taggedCards, {
        label: "Game Changer",
        valueKey: null,
      });
      addTaggedCards(roleIndex, analysis?.landBase?.taggedCards, {
        label: "Land Base",
        valueKey: "landValue",
      });
      addTaggedCards(roleIndex, analysis?.ramp?.taggedCards, {
        label: "Ramp",
        valueKey: "rampValue",
      });
      addTaggedCards(roleIndex, analysis?.draw?.taggedCards, {
        label: "Card Flow",
        valueKey: "drawValue",
      });
      addTaggedCards(roleIndex, analysis?.consistency?.taggedCards, {
        label: "Consistency",
        valueKey: "consistencyValue",
      });
      addTaggedCards(roleIndex, analysis?.removal?.taggedCards, {
        label: "Removal",
        valueKey: "removalValue",
      });
      addTaggedCards(roleIndex, analysis?.spellInteraction?.taggedCards, {
        label: "Spell Interaction",
        valueKey: "interactionValue",
      });
      addTaggedCards(roleIndex, analysis?.protection?.taggedCards, {
        label: "Protection",
        valueKey: "protectionValue",
      });
      addTaggedCards(roleIndex, analysis?.recursion?.taggedCards, {
        label: "Recursion",
        valueKey: "recursionValue",
      });
      addTaggedCards(roleIndex, analysis?.winConditions?.taggedCards, {
        label: "Wincon",
        valueKey: "finisherValue",
      });
      addAdvancedTaggedCards(roleIndex, analysis?.advancedRoles?.taggedCards);

      addNameList(roleIndex, analysis?.strategy?.mainStrategy?.keyCards, "Strategy", 1);
      for (const entry of analysis?.strategy?.subStrategies ?? []) {
        addNameList(roleIndex, entry.keyCards, "Substrategy", 0.5);
      }
      addNameList(roleIndex, analysis?.winStrategy?.primaryPlan?.keyCards, "Win Plan", 1);
      for (const combo of analysis?.winConditions?.combos?.exact ?? []) {
        addNameList(roleIndex, combo.cardNames, "Combo Line", combo.comboValue ?? 1);
      }

      return roleIndex;
    }

    function buildTagStats(analysis) {
      const assignments = new Map();
      const addTaggedCards = (taggedCards = []) => {
        for (const taggedCard of taggedCards ?? []) {
          if (!taggedCard?.name) {
            continue;
          }

          const quantity = Math.max(1, Number(taggedCard.quantity ?? 1) || 1);
          const section = taggedCard.section ?? "card";
          const nameKey = helpers.normalizeText(taggedCard.name);
          const seenTags = new Set();

          for (const hit of taggedCard.hits ?? []) {
            const rawTag = String(hit?.tag ?? "").trim();
            if (!rawTag) {
              continue;
            }

            const tagKey = helpers.normalizeText(rawTag);
            if (isHiddenTagStat(rawTag)) {
              continue;
            }

            const label = getTagStatLabel(rawTag);
            const labelKey = helpers.normalizeText(label);
            const dedupeKey = labelKey || tagKey;
            if (seenTags.has(dedupeKey)) {
              continue;
            }
            seenTags.add(dedupeKey);

            const assignmentKey = `${section}:${nameKey}:${dedupeKey}`;
            const existing = assignments.get(assignmentKey);
            if (!existing || quantity > existing.quantity) {
              assignments.set(assignmentKey, {
                rawTag,
                label,
                quantity,
              });
            }
          }
        }
      };

      addTaggedCards(analysis?.commander?.taggedCommanders);
      addTaggedCards(analysis?.gameChangers?.taggedCards);
      addTaggedCards(analysis?.landBase?.taggedCards);
      addTaggedCards(analysis?.ramp?.taggedCards);
      addTaggedCards(analysis?.draw?.taggedCards);
      addTaggedCards(analysis?.consistency?.taggedCards);
      addTaggedCards(analysis?.removal?.taggedCards);
      addTaggedCards(analysis?.spellInteraction?.taggedCards);
      addTaggedCards(analysis?.protection?.taggedCards);
      addTaggedCards(analysis?.recursion?.taggedCards);
      addTaggedCards(analysis?.winConditions?.taggedCards);
      addTaggedCards(analysis?.advancedRoles?.taggedCards);

      const totals = new Map();
      for (const assignment of assignments.values()) {
        const key = helpers.normalizeText(assignment.label) || helpers.normalizeText(assignment.rawTag);
        const current = totals.get(key) ?? {
          label: assignment.label,
          count: 0,
        };
        current.count += assignment.quantity;
        totals.set(key, current);
      }

      return [...totals.values()]
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
    }

    function isHiddenTagStat(rawTag) {
      const rawKey = helpers.normalizeText(rawTag);
      const labelKey = helpers.normalizeText(helpers.formatTagLabel(rawTag));
      return hiddenTagStats.has(rawKey) || hiddenTagStats.has(labelKey);
    }

    function buildTagStatAliasMap(aliases) {
      const map = new Map();
      for (const [rawTag, label] of Object.entries(aliases ?? {})) {
        map.set(helpers.normalizeText(rawTag), String(label));
        map.set(helpers.normalizeText(helpers.formatTagLabel(rawTag)), String(label));
      }
      return map;
    }

    function getTagStatLabel(rawTag) {
      const rawKey = helpers.normalizeText(rawTag);
      const label = helpers.formatTagLabel(rawTag);
      const labelKey = helpers.normalizeText(label);
      return tagStatAliases.get(rawKey) ?? tagStatAliases.get(labelKey) ?? label;
    }

    function renderTagStats(stats) {
      if (!elements.tagStats) {
        return;
      }

      if (!stats.length) {
        const empty = document.createElement("p");
        empty.className = "card-breakdown-tag-empty";
        empty.textContent = "No analyzer tags detected yet.";
        elements.tagStats.replaceChildren(empty);
        return;
      }

      const maxCount = Math.max(...stats.map((stat) => stat.count), 1);
      elements.tagStats.replaceChildren(...stats.map((stat) => createTagStatRow(stat, maxCount)));
    }

    function createTagStatRow(stat, maxCount) {
      const row = document.createElement("div");
      row.className = "card-breakdown-tag-stat";
      row.style.setProperty("--tag-stat-ratio", String(Math.max(0, Math.min(1, stat.count / maxCount))));

      const label = document.createElement("span");
      label.className = "card-breakdown-tag-stat-label";
      label.textContent = stat.label;

      const count = document.createElement("strong");
      count.className = "card-breakdown-tag-stat-count";
      count.textContent = String(stat.count);

      const track = document.createElement("span");
      track.className = "card-breakdown-tag-stat-track";
      const fill = document.createElement("span");
      fill.className = "card-breakdown-tag-stat-fill";
      track.append(fill);

      row.title = `${stat.label}: ${stat.count}`;
      row.append(label, count, track);
      return row;
    }

    function addAdvancedTaggedCards(roleIndex, taggedCards = []) {
      for (const taggedCard of taggedCards ?? []) {
        if (!taggedCard.name || !taggedCard.section) {
          continue;
        }

        for (const hit of taggedCard.hits ?? []) {
          if (!hit?.tag) {
            continue;
          }

          const label = helpers.formatTagLabel(hit.tag);
          if (isRoleAlreadyCovered(roleIndex, taggedCard, label)) {
            continue;
          }

          addRole(roleIndex, taggedCard.name, taggedCard.section, {
            label,
            value: Number(hit.weight ?? 0),
            tags: [],
          });
        }
      }
    }

    function isRoleAlreadyCovered(roleIndex, taggedCard, label) {
      const keys = [
        `${taggedCard.section}:${helpers.normalizeText(taggedCard.name)}`,
        getNameKey(taggedCard.name),
      ];

      return keys.some((key) =>
        (roleIndex.get(key) ?? []).some((role) =>
          role.label === label || (role.tags ?? []).includes(label),
        ),
      );
    }

    function addTaggedCards(roleIndex, taggedCards = [], options) {
      for (const taggedCard of taggedCards ?? []) {
        const tags = getHitTags(taggedCard);
        const value = options.valueKey ? Number(taggedCard[options.valueKey] ?? 0) : 1;
        addRole(roleIndex, taggedCard.name, taggedCard.section, {
          label: options.label,
          value,
          tags,
        });
      }
    }

    function addNameList(roleIndex, names = [], label, value) {
      for (const name of names ?? []) {
        addRole(roleIndex, name, null, {
          label,
          value,
          tags: [],
        });
      }
    }

    function addRole(roleIndex, name, section, role) {
      if (!name) {
        return;
      }

      const displayRole = getDisplayRole(role);
      if (shouldHideLowSignalRole(displayRole)) {
        return;
      }

      const keys = section ? [`${section}:${helpers.normalizeText(name)}`] : [getNameKey(name)];
      for (const key of keys) {
        const roles = roleIndex.get(key) ?? [];
        const existing = roles.find((entry) => entry.label === displayRole.label);
        if (existing) {
          existing.value = Math.max(existing.value, displayRole.value);
          existing.tags = Array.from(new Set([...existing.tags, ...displayRole.tags]));
        } else {
          roles.push({
            label: displayRole.label,
            value: displayRole.value,
            tags: displayRole.tags,
          });
        }
        roleIndex.set(key, roles);
      }
    }

    function mergeRoles(...roleGroups) {
      const merged = [];
      for (const role of roleGroups.flat()) {
        const existing = merged.find((entry) => entry.label === role.label);
        if (existing) {
          existing.value = Math.max(existing.value, role.value);
          existing.tags = Array.from(new Set([...existing.tags, ...role.tags]));
        } else {
          merged.push({
            label: role.label,
            value: role.value,
            tags: [...role.tags],
          });
        }
      }
      return merged;
    }

    function getHitTags(taggedCard) {
      return (taggedCard.hits ?? [])
        .map((hit) => hit.tag)
        .filter(Boolean)
        .map(helpers.formatTagLabel);
    }

    function getDisplayRole(role) {
      const rawLabel = String(role.label ?? "");
      const rawTags = (role.tags ?? []).map((tag) => String(tag)).filter(Boolean);
      const normalizedParts = [rawLabel, ...rawTags].map(helpers.normalizeText);
      const hasPart = (...patterns) =>
        normalizedParts.some((part) => patterns.some((pattern) => part.includes(pattern)));

      let label = "Utility";
      if (hasPart("strategy", "substrategy", "win plan", "token support", "counter support", "artifact support", "enchantment support", "kindred support", "sacrifice support", "replacement engine", "multiplier support", "land synergy", "dungeon support", "dice support", "coin support", "energy support", "mill support", "theft support", "donation support", "copy support", "tempo support", "lifegain")) {
        label = "Synergy";
      } else if (hasPart("game changer")) {
        label = "Game Changer";
      } else if (hasPart("commander")) {
        label = "Commander";
      } else if (hasPart("combo line")) {
        label = "Combo";
      } else if (hasPart("wincon", "finisher", "win condition")) {
        label = "Win Condition";
      } else if (hasPart("consistency", "tutor")) {
        label = "Tutors";
      } else if (hasPart("card flow", "card draw", "draw", "selection", "repeatable advantage")) {
        label = "Draw";
      } else if (hasPart("ramp", "mana fixing", "cost reduction", "land acceleration")) {
        label = "Ramp";
      } else if (hasPart("removal", "hand attack")) {
        label = "Removal";
      } else if (hasPart("spell interaction", "stack", "stax", "graveyard hate", "hate piece")) {
        label = "Interaction";
      } else if (hasPart("protection", "self bounce", "flicker")) {
        label = "Protection";
      } else if (hasPart("recursion")) {
        label = "Recursion";
      } else if (hasPart("land base")) {
        label = "Land Base";
      } else if (hasPart("combat")) {
        label = "Combat";
      }

      const formattedLabel = helpers.formatTagLabel(rawLabel);
      const formattedTags = rawTags.map(helpers.formatTagLabel);
      const details = formattedTags.length > 0
        ? formattedTags
        : formattedLabel && formattedLabel !== label
          ? [formattedLabel]
          : [];

      return {
        label,
        value: Number.isFinite(role.value) ? role.value : 0,
        tags: Array.from(new Set(details.filter((tag) => tag && tag !== label))),
      };
    }

    function shouldHideLowSignalRole(role) {
      if (role.label !== "Land Base") {
        return false;
      }

      const tags = role.tags ?? [];
      return tags.length > 0 && tags.every((tag) => lowSignalLandTags.has(tag));
    }

    function limitRoles(roles) {
      return [...roles]
        .sort(compareDisplayRoles)
        .slice(0, maxRoles);
    }

    function compareDisplayRoles(left, right) {
      const synergyOrder = Number(!isSynergyRole(left)) - Number(!isSynergyRole(right));
      if (synergyOrder !== 0) {
        return synergyOrder;
      }

      const valueOrder = Number(right.value ?? 0) - Number(left.value ?? 0);
      if (valueOrder !== 0) {
        return valueOrder;
      }

      const priorityOrder = getRolePriority(left.label) - getRolePriority(right.label);
      if (priorityOrder !== 0) {
        return priorityOrder;
      }

      return left.label.localeCompare(right.label);
    }

    function isSynergyRole(role) {
      return synergyLabels.has(role.label);
    }

    function getRolePriority(label) {
      const index = rolePriority.indexOf(label);
      return index === -1 ? rolePriority.length : index;
    }

    function createRow(row) {
      const card = document.createElement("article");
      const impact = getImpact(row);
      card.className = `card-breakdown-card is-${impact.tier}`;

      const visual = document.createElement(row.scryfallUri ? "a" : "div");
      visual.className = "card-breakdown-visual";
      if (row.scryfallUri) {
        visual.href = row.scryfallUri;
        visual.target = "_blank";
        visual.rel = "noreferrer noopener";
        visual.title = `Open ${row.name} on Scryfall`;
      }

      if (row.imageUrl) {
        const image = document.createElement("img");
        image.className = "card-breakdown-image";
        image.src = row.imageUrl;
        image.alt = `${row.name} card image`;
        image.loading = "lazy";
        image.decoding = "async";
        image.referrerPolicy = "no-referrer";
        visual.append(image);
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "card-breakdown-image-placeholder";
        placeholder.textContent = row.name;
        visual.append(placeholder);
      }

      const content = document.createElement("div");
      content.className = "card-breakdown-content";

      const header = document.createElement("div");
      header.className = "card-breakdown-card-head";
      const titleWrap = document.createElement("div");
      titleWrap.className = "card-breakdown-title";
      const name = document.createElement("strong");
      name.textContent = row.name;
      const colors = document.createElement("span");
      colors.className = "card-breakdown-subtext";
      colors.textContent = row.colors.length > 0 ? row.colors.join("") : "Colorless";
      titleWrap.append(name, colors);

      const metaWrap = document.createElement("div");
      metaWrap.className = "card-breakdown-meta";
      const impactBadge = document.createElement("span");
      impactBadge.className = `card-breakdown-impact is-${impact.tier}`;
      impactBadge.textContent = impact.label;
      const sectionPill = document.createElement("span");
      sectionPill.className = "card-breakdown-section";
      sectionPill.textContent = `${helpers.formatTagLabel(row.section)} x${row.quantity}`;
      metaWrap.append(impactBadge, sectionPill);
      header.append(titleWrap, metaWrap);

      const facts = document.createElement("dl");
      facts.className = "card-breakdown-facts";
      facts.append(
        createFact("MV", helpers.formatOneDecimal(row.manaValue)),
        createFact("Type", row.typeLine),
      );

      const roles = document.createElement("div");
      roles.className = "card-breakdown-role-list";
      if (row.roles.length > 0) {
        roles.append(...row.roles.map(createRoleChip));
      } else {
        const empty = document.createElement("span");
        empty.className = "card-breakdown-muted";
        empty.textContent = "No role tagged";
        roles.append(empty);
      }

      content.append(header, facts, roles);

      card.append(visual, content);
      return card;
    }

    function getImpact(row) {
      const overall = getOverall(row.roles);
      if (overall.score <= 0) {
        return { tier: "none", label: "No role" };
      }

      switch (overall.tier) {
        case "strong":
          return { tier: "strong", label: "Core piece" };
        case "useful":
          return { tier: "useful", label: "Useful" };
        default:
          return { tier: "minor", label: "Minor" };
      }
    }

    function getOverall(roles) {
      if (!roles.length) {
        return { score: 0, scale: 10, tier: "none" };
      }

      const normalizedRoles = roles
        .map((role) => {
          const scale = getRoleScale(role);
          const value = Number(role.value) || 0;
          return Math.max(0, Math.min(1, value / scale));
        })
        .sort((left, right) => right - left);

      const scoreBase = normalizedRoles.reduce((sum, normalized, index) => {
        const weight = index === 0 ? 1 : index === 1 ? 0.55 : index === 2 ? 0.35 : 0.16;
        return sum + normalized * weight;
      }, 0);

      const score = Math.min(10, helpers.roundTo((scoreBase / 1.9) * 10, 1));
      return {
        score,
        scale: 10,
        tier: score >= 7 ? "strong" : score >= 4 ? "useful" : score > 0 ? "minor" : "none",
      };
    }

    function getRoleScale(role) {
      if (["Game Changer", "Commander", "Synergy", "Combo"].includes(role.label)) {
        return Math.max(1, role.value);
      }

      const value = Number(role.value) || 0;
      if (value <= 3) {
        return 3;
      }

      return Math.ceil(value / 3) * 3;
    }

    function createFact(label, value) {
      const item = document.createElement("div");
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = label;
      detail.textContent = value;
      item.append(term, detail);
      return item;
    }

    function createRoleChip(role) {
      const chip = document.createElement("span");
      chip.className = "card-breakdown-role-chip";

      const label = document.createElement("span");
      label.className = "card-breakdown-role-chip-label";
      label.textContent = role.label;
      chip.append(label);

      if (role.tags.length > 0) {
        const details = document.createElement("span");
        details.className = "card-breakdown-role-chip-details";
        details.textContent = formatRoleDetails(role.tags);
        chip.append(details);
        chip.title = role.tags.join(", ");
      }
      return chip;
    }

    function formatRoleDetails(tags) {
      const visibleTags = tags.slice(0, maxRoleDetails);
      const remaining = tags.length - visibleTags.length;
      return remaining > 0
        ? `${visibleTags.join(" / ")} +${remaining}`
        : visibleTags.join(" / ");
    }

    function getLookupKey(deckCard) {
      return `${deckCard.section}:${helpers.normalizeText(deckCard.card.name)}`;
    }

    function getNameKey(name) {
      return `card:${helpers.normalizeText(name)}`;
    }

    function getSectionSortOrder(section) {
      switch (section) {
        case "commander":
          return 0;
        case "companion":
          return 1;
        case "mainboard":
          return 2;
        default:
          return 3;
      }
    }

    return {
      initializeControls,
      render,
      rerender,
    };
  },
};
