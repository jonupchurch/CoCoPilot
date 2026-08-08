import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Workspaces resolve each other's *source* rather than their build output, so
// the suite runs without a build step. Publishing uses each package's own
// `exports` map.
const resolve = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

const alias = {
  'cocoapilot-contract': resolve('./packages/contract/src/index.ts'),
  // A devDependency of packages/clients, used only to run a real service in
  // integration tests. It must never reach the published dependency tree.
  '@cocoapilot/board': resolve('./apps/board/src/main/index.ts'),
};

const NEVER = ['**/node_modules/**', '**/dist/**'];

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'packages/*/tests/**/*.test.ts',
            'apps/*/tests/unit/**/*.test.ts',
            // Co-located, per the renderer stack pack: a helper's test sits
            // beside it rather than in a parallel tree.
            'apps/*/src/**/*.test.ts',
          ],
          exclude: [...NEVER, '**/tests/integration/**', '**/tests/e2e/**'],
        },
      },
      {
        // Repo-wide checks belonging to no package. Kept separate so it is
        // obvious where a cross-cutting invariant goes, rather than being
        // wedged into whichever workspace happened to be open.
        test: {
          name: 'repo',
          environment: 'node',
          include: ['tests/**/*.test.ts', 'scripts/tests/**/*.test.ts'],
          exclude: NEVER,
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['packages/*/tests/integration/**/*.test.ts', 'apps/*/tests/integration/**/*.test.ts'],
          exclude: NEVER,
        },
      },
    ],
  },
});
