# Reuse the PROXe V1 / Brain pieces, never rebuild them

**Founder, 2026-10-25:** "Please bring in all the main things that we have for proxy... the gradient, the backend, the
end screen... Don't have to recreate any of those." And: "Look at the newer versions of PROXe V1 Live and Brain. That
is how we are using it. That is how it should look."

The PROXe V1 launch film (EDITR task T20) and the PROXe Brain video are the reference look. Their code is in
`C:\dev\builds\proxe-clips\PROXe-Clips\edit` (Remotion). Use these directly:

| Piece | Where | Used for |
|---|---|---|
| Horizon stage (navy + soft colour band rising from the bottom) | `src/Launch.tsx` `Stage` with `BgContext` = `horizon` | Every graphic scene |
| Brand colours, fonts (Hubot Sans, Inter, JetBrains Mono), `BRAND_BG`, grain | `src/brand.ts` | Type and colour |
| Orb | `src/v1/OrbV1.tsx` | End card, channels scene |
| PROXe logo | `public/brand/proxe-logo-white.webp` | End card |
| Instagram / WhatsApp phone mock-ups (`Phone`, `AppHead`, `B`, `Av`, `Auto`, `Typing`) | `src/v1/Beats4.tsx` (exported) | The business's inbox |
| Lost-leads Notice cards (frosted glass, "No reply") and `glass` style | `src/v1/Beats.tsx` (exported) | Overnight pile-up |
| Channel icons `CH` | `src/LaunchPanels.tsx` | Channels scene |
| Captions, stills, safe zones (India ads kit) | `src/ads/AdKit.tsx` | Every live-action shot |
| Music bed (founder-approved for V1) | EDITR `tasks/T20.../audio/v6/music_v2_A_edit.wav` | Under every UK ad |

UK ad pieces built from these (exported from `src/uk/UK.tsx`): `Backdrop`, `PileUp`, `Booked` (+ `Thread` config per
industry), `Channels`, `End`, `Cut`, `Shot`, `Title`. A new industry = a new file like `src/uk/U2.tsx` with its own
thread, pile-up items and stills.

## How the end must look and sound (from the newest V1 and Brain films)
- Orb behind, PROXe logo, then the tagline word by word ("Never miss a lead." white, "Ever again." lime #c8f031),
  then goproxe.com. Held about 3.4s, calm.
- **Music only. No chime.** The founder heard our added end chime as "a ting... I don't know where it's coming from".
- The music bed runs under the whole ad low under the voice and lifts on the end card.
- A white screen-blend flash on hard cuts into graphic scenes, as V1 does.
