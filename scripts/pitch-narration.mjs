// Generates the /pitch narration: one short clip per card, read by a narrator
// (not the PROXe agent's calling voice), saved as small MP3s under public/pitch/audio/.
//
//   node --env-file=<file with ELEVENLABS_API_KEY> scripts/pitch-narration.mjs [key ...]
//
// The key is only read here, on the machine that runs this; the site serves
// the finished files and never calls ElevenLabs. Re-run after editing a line.
// Needs ffmpeg on PATH for loudness normalising.
import { writeFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";

// Riya Rao, "Confident and Clear": Indian English, built for narration. Swap
// the ID to change the narrator; the agent voice stays for calls only.
const VOICE = "vYENaCJHl4vFKNDYPr8y";
const OUT = "public/pitch/audio";

// Key pointers, not the card read aloud. Keys match the cards in PitchDeck.tsx.
export const LINES = {
  cover: "[warmly] This is PROXe. Your AI, for the customer side of your business. In one line? Never miss a lead, ever again.",
  problem: "Here's the problem. Brands spend money making ads, and running them. The leads show up... and nobody responds. [sighs] The lead goes cold, and the ad money goes with it.",
  gaps: "We see four gaps, again and again. A slow first reply. No follow-up. No-shows. And lost context, between WhatsApp and calls. Under each one... is what PROXe does about it.",
  who: "Who is this for? Any business that runs on leads, and wants to take better care of its customers. Coaching academies, clinics, real estate, training academies, wellness, professional services... if leads come in, PROXe takes care of them.",
  solution: "[confident] PROXe answers in seconds, on every channel. WhatsApp, Instagram, Messenger, voice, and web chat. One AI brain that replies, qualifies, books the call, and keeps following up.",
  how: "The loop is simple. Capture every lead. Nurture it, in the business's own tone. Close, by booking the demo or the visit. And repeat, learning from every single conversation.",
  dashboard: "And the founder sees everything. This is a real PROXe dashboard. Every lead is scored, with the next step, and where it came from.",
  memory: "PROXe keeps one memory across channels. A message on Monday. A call on Thursday. The pricing page on Saturday. It connects all of it, so the customer never has to repeat themselves.",
  price: "The model is simple. Nine thousand, nine hundred and ninety nine rupees a month, for a thousand managed leads. That's under ten rupees a lead... when businesses already spend ten to a hundred rupees on every single one.",
  traction: "Here's where we are, against our plan to the first hundred customers. Five thousand leads. A thousand demos. A hundred customers. The rings show how far along we are, today.",
  round: "[confident] We're raising our pre-seed. Five percent, for twenty five lakh rupees. The plan is the one you just saw. And the gold shows how much of the round is already committed.",
  founder: "This is Thanzeel, our founder. Seven years in marketing, across retail, hospitality, real estate and healthcare. [chuckles] And honestly? We had this exact problem. In our own businesses, and in our clients'. We've seen it up close... and we're on a mission to solve it.",
  talk: "[warmly] That's the pitch. Now... talk to PROXe. Tap the orb to speak with it right here, or leave your number, and PROXe will call you in seconds.",
};

// Said "Proxy". Spelt PROXe, the voice guesses at it, so it reads the sound instead.
// Names said the way they are said: PROXe is "Proxy", Thanzeel is "Than-zeel".
const speakable = (t) => t.replace(/PROXe/g, "Proxy").replace(/Thanzeel/g, "Than-zeel");

async function tts(text, model) {
  text = speakable(text);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
  });
  if (!res.ok) throw new Error(`${model} ${res.status} ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

if (!process.env.ELEVENLABS_API_KEY) { console.error("ELEVENLABS_API_KEY is not set"); process.exit(1); }
await mkdir(OUT, { recursive: true });
const only = process.argv.slice(2);
for (const [key, line] of Object.entries(LINES)) {
  if (only.length && !only.includes(key)) continue;
  let buf;
  try {
    buf = await tts(line, "eleven_v3"); // v3 performs tags like [chuckles]
  } catch (e) {
    console.warn(`v3 failed for ${key}, falling back: ${e.message}`);
    buf = await tts(line.replace(/\[[^\]]+\]\s*/g, ""), "eleven_multilingual_v2");
  }
  const raw = `${OUT}/${key}.raw.mp3`;
  await writeFile(raw, buf);
  // Even loudness across clips (this voice is mastered quiet), mono, small.
  // v3 sometimes rushes a line. Keep every clip near one pace (~132 words a
  // minute) by slowing fast ones, pitch unchanged.
  const secs = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw]).toString());
  const words = line.replace(/\[[^\]]+\]/g, "").split(/\s+/).filter(Boolean).length;
  const wpm = (words / secs) * 60;
  const tempo = wpm > 140 ? Math.max(0.8, 132 / wpm) : 1;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af", `atempo=${tempo.toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11`, "-ac", "1", "-b:a", "64k", `${OUT}/${key}.mp3`]);
  await rm(raw);
  if (tempo < 1) console.log(`  ${key}: ${wpm.toFixed(0)} wpm, slowed to ${(wpm * tempo).toFixed(0)}`);
  console.log(`${key}.mp3`);
}
