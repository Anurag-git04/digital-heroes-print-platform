"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#f5f3ee",
          color: "#171916",
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: 460, textAlign: "center" }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#e45a2b",
            }}
          >
            Digital Heroes
          </p>
          <h1 style={{ marginTop: 12, fontSize: 32, lineHeight: 1.1 }}>
            Something unexpected happened.
          </h1>
          <p style={{ marginTop: 12, color: "#666b63", lineHeight: 1.6 }}>
            Please retry the request. If the problem continues, return to the home page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              background: "#e45a2b",
              color: "#fff",
              border: 0,
              borderRadius: 999,
              padding: "12px 24px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </main>
      </body>
    </html>
  );
}
