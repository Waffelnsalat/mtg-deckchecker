window.MtgDeckcheckerStructureOverview = {
  create({ elements }) {
    function render(deckDocument, structure) {
      const deckSize = deckDocument.result.resolvedCards
        .filter((item) => item.section === "commander" || item.section === "mainboard")
        .reduce((sum, item) => sum + item.quantity, 0);

      elements.structureScore.textContent = String(structure.structureScore);
      elements.landCount.textContent = String(structure.counts.lands);
      elements.creatureCount.textContent = String(structure.counts.creatures);
      elements.averageManaValue.textContent = structure.mana.averageManaValue.toFixed(2);
      elements.resolvedCount.textContent = String(deckDocument.result.resolvedCount);
      elements.uniqueCount.textContent = String(deckDocument.parse.uniqueCards);
      elements.totalCount.textContent = String(deckSize);
      elements.instantCount.textContent = String(structure.counts.instants);
      elements.sorceryCount.textContent = String(structure.counts.sorceries);
      elements.artifactCount.textContent = String(structure.counts.artifacts);
      elements.enchantmentCount.textContent = String(structure.counts.enchantments);
      elements.planeswalkerCount.textContent = String(structure.counts.planeswalkers);
      elements.battleCount.textContent = String(structure.counts.battles);
      elements.recommendedLands.textContent =
        `${structure.mana.recommendedLands.min}-${structure.mana.recommendedLands.max}`;
      elements.medianManaValue.textContent = structure.mana.medianManaValue.toFixed(2);
      elements.landFit.textContent = formatFindingLabel(structure.findings[0]);
      elements.curveProfile.textContent = formatFindingLabel(structure.findings[2]);
      elements.earlyShare.textContent = formatPercent(structure.mana.shares.early);
      elements.lateShare.textContent = formatPercent(structure.mana.shares.late);

      applyScoreTone(elements.structureScore, structure.structureScore);
      renderFindings(structure.findings);
      renderManaCurve(structure.mana.curve);
      renderCompositionChart(deckDocument.result.resolvedCards);
    }

    function reset() {
      elements.findingsList.replaceChildren();
      elements.curveBars.replaceChildren();
      elements.compositionChart?.replaceChildren();
    }

    function renderManaCurve(curve) {
      const buckets = [
        { label: "0-1", count: curve.zeroToOne },
        { label: "2", count: curve.two },
        { label: "3", count: curve.three },
        { label: "4", count: curve.four },
        { label: "5", count: curve.five },
        { label: "6+", count: curve.sixPlus },
      ];
      const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);
      const bars = buckets.map((bucket) => {
        const item = document.createElement("article");
        item.className = "curve-item";

        const value = document.createElement("span");
        value.className = "curve-value";
        value.textContent = String(bucket.count);

        const bar = document.createElement("div");
        bar.className = "curve-bar";
        bar.style.height = `${Math.max(16, Math.round((bucket.count / maxCount) * 120))}px`;

        const label = document.createElement("span");
        label.className = "curve-label";
        label.textContent = bucket.label;

        item.append(value, bar, label);
        return item;
      });

      elements.curveBars.replaceChildren(...bars);
    }

    function renderCompositionChart(resolvedCards) {
      if (!elements.compositionChart) {
        return;
      }

      const bucketMap = new Map([
        ["land", { label: "Lands", count: 0, color: "land" }],
        ["creature", { label: "Creatures", count: 0, color: "creature" }],
        ["instant", { label: "Instants", count: 0, color: "instant" }],
        ["sorcery", { label: "Sorceries", count: 0, color: "sorcery" }],
        ["artifact", { label: "Artifacts", count: 0, color: "artifact" }],
        ["enchantment", { label: "Enchantments", count: 0, color: "enchantment" }],
        ["planeswalker", { label: "Planeswalkers", count: 0, color: "planeswalker" }],
        ["battle", { label: "Battles", count: 0, color: "battle" }],
        ["other", { label: "Other", count: 0, color: "other" }],
      ]);

      for (const entry of resolvedCards ?? []) {
        if (entry.section !== "commander" && entry.section !== "mainboard") {
          continue;
        }

        const bucket = bucketMap.get(getPrimaryCardType(entry.card.type_line ?? "")) ?? bucketMap.get("other");
        bucket.count += entry.quantity;
      }

      const buckets = [...bucketMap.values()].filter((bucket) => bucket.count > 0);
      const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

      if (total <= 0) {
        elements.compositionChart.replaceChildren();
        return;
      }

      const stackedBar = document.createElement("div");
      stackedBar.className = "composition-stacked-bar";

      const legend = document.createElement("div");
      legend.className = "composition-legend";

      for (const bucket of buckets) {
        const share = bucket.count / total;
        const segment = document.createElement("span");
        segment.className = `composition-segment composition-segment-${bucket.color}`;
        segment.style.flexGrow = String(Math.max(0.02, share));
        segment.title = `${bucket.label}: ${bucket.count} (${formatPercent(share)})`;
        stackedBar.append(segment);

        const item = document.createElement("span");
        item.className = `composition-legend-item composition-legend-${bucket.color}`;
        item.textContent = `${bucket.label} ${bucket.count}`;
        legend.append(item);
      }

      elements.compositionChart.replaceChildren(stackedBar, legend);
    }

    function getPrimaryCardType(typeLine) {
      if (/\bland\b/i.test(typeLine)) {
        return "land";
      }
      if (/\bcreature\b/i.test(typeLine)) {
        return "creature";
      }
      if (/\binstant\b/i.test(typeLine)) {
        return "instant";
      }
      if (/\bsorcery\b/i.test(typeLine)) {
        return "sorcery";
      }
      if (/\bartifact\b/i.test(typeLine)) {
        return "artifact";
      }
      if (/\benchantment\b/i.test(typeLine)) {
        return "enchantment";
      }
      if (/\bplaneswalker\b/i.test(typeLine)) {
        return "planeswalker";
      }
      if (/\bbattle\b/i.test(typeLine)) {
        return "battle";
      }
      return "other";
    }

    function renderFindings(findings) {
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

      elements.findingsList.replaceChildren(...cards);
    }

    function applyScoreTone(element, score) {
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
      card.classList.add("score-card", `score-card-${getScoreTone(score)}`);
      card.style.setProperty("--score-ratio", String(Math.max(0, Math.min(1, score / 100))));
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

    function formatPercent(value) {
      return `${Math.round(value * 100)}%`;
    }

    function formatFindingLabel(finding) {
      if (!finding) {
        return "-";
      }

      return `${capitalize(finding.status)}: ${finding.title}`;
    }

    function capitalize(value) {
      return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
    }

    return {
      render,
      reset,
    };
  },
};
