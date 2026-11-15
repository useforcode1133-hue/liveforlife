import { createApp } from "./app";
import { env } from "./lib/env";
import { prisma } from "./lib/prisma";

async function main() {
  const app = createApp();
  await prisma.$connect();
  app.listen(env.port, "0.0.0.0", () => {
    console.log(`[api] PG Management API listening on http://localhost:${env.port}`);
  });
}

main().catch((error) => {
  console.error("[api] failed to start", error);
  process.exit(1);
});
