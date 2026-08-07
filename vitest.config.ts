import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The board and the contract are separate workspaces, but tests resolve the
// contract's *source* rather than its build output so the suite runs without a
// build step. Publishing uses the `exports` map in packages/contract.
const contract = fileURLToPath(new URL('./packages/contract/src/index.ts', import.meta.url));

const alias = { '@cocopilot/contract': contract };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['packages/*/tests/**/*.test.ts', 'apps/*/tests/unit/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['apps/*/tests/integration/**/*.test.ts'],
        },
      },
    ],
  },
});
