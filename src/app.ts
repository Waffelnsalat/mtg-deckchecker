import express from "express";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { analyzeDeckBracket } from "./bracketAnalysis";
import { analyzeDeckCommander } from "./commanderAnalysis";
import { analyzeDeckStructure } from "./deckAnalysis";
import { analyzeDeckConsistency } from "./consistencyAnalysis";
import { analyzeDeckDraw } from "./drawAnalysis";
import { analyzeDeckGameChangers } from "./gameChangerAnalysis";
import { analyzeDeckRemoval, analyzeDeckSpellInteraction } from "./interactionAnalysis";
import { analyzeDeckLandBase } from "./landBaseAnalysis";
import { analyzeDeckPower } from "./powerAnalysis";
import { analyzeDeckProtection } from "./protectionAnalysis";
import { analyzeDeckRecommendations } from "./recommendationAnalysis";
import { analyzeDeckRecursion } from "./recursionAnalysis";
import { analyzeDeckRamp } from "./rampAnalysis";
import { analyzeDeckStrategy } from "./strategyAnalysis";
import { analyzeDeckWinConditions } from "./winConditionAnalysis";
import { analyzeDeckWinStrategy } from "./winStrategyAnalysis";
import { analyzeDeckAdvancedRoles } from "./advancedCardScan";
import { DeckImportError, importDecklistFromUrl } from "./deckImport";
import { DeckValidationError } from "./deckValidation";
import { createDeckExport, getGeneratedExportsDir, resolveDecklistForAnalysis, resolveDecklistToDocument } from "./deckExport";
import { lookupCommanderEdhrecInsights } from "./edhrec";
import { lookupRecommanderRecommendations } from "./recommander";
import {
  DeckAnalysisSources,
  DeckBracketNumber,
  DeckRecommendationAnalysis,
  DeckResolutionDocument,
  DeckValidationResult,
  DeckWinConditionAnalysis,
} from "./types";

const importDeckSchema = z.object({
  url: z.string().trim().url().max(500),
});

const REPORTS_DIR = path.resolve(process.cwd(), "user-reports");

const reportSchema = z.object({
  reportType: z.enum(["website", "deck_evaluation", "other"]),
  websiteKind: z.enum(["issue", "feedback"]).optional(),
  evaluationCategories: z.array(z.string().trim().min(1).max(80)).max(40).optional().default([]),
  comment: z.string().trim().max(5000).optional().default(""),
  context: z.unknown().optional(),
});

const resolveDeckSchema = z.object({
  commanderName: z.string().trim().max(160).optional(),
  additionalCommanderName: z.string().trim().max(160).optional(),
  partnerName: z.string().trim().max(160).optional(),
  backgroundName: z.string().trim().max(160).optional(),
  companionName: z.string().trim().max(160).optional(),
  secretCommanderName: z.string().trim().max(160).optional(),
  preferredStrategyKey: z.string().trim().max(80).optional(),
  targetBracket: z.coerce.number().int().min(1).max(5).optional(),
  decklist: z.string().min(1, "decklist is required"),
});

const exportDeckSchema = resolveDeckSchema.extend({
  fileName: z.string().trim().max(120).optional(),
  sourceName: z.string().trim().max(180).optional(),
});

function toDeckBracketNumber(value: number | undefined): DeckBracketNumber | undefined {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? value
    : undefined;
}

