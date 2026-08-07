#!/usr/bin/env node
import { run } from './run.js';

/** The `cocoapilot` binary. */
process.exitCode = await run(process.argv.slice(2), {
  io: {
    out: (line) => {
      process.stdout.write(`${line}\n`);
    },
    err: (line) => {
      process.stderr.write(`${line}\n`);
    },
  },
});
