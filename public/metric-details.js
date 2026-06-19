window.MtgDeckcheckerMetricDetails = {
  create({ elements }) {
    function render(analysis) {
      const {
        landBase,
        ramp,
        draw,
        consistency,
        gameChangers,
        protection,
        recursion,
        winConditions,
        removal,
        spellInteraction,
      } = analysis;

      renderLandBase(landBase);
      renderRamp(ramp);
      renderDraw(draw);
      renderConsistency(consistency);
      renderGameChangers(gameChangers);
      renderProtection(protection);
      renderRecursion(recursion);
      renderFinishers(winConditions);
      renderRemoval(removal);
      renderSpellInteraction(spellInteraction);
    }

    function reset() {
      Object.values(elements.findings).forEach((list) => list?.replaceChildren());
    }

    function renderLandBase(landBase) {
      elements.landBase.score.textContent = String(landBase.landBaseScore);
      elements.landBase.reliableUntapped.textContent = String(landBase.counts.reliableUntapped);
      elements.landBase.alwaysTapped.textContent = String(landBase.counts.alwaysTapped);
      elements.landBase.conditionalTapped.textContent = String(landBase.counts.conditionalTapped);
      elements.landBase.fetch.textContent = String(landBase.counts.fetch);
      elements.landBase.typed.textContent = String(landBase.counts.typed);
      elements.landBase.utility.textContent = String(landBase.counts.utility);
      elements.landBase.colorlessOnly.textContent = String(landBase.counts.colorlessOnly);
      elements.landBase.costly.textContent = String(landBase.counts.costly);
      elements.landBase.target.textContent =
        `${landBase.recommendations.alwaysTappedMax} / ${landBase.recommendations.colorlessOnlyMax}`;
      applyScoreTone(elements.landBase.score, landBase.landBaseScore);
      renderFindings(landBase.findings, elements.findings.landBase);
    }

    function renderRamp(ramp) {
      elements.ramp.score.textContent = String(ramp.rampScore);
      elements.ramp.core.textContent = formatDecimal(ramp.counts.core);
      elements.ramp.stable.textContent = formatDecimal(ramp.counts.stable);
      elements.ramp.landAcceleration.textContent = formatDecimal(ramp.counts.landAcceleration);
      elements.ramp.burst.textContent = formatDecimal(ramp.counts.burst);
      elements.ramp.manaFixing.textContent = formatDecimal(ramp.counts.manaFixing);
      elements.ramp.costReduction.textContent = formatDecimal(ramp.counts.costReduction);
      elements.ramp.taggedCount.textContent = String(totalTaggedQuantity(ramp.taggedCards));
      elements.ramp.target.textContent =
        `${ramp.recommendations.coreTarget} / ${ramp.recommendations.stableTarget}`;
      applyScoreTone(elements.ramp.score, ramp.rampScore);
      renderFindings(ramp.findings, elements.findings.ramp);
    }

    function renderDraw(draw) {
      elements.draw.score.textContent = String(draw.drawScore);
      elements.draw.core.textContent = formatDecimal(draw.counts.core);
      elements.draw.raw.textContent = formatDecimal(draw.counts.draw);
      elements.draw.selection.textContent = formatDecimal(draw.counts.selection);
      elements.draw.repeatable.textContent = formatDecimal(draw.counts.repeatable);
      elements.draw.taggedCount.textContent = String(totalTaggedQuantity(draw.taggedCards));
      elements.draw.target.textContent =
        `${draw.recommendations.drawTarget} / ${draw.recommendations.repeatableTarget}`;
      applyScoreTone(elements.draw.score, draw.drawScore);
      renderFindings(draw.findings, elements.findings.draw);
    }

    function renderConsistency(consistency) {
      elements.consistency.score.textContent = String(consistency.consistencyScore);
      elements.consistency.core.textContent = formatDecimal(consistency.counts.core);
      elements.consistency.direct.textContent = formatDecimal(consistency.counts.direct);
      elements.consistency.restricted.textContent = formatDecimal(consistency.counts.restricted);
      elements.consistency.repeatable.textContent = formatDecimal(consistency.counts.repeatable);
      elements.consistency.land.textContent = formatDecimal(consistency.counts.land);
      elements.consistency.selectionSupport.textContent =
        formatDecimal(consistency.counts.selectionSupport);
      elements.consistency.taggedCount.textContent =
        String(totalTaggedQuantity(consistency.taggedCards));
      elements.consistency.target.textContent =
        `${formatDecimal(consistency.recommendations.coreTarget)} / ${formatDecimal(consistency.recommendations.directTarget)} / ${formatDecimal(consistency.recommendations.repeatableTarget)}`;
      applyScoreTone(elements.consistency.score, consistency.consistencyScore);
      renderFindings(consistency.findings, elements.findings.consistency);
    }

    function renderGameChangers(gameChangers) {
      elements.gameChangers.total.textContent = String(gameChangers.counts.total);
      elements.gameChangers.unique.textContent = String(gameChangers.counts.unique);
      elements.gameChangers.commander.textContent = String(gameChangers.counts.commander);
      elements.gameChangers.mainboard.textContent = String(gameChangers.counts.mainboard);
      elements.gameChangers.companion.textContent = String(gameChangers.counts.companion);
    }

    function renderProtection(protection) {
      elements.protection.score.textContent = String(protection.protectionScore);
      elements.protection.core.textContent = formatDecimal(protection.counts.core);
      elements.protection.broad.textContent = formatDecimal(protection.counts.broad);
      elements.protection.targeted.textContent = formatDecimal(protection.counts.targeted);
      elements.protection.equipment.textContent = formatDecimal(protection.counts.equipment);
      elements.protection.selfBounce.textContent = formatDecimal(protection.counts.selfBounce);
      elements.protection.flicker.textContent = formatDecimal(protection.counts.flicker);
      elements.protection.taggedCount.textContent =
        String(totalTaggedQuantity(protection.taggedCards));
      elements.protection.target.textContent =
        `${protection.recommendations.coreTarget} / ${protection.recommendations.broadTarget}`;
      applyScoreTone(elements.protection.score, protection.protectionScore);
      renderFindings(protection.findings, elements.findings.protection);
    }

    function renderRecursion(recursion) {
      elements.recursion.score.textContent = String(recursion.recursionScore);
      elements.recursion.core.textContent = formatDecimal(recursion.counts.core);
      elements.recursion.battlefield.textContent = formatDecimal(recursion.counts.battlefield);
      elements.recursion.hand.textContent = formatDecimal(recursion.counts.hand);
      elements.recursion.replay.textContent = formatDecimal(recursion.counts.replay);
      elements.recursion.mass.textContent = formatDecimal(recursion.counts.mass);
      elements.recursion.library.textContent = formatDecimal(recursion.counts.library);
      elements.recursion.taggedCount.textContent = String(totalTaggedQuantity(recursion.taggedCards));
      elements.recursion.target.textContent =
        `${recursion.recommendations.coreTarget} / ${recursion.recommendations.battlefieldTarget} / ${recursion.recommendations.replayTarget}`;
      applyScoreTone(elements.recursion.score, recursion.recursionScore);
      renderFindings(recursion.findings, elements.findings.recursion);
    }

    function renderFinishers(winConditions) {
      elements.finisher.score.textContent = String(winConditions.finisherScore);
      elements.finisher.core.textContent = formatDecimal(winConditions.counts.core);
      elements.finisher.combat.textContent = formatDecimal(winConditions.counts.combat);
      elements.finisher.direct.textContent = formatDecimal(winConditions.counts.direct);
      elements.finisher.alternate.textContent = formatDecimal(winConditions.counts.alternate);
      elements.finisher.repeatable.textContent = formatDecimal(winConditions.counts.repeatable);
      elements.finisher.combo.textContent = formatDecimal(winConditions.counts.combo);
      elements.finisher.comboLineCount.textContent = String(winConditions.combos.exactCount);
      elements.finisher.comboFinisherCount.textContent = String(winConditions.combos.finisherCount);
      elements.finisher.comboEngineCount.textContent = String(winConditions.combos.engineCount);
      elements.finisher.taggedCount.textContent =
        String(totalTaggedQuantity(winConditions.taggedCards));
      elements.finisher.comboNearMissCount.textContent = String(winConditions.combos.nearMissCount);
      elements.finisher.target.textContent =
        `${winConditions.recommendations.coreTarget} / ${winConditions.recommendations.combatTarget} / ${winConditions.recommendations.directTarget}`;
      applyScoreTone(elements.finisher.score, winConditions.finisherScore);
      renderFindings(winConditions.findings, elements.findings.finisher);
    }

    function renderRemoval(removal) {
      elements.removal.score.textContent = String(removal.removalScore);
      elements.removal.core.textContent = formatDecimal(removal.counts.core);
      elements.removal.targeted.textContent = formatDecimal(removal.counts.targeted);
      elements.removal.mass.textContent = formatDecimal(removal.counts.mass);
      elements.removal.tempo.textContent = formatDecimal(removal.counts.tempo);
      elements.removal.handAttack.textContent = formatDecimal(removal.counts.handAttack);
      elements.removal.taggedCount.textContent = String(totalTaggedQuantity(removal.taggedCards));
      elements.removal.target.textContent =
        `${removal.recommendations.targetedTarget} / ${removal.recommendations.massTarget} / ${removal.recommendations.tempoTarget}`;
      applyScoreTone(elements.removal.score, removal.removalScore);
      renderFindings(removal.findings, elements.findings.removal);
    }

    function renderSpellInteraction(spellInteraction) {
      elements.spellInteraction.score.textContent = String(spellInteraction.interactionScore);
      elements.spellInteraction.core.textContent = formatDecimal(spellInteraction.counts.core);
      elements.spellInteraction.hard.textContent = formatDecimal(spellInteraction.counts.hard);
      elements.spellInteraction.soft.textContent = formatDecimal(spellInteraction.counts.soft);
      elements.spellInteraction.tempo.textContent =
        formatDecimal(spellInteraction.counts.spellTempo);
      elements.spellInteraction.broad.textContent = formatDecimal(spellInteraction.counts.broad);
      elements.spellInteraction.stax.textContent =
        formatDecimal(spellInteraction.counts.stax ?? 0);
      elements.spellInteraction.graveyardHate.textContent =
        formatDecimal(spellInteraction.counts.graveyardHate ?? 0);
      elements.spellInteraction.taggedCount.textContent =
        String(totalTaggedQuantity(spellInteraction.taggedCards));
      elements.spellInteraction.target.textContent =
        `${spellInteraction.recommendations.hardTarget} / ${spellInteraction.recommendations.softTarget}`;
      applyScoreTone(elements.spellInteraction.score, spellInteraction.interactionScore);
      renderFindings(spellInteraction.findings, elements.findings.spellInteraction);
    }

    function renderFindings(findings, listElement) {
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

      listElement.replaceChildren(...cards);
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

    function totalTaggedQuantity(taggedCards) {
      return taggedCards.reduce((total, card) => total + card.quantity, 0);
    }

    function formatDecimal(value) {
      const rounded = Math.round(value * 10) / 10;
      return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }

    return {
      render,
      reset,
    };
  },
};
