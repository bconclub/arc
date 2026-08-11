/**
 * ARC brand marks, rendered from the real logo files.
 *
 * The supplied artwork is a blackout variant, the letterform is #1C1E22 on a
 * solid black canvas, which is invisible on the dark shell and can't be tinted
 * from CSS. So the sources are rebuilt at build-prep time into transparent PNGs
 * with the ink recoloured: `arc-logo.png` carries a near-white letterform for
 * dark surfaces, `arc-logo-light.png` a charcoal one for light. The lime wedge
 * (#CBFA0A) is the brand constant and is identical in both.
 *
 * Swapping two images rather than tinting one keeps the wedge untouched, a CSS
 * filter that lightened the letterform would shift the lime as well.
 *
 * Sizes below are the intrinsic pixel dimensions of those files; width is
 * derived from them so the marks can never be stretched by a caller.
 */

export const ARC_LIME = "#CBFA0A";

const LOGO_ASPECT = 416 / 96;    // full wordmark
const ICON_ASPECT = 181 / 128;   // "A" mark alone

function Swappable({
  base, alt, height, aspect, className,
}: {
  base: string; alt: string; height: number; aspect: number; className: string;
}) {
  const width = Math.round(height * aspect);
  // Plain <img>: these are fixed-size static brand assets already exported at
  // 3x, so the Next optimiser has nothing to add.
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/${base}.png`}
        alt={alt}
        width={width}
        height={height}
        className={`arc-mark-dark ${className}`}
        style={{ width, height }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/${base}-light.png`}
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        className={`arc-mark-light ${className}`}
        style={{ width, height }}
      />
    </>
  );
}

/** The "A" mark on its own, for collapsed rails and small slots. */
export function ArcMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return <Swappable base="arc-icon" alt="ARC" height={size} aspect={ICON_ASPECT} className={className} />;
}

/** Full ARC wordmark, for the sidebar header. `size` is the height. */
export function ArcLogo({ size = 26, className = "" }: { size?: number; className?: string }) {
  return <Swappable base="arc-logo" alt="ARC" height={size} aspect={LOGO_ASPECT} className={className} />;
}
