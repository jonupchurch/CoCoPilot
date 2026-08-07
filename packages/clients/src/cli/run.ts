import { parseArgs } from 'node:util';

import { CHIPS, type Chip } from '@cocoapilot/contract';

import { note, report, type ClientResult } from '../client.js';
import type { SendOptions } from '../transport.js';

/**
 * `cocoapilot report` and `cocoapilot note`, for hooks and build scripts.
 *
 * Kept separate from the binary so tests can drive it without spawning a
 * process, and written against injected IO so the exit-code table is assertable
 * rather than merely documented.
 */

export const USAGE = [
  'Usage:',
  '  cocoapilot report [--task ID] [--note TEXT] [--chip STATE]',
  '  cocoapilot note TEXT [--source TEXT]',
  '',
  `  --chip  one of: ${CHIPS.join(', ')}`,
  '',
  'Repository and branch come from the working directory. Reports from here are',
  'attributed to a shared script session, not to an agent.',
  '',
  'Exit codes: 0 delivered or no board running, 1 invalid usage or not in a',
  'repository, 2 rejected by the board.',
].join('\n');

export interface CliIo {
  out(line: string): void;
  err(line: string): void;
}

export interface CliDeps extends SendOptions {
  cwd?: string | undefined;
  io: CliIo;
}

export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_REJECTED = 2;

export async function run(argv: readonly string[], deps: CliDeps): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        task: { type: 'string' },
        note: { type: 'string' },
        chip: { type: 'string' },
        source: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    return usage(deps.io, error instanceof Error ? error.message : 'could not parse arguments');
  }

  if (parsed.values.help === true) {
    deps.io.out(USAGE);
    return EXIT_OK;
  }

  const [command, ...rest] = parsed.positionals;

  switch (command) {
    case 'report': {
      if (rest.length > 0) return usage(deps.io, `unexpected argument: ${rest[0] ?? ''}`);

      const chip = parsed.values.chip;
      if (chip !== undefined && !isChip(chip)) {
        return usage(deps.io, `unknown chip: ${chip}`);
      }

      return finish(
        deps.io,
        await report(
          { task: parsed.values.task, note: parsed.values.note, chip },
          { ...deps, sessionId: null },
        ),
      );
    }

    case 'note': {
      const text = rest.join(' ').trim();
      if (text === '') return usage(deps.io, 'note requires text');

      return finish(
        deps.io,
        await note({ text, source: parsed.values.source }, { ...deps, sessionId: null }),
      );
    }

    case undefined:
      return usage(deps.io, 'no command given');

    default:
      return usage(deps.io, `unknown command: ${command}`);
  }
}

function isChip(value: string): value is Chip {
  return (CHIPS as readonly string[]).includes(value);
}

function usage(io: CliIo, problem: string): number {
  io.err(problem);
  io.err(USAGE);
  return EXIT_USAGE;
}

function finish(io: CliIo, result: ClientResult): number {
  switch (result.kind) {
    case 'delivered':
      io.out(result.message);
      return EXIT_OK;

    case 'no-board':
      // Exit 0, on stdout, on purpose. These run from hooks, and a hook that
      // failed because a dashboard was closed would be a monitoring tool
      // breaking the work it monitors.
      io.out(result.message);
      return EXIT_OK;

    case 'version-mismatch':
      // Worth seeing, not worth failing a hook over. Nothing was sent.
      io.err(result.message);
      return EXIT_OK;

    case 'not-a-repo':
      io.err(result.message);
      return EXIT_USAGE;

    case 'rejected':
      io.err(result.message);
      return EXIT_REJECTED;
  }
}
