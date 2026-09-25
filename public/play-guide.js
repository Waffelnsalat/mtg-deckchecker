window.MtgDeckcheckerPlayGuide = {
  create(elements) {
    const plans = {
      combo: ["Assemble card flow and mana before committing a combo piece.", "Keep the payoff protected; commit when the line is ready."],
      spellslinger: ["Set up mana and card flow before chaining spells.", "Save spells that matter for the payoff turn."],
      tokens: ["Develop token makers before spending your payoff cards.", "Build a board, then convert it into pressure."],
      aristocrats: ["Establish creatures or tokens before sacrifice payoffs.", "Line up an outlet, a payoff, and repeatable material."],
      reanimator: ["Fill the graveyard and secure a way to bring threats back.", "Time the reanimation spell around opposing graveyard interaction."],
      control: ["Develop mana while keeping answers available.", "Answer threats that stop your plan, then win with sustained advantage."],
      aggro: ["Play early threats and use your mana each turn.", "Apply pressure without committing every threat into a board wipe."],
      lands_matter: ["Make land drops and assemble land-based engines.", "Get repeatable value from lands before committing a finisher."],
      enchantress: ["Establish an enchantment payoff before chaining enchantments.", "Keep enough cards flowing to rebuild after removal."],
      artifacts: ["Develop artifact mana and the pieces that reward artifacts.", "Sequence the engine before spending your strongest payoff."],
    };

    function list(container, entries) {
      container.replaceChildren(...entries.map((entry) => {
        const item = document.createElement("li");
        item.textContent = entry;
        return item;
      }));
    }

    function names(analysis, role, limit = 2) {
      return (analysis?.[role]?.taggedCards ?? [])
        .filter((entry) => entry.section === "mainboard")
        .map((entry) => entry.name)
        .slice(0, limit);
    }

    function example(items) {
      return items.length ? ` Examples: ${items.join(", ")}.` : "";
    }

    function render(analysis, deckDocument) {
      const strategy = analysis?.strategy?.mainStrategy;
      const win = analysis?.winStrategy?.primaryPlan;
      const directions = plans[strategy?.key] ?? [
        "Build mana and card flow before committing your key cards.",
        "Develop the main strategy while keeping a backup route available.",
      ];
      elements.title.textContent = strategy ? `Playing ${strategy.label}` : "Finding Your Plan";
      elements.summary.textContent = strategy
        ? `Your main plan is ${strategy.label.toLowerCase()}${win ? `, with ${win.label.toLowerCase()} as the likely finish` : ""}. These are priorities, not guaranteed turn-by-turn plays.`
        : "The deck has no clear main strategy yet. Start with mana, card flow, and the cards that work together.";

      const ramp = names(analysis, "ramp");
      const draw = names(analysis, "draw");
      const payoff = (strategy?.keyCards ?? []).slice(0, 2);
      const turns = [
        ["Turn 1", "Make a land drop. If you have cheap mana or setup, develop it without spending key payoff pieces." + example(ramp)],
        ["Turn 2", "Prioritize reliable mana and a playable next turn; use card selection if your hand needs it." + example(ramp)],
        ["Turn 3", directions[0] + example(draw)],
        ["Turn 4", directions[1] + example(payoff)],
      ];
      elements.turns.replaceChildren(...turns.map(([title, copy]) => {
        const article = document.createElement("article");
        article.className = "play-guide-turn";
        const heading = document.createElement("h4");
        heading.textContent = title;
        const paragraph = document.createElement("p");
        paragraph.textContent = copy;
        article.append(heading, paragraph);
        return article;
      }));

      list(elements.priorities, [
        `First: ${directions[0]}`,
        `Next: ${directions[1]}`,
        win ? `Closing plan: ${win.label}. ${win.summary}` : "Find a repeatable way to turn your board into a win.",
        "Watch for opposing removal or disruption before committing cards you cannot replace.",
      ]);
      elements.handRules.textContent = "Look for 2–4 lands, a play in the first two turns, and a path to your main plan. Check that your lands actually cast your spells.";
      elements.handRead.textContent = "Draw an opening seven to see a hand-specific read.";
      elements.handReasons.replaceChildren();
      elements.drawButton.disabled = !deckDocument?.result?.resolvedCards?.some((entry) => entry.section === "mainboard");
    }

    function assessHand(hand, analysis) {
      if (!hand?.length) {
        elements.handRead.textContent = "No complete opening hand is available.";
        elements.handReasons.replaceChildren();
        return;
      }
      const cards = hand.map((entry) => entry.deckCard.card);
      const lands = cards.filter((card) => /\bland\b/i.test(card.type_line ?? "")).length;
      const early = cards.filter((card) => !/\bland\b/i.test(card.type_line ?? "") && Number(card.cmc) <= 2).length;
      const rampNames = new Set(names(analysis, "ramp", 200).map((name) => name.toLowerCase()));
      const earlyRamp = cards.some((card) => rampNames.has((card.name ?? "").toLowerCase()) && Number(card.cmc) <= 2);
      const notes = [`${lands} land${lands === 1 ? "" : "s"} and ${early} spell${early === 1 ? "" : "s"} costing at most two mana.`];
      if (earlyRamp) notes.push("Early mana development is available.");
      if (lands < 2) notes.push("Few lands: check carefully whether you can make your early plays.");
      if (lands > 4) notes.push("Many lands: check whether the remaining cards advance your plan.");
      if (!early) notes.push("No cheap spell: the hand may take several turns to develop.");
      const playable = lands >= 2 && lands <= 4 && early > 0;
      elements.handRead.textContent = playable
        ? "Promising starting point — check colors and your matchup before keeping."
        : "Consider a mulligan — this hand may struggle to develop early.";
      list(elements.handReasons, notes);
    }

    return { render, assessHand };
  },
};
