// The /pitch narration in Indian languages (the proxesi set; Odia is left out
// because ElevenLabs v3 does not speak it). On-screen text stays English;
// only the voice changes.
//
//   node --env-file=<file with ANTHROPIC_API_KEY and ELEVENLABS_API_KEY> scripts/pitch-narration-i18n.mjs [lang ...]
//
// 1. Claude translates the English lines into spoken, natural narration and
//    saves them to scripts/pitch-i18n/<lang>.json (review and edit there).
//    An existing file is reused, so hand edits survive a re-run.
// 2. ElevenLabs v3 voices each line with the same narrator as English, into
//    public/pitch/audio/<lang>/<card>.mp3.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const VOICE = "vYENaCJHl4vFKNDYPr8y"; // the English narrator, speaking every language
const MODEL = "claude-sonnet-5-5";

// code, ElevenLabs language, name, how PROXe and Thanzeel are written so they are said right
export const LANGS = [
  ["hi-IN", "hi", "Hindi", "प्रॉक्सी", "तनज़ील"],
  ["ta-IN", "ta", "Tamil", "ப்ராக்ஸி", "தன்ஸீல்"],
  ["te-IN", "te", "Telugu", "ప్రాక్సీ", "తన్‌జీల్"],
  ["kn-IN", "kn", "Kannada", "ಪ್ರಾಕ್ಸಿ", "ತನ್‌ಜೀಲ್"],
  ["ml-IN", "ml", "Malayalam", "പ്രോക്സി", "തൻസീൽ"],
  ["mr-IN", "mr", "Marathi", "प्रॉक्सी", "तनझील"],
  ["bn-IN", "bn", "Bengali", "প্রক্সি", "তানজীল"],
  ["gu-IN", "gu", "Gujarati", "પ્રોક્સી", "તનઝીલ"],
  ["pa-IN", "pa", "Punjabi", "ਪ੍ਰੌਕਸੀ", "ਤਨਜ਼ੀਲ"],
];

async function englishLines() {
  const src = await readFile("scripts/pitch-narration.mjs", "utf8");
  const out = {};
  for (const m of src.matchAll(/^ {2}(\w+): "(.*)",$/gm)) out[m[1]] = m[2].replace(/\\"/g, '"');
  return out;
}

async function translate(lines, name, proxe, thanzeel) {
  const prompt = `Translate this startup pitch voiceover into ${name}, as a native ${name} speaker would narrate it to an investor: warm, natural, spoken, not literal or bookish.
Rules:
- Keep audio tags like [warmly], [sighs], [chuckles], [confident], [softly] exactly as they are, in English, in square brackets, at the same spot.
- Write the brand PROXe as "${proxe}" and the founder's name Thanzeel as "${thanzeel}".
- Everyday English business words people in India say in English (WhatsApp, Instagram, Messenger, demo, leads, dashboard, follow-up, pre-seed, ad) stay as those English words, written in ${name} script.
- Write numbers and money as spoken words in ${name}.
- Keep the pauses (... and commas) where they help the narration.
Return only a JSON object with exactly the same keys.

${JSON.stringify(lines, null, 2)}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`claude ${res.status} ${JSON.stringify(j).slice(0, 200)}`);
  const text = j.content.map((c) => c.text ?? "").join("");
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

async function tts(text, lang) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_v3", language_code: lang, voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
  });
  if (!res.ok) throw new Error(`tts ${res.status} ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

const only = process.argv.slice(2);
const english = await englishLines();
await mkdir("scripts/pitch-i18n", { recursive: true });
for (const [code, el, name, proxe, thanzeel] of LANGS) {
  if (only.length && !only.includes(code)) continue;
  const file = `scripts/pitch-i18n/${code}.json`;
  let lines;
  if (existsSync(file)) lines = JSON.parse(await readFile(file, "utf8"));
  else {
    lines = await translate(english, name, proxe, thanzeel);
    await writeFile(file, JSON.stringify(lines, null, 2) + "\n");
  }
  const dir = `public/pitch/audio/${code}`;
  await mkdir(dir, { recursive: true });
  for (const [key, line] of Object.entries(lines)) {
    if (!english[key]) continue;
    const raw = `${dir}/${key}.raw.mp3`;
    await writeFile(raw, await tts(line, el));
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ac", "1", "-b:a", "48k", `${dir}/${key}.mp3`]);
    await rm(raw);
  }
  console.log(`${code}: ${Object.keys(lines).length} clips`);
}
