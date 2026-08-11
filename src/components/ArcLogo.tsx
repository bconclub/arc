/**
 * ARC mark, traced from public/ARC Icon.png.
 *
 * The supplied PNGs can't be used directly in the shell: the full logo has no
 * alpha (solid black canvas) and the icon's letterform is #15171A, which
 * disappears on the dark sidebar. So the letterform here is `currentColor` —
 * it inherits the surrounding text colour and works on either theme — while the
 * lime stays fixed at the sampled brand value.
 *
 * Geometry is measured, not eyeballed: outer edges, inner counter apex and the
 * lime wedge vertices all come from pixel scans of the source file.
 */

export const ARC_LIME = "#CBFA0A";

export function ArcMark({ className = "", size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 906 642"
      width={size * (906 / 642)}
      height={size}
      className={className}
      role="img"
      aria-label="ARC"
    >
      {/* Letterform — inherits colour from the parent. */}
      <path
        d="M391 4 L516 4 L906 642 L755 642 L454 149 L149 642 L0 642 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinejoin="round"
      />
      {/* Lime wedge inside the counter. */}
      <path
        d="M716 338 L241 491 L150 642 L190 642 Z"
        fill={ARC_LIME}
        stroke={ARC_LIME}
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark + wordmark, for the sidebar header. */
export function ArcLogo({ size = 26 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2 text-text">
      <ArcMark size={size} />
      <span
        className="font-extrabold leading-none tracking-[-0.02em]"
        style={{ fontSize: size * 0.86 }}
      >
        ARC
      </span>
    </span>
  );
}
