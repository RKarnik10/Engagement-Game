# Decisions log

Dated answers to the open questions in README section 2. Until a row has a
decision, the code uses the "Assumed for now" value. Assumptions still open
are marked in the source with `TODO(Qn)`; settled ones with `DECIDED(Qn)`.
Find them with `grep -rn "TODO(Q\|DECIDED(Q" src/`.

## Answers from Dr. Song, September 21, 2026

Relayed by Rehaan Karnik from Dr. Song's written feedback.

| # | Question | Decision | Where it lives in the code | Date |
|---|----------|----------|-----------------------------|------|
| Q1 | Construct: attention fluctuations, engagement, or both? | **Both.** | Attention measures are built. Engagement probes are still not built. | 2026-09-21 |
| Q2 | Response device and button count? | **One hand, 3 buttons. Nine holes in a 3 by 3 grid; a button is a column.** | `LAYOUTS.grid3x3` in `src/config.js`; `holeResponse` maps each hole to its column's button. | 2026-09-21 |
| Q3 | Presentation software? | **Browser is fine.** Psychtoolbox was the lab's tool but is now behind a paywall; PsychoPy is the fallback if the browser build is not good enough. | No change; the browser build stands. | 2026-09-21 |
| Q4 | TR, run length, number of runs, trigger key, dummy scans? | **Still undetermined; will discuss.** Run length is settled at 600 trials, about 10 minutes. | `nTrials: 600`, `trialMs: 1000`. `trS`, `triggerKey`, `firstOnsetMs` remain placeholders. | partly 2026-09-21 |
| Q5 | Continuous play or blocks? | **Continuous.** A trial every second, no rest blocks. | `trialMs` in `src/schedule.js`; onsets are fixed, not jittered. | 2026-09-21 |
| Q6 | Show a score or feedback? | **No.** The participant sees nothing in response to a press: no score, no hole lighting up, no white ring. Moles only pop in and out. | `showScore: false`, `feedback: false`; `src/render/board.js` has no flash code at all. | 2026-09-21 |
| Q7 | Adaptive difficulty? | **No, non-adaptive.** | Nothing in `src/engine.js` adapts to performance. | 2026-09-21 |
| Q8 | Mole art vs. neutral art? | **Moles, no eggplants.** The good mole is a happy mole; the bad mole is a sad mole or a molerat (see open point A). | `src/render/skin-mole.js`. | 2026-09-21 |
| Q9 | Participant population? | **All adults.** | Affects instructions and IRB only. | 2026-09-21 |
| Q10 | Eye tracking and visual angle? | **No eye tracking available.** Visual angle still unknown. | Hole spacing in `src/styles.css` is still a placeholder. | 2026-09-21 |
| Q11 | Wrong-hole press during a skip trial: commission or wrong-hole? | **Wrong-hole is fine.** Logged as `wrong_hole`; the trial continues. | `src/classify.js`. Now means the wrong *column*. | 2026-09-21 |

## Other decisions from the same feedback

| Item | Decision | Where | Date |
|------|----------|-------|------|
| Trial rate | One trial per second, fixed, not jittered | `trialMs: 1000` | 2026-09-21 |
| Trials per run | 600, so a run is about 10 minutes | `nTrials: 600` | 2026-09-21 |
| Trial mix | 80 / 10 / 10 (meaning clarified September 25; see below) | `goodShare`, `badShare`, `bothShare` | 2026-09-21 |
| Experimenter and participant screens | Settings hidden from the participant; the participant display on a separate screen | Since September 25: its own tab, `src/display.html`, linked to the console by `src/link.js` | 2026-09-21 |
| Where the run happens | Recorded per run as scanner = 1 or behavioral suite = 0 | `setting` in `src/config.js`, `in_scanner` in the JSON metadata | 2026-09-21 |
| Which inputs are recorded | Only the mapped response buttons; every other key is ignored | `src/input.js` | 2026-09-21 |
| Output columns | Which mole appeared (row and column), what should have been pressed, what was pressed, and the reaction time | `buildRunCSV` in `src/export.js` | 2026-09-21 |

## Clarified by Rehaan Karnik, September 25, 2026

