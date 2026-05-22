"use client";

// Thin wrapper around react-force-graph-3d so an imperative ref survives
// next/dynamic (which does NOT forward `ref`). We pass the ref through a plain
// `innerRef` prop instead — that's how the widget reaches cameraPosition() and
// the post-processing composer (bloom).
import ForceGraph3D from "react-force-graph-3d";
import type { Ref } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any> & { innerRef?: Ref<unknown> };

export default function ForceGraph({ innerRef, ...props }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const FG = ForceGraph3D as any;
  return <FG ref={innerRef} {...props} />;
}
