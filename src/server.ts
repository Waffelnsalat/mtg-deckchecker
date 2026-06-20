import { createApp } from "./app";
import { createLogger } from "./logger";

const port = Number(process.env.PORT ?? "3000");
const app = createApp();
const logger = createLogger("server");

app.listen(port, () => {
  logger.info(`MTG Deckchecker web app listening on http://localhost:${port}`);
});
