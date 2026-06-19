window.MtgDeckcheckerSummaryPanels = {
  create({ elements }) {
    function render(analysis) {
      renderPower(analysis.power, analysis.strategy);
      renderBracket(analysis.bracket);
      renderCommander(analysis.commander);
    }

    function reset() {
      elements.power.strengthsList.replaceChildren();
      elements.power.weaknessesList.replaceChildren();
      elements.bracket.findingsList.replaceChildren();
      elements.commander.findingsList.replaceChildren();
    }

    function renderPower(power, strategy) {
      elements.power.summary.textContent = power.summary;
      elements.power.score.textContent = `${power.powerScore.toFixed(1)} / 10`;
      elements.power.synergy.textContent = String(strategy.synergy?.synergyScore ?? 0);

      setPowerDimension("speed", power);
      setPowerDimension("consistency", power);
      setPowerDimension("interaction", power);
      setPowerDimension("resilience", power);
      setPowerDimension("closing", power);
      setPowerDimension("mana", power);

      applyScoreTone(elements.power.score, power.powerIndex);
      applyScoreTone(elements.power.synergy, strategy.synergy?.synergyScore ?? 0);
      renderSimpleList(
        elements.power.strengthsList,
        power.strengths,
        "No single pillar clearly stands above the rest of the shell yet.",
      );
      renderSimpleList(
        elements.power.weaknessesList,
        power.weaknesses,
        "No major brake stands out yet.",
      );
    }

    function renderBracket(bracket) {
      elements.bracket.summary.textContent = bracket.summary;
      elements.bracket.recommended.textContent = bracket.recommendedLabel;
      elements.bracket.target.textContent = bracket.targetLabel
        ? `${bracket.targetLabel} | ${bracket.targetName}`
        : "Not set";
      elements.bracket.powerRead.textContent = `${bracket.powerLabel} | ${bracket.powerName}`;
      elements.bracket.rulesFloor.textContent = bracket.rulesFloorLabel;
      elements.bracket.gameChangers.textContent = String(bracket.signals.gameChangers);
      elements.bracket.twoCardCombos.textContent = String(bracket.signals.twoCardCombos);
      elements.bracket.extraTurns.textContent = String(bracket.signals.extraTurns);
      elements.bracket.landDenial.textContent = String(bracket.signals.massLandDenial);
      renderFindings(bracket.findings, elements.bracket.findingsList);
    }

    function renderCommander(commander) {
      elements.commander.summary.textContent = commander.summary;
      elements.commander.impactScore.textContent = String(Math.round(commander.impactScore));
      elements.commander.dependencyScore.textContent =
        String(Math.round(commander.dependencyScore));
      elements.commander.ceilingScore.textContent = String(Math.round(commander.ceilingScore));
      elements.commander.comboLines.textContent = String(commander.commanderInvolvedCombos);
      elements.commander.priorScore.textContent = String(commander.prior.score);
      elements.commander.keyRoles.textContent =
        commander.keyRoles.length > 0 ? commander.keyRoles.join(" | ") : "Low";

      applyScoreTone(elements.commander.impactScore, commander.impactScore);
      applyScoreTone(elements.commander.dependencyScore, commander.dependencyScore);
      applyScoreTone(elements.commander.ceilingScore, commander.ceilingScore);
      renderFindings(commander.findings, elements.commander.findingsList);
    }

    function setPowerDimension(key, power) {
      const score = getPowerDimensionScore(power, key);
      const element = elements.power.dimensions[key];
      element.textContent = formatWholeScore(score);
      applyScoreTone(element, score);
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

    function renderSimpleList(listElement, values, emptyMessage) {
      const items = values.length > 0
        ? values.map(createListItem)
        : [createListItem(emptyMessage)];
      listElement.replaceChildren(...items);
    }

    function createListItem(text) {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
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

    function getPowerDimensionScore(power, key) {
      return power.dimensions.find((dimension) => dimension.key === key)?.score ?? 0;
    }

    function formatWholeScore(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        return "0";
      }

      return String(Math.round(number));
    }

    return {
      render,
      reset,
    };
  },
};
