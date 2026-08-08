import { describe, expect, it } from 'vitest';

import { PORT_BASE, PORT_COUNT, PORT_RANGE } from '../src/ports.js';
import { APP_NAME, healthPayload, isCoCoapilotHealth } from '../src/version.js';

/**
 * Probing a range means knocking on ports owned by unrelated local software. A
 * client that treated any 200 as success would POST an agent's prompt text and
 * file paths into whatever else happened to answer, so identification is the
 * point of the endpoint and a 200 is not evidence of anything.
 */
describe('isCoCoapilotHealth', () => {
  it('accepts what the board actually serves', () => {
    expect(isCoCoapilotHealth(healthPayload())).toBe(true);
    expect(healthPayload().app).toBe(APP_NAME);
  });

  it('rejects a bare 200 body', () => {
    expect(isCoCoapilotHealth({})).toBe(false);
  });

  it('rejects another program that happens to answer', () => {
    expect(isCoCoapilotHealth({ app: 'grafana', version: '11.0.0', contract: 'v1' })).toBe(false);
    expect(isCoCoapilotHealth({ status: 'ok' })).toBe(false);
    expect(isCoCoapilotHealth('OK')).toBe(false);
    expect(isCoCoapilotHealth(null)).toBe(false);
    expect(isCoCoapilotHealth(undefined)).toBe(false);
  });

  it('rejects a payload naming us but carrying nothing to compare versions with', () => {
    // Decision 27 accepts that a published client can drift from the installed
    // app. Drift is only detectable if the version is actually there.
    expect(isCoCoapilotHealth({ app: APP_NAME })).toBe(false);
    expect(isCoCoapilotHealth({ app: APP_NAME, version: '', contract: 'v1' })).toBe(false);
  });
});

describe('the port range', () => {
  it('is the base plus four, in the order both sides walk', () => {
    expect(PORT_RANGE).toEqual([41847, 41848, 41849, 41850, 41851]);
    expect(PORT_RANGE[0]).toBe(PORT_BASE);
    expect(PORT_RANGE).toHaveLength(PORT_COUNT);
  });

  it('cannot be reordered by a caller', () => {
    expect(Object.isFrozen(PORT_RANGE)).toBe(true);
  });
});
