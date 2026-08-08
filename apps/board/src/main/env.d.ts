/**
 * Assets imported by the main process.
 *
 * `?asset` is electron-vite's mechanism: the file is emitted next to the main
 * bundle and the import becomes the path it landed at, which is what lets an
 * icon survive both `electron-vite dev` and the built `out/` that ships inside
 * the npm package. The declaration exists because TypeScript otherwise has no
 * idea the suffix means anything.
 */
declare module '*.png?asset' {
  const path: string;
  export default path;
}

declare module '*.ico?asset' {
  const path: string;
  export default path;
}
