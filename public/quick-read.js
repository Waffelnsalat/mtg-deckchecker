window.MtgDeckcheckerQuickRead = {
  create({ elements }) {
    const metricElements = {
      shell: elements.metrics.shell,
      landBase: elements.metrics.landBase,
      ramp: elements.metrics.ramp,
      cardFlow: elements.metrics.cardFlow,
      consistency: elements.metrics.consistency,
      interaction: elements.metrics.interaction,
      resilience: elements.metrics.resilience,
      closing: elements.metrics.closing,
    };

    function render(analysis) {
      const metrics = buildMetrics(analysis);
      const metricByKey = new Map(metrics.map((metric) => [metric.key, metric]));
      const sortedMetrics = [...metrics].sort(
        (left, right) => right.score - left.score || left.label.localeCompare(right.label),
      );
      const strongestMetrics = sortedMetrics.slice(0, 3);
      const weakestMetrics = [...sortedMetrics].reverse().slice(0, 3);

      Object.entries(metricElements).forEach(([key, element]) => {
        updateMetric(element, metricByKey.get(key));
      });
      renderScoreRadarChart(metrics);

      elements.summary.textContent = buildSummary(
        analysis,
        strongestMetrics[0],
        weakestMetrics[0],
      );
      renderSimpleList(
        elements.strengthsList,
        strongestMetrics.map((metric) => `${metric.label} (${metric.score}): ${metric.note}`),
        "No single pillar clearly leads the shell yet.",
      );
      renderSimpleList(
        elements.risksList,
        weakestMetrics.map((metric) => `${metric.label} (${metric.score}): ${metric.note}`),
        "No major weak point stands out yet.",
      );
    }

    function reset() {
      elements.strengthsList.replaceChildren();
      elements.risksList.replaceChildren();
      clearChart();
      elements.summary.textContent = "The simplest deck read appears here after analysis.";
      Object.values(metricElements).forEach((element) => {
        if (element) {
          element.textContent = "0";
          applyToneToCard(element, null);
        }
      });
    }

    function clearChart() {
      elements.radarChart?.replaceChildren();
    }

    function renderScoreRadarChart(metrics) {
      if (!elements.radarChart) {
        return;
      }

      const normalizedMetrics = metrics.map((metric) => ({
        ...metric,
        score: Math.max(0, Math.min(100, Math.round(metric.score))),
      }));

      if (normalizedMetrics.length < 3) {
        elements.radarChart.replaceChildren();
        return;
      }

      const svgNamespace = "http://www.w3.org/2000/svg";
      const size = 460;
      const center = size / 2;
      const maxRadius = 118;
      const labelRadius = 158;
      const angleStep = (Math.PI * 2) / normalizedMetrics.length;
      const startAngle = -Math.PI / 2;
      const createSvgElement = (tagName, attributes = {}) => {
        const element = document.createElementNS(svgNamespace, tagName);
        Object.entries(attributes).forEach(([key, value]) => {
          element.setAttribute(key, String(value));
        });
        return element;
      };
      const getPoint = (index, radius) => {
        const angle = startAngle + index * angleStep;
        return {
          x: center + Math.cos(angle) * radius,
          y: center + Math.sin(angle) * radius,
        };
      };
      const formatPoints = (points) =>
        points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
      const labelAnchor = (x) => {
        if (x > center + 12) {
          return "start";
        }

        if (x < center - 12) {
          return "end";
        }

        return "middle";
      };
      const labelBaseline = (y) => {
        if (y > center + 12) {
          return "hanging";
        }

        if (y < center - 12) {
          return "auto";
        }

        return "middle";
      };

      const svg = createSvgElement("svg", {
        class: "score-radar-svg",
        viewBox: `0 0 ${size} ${size}`,
        role: "img",
        "aria-labelledby": "score-radar-title score-radar-desc",
      });

      const title = createSvgElement("title", { id: "score-radar-title" });
      title.textContent = "Deck score web";
      const description = createSvgElement("desc", { id: "score-radar-desc" });
      description.textContent =
        "A radar chart showing shell, land base, ramp, card flow, consistency, interaction, resilience, and closing scores.";
      svg.append(title, description);

      const gridGroup = createSvgElement("g", { class: "score-radar-grid" });
      [25, 50, 75, 100].forEach((level) => {
        const radius = (level / 100) * maxRadius;
        const points = normalizedMetrics.map((_, index) => getPoint(index, radius));
        gridGroup.append(
          createSvgElement("polygon", {
            class: `score-radar-grid-ring score-radar-grid-ring-${level}`,
            points: formatPoints(points),
          }),
        );
      });

      normalizedMetrics.forEach((_, index) => {
        const outerPoint = getPoint(index, maxRadius);
        gridGroup.append(
          createSvgElement("line", {
            class: "score-radar-axis",
            x1: center,
            y1: center,
            x2: outerPoint.x.toFixed(1),
            y2: outerPoint.y.toFixed(1),
          }),
        );
      });
      svg.append(gridGroup);

      const dataPoints = normalizedMetrics.map((metric, index) =>
        getPoint(index, (metric.score / 100) * maxRadius),
      );
      const dataGroup = createSvgElement("g", { class: "score-radar-data" });
      dataGroup.append(
        createSvgElement("polygon", {
          class: "score-radar-area",
          points: formatPoints(dataPoints),
        }),
        createSvgElement("polyline", {
          class: "score-radar-outline",
          points: formatPoints([...dataPoints, dataPoints[0]]),
        }),
      );

      normalizedMetrics.forEach((metric, index) => {
        const point = dataPoints[index];
        const dot = createSvgElement("circle", {
          class: `score-radar-dot score-radar-dot-${getScoreTone(metric.score)}`,
          cx: point.x.toFixed(1),
          cy: point.y.toFixed(1),
          r: 4.6,
        });
        dataGroup.append(dot);
      });
      svg.append(dataGroup);

      const labelGroup = createSvgElement("g", { class: "score-radar-labels" });
      normalizedMetrics.forEach((metric, index) => {
        const point = getPoint(index, labelRadius);
        const text = createSvgElement("text", {
          class: `score-radar-label score-radar-label-${getScoreTone(metric.score)}`,
          x: point.x.toFixed(1),
          y: point.y.toFixed(1),
          "text-anchor": labelAnchor(point.x),
          "dominant-baseline": labelBaseline(point.y),
        });
        const label = createSvgElement("tspan", {
          class: "score-radar-label-name",
          x: point.x.toFixed(1),
        });
        label.textContent = metric.label;
        const value = createSvgElement("tspan", {
          class: "score-radar-label-score",
          x: point.x.toFixed(1),
          dy: "1.2em",
        });
        value.textContent = String(metric.score);
        text.append(label, value);
        labelGroup.append(text);
      });
      svg.append(labelGroup);

      const legend = document.createElement("div");
      legend.className = "score-radar-legend";
      normalizedMetrics.forEach((metric) => {
        const item = document.createElement("article");
        item.className = `score-radar-legend-item score-radar-legend-${getScoreTone(metric.score)}`;

        const label = document.createElement("span");
        label.textContent = metric.label;

        const value = document.createElement("strong");
        value.textContent = String(metric.score);

        item.append(label, value);
        legend.append(item);
      });

      const visual = document.createElement("div");
      visual.className = "score-radar-visual";
      visual.append(svg);

      elements.radarChart.replaceChildren(visual, legend);
    }

    function buildMetrics(analysis) {
      return [
        {
          key: "shell",
          label: "Shell",
          score: Math.round(analysis.structure.structureScore),
          note: firstSentence(analysis.structure.summary),
        },
        {
          key: "landBase",
          label: "Land Base",
          score: Math.round(analysis.landBase.landBaseScore),
          note: firstSentence(analysis.landBase.summary),
        },
        {
          key: "ramp",
          label: "Ramp",
          score: Math.round(analysis.ramp.rampScore),
          note: firstSentence(analysis.ramp.summary),
        },
        {
          key: "cardFlow",
          label: "Card Flow",
          score: Math.round(analysis.draw.drawScore),
          note: firstSentence(analysis.draw.summary),
        },
        {
          key: "consistency",
          label: "Consistency",
          score: Math.round(analysis.consistency.consistencyScore),
          note: firstSentence(analysis.consistency.summary),
        },
        {
          key: "interaction",
          label: "Interaction",
          score: averageScores(
            analysis.removal.removalScore,
            analysis.spellInteraction.interactionScore,
          ),
          note: buildPairedNote(
            "Removal",
            analysis.removal.removalScore,
            "Spell interaction",
            analysis.spellInteraction.interactionScore,
          ),
        },
        {
          key: "resilience",
          label: "Resilience",
          score: averageScores(
            analysis.protection.protectionScore,
            analysis.recursion.recursionScore,
          ),
          note: buildPairedNote(
            "Protection",
            analysis.protection.protectionScore,
            "Recursion",
            analysis.recursion.recursionScore,
          ),
        },
        {
          key: "closing",
          label: "Closing",
          score: Math.round(analysis.winConditions.finisherScore),
          note: firstSentence(analysis.winConditions.summary),
        },
      ];
    }

    function buildSummary(analysis, strongestMetric, weakestMetric) {
      const strategyLabel = analysis.strategy.mainStrategy?.label ?? "Mixed shell";
      const winPlanLabel = analysis.winStrategy.primaryPlan?.label ?? "No clear finish yet";
      const strongestLabel = strongestMetric?.label?.toLowerCase() ?? "none";
      const weakestLabel = weakestMetric?.label?.toLowerCase() ?? "none";

      return `${analysis.bracket.recommendedLabel} ${analysis.bracket.recommendedName}. ${strategyLabel} is the clearest plan, ${winPlanLabel.toLowerCase()} is the main finish, ${strongestLabel} is the strongest pillar, and ${weakestLabel} needs the most work.`;
    }

    function buildPairedNote(leftLabel, leftScore, rightLabel, rightScore) {
      if (Math.abs(leftScore - rightScore) <= 8) {
        return `${leftLabel} and ${rightLabel.toLowerCase()} are carrying similar weight right now.`;
      }

      const strongerLabel = leftScore > rightScore ? leftLabel : rightLabel;
      const weakerLabel = leftScore > rightScore ? rightLabel.toLowerCase() : leftLabel.toLowerCase();
      return `${strongerLabel} is doing more of the work than ${weakerLabel} right now.`;
    }

    function updateMetric(element, metric) {
      if (!element || !metric) {
        return;
      }

      element.textContent = String(metric.score);
      applyToneToCard(element, getScoreTone(metric.score));
    }

    function renderSimpleList(listElement, values, emptyMessage) {
      const items =
        values.length > 0
          ? values.map((value) => createListItem(value))
          : [createListItem(emptyMessage)];

      listElement.replaceChildren(...items);
    }

    function createListItem(text) {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }

    function averageScores(...scores) {
      if (scores.length === 0) {
        return 0;
      }

      return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    }

    function firstSentence(text) {
      const trimmedText = text?.trim();
      if (!trimmedText) {
        return "";
      }

      const sentenceMatch = trimmedText.match(/^.*?[.!?](?:\s|$)/);
      return sentenceMatch ? sentenceMatch[0].trim() : trimmedText;
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

    function applyToneToCard(element, tone) {
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

      if (!tone) {
        return;
      }

      card.classList.add("score-card", `score-card-${tone}`);
    }

    return {
      clearChart,
      render,
      reset,
    };
  },
};
