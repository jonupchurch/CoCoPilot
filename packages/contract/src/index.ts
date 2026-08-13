/**
 * The one definition of CoCoapilot's push contract.
 *
 * The service and both clients import from here rather than restating the
 * payload, which is the only thing stopping three front doors from drifting.
 * Nothing in this package touches the filesystem or the network — that keeps the
 * published client free of Node-only surface and keeps the service's
 * "never writes, never reads the repository" guarantee easy to verify.
 */

export * from './caps.js';
export * from './errors.js';
export * from './ports.js';
export * from './schema.js';
export * from './url.js';
export * from './version.js';