export function createApp() {
  const app = express();
  const publicDir = path.resolve(process.cwd(), "public");
  const exportsDir = getGeneratedExportsDir();

  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(publicDir));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post("/api/edh/decklists/import", async (request, response) => {
    const parsedBody = importDeckSchema.safeParse(request.body);

    if (!parsedBody.success) {
      response.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.flatten(),
      });
      return;
    }

    try {
      const result = await importDecklistFromUrl(parsedBody.data.url);

      response.json(result);
    } catch (error) {
      sendDeckImportError(response, error);
    }
  });

  app.post("/api/edh/decklists/resolve", async (request, response) => {
    const parsedBody = resolveDeckSchema.safeParse(request.body);

    if (!parsedBody.success) {
      response.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.flatten(),
      });
      return;
    }

    try {
      const additionalCommanderName =
        parsedBody.data.additionalCommanderName ??
        parsedBody.data.partnerName ??
        parsedBody.data.backgroundName;
      response.json(
        await resolveDecklistToDocument(parsedBody.data.decklist, {
          commanderName: parsedBody.data.commanderName,
          additionalCommanderName,
          partnerName: parsedBody.data.partnerName,
          backgroundName: parsedBody.data.backgroundName,
          companionName: parsedBody.data.companionName,
        }),
      );
    } catch (error) {
      sendDeckError(response, error);
    }
  });

  app.post("/api/edh/decklists/analyze", async (request, response) => {
    const parsedBody = resolveDeckSchema.safeParse(request.body);

    if (!parsedBody.success) {
      response.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.flatten(),
      });
      return;
    }

    try {
      const additionalCommanderName =
        parsedBody.data.additionalCommanderName ??
        parsedBody.data.partnerName ??
        parsedBody.data.backgroundName;
      const { document, validation } = await resolveDecklistForAnalysis(parsedBody.data.decklist, {
        commanderName: parsedBody.data.commanderName,
        additionalCommanderName,
        partnerName: parsedBody.data.partnerName,
        backgroundName: parsedBody.data.backgroundName,
        companionName: parsedBody.data.companionName,
      });
      const draw = analyzeDeckDraw(document);
      const winConditions = await analyzeDeckWinConditions(document);
      const targetBracket = toDeckBracketNumber(parsedBody.data.targetBracket);
      const edhrec = await lookupCommanderEdhrecInsights(document, targetBracket);
      const recommander = await lookupRecommanderRecommendations(document);
      const strategy = analyzeDeckStrategy(document, winConditions, {
        secretCommanderName: parsedBody.data.secretCommanderName,
        preferredStrategyKey: parsedBody.data.preferredStrategyKey,
        edhrec,
      });
      const winStrategy = analyzeDeckWinStrategy(document, strategy, winConditions);
      const commander = analyzeDeckCommander(document, strategy, winStrategy, winConditions);
      const gameChangers = analyzeDeckGameChangers(document);
      const structure = analyzeDeckStructure(document);
      const landBase = analyzeDeckLandBase(document);
      const ramp = analyzeDeckRamp(document);
      const consistency = analyzeDeckConsistency(document, {
        draw,
        strategy,
        winConditions,
      });
      const protection = analyzeDeckProtection(document);
      const recursion = analyzeDeckRecursion(document);
      const removal = analyzeDeckRemoval(document);
      const spellInteraction = analyzeDeckSpellInteraction(document);
      const advancedRoles = analyzeDeckAdvancedRoles(document);
      const power = analyzeDeckPower({
        commander,
        structure,
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
        strategy,
        winStrategy,
      });
      const bracket = analyzeDeckBracket({
        document,
        power,
        gameChangers,
        winConditions,
        targetBracket,
      });
      const recommendations = await analyzeDeckRecommendations({
        document,
        commander,
        bracket,
        strategy,
        winStrategy,
        structure,
        landBase,
        ramp,
        draw,
        consistency,
        protection,
        recursion,
        winConditions,
        removal,
        spellInteraction,
        edhrec,
        recommander,
      });
      const sources = buildAnalysisSources({
        document,
        validation,
        edhrec,
        recommander,
        recommendations,
        winConditions,
      });

      response.json({
        document,
        validation,
        sources,
        analysis: {
          commander,
          power,
          bracket,
          recommendations,
          strategy,
          winStrategy,
          structure,
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
          advancedRoles,
        },
      });
    } catch (error) {
      sendDeckError(response, error);
    }
  });

  app.post("/api/edh/decklists/export", async (request, response) => {
    const parsedBody = exportDeckSchema.safeParse(request.body);

    if (!parsedBody.success) {
      response.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.flatten(),
      });
      return;
    }

    try {
      const additionalCommanderName =
        parsedBody.data.additionalCommanderName ??
        parsedBody.data.partnerName ??
        parsedBody.data.backgroundName;
      const exportResult = await createDeckExport(parsedBody.data.decklist, {
        createdBy: "web",
        commanderName: parsedBody.data.commanderName,
        additionalCommanderName,
        partnerName: parsedBody.data.partnerName,
        backgroundName: parsedBody.data.backgroundName,
        companionName: parsedBody.data.companionName,
        fileStem: parsedBody.data.fileName,
        inputLabel: parsedBody.data.sourceName,
      });

      response.status(201).json({
        exportFile: {
          fileName: exportResult.fileName,
          outputPath: exportResult.outputPath,
          downloadUrl: `/api/exports/${encodeURIComponent(exportResult.fileName)}`,
        },
        document: exportResult.document,
      });
    } catch (error) {
      sendDeckError(response, error);
    }
  });

  app.post("/api/reports", async (request, response) => {
    const parsedBody = reportSchema.safeParse(request.body);

    if (!parsedBody.success) {
      response.status(400).json({
        error: "Invalid report body.",
        details: parsedBody.error.flatten(),
      });
      return;
    }

    const contentIssue = validateReportContent(parsedBody.data);
    if (contentIssue) {
      response.status(400).json({
        error: contentIssue,
      });
      return;
    }

    try {
      const report = await saveUserReport(parsedBody.data);
      response.status(201).json({
        reportId: report.id,
        fileName: report.fileName,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      response.status(500).json({
        error: "Failed to save report.",
        details: message,
      });
    }
  });

  app.get("/api/exports/:fileName", async (request, response) => {
    const fileName = path.basename(request.params.fileName);
    const filePath = path.join(exportsDir, fileName);

    try {
      await access(filePath);
      response.download(filePath, fileName);
    } catch {
      response.status(404).json({
        error: "Export file not found.",
      });
    }
  });

  return app;
}

export function buildAnalysisSources(input: {
  document: DeckResolutionDocument;
  validation: DeckValidationResult;
  edhrec: Awaited<ReturnType<typeof lookupCommanderEdhrecInsights>>;
  recommander: Awaited<ReturnType<typeof lookupRecommanderRecommendations>>;
  recommendations: DeckRecommendationAnalysis;
  winConditions: DeckWinConditionAnalysis;
}): DeckAnalysisSources {
  const commanderNames = input.document.result.resolvedCards
    .filter((card) => card.section === "commander")
    .map((card) => card.card.name);
  const uniqueMainboardCount = new Set(
    input.document.result.resolvedCards
      .filter((card) => card.section === "mainboard")
      .map((card) => card.card.name.toLowerCase()),
  ).size;
  const unresolvedCount = input.document.result.unresolvedCount;
  const parseErrorCount = input.document.parse.errors.length;
  const scryfallLimited = unresolvedCount > 0 || parseErrorCount > 0;
  const hasCommander = commanderNames.length > 0;
  const comboLookupUnavailable = input.winConditions.combos.lookupStatus !== "ok";
  const recommendationCardCount = input.recommendations.topics.reduce(
    (sum, topic) => sum + topic.cards.length,
    0,
  );

  return {
    scryfall: {
      key: "scryfall",
      label: "Scryfall",
      status: scryfallLimited ? "partial" : "ok",
      used: true,
      summary: scryfallLimited
        ? `${unresolvedCount} unresolved card${unresolvedCount === 1 ? "" : "s"} and ${parseErrorCount} parse issue${parseErrorCount === 1 ? "" : "s"} affected the resolved deck.`
        : `${input.document.result.resolvedCount} card entries resolved.`,
      detail: scryfallLimited
        ? "Every score is based only on the cards that could be resolved."
        : undefined,
      affects: ["deck identity", "all scores", "card roles"],
    },
    edhrec: {
      key: "edhrec",
      label: "EDHREC",
      status: input.edhrec ? "ok" : hasCommander ? "failed" : "partial",
      used: Boolean(input.edhrec),
      summary: input.edhrec
        ? `${input.edhrec.pageLabel} commander page loaded with ${input.edhrec.lists.length} card list${input.edhrec.lists.length === 1 ? "" : "s"}.`
        : hasCommander
          ? "Commander-page data was unavailable, so commander-specific trends were not used."
          : "No commander was resolved, so commander-page data could not be requested.",
      url: input.edhrec?.url,
      affects: ["strategy detection", "commander themes", "recommendation fit"],
    },
    commanderSpellbook: {
      key: "commanderSpellbook",
      label: "Commander Spellbook",
      status: comboLookupUnavailable ? "failed" : "ok",
      used: !comboLookupUnavailable,
      summary: comboLookupUnavailable
        ? "Combo lookup was unavailable, so exact external combo lines were not used."
        : `${input.winConditions.combos.exactCount} exact combo line${input.winConditions.combos.exactCount === 1 ? "" : "s"} found.`,
      detail: input.winConditions.combos.error,
      affects: ["win conditions", "combo count", "bracket rules floor"],
    },
    recommander: {
      key: "recommander",
      label: "Recommander",
      status: input.recommander ? "ok" : hasCommander && uniqueMainboardCount >= 5 ? "failed" : "partial",
      used: Boolean(input.recommander),
      summary: input.recommander
        ? `${input.recommander.cards.length} deck-context recommendation${input.recommander.cards.length === 1 ? "" : "s"} loaded.`
        : hasCommander && uniqueMainboardCount >= 5
          ? "Deck-context recommendations were unavailable, so fallback and EDHREC/library suggestions were used."
          : "The deck did not have enough resolved commander/mainboard context for deck-context recommendations.",
      url: input.recommander?.url,
      affects: ["card recommendations", "suggestion confidence"],
    },
  };
}

function validateReportContent(report: z.infer<typeof reportSchema>) {
  const hasComment = report.comment.trim().length > 0;

  if (report.reportType === "website") {
    if (!report.websiteKind) {
      return "Choose whether the website report is an issue or feedback.";
    }

    return hasComment ? null : "Add a short website report comment before submitting.";
  }

  if (report.reportType === "deck_evaluation") {
    return hasComment || report.evaluationCategories.length > 0
      ? null
      : "Choose an evaluation category or add a comment before submitting.";
  }

  return hasComment ? null : "Add a short report comment before submitting.";
}

async function saveUserReport(report: z.infer<typeof reportSchema>) {
  const id = randomUUID();
  const submittedAt = new Date().toISOString();
  const fileName = `${submittedAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}-${report.reportType}-${id.slice(0, 8)}.json`;
  const payload = {
    id,
    submittedAt,
    ...report,
  };

  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(
    path.join(REPORTS_DIR, fileName),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );

  return {
    id,
    fileName,
  };
}

function sendDeckError(
  response: express.Response,
  error: unknown,
) {
  if (error instanceof DeckValidationError) {
    response.status(400).json({
      error: "Deck validation failed.",
      validation: error.validation,
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Unknown error.";
  const statusCode = message.includes("No deck cards could be parsed") ? 400 : 502;

  response.status(statusCode).json({
    error:
      statusCode === 400
        ? "The submitted decklist could not be parsed."
        : "Failed to fetch card data from Scryfall.",
    details: message,
  });
}

function sendDeckImportError(
  response: express.Response,
  error: unknown,
) {
  if (error instanceof DeckImportError) {
    response.status(error.statusCode).json({
      error:
        error.statusCode >= 500
          ? "Deck URL import failed."
          : "Deck URL could not be imported.",
      details: error.message,
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Unknown error.";

  response.status(502).json({
    error: "Deck URL import failed.",
    details: message,
  });
}
