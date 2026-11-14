# Z's feedback on the AI callers (newest first)

- **2026-11-14** (Pratham Motors) "She was giving the number, we didn't take the entire number, and it said thank you Sangeeta. We should understand the number and check the number; it didn't do that." -> number capture rule (10 digits, read back, confirm) + `referral_number`.

- **2026-11-13** "Calls Proxy books, like Pai Mobiles 2:33, I'll not be calling: Proxy has to call them back. Follow up every call-back until we get the information from them or a no. Only those two outcomes, until then we keep going." -> auto call-back dialler + calling-back prompt block.

- **2026-11-12** (Optum Car Care call) "I am not interested, and it just kept us [going]" -> the line dropped "not" (transcript: "I'm, uh, interested. Thank you."), the caller said "great to hear" and pushed a founder call. Rule: a bare "interested, thank you" after a brush-off is a no; close.

- **2026-11-12** (Brik Oven call) "The person said call the manager back after 30 minutes, and it kept probing, asking something. Not correct. After half an hour we should call. Stop it." -> top rule: call-later beats everything; say the time once and end, no more questions.

- **2026-11-12** (Bachpan Play School call) "Don't repeat things: it said I'll call you at 4, then again I'll call you at 4 PM. That's robotic. Say the time once, then 'I'll call you then', that's it." -> time confirmed once, naturally; never repeated.

- **2026-11-12** "Try to get their name, but don't call them by name; Indian names will break. Just ask who can I ask for. Don't repeat their name." -> ask for the name (or whom to ask for), record it (`contact_name`), never say it back.

- **2026-11-12** (test call) "My name is wrong, it's Tanzeel not Tanzeem. Don't say the full name, just say 'our founder'; only if they ask, 'our founder Thanzeel would like to call you', stress on the zeel part." -> 'our founder' everywhere; first name only if asked, Tan-ZEEL; no surname.

- **2026-11-12** "Proxy starts the call too fast. The call should be based on the new GTM learnings in ARC (Axlrate)." -> voice speed 0.9, pause after the first line; one loss question (session 09: loss as per TEMQ) before asking for a call with Thanzeel; no demo push before their loss.

- **2026-11-12** "When someone asks what company this is: I am Proxy, from Beacon Club; the founder is Thanzeel Ashruf, pronounced properly; we run marketing systems for businesses across Bangalore." -> 'Who we are' answer + pronunciation guide (Tan-zeel Ash-ruf, Proxy, Beacon Club).

- **2026-11-11** Laptop Store call: line unclear, they kept talking, the agent kept asking. "We should have a clarity rating; if clarity is below a threshold, end the call saying we'll reach out." -> clarity rule: on unclear line, one apology line, end, retry later (not a no).

- **2026-11-11** "When they are ready to close, close the call and just let it be." -> when they signal the end, one warm closing line and hang up; no extra question or pitch.

- **2026-11-10** "That call just dropped, how did it go to interested?" (Brik Oven: manager said 'yes, tell me', then the call dropped) -> outcome rule tightened: interested only on an explicit ask (details, demo, price, callback, WhatsApp); 'yes tell me' then a drop = connected.

- **2026-11-10** "After the call, if someone says send me the details on WhatsApp, it should say OK, I'll send it on WhatsApp. It's not doing that." -> agent confirms WhatsApp, checks the number, asks a follow-up time; outcome interested + "WhatsApp details"; PROXe must actually send the details on WhatsApp after the call (Dev, needs an approved template).

- **2026-11-10** "If the name can be pronounced, like Bangalore Baptist Hospital or Wonder Bums Studios, why are we not
  using the name? Only if it's something you can't pronounce say coaching or anything." -> first line = "Hi, is this
  {business_name}?" with a short, sayable name; type only if the name is hard to say.
- **2026-11-10** "Don't make the call too long." Numbers first: keep the call short.
- **2026-11-02** "Make sure we're not calling clinics and saying something else." -> the right `vertical` for every type.
- **2026-10-30** "When they ask what it's about and Proxy says 'ok I'll let you go', she was getting warm." -> a question
  is not a no; answer in one line and continue; end only on a clear no after one polite check.
- **2026-10-30** "Don't call anyone 'the clinic' / 'sir'; use their name; if you don't know the name say something close."
- **2026-10-28** "The calls are breaking." Line quality on some calls (one-way audio / breaking voice): watch, likely the
  carrier leg.
- **2026-10-27** "Don't call the same number again after they answered." -> no redial of anyone who gave an answer.
- **2026-10-27** "Calling hours 11 AM to 5:30 PM, Mon-Sat."
- **2026-10-26** "The first intro line should change; test a few openers and see which gets through." -> the 5 BDR openers.