| Item | Decision | Where | Date |
|------|----------|-------|------|
| What "80-10-10" means | Three **trial types**, not three pictures: 80% **good** (one good mole: press its column, it gets killed), 10% **bad** (one bad mole: do not press, it is not killed), 10% **both** (a good and a bad mole at once, in different columns: press only the good one). Rehaan first wrote 70 / 20 / 10, then corrected it to Dr. Song's 80 / 10 / 10 the same day. | `goodShare: 0.8`, `badShare: 0.1`, `bothShare: 0.1` in `src/config.js`; `src/schedule.js`, `src/classify.js`, `src/engine.js` | 2026-09-25 |
| Participant display in its own tab | The display opens as a separate browser tab, which can be dragged to its own window on the participant's screen. The console controls it. | `src/display.html`, `src/display.js`, `src/session.js`, `src/link.js` | 2026-09-25 |
| Button labels | The 1, 2, 3 labels under the columns **stay**, in the scanner too. | `renderKeycaps` in `src/render/board.js` | 2026-09-25 |
| Drawing fixes | The molerat's two outlined front teeth read as a pause symbol; they are now one solid block. The sad mole's brows slanted down toward the middle and read as angry; they now rise toward the middle. | `src/render/skin-mole.js` | 2026-09-25 |

This resolves open points A, C, and E from September 21.

## Testing tools, September 28, 2026

Requested by Rehaan Karnik for testing. Neither changes what a participant sees in a real session.

| Item | Decision | Where | Date |
|------|----------|-------|------|
| Pause | A run can be paused and resumed (console Pause button, or P in the display). The run clock stops, so the schedule resumes where it stopped. Pauses are logged (`pause`, `resume` with `paused_ms`) and the run summary says a paused run is not usable for scanning. | `pause()`/`resume()` in `src/engine.js`; `src/session.js`, `src/link.js` | 2026-09-28 |
| Results after a run | However a run ends (time runs out, End run, Esc), the console keeps the summary, measures, trace, and downloads until the next run starts. | `src/main.js` | 2026-09-28 |
| Results on the display | Optional, off by default: after a run, the display also shows the summary, trace, and downloads. Off because Q6 says the participant sees nothing. | `showResultsOnDisplay` in `src/config.js`; `src/display.js` | 2026-09-28 |

## Piloting variants and publishing, October 11, 2026

Requested by Rehaan Karnik. The defaults still follow Q6 (no feedback).

| Item | Decision | Where | Date |
|------|----------|-------|------|
| Feedback variants | Four switches for piloting, all off by default: score (happy moles hit; a pressed distractor no longer subtracts), rings (white hit, red distractor), sound (good hit, bad wrong press), hammer. Each run records its variant. To compare with labmates which feedback keeps people engaged. | `showScore`, `hitRings`, `sound`, `hammer` in `src/config.js`; `src/display.js`, `src/render/board.js`, `src/render/sound.js` | 2026-10-11 |
| Sound and hammer vs. README section 8 | Section 8 kept the "violence dial" low (no hammer, no impact, no sound). These variants turn it up and are for piloting only; whether any feedback stays is still Dr. Song's call (Q6). | README 6.4 | 2026-10-11 |
| Publishing | The game is published to GitHub Pages from `src/` by a GitHub Actions workflow, after the tests pass. The v0.1 prototype moves to `/prototype/`; the `index.html` file itself is unchanged. Needs the owner to set Settings > Pages > Source: GitHub Actions once. | `.github/workflows/pages.yml` | 2026-10-11 |
| Labmate links | A display link carries its settings and runs alone, with results at the end. | `src/query.js`; "Link for labmates" in the console | 2026-10-11 |

## Feedback after a test run, October 13, 2026

Relayed by Rehaan Karnik.

| Item | Decision | Where | Date |
|------|----------|-------|------|
| Every press timed | All presses in a trial are kept with their own times (`press_times_ms` in the run table, `press_times` in the events table; the full log already had them). | `src/export.js` | 2026-10-13 |
| Decimals | Reaction times and onset lag keep one decimal in ms (0.1 ms; seconds to four decimals in the events table). That is the browser timer's resolution, not the screen's accuracy. | `src/export.js` | 2026-10-13 |
| Penalty | Hitting a distractor costs 10 points (`scorePenalty`, adjustable in the console and in links as `penalty=`). | `src/engine.js` | 2026-10-13 |
| Score as a percentage | Shown score = (happy moles hit − 10 × distractors hit) ÷ happy moles that could have been hit so far, as a %. A count of hits gave away how many trials were left. Recorded per trial (`score_points`, `score_pct`). | `src/engine.js`, `scorePercent` in `src/summary.js` | 2026-10-13 |

