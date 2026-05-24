"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { asset } from "@/lib/asset";

// Profile photo with a graceful placeholder. Drop a file at `public/profile.jpg`
// and it appears automatically — no code change. Until then (or on load error)
// a styled placeholder is shown, so the layout never breaks.
export function Avatar({
  size = 96,
  src = "/profile.jpg",
  alt = "Belkis Aslani",
  className = "",
}: {
  size?: number;
  src?: string;
  alt?: string;
  className?: string;
}) {
  const [ok, setOk] = useState(true);
  const dim = { width: size, height: size };
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-accent/30 bg-gradient-to-br from-panel to-background ${className}`}
      style={dim}
    >
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset(src)}
          alt={alt}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setOk(false)}
        />
      ) : (
        <User className="text-muted" style={{ width: size * 0.42, height: size * 0.42 }} aria-hidden />
      )}
    </span>
  );
}
