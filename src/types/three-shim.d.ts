// three ships no bundled TypeScript types and we deliberately avoid the heavy
// @types/three package. The 3D graph only uses a tiny, well-known surface
// (Vector2 + UnrealBloomPass), so we declare those modules loosely here.
declare module "three";
declare module "three/examples/jsm/postprocessing/UnrealBloomPass.js";
// d3-force-3d ships no types; the 3D graph only uses forceCollide.
declare module "d3-force-3d";