## Full-precision times, October 16, 2026

Feedback relayed by Rehaan Karnik: the decimals matter, and times should be saved as full values.

| Item | Decision | Where | Date |
|------|----------|-------|------|
| No rounding | Every time in every file (run CSV, events TSV, full JSON log) is written exactly as the clock gave it. Replaces the one-decimal rounding of October 13. | `src/export.js`, `src/logger.js`, `src/engine.js` | 2026-10-16 |
| Press columns | Each of the first five presses in a trial gets its own button and time column (`press_1_button`, `press_1_ms`, …), filled in the order pressed, `n/a` (NaN) otherwise. `n_presses` gives the count; the full log keeps any presses beyond five. Replaces the space-separated `pressed_buttons` and `press_times_ms` text columns, so time columns load as numbers. | `PRESS_COLUMNS` in `src/export.js` | 2026-10-16 |

## Display changes, October 17, 2026

| Item | Decision | Where | Date |
|------|----------|-------|------|
| Score bar | The score moves to the top centre of the display, above the grid (the grid shifts down to make room), with a bar that fills to the percentage. Its colour slides smoothly: dark red at 0%, red at 30%, orange at 45%, yellow from 55% to 72%, light green at 85%, green at 100% (Rehaan asked for a gradient rather than three fixed colours); empty below 0%. Meant to motivate. It is a small coloured element on the mid-grey screen, so it slightly changes screen brightness (README 4.3); piloting only. | `scoreColor`, `scoreFill` in `src/summary.js`; `src/display.html`, `src/styles.css` | 2026-10-17 |
| Ring shape | The feedback ring is now only its front arc, below the hole's rim, slightly thicker, with a brighter red. The full ellipse crossed a raised mole and was distracting. | `holeSVG` in `src/render/board.js`; `styles.css` | 2026-10-17 |
| Hammer timing | With the hammer on, a hit mole no longer drops before the hammer arrives: it stays up until the hammer lands (about 90 ms after the press), is squashed, and sinks by 300 ms. Display only; the data still records the hit, and the mole's offset, at the moment of the press. Hammer off: unchanged. | `sinkStruck` in `src/render/board.js`; `src/display.js`; `styles.css` | 2026-10-17 |
| Sound | Sound plays only when a mole is hit (good for happy, bad for sad). A press on an empty column is silent. | `src/display.js` | 2026-10-17 |
| Garden scene | The display shows sky with clouds, hills on the horizon, grass, and brown holes. Default for piloting; plain grey stays available (`scene: 'grey'`), as README 4.3 recommends for scanning. Which one to scan with is open. | `scene` in `src/config.js`; `styles.css` | 2026-10-17 |
| Penalty | Hitting a sad mole now costs 3 points by default, down from 10 (and briefly 5, the same day). Rehaan Karnik judged −10 too harsh. Still adjustable in the console and in links (`penalty=`). The score formula is otherwise unchanged; the weight of one mistake still shrinks as the run goes on (an open question). | `scorePenalty` in `src/config.js` | 2026-10-17 |

## Checklist against the September 21 feedback notes

Every line of the feedback notes, and where it stands in the build.

| Note | Status |
|------|--------|
| 9 holes, 3 buttons | Done. 3 by 3 grid; the three buttons sit in a row and each one covers a column. |
| Hide settings; separate participant screen; experimenter and participant rooms | Done. The participant display is its own tab; settings and data stay in the console. |
| No eggplants; molerat; happy and sad mole | Done. Happy mole is good. Bad is a sad mole by default, molerat as an option (open point A). |
| 1 second per trial | Done. `trialMs: 1000`, fixed. |
| Trials with correct, incorrect, and both (80-10-10) | Done. Good / bad / both at 80 / 10 / 10. |
| Scanner or behavioral suite (1 or 0) | Done. `setting`; `in_scanner` 1 or 0 in the log; also in the file name. |
| Record the 1 and 2 inputs rather than any other input | Partly. Only the three response buttons are recorded; every other key is ignored. "1 and 2" still needs confirming (open point B). |
| Psychtoolbox is paywalled; maybe PsychoPy | Noted. Browser is fine (Q3). |
| No colour change after a press | Done. Nothing on the display reacts to a press; only a hit mole goes down. |
| 600 trials, 10 minutes, print the outcome CSV | Done. `examples/example_run.csv`. |
| Output: which mole (row and column), what should be pressed, what was pressed, reaction time | Done. `good_row`, `good_col`, `bad_row`, `bad_col`, `expected_button`, `pressed_buttons`, `first_press_ms`, `good_hit_ms`. |

