"use client";

// Last-resort boundary: replaces the root layout if it itself throws, so it must
// render its own <html>/<body> and can't depend on app styles — use inline styles.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#07090d",
          color: "#e6e9ef",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Claude Mission Control — kritischer Fehler</h1>
        <p style={{ maxWidth: "32rem", fontSize: "0.875rem", color: "#8b94a7", wordBreak: "break-word" }}>
          {error.message || "Unbekannter Fehler"}
        </p>
        <button
          onClick={reset}
          style={{
            border: "1px solid #1c2230",
            background: "transparent",
            color: "#e6e9ef",
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          Neu laden
        </button>
      </body>
    </html>
  );
}
