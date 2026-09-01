/**
 * The drifting light behind every dark navy section — the WIPEG
 * translation of the reference template's green hero glow.
 * Pure CSS, no JS, so it costs nothing on the main thread.
 */
export function GlowField({
  variant = "hero",
  className = "",
}: {
  variant?: "hero" | "section" | "footer";
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {variant === "hero" && (
        <>
          <div className="absolute inset-0 grid-lines opacity-60" />
          <div
            className="animate-drift absolute -right-[12%] top-[-18%] size-[46rem] rounded-full opacity-70 blur-[110px]"
            style={{
              background:
                "radial-gradient(circle, rgba(46,86,232,0.85) 0%, rgba(23,52,168,0.35) 45%, transparent 70%)",
            }}
          />
          <div
            className="animate-drift absolute -left-[16%] bottom-[-24%] size-[38rem] rounded-full opacity-55 blur-[120px]"
            style={{
              background:
                "radial-gradient(circle, rgba(231,57,7,0.55) 0%, rgba(198,45,4,0.2) 50%, transparent 72%)",
              animationDelay: "-8s",
              animationDuration: "26s",
            }}
          />
          <div
            className="animate-drift absolute left-[38%] top-[24%] size-[26rem] rounded-full opacity-40 blur-[100px]"
            style={{
              background:
                "radial-gradient(circle, rgba(247,195,67,0.45) 0%, transparent 68%)",
              animationDelay: "-14s",
              animationDuration: "30s",
            }}
          />
        </>
      )}

      {variant === "section" && (
        <>
          <div className="absolute inset-0 dot-grid opacity-40" />
          <div
            className="animate-drift absolute -left-[10%] top-[-30%] size-[34rem] rounded-full opacity-60 blur-[110px]"
            style={{
              background:
                "radial-gradient(circle, rgba(46,86,232,0.75) 0%, transparent 68%)",
            }}
          />
          <div
            className="animate-drift absolute -right-[8%] bottom-[-34%] size-[30rem] rounded-full opacity-45 blur-[110px]"
            style={{
              background:
                "radial-gradient(circle, rgba(231,57,7,0.5) 0%, transparent 70%)",
              animationDelay: "-11s",
            }}
          />
        </>
      )}

      {variant === "footer" && (
        <>
          <div className="absolute inset-0 grid-lines opacity-35" />
          <div
            className="animate-drift absolute left-[20%] top-[-40%] size-[36rem] rounded-full opacity-45 blur-[120px]"
            style={{
              background:
                "radial-gradient(circle, rgba(46,86,232,0.7) 0%, transparent 70%)",
            }}
          />
        </>
      )}
    </div>
  );
}