## Still open, and how the code reads the feedback today

These are the places where the written feedback could be read more than one
way, where a value had to be picked to make the build run, or where a question
came up while testing (H to N, October 17, 2026). Each needs a one-line answer.
E was answered on September 25, 2026.

| # | Open point | What the code does now | Why it needs confirming |
|---|------------|------------------------|--------------------------|
| A | Which picture is the bad mole | Sad mole by default; molerat as an option (`badStim`). | The notes mention both a molerat and a happy/sad mole. The sad mole is the same size and brightness as the happy one apart from its face, which helps the matching required in README 3.6, but it is harder to tell apart at one per second. The molerat is easier to spot. |
| B | "Record the 1 and 2 inputs rather than any other input" | All three mapped buttons (1, 2, 3) are recorded as responses; every other key is ignored and never stored. | Q2 settled on three buttons, so "1 and 2" may be shorthand, or may name the exact codes the button box sends. |
| C | Both trials, after the good mole is hit | The bad mole stays up until the window ends; pressing it later still counts as a commission, and the trial's outcome is then `commission`. | Part of the wider question H. The alternative is to take both moles down on the first press, which would make any second press a stray press instead. |
| D | How long a mole stays up inside the 1 s cycle | 800 ms up, then 200 ms empty before the next trial. | The 1 s cycle is settled; the split inside it is not. |
| F | Q4 remainder | TR 1 s, trigger key `t`, 2 s lead-in, one run. | Needed before any scan. Dr. Song said this is still to be discussed. |
| G | Same-hole and same-column repeats | The same hole never repeats on consecutive trials; the same column may. | Carried over from v0.1 and never confirmed. |
| H | Several presses in one trial: does every press count, or only the first? | **Every press counts.** Pressing a sad mole and then an empty column records both a sad-mole hit and a wrong-column press. A wrong-column press followed by the right one counts as a hit. In a both trial, hitting the happy mole and then the sad one counts as a hit and a sad-mole hit, and the trial's outcome is `commission`. | Raised by Rehaan Karnik on October 17, 2026. A "first press only" rule (later presses recorded with their times but ignored for scoring) was built and reverted the same day, because it also turns a quick correction into a miss, which Dr. Song's feedback described. Options: (1) every press counts, as now; (2) only the first press counts; (3) a middle way, e.g. only the first press *on a mole* counts, so a wrong-column press can still be corrected but a happy-mole hit cannot be followed by a sad-mole hit. Every press is recorded with its time whichever is chosen, so the analysis can apply any rule later. |
| I | Should a wrong-column press cost points? | No: it is recorded (`wrong_hole`) but the score ignores it. | Only a sad-mole hit costs points (3). Raised October 17, 2026. |
| J | Very fast presses | No lower limit: a press 50 ms after a mole appears counts as a hit. | People cannot react that fast, so such presses are anticipations. Attention studies often drop reaction times under about 100 to 150 ms. This can be applied in the analysis instead of the game. |
| K | The score formula | Points (+1 hit, −3 per sad-mole hit) over the happy moles so far, as a percentage. | One mistake weighs much more early in the run than late (after 3 happy moles one sad-mole hit at −3 gives 0%; after 300 it costs 1 percentage point). A score over the last 50 happy moles would make every mistake weigh the same. Raised October 17, 2026. |
| L | Which feedback, if any, stays | All off by default (Q6: the participant sees nothing). Score, rings, sound, and hammer exist for piloting with labmates. | Decide after piloting, with Dr. Song. Sound and hammer also turn up the "violence dial" of README section 8. |
| M | Garden scene or plain grey | Garden (sky, hills, grass, brown holes) is the default; plain grey is one click away. | README 4.3 recommends plain grey for scanning, to keep screen brightness neutral. The garden is static, but brighter and busier. |
| N | Pop-up or gradual rise | Moles pop up instantly; gradual rise is an option. | README 3.5: abrupt pop-ups grab attention automatically, which may make the task less sensitive to lapses than the lab's gradCPT. Never decided. |
