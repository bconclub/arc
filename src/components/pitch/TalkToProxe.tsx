"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, PhoneCall, Loader2, Check } from "lucide-react";

/**
 * The pitch's last card: talk to PROXe in the browser (an orb), or get a call.
 *
 * The orb uses the same public ElevenLabs agent as goproxe.com; the ID is a
 * public identifier, not a secret. The agent only connects from domains on its
 * allowlist (ElevenLabs → Agent → Security), so arc.bconclub.com must be there.
 * The SDK loads only when someone taps the orb, so the deck stays light.
 */
const AGENT_ID = process.env.NEXT_PUBLIC_PITCH_AGENT_ID || "agent_7301kz312hzffr292fz3d6v04c9q";
// Opening line override works only once "First message" overrides are enabled
// on the agent. Until then the agent opens with its own line and gets the
// pitch context as a contextual update instead.
const USE_OVERRIDE = process.env.NEXT_PUBLIC_PITCH_ORB_OVERRIDE === "1";
const FIRST_MESSAGE = "Hey, you just went through our pitch. What do you think of PROXe? I can walk you through anything you want to know.";
const CONTEXT =
  "The person you are speaking to just finished the PROXe investor pitch inside ARC. Ask what they thought, answer questions about PROXe, the product, pricing (₹9,999 a month) and the pre-seed round, and offer to set up a call with Thanzeel, the founder.";

type OrbState = "idle" | "connecting" | "live" | "ending";
type Session = { endSession: () => Promise<void>; sendContextualUpdate?: (t: string) => void };

export function TalkToProxe({ onActive }: { onActive: (live: boolean) => void }) {
  const [state, setState] = useState<OrbState>("idle");
  const [speaking, setSpeaking] = useState(false);
  const [orbError, setOrbError] = useState("");
  const session = useRef<Session | null>(null);

  const [phone, setPhone] = useState("");
  const [call, setCall] = useState<"idle" | "sending" | "ringing" | "error">("idle");
  const [callMsg, setCallMsg] = useState("");

  useEffect(() => { onActive(state !== "idle"); }, [state, onActive]);
  useEffect(() => () => { session.current?.endSession().catch(() => {}); }, []);

  async function toggleOrb() {
    if (state === "live" || state === "connecting") {
      setState("ending");
      await session.current?.endSession().catch(() => {});
      session.current = null;
      setState("idle");
      return;
    }
    setOrbError("");
    setState("connecting");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("idle");
      setOrbError("Allow the microphone to talk to PROXe.");
      return;
    }
    try {
      const { Conversation } = await import("@elevenlabs/client");
      const s = (await Conversation.startSession({
        agentId: AGENT_ID,
        ...(USE_OVERRIDE ? { overrides: { agent: { firstMessage: FIRST_MESSAGE } } } : {}),
        onConnect: () => setState("live"),
        onDisconnect: () => { session.current = null; setState("idle"); setSpeaking(false); },
        onModeChange: ({ mode }: { mode: string }) => setSpeaking(mode === "speaking"),
        onError: () => setOrbError("PROXe dropped the line. Tap to try again."),
      })) as unknown as Session;
      session.current = s;
      s.sendContextualUpdate?.(CONTEXT);
      // This voice is mastered quiet; goproxe.com applies the same gain.
      try {
        (s as unknown as { output?: { setVolume?: (v: number) => void } }).output?.setVolume?.(5.5);
      } catch { /* stock volume is fine */ }
    } catch {
      setState("idle");
      setOrbError("PROXe could not connect from here. Try the call instead.");
    }
  }

  async function requestCall(e: React.FormEvent) {
    e.preventDefault();
    setCall("sending");
    setCallMsg("");
    const res = await fetch("/api/pitch/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (j.ok) { setCall("ringing"); setCallMsg("PROXe is calling you now."); return; }
    setCall("error");
    setCallMsg(
      j.reason === "bad_phone" ? "Enter a 10-digit Indian mobile number."
      : j.reason === "recently_called" ? "PROXe already called this number today."
      : "The call did not go through. Try again in a minute.",
    );
  }

  const live = state === "live";
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <button
          onClick={toggleOrb}
          aria-label={live ? "End the conversation" : "Talk to PROXe"}
          className="relative flex h-36 w-36 items-center justify-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-[#0b0c08]/30"
        >
          {/* Rings breathe while PROXe talks */}
          <span className={`absolute inset-0 rounded-full bg-[#0b0c08]/10 ${live ? "animate-ping" : ""}`} style={{ animationDuration: speaking ? "1.1s" : "2.4s" }} />
          <span className="absolute inset-3 rounded-full bg-[#0b0c08]/15" />
          <span
            className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#0b0c08] text-[#cbfa0a] transition-transform duration-300"
            style={{ transform: speaking ? "scale(1.08)" : "scale(1)" }}
          >
            {state === "connecting" || state === "ending" ? <Loader2 size={28} className="animate-spin" /> : <Mic size={30} />}
          </span>
        </button>
        <p className="text-[14px] font-medium text-[#0b0c08]">
          {state === "connecting" ? "Connecting…" : live ? (speaking ? "PROXe is talking" : "Listening · tap to end") : "Tap to talk to PROXe"}
        </p>
        {orbError && <p className="text-center text-[12.5px] text-[#5c1f00]">{orbError}</p>}
      </div>

      <form onSubmit={requestCall} className="mt-4 space-y-2">
        <p className="text-[12.5px] font-medium text-[#0b0c08]/70">Or get a call in five seconds</p>
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-[#0b0c08] px-4">
            <span className="text-[15px] text-white/50">+91</span>
            <input
              value={phone}
              onChange={(e) => { setPhone(e.target.value); if (call !== "sending") setCall("idle"); }}
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="Mobile number"
              aria-label="Mobile number"
              className="h-12 min-w-0 flex-1 bg-transparent pl-2 text-[15px] text-white outline-none placeholder:text-white/35"
            />
          </div>
          <button
            type="submit"
            disabled={call === "sending" || phone.replace(/\D/g, "").length < 10}
            className="flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-white px-4 text-[14px] font-semibold text-[#0b0c08] transition-opacity disabled:opacity-40"
          >
            {call === "sending" ? <Loader2 size={16} className="animate-spin" /> : call === "ringing" ? <Check size={16} /> : <PhoneCall size={16} />}
            Call me
          </button>
        </div>
        {callMsg && <p className={`text-[12.5px] ${call === "error" ? "text-[#5c1f00]" : "text-[#0b0c08]"}`}>{callMsg}</p>}
      </form>
    </div>
  );
}
