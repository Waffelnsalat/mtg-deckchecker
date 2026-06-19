import { readFile } from "node:fs/promises";
import path from "node:path";
import { createDeckExport } from "./deckExport";

async function main() {
  const [inputArgument, outputArgument] = process.argv.slice(2);

  if (!inputArgument) {
    console.error("Usage: npm run export:deck -- <input.txt> [output.json]");
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

  console.log(`Deck export written to ${outputPath}`);
  console.log(`Resolved cards: ${document.result.resolvedCount}`);
  console.log(`Unresolved cards: ${document.result.unresolvedCount}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
