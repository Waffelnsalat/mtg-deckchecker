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
    }

    function reset() {
      elements.findingsList.replaceChildren();
      elements.curveBars.replaceChildren();
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
