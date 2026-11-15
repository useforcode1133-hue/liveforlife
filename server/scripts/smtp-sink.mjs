#!/usr/bin/env node
/**
 * Development SMTP sink.
 *
 * Prints every outgoing email to the console and stores the last messages in
 * scripts/.mail-sink.json, so you can verify the mail pipeline without a real
 * provider. Start it with `npm run mail:sink`, then run the API with
 * SMTP_HOST=127.0.0.1 SMTP_PORT=2525.
 */
import { SMTPServer } from "smtp-server";
import fs from "node:fs";
import path from "node:path";

const outFile = path.join(process.cwd(), "scripts", ".mail-sink.json");
const received = [];

const server = new SMTPServer({
  authOptional: true,
  // Plain local SMTP for development; a real provider would use valid TLS.
  disabledCommands: ["AUTH", "STARTTLS"],
  onData(stream, session, callback) {
    let raw = "";
    stream.on("data", (chunk) => {
      raw += chunk.toString();
    });
    stream.on("end", () => {
      const entry = {
        to: session.envelope.rcptTo.map((recipient) => recipient.address),
        from: session.envelope.mailFrom && "address" in session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
        receivedAt: new Date().toISOString(),
        raw,
      };
      received.push(entry);
      fs.writeFileSync(outFile, JSON.stringify(received, null, 2));
      const subject = /^Subject: (.*)$/m.exec(raw)?.[1] ?? "(no subject)";
      console.log(`[smtp] ${entry.to.join(", ")} — ${subject}`);
      callback();
    });
  },
});

server.listen(2525, "127.0.0.1", () => {
  console.log("Development SMTP sink listening on 127.0.0.1:2525");
  console.log(`Messages are written to ${outFile}`);
});
