# Long sentences in the player — design

Owner request (2026-10-06, translated): *"In Bible reading, for longer sentences the analysis does not let me finish the
sentence before scoring it — make it a better experience. When I make an error while reading the Bible the microphone
controls are pushed down and I have to scroll to use them; they should stay put. The error message should be placed so
that it does not break the interface."* The owner was away; the choices below were made by Claude with the stated reasons.

## What happens today

- **Bible segments are long**: median 21 words (KJV) / 16 (PBG), 90th percentile 34 / 29, cap 40 (`LONG_SEGMENT_WORDS`).
- **False "restart" verdicts.** Live mode treats "the sentence's first word again, followed by no errors" as the speaker
  starting over after a slip (DECISIONS #42). Once one word of a long sentence was misheard, the *first word alone*
  qualifies — so the next "And" / "I" / "A" inside the sentence rejects the try mid-sentence and the rest can no longer
  match. The first word recurs inside 40 % of KJV segments and 19 % of PBG segments.
- **Every 1.5 s pause settles the sentence.** A breath at a comma, or a moment to read ahead in an archaic verse, ends
  the try with "missing words" — in live mode (silence timer) and in tap mode (the utterance ends).
- **Layout.** The page grows with content and only the footer is `sticky`. After a rejection the sentence appears twice
  (the stage at reading size, then the diff card), the Guardian's bubble and the card land under the footer, and on
  phones with collapsing browser bars the controls end up below the fold.

## Decisions

1. **A restart must look like one**: the words after the candidate restart must begin with the sentence's first three
   words (fewer for shorter sentences), each said or near. A lone recurring "And" is just a word of the sentence.
2. **A pause in the middle of a sentence waits.** On a short pause the tracker settles as before when the speaker reached
   the end of the sentence or what was said already passes; otherwise it answers `holding`, and the player settles only
   when the quiet lasts — 4 s in all (1.5 s + 2.5 s hold). Any new word cancels the hold. Applies to every sentence: in
   memory mode recalling the next words is exactly such a pause.
3. **Tap mode lets long sentences breathe**: the quiet time that ends an utterance grows with the sentence — 1.5 s up to
   10 words, +60 ms per word, at most 3 s (Web Speech and Whisper alike, per `start()`).
4. **The player is a fixed-viewport screen**: header, a scrolling middle (the sentence), and the controls always on
   screen — a flex column of `100dvh`, not a sticky footer on a growing page. Very long sentences (> 24 words) use the
   reading size one step smaller.
5. **The verdict is shown where the eyes are**: the diff is drawn on the sentence itself (said, near, missing, extra —
   the same colours as before), and a compact feedback strip docked above the microphone carries the message, the
   Guardian's line, the next try's rung, the legend and "How do we check?". Speech errors and the offline notice live in
   the same dock. Nothing is duplicated, nothing hides under the controls. Once the speaker starts the next try, the
   live highlighting takes the sentence back.

## Testing

- Unit (test-first): restart confirmation (long KJV/PBG sentences with a recurring first word and a misheard word, the
  stutter and slip cases still rejected), mid-sentence hold and long-pause settle, end-of-sentence short pause still
  settles at once, `utteranceSilenceMs`, per-start silence in both engines, the live hook's hold timer.
- e2e: a rejected long Bible sentence keeps the microphone inside the viewport, the feedback strip visible and not
  overlapping it (Chromium phone + WebKit iPhone); the existing ladder test reads the message from the strip.
