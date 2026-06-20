import { readFile } from "node:fs/promises";
import path from "node:path";
import { createDeckExport } from "./deckExport";
import { createLogger } from "./logger";

const logger = createLogger("export-deck");

async function main() {
  const [inputArgument, outputArgument] = process.argv.slice(2);

  if (!inputArgument) {
    logger.error("Usage: npm run export:deck -- <input.txt> [output.json]");
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(inputArgument);
  const outputPath = outputArgument
    ? path.resolve(outputArgument)
    : path.format({
        dir: path.dirname(inputPath),
        name: path.parse(inputPath).name,
        ext: ".json",
      });

  const decklistText = await readFile(inputPath, "utf8");
  const { document } = await createDeckExport(decklistText, {
    createdBy: "cli",
    inputLabel: inputPath,
    outputPath,
    fileStem: path.parse(inputPath).name,
  });

  logger.info(`Deck export written to ${outputPath}`);
  logger.info(`Resolved cards: ${document.result.resolvedCount}`);
  logger.info(`Unresolved cards: ${document.result.unresolvedCount}`);
}

main().catch((error) => {
  logger.error("Deck export failed.", error);
  process.exitCode = 1;
});
