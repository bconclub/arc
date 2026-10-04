"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, PhoneCall, Loader2, Check } from "lucide-react";

/**
 * The pitch's last card: talk to PROXe in the browser (an orb), or get a call.
 *
 * Both use the "PROXe Pitch" ElevenLabs agent: its own prompt treats the
 * person as an investor who just read the pitch, opens with "you just finished
 * looking at the pitch, any questions? can I get your name?", and knows the
 * round. The agent ID is a public identifier; the agent only accepts
 * arc.bconclub.com (and localhost). The SDK loads on tap, so the deck stays light.
 */
const AGENT_ID = process.env.NEXT_PUBLIC_PITCH_AGENT_ID || "agent_2201m434mm0zfgrsqexd5510g8ak";

type OrbState = "idle" | "connecting" | "live" | "ending";
type Session = { endSession: () => Promise<void> };

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
        onConnect: () => setState("live"),
        onDisconnect: () => { session.current = null; setState("idle"); setSpeaking(false); },
        onModeChange: ({ mode }: { mode: string }) => setSpeaking(mode === "speaking"),
        onError: () => setOrbError("PROXe dropped the line. Tap to try again."),
      })) as unknown as Session;
      session.current = s;
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
          className="relative flex h-36 w-36 items-center justify-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-white/40"
        >
          {/* Rings breathe while PROXe talks */}
          <span className={`absolute inset-0 rounded-full bg-white/10 ${live ? "animate-ping" : ""}`} style={{ animationDuration: speaking ? "1.1s" : "2.4s" }} />
          <span className="absolute inset-3 rounded-full bg-white/15" />
          <span
            className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white text-[#6d28d9] transition-transform duration-300"
            style={{ transform: speaking ? "scale(1.08)" : "scale(1)" }}
          >
            {state === "connecting" || state === "ending" ? <Loader2 size={28} className="animate-spin" /> : <Mic size={30} />}
          </span>
        </button>
        <p className="text-[14px] font-medium text-white">
          {state === "connecting" ? "Connecting…" : live ? (speaking ? "PROXe is talking" : "Listening · tap to end") : "Tap to talk to PROXe"}
        </p>
        {orbError && <p className="text-center text-[12.5px] text-[#fecaca]">{orbError}</p>}
      </div>

      <form onSubmit={requestCall} className="mt-4 space-y-2">
        <p className="text-[12.5px] font-medium text-white/70">Or get a call in five seconds</p>
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-[#16112b] px-4">
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
            className="flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-white px-4 text-[14px] font-semibold text-[#4c1d95] transition-opacity disabled:opacity-40"
          >
            {call === "sending" ? <Loader2 size={16} className="animate-spin" /> : call === "ringing" ? <Check size={16} /> : <PhoneCall size={16} />}
            Call me
          </button>
        </div>
        {callMsg && <p className={`text-[12.5px] ${call === "error" ? "text-[#fecaca]" : "text-white"}`}>{callMsg}</p>}
      </form>
    </div>
  );
}
