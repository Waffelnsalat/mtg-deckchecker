(function () {
  const MATERIAL_ONLY_TAGS = new Set([
    "artifact_material",
    "combat_body_output",
    "creature_type_material",
    "enchantment_material",
  ]);

  const DOMAIN_COLORS = {
    graveyard: "#8e6ad8",
    sacrifice: "#bf5a63",
    spells: "#5f8ee4",
    tokens: "#62a66f",
    counters: "#c4a63c",
    lifegain: "#d8709b",
    kindred: "#b8834b",
    artifacts: "#7b8a99",
    enchantments: "#b88fdf",
    discard: "#995d77",
    combat: "#d47b42",
    timing: "#55a9b5",
    resources: "#c59b45",
    protection: "#58a982",
  };

  const DOMAIN_ORDER = [
    "graveyard",
    "sacrifice",
    "spells",
    "tokens",
    "counters",
    "lifegain",
    "kindred",
    "artifacts",
    "enchantments",
    "discard",
    "combat",
    "timing",
    "resources",
    "protection",
  ];

  function create() {
    const elements = {
      count: document.querySelector("#synergy-network-count"),
      summary: document.querySelector("#synergy-network-summary"),
      graph: document.querySelector("#synergy-network-graph"),
      commanderScore: document.querySelector("#synergy-commander-score"),
      commanderSummary: document.querySelector("#synergy-commander-summary"),
      selectedPackage: document.querySelector("#synergy-selected-package"),
      packageList: document.querySelector("#synergy-package-list"),
    };
    let selectedDomain = null;
    let currentGraph = null;

    function render(analysis) {
      const synergyIo = analysis?.synergyIo;
      const graph = buildGraph(synergyIo);
      currentGraph = graph;
      selectedDomain = graph.nodes[0]?.domain ?? null;

      if (!synergyIo || graph.nodes.length === 0) {
        renderEmpty();
        return;
      }

      if (elements.count) {
        elements.count.textContent = `${graph.nodes.length} packages`;
      }
      if (elements.summary) {
        elements.summary.textContent = buildSummary(synergyIo, graph);
      }
      if (elements.commanderScore) {
        elements.commanderScore.textContent = `${formatNumber(synergyIo.commanderSynergy?.score ?? 0)} / 10`;
      }
      if (elements.commanderSummary) {
        elements.commanderSummary.textContent =
          synergyIo.commanderSynergy?.summary ?? "No commander synergy read was returned.";
      }

      renderGraph(graph);
      renderSelectedPackage();
      renderPackageList(graph);
    }

    function renderEmpty() {
      elements.count && (elements.count.textContent = "0 packages");
      elements.summary && (elements.summary.textContent = "No connected synergy packages were found yet.");
      elements.commanderScore && (elements.commanderScore.textContent = "0 / 10");
      elements.commanderSummary && (elements.commanderSummary.textContent = "No commander synergy read was returned.");
      elements.selectedPackage && (elements.selectedPackage.textContent = "No synergy package is available.");
      elements.packageList?.replaceChildren();
      elements.graph?.replaceChildren(createEmptyState());
    }

    function renderGraph(graph) {
      if (!elements.graph) {
        return;
      }

      const width = 760;
      const height = 520;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = graph.nodes.length <= 4 ? 150 : 190;
      const nodes = graph.nodes.map((node, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / graph.nodes.length;
        return {
          ...node,
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        };
      });
      const nodeLookup = new Map(nodes.map((node) => [node.domain, node]));
      const svg = createSvgElement("svg", {
        class: "synergy-network-svg",
        viewBox: `0 0 ${width} ${height}`,
        role: "img",
        "aria-label": "Synergy network graph",
      });
      const edgesGroup = createSvgElement("g", { class: "synergy-network-edges" });
      const nodesGroup = createSvgElement("g", { class: "synergy-network-nodes" });

      for (const edge of graph.edges) {
        const source = nodeLookup.get(edge.source);
        const target = nodeLookup.get(edge.target);

        if (!source || !target) {
          continue;
        }

        const edgeLine = createSvgElement("line", {
          class: "synergy-network-edge",
          x1: source.x,
          y1: source.y,
          x2: target.x,
          y2: target.y,
          "stroke-width": Math.min(9, 1.5 + edge.cards.length * 1.2),
        });
        edgeLine.appendChild(createSvgElement("title", {}, `${edge.cards.length} shared synergy cards: ${edge.cards.slice(0, 6).join(", ")}`));
        edgesGroup.appendChild(edgeLine);
      }

      for (const node of nodes) {
        const group = createSvgElement("g", {
          class: `synergy-network-node${node.domain === selectedDomain ? " is-selected" : ""}`,
          tabindex: "0",
          role: "button",
          "aria-label": `${node.label}, ${node.cardCount} synergy cards`,
          transform: `translate(${node.x} ${node.y})`,
        });
        const color = DOMAIN_COLORS[node.domain] ?? "#8a929e";

        if (node.hasLoop) {
          group.appendChild(createSvgElement("circle", {
            class: "synergy-network-loop-ring",
            r: node.radius + 8,
          }));
        }

        group.appendChild(createSvgElement("circle", {
          class: "synergy-network-bubble",
          r: node.radius,
          fill: color,
        }));
        group.appendChild(createSvgElement("text", {
          class: "synergy-network-node-label",
          y: -4,
          "text-anchor": "middle",
        }, node.shortLabel));
        group.appendChild(createSvgElement("text", {
          class: "synergy-network-node-count",
          y: 14,
          "text-anchor": "middle",
        }, `${node.cardCount} cards`));
        group.appendChild(createSvgElement("title", {}, `${node.label}: ${node.cardCount} synergy cards, score ${formatNumber(node.score)}`));
        group.addEventListener("click", () => selectDomain(node.domain));
        group.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          selectDomain(node.domain);
        });
        nodesGroup.appendChild(group);
      }

      svg.append(edgesGroup, nodesGroup);
      elements.graph.replaceChildren(svg);
    }

    function selectDomain(domain) {
      selectedDomain = domain;
      if (currentGraph) {
        renderGraph(currentGraph);
        renderPackageList(currentGraph);
      }
      renderSelectedPackage();
    }

    function renderSelectedPackage() {
      if (!elements.selectedPackage || !currentGraph) {
        return;
      }

      const node = currentGraph.nodes.find((entry) => entry.domain === selectedDomain) ?? currentGraph.nodes[0];

      if (!node) {
        elements.selectedPackage.textContent = "No synergy package is available.";
        return;
      }

      const heading = document.createElement("strong");
      heading.textContent = node.label;
      const meta = document.createElement("p");
      meta.textContent = `${node.cardCount} synergy cards, package score ${formatNumber(node.score)}.`;
      const tags = document.createElement("div");
      tags.className = "synergy-package-tags";
      tags.replaceChildren(
        createTag(`Input ${formatNumber(node.inputs)}`),
        createTag(`Output ${formatNumber(node.outputs)}`),
        createTag(`Payoff ${formatNumber(node.payoffs)}`),
        node.frictions > 0 ? createTag(`Friction ${formatNumber(node.frictions)}`, "is-warning") : createTag("No major friction"),
      );
      const cards = document.createElement("p");
      cards.className = "synergy-card-line";
      cards.textContent = node.keyCards.length > 0
        ? `Key cards: ${node.keyCards.slice(0, 6).join(", ")}`
        : "No key cards were returned for this package.";
      const gaps = document.createElement("ul");
      gaps.className = "note-list synergy-gap-list";
      const gapItems = node.gaps.length > 0 ? node.gaps : [node.hasLoop ? "Input, output, and payoff are all present." : "Package is present but not a complete loop yet."];
      gaps.replaceChildren(...gapItems.slice(0, 3).map((gap) => {
        const item = document.createElement("li");
        item.textContent = gap;
        return item;
      }));

      elements.selectedPackage.replaceChildren(heading, meta, tags, cards, gaps);
    }

    function renderPackageList(graph) {
      if (!elements.packageList) {
        return;
      }

      const rows = graph.nodes.map((node) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = `synergy-package-row${node.domain === selectedDomain ? " is-selected" : ""}`;
        row.addEventListener("click", () => selectDomain(node.domain));

        const title = document.createElement("strong");
        title.textContent = node.label;
        const stats = document.createElement("span");
        stats.textContent = `${node.cardCount} cards - score ${formatNumber(node.score)}${node.hasLoop ? " - loop" : ""}`;
        const cards = document.createElement("small");
        cards.textContent = node.keyCards.slice(0, 4).join(", ") || "No key cards";
        row.replaceChildren(title, stats, cards);
        return row;
      });

      elements.packageList.replaceChildren(...rows);
    }

    return { render };
  }

  function buildGraph(synergyIo) {
    if (!synergyIo) {
      return { nodes: [], edges: [] };
    }

    const cardDomains = buildCardDomainMap(synergyIo.taggedCards ?? []);
    const commanderDomains = new Set((synergyIo.commanderSynergy?.matches ?? [])
      .filter((match) => match.score >= 0.8)
      .map((match) => match.domain));
    const nodes = (synergyIo.packages ?? [])
      .map((entry) => toNode(entry, cardDomains, commanderDomains))
      .filter((entry) => entry !== null)
      .sort((left, right) => right.score - left.score || right.cardCount - left.cardCount)
      .slice(0, 8);
    const nodeDomains = new Set(nodes.map((node) => node.domain));
    const edges = buildEdges(cardDomains, nodeDomains);

    return { nodes, edges };
  }

  function buildCardDomainMap(taggedCards) {
    const cardDomains = new Map();

    for (const card of taggedCards) {
      const domains = new Set();

      for (const atom of card.atoms ?? []) {
        if (!isDisplayAtom(atom)) {
          continue;
        }

        domains.add(atom.domain);
      }

      if (domains.size > 0) {
        cardDomains.set(card.name, {
          quantity: card.quantity ?? 1,
          domains,
        });
      }
    }

    return cardDomains;
  }

  function toNode(pkg, cardDomains, commanderDomains) {
    const cards = [...cardDomains.entries()]
      .filter(([, entry]) => entry.domains.has(pkg.domain))
      .map(([name, entry]) => ({ name, quantity: entry.quantity }));
    const cardCount = cards.reduce((sum, card) => sum + card.quantity, 0);
    const completeLoop = pkg.inputs >= 0.5 && pkg.outputs >= 0.5 && pkg.payoffs >= 0.5;
    const isSubstantial =
      cardCount >= 2 &&
      pkg.score >= 2.5 &&
      (completeLoop || pkg.payoffs >= 1 || commanderDomains.has(pkg.domain));

    if (!isSubstantial) {
      return null;
    }

    return {
      ...pkg,
      cardCount,
      shortLabel: shortenLabel(pkg.label),
      radius: Math.max(28, Math.min(60, 24 + Math.sqrt(cardCount) * 7)),
      hasLoop: completeLoop,
      keyCards: cards
        .sort((left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name))
        .map((card) => card.name)
        .slice(0, 8),
    };
  }

  function buildEdges(cardDomains, nodeDomains) {
    const edgeMap = new Map();

    for (const [cardName, entry] of cardDomains.entries()) {
      const domains = [...entry.domains].filter((domain) => nodeDomains.has(domain));

      for (let first = 0; first < domains.length; first += 1) {
        for (let second = first + 1; second < domains.length; second += 1) {
          const pair = [domains[first], domains[second]].sort((left, right) =>
            DOMAIN_ORDER.indexOf(left) - DOMAIN_ORDER.indexOf(right),
          );
          const key = pair.join("|");
          const edge = edgeMap.get(key) ?? { source: pair[0], target: pair[1], cards: [] };

          edge.cards.push(cardName);
          edgeMap.set(key, edge);
        }
      }
    }

    return [...edgeMap.values()]
      .filter((edge) => edge.cards.length >= 1)
      .sort((left, right) => right.cards.length - left.cards.length)
      .slice(0, 14);
  }

  function isDisplayAtom(atom) {
    if (!atom || !atom.domain || !atom.kind) {
      return false;
    }

    if (MATERIAL_ONLY_TAGS.has(atom.tag)) {
      return false;
    }

    return atom.kind !== "output" || atom.weight >= 0.42;
  }

  function buildSummary(synergyIo, graph) {
    const loops = graph.nodes.filter((node) => node.hasLoop);
    const strongest = graph.nodes.slice(0, 3).map((node) => node.label).join(", ");

    if (graph.nodes.length === 0) {
      return "No connected synergy packages were found yet.";
    }

    if (loops.length > 0) {
      return `${strongest} are the main connected packages. ${loops.length} package${loops.length === 1 ? "" : "s"} show input, output, and payoff in the same lane.`;
    }

    return `${strongest} are present, but no full input/output/payoff loop is visible yet.`;
  }

  function createEmptyState() {
    const empty = document.createElement("div");
    empty.className = "synergy-network-empty";
    empty.textContent = "No synergy network available yet.";
    return empty;
  }

  function createTag(text, className = "") {
    const tag = document.createElement("span");
    tag.className = `synergy-package-tag${className ? ` ${className}` : ""}`;
    tag.textContent = text;
    return tag;
  }

  function createSvgElement(tagName, attributes = {}, text = "") {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);

    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, String(value));
    }

    if (text) {
      element.textContent = text;
    }

    return element;
  }

  function shortenLabel(label) {
    return String(label ?? "")
      .replace(" / ", " ")
      .replace("Combat Attack", "Combat")
      .replace("Protection Setup", "Protect")
      .replace("Kindred Type", "Kindred")
      .slice(0, 13);
  }

  function formatNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "0";
    }

    return number % 1 === 0 ? String(number) : number.toFixed(1);
  }

  window.MtgDeckcheckerSynergyNetwork = { create };
})();
