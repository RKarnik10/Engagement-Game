# Decisions log

Every **answered** decision, with its date, who made it, and where it lives in
the code. Newest rounds of feedback are lower down; the lettered decisions
(A to Q) were raised while testing and are closed in the section "Closed by
Rehaan Karnik, October 17, 2026" and in the "Piloting feedback" sections.

**Decisions that are still open are not here: they are in the
[README, section 2](../README.md#2-open-decisions).** When one is answered, it
moves from the README into this file with the date.

In the source, a setting that is still open is marked `TODO(Qn)` and a settled
one `DECIDED(Qn)`; find them with `grep -rn "TODO(Q\|DECIDED(Q" src/`.

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
| Penalty | Hitting a sad mole now costs 3 points by default, down from 10 (and briefly 5, the same day). Rehaan Karnik judged −10 too harsh. Still adjustable in the console and in links (`penalty=`). The score formula is otherwise unchanged; the weight of one mistake still shrinks as the run goes on (raised as decision K and kept). | `scorePenalty` in `src/config.js` | 2026-10-17 |

## Phase 2, October 17, 2026

| Item | Decision | Where | Date |
|------|----------|-------|------|
| Participant and run | Every run can carry a participant ID (letters and digits, as BIDS requires) and a run number. They label the files (`sub-07_task-whacamole_run-02_...`), the first two columns of the run table, and the log. Without an ID, files keep the old `engagement-game_...` names. | `participant`, `run` in `src/config.js`; `exportFilename` in `src/export.js` | 2026-10-17 |
| Per-run schedules | Optional (`seedFromIds`, off by default): the schedule seed is worked out from the seed, participant, and run, so each participant and run gets its own schedule that can always be recreated. Whether to use it is open decision O (README section 2). | `scheduleSeed` in `src/config.js` | 2026-10-17 |
| Auto-save | When a run ends, its three files are saved to the downloads folder automatically (`autoSave`, on by default): by the console, or by the display when it was opened from a labmate link. A run is saved once, never again after a console reload. | `downloadRun` in `src/export.js`; `src/main.js`; `src/display.js` | 2026-10-17 |
| Picture matching | The happy and sad moles already matched; the molerat was darkened and scaled up 2.94%. All three are now within 0.3% in mean brightness and equal in area. Details: [stimuli.md](../docs/stimuli.md). | `src/render/skin-mole.js`; `scripts/measure-stimuli.py` | 2026-10-17 |

## Piloting feedback, October 26, 2026

From Irene and Dr. Song, relayed by Rehaan Karnik. Dr. Song's note: she tried the game and liked the aesthetics, scoring, and output changes, and asked to see everything Irene suggested where it is implementable.

| Item | Decision | Where | Date |
|------|----------|-------|------|
| Run length | **Stays ten minutes** (Dr. Song). Attention fluctuation is largest when people get bored, which is part of the aim, and the gradCPT is also ten minutes, so the two are equated in time. | `nTrials`, `trialMs` in `src/config.js` | 2026-10-26 |
| Health bar game style | A separate game style (`gameStyle: 'health'`) beside the percentage score. Starts at 100; a sad mole hit costs **10**, a missed happy mole costs **3**; every 5 correct trials in a row give back **5**, up to 100 (Rehaan's numbers, adjusted from 3, 1, and 5 later the same day; all adjustable). At these numbers a miss costs 3 and each streak of five wins 5 back, so a player who misses fewer than 1 happy mole in 5 slowly gains health, and one sad mole needs 10 correct trials in a row to win back. | `src/engine.js`, `src/display.js`, `src/config.js` | 2026-10-26 |
| Bonk sound | A hit now sounds like a "bonk" (a low thump with a click), replacing the bright ding-ding Irene found passive. Hitting a sad mole adds a low buzz so it sounds like a mistake. With the hammer on, the sound is timed to the hammer landing. | `src/render/sound.js` | 2026-10-26 |
| Hammer that interacts with the mole | The hammer now lands with an impact burst (rays and stars), rebounds slightly, and squashes the mole harder before it sinks. Display only; the data records the press as before. | `src/render/board.js`, `src/styles.css` | 2026-10-26 |
| Sad-mole reaction times | The run summary now also reports sad-mole (commission) reaction times, separately for bad-only and both trials, because on a both trial the time is measured from trial onset and can follow an earlier happy-mole press. Added from a diff supplied by Rehaan Karnik. | `summarize()` in `src/summary.js`; `tests/commission-rt.test.js` | 2026-10-26 |
| Both trials: sad-mole hit overrides the happy mole | Once the sad mole is hit in a both trial, the trial counts only as that error. The happy mole no longer counts toward the score or health, whether it is then pressed or missed (so sad-then-happy gives no +1, and sad-then-missed-happy gives no extra −3). A happy mole hit before the sad one still counts. The raw outcomes and press times stay in the data; the JSON log marks the ignored mole `counted: false`; the summary's hit and miss statistics are unchanged. This settles part of open decision C. | `resolveTarget` in `src/engine.js`; `tests/both-trial-scoring.test.js` | 2026-10-26 |
| Bar layout | The score and health bar now show the value in large bold numerals above the bar, with a small spaced-out label (SCORE or HEALTH) below it, instead of one line of text ("Health 87"). | `src/display.html`, `src/display.js`, `src/styles.css` | 2026-10-26 |

## Checklist against the September 21 feedback notes

Every line of the feedback notes, and where it stands in the build.

| Note | Status |
|------|--------|
| 9 holes, 3 buttons | Done. 3 by 3 grid; the three buttons sit in a row and each one covers a column. |
| Hide settings; separate participant screen; experimenter and participant rooms | Done. The participant display is its own tab; settings and data stay in the console. |
| No eggplants; molerat; happy and sad mole | Done. Happy mole is good. Bad is the sad mole (decided, A); molerat stays an option. |
| 1 second per trial | Done. `trialMs: 1000`, fixed. |
| Trials with correct, incorrect, and both (80-10-10) | Done. Good / bad / both at 80 / 10 / 10. |
| Scanner or behavioral suite (1 or 0) | Done. `setting`; `in_scanner` 1 or 0 in the log; also in the file name. |
| Record the 1 and 2 inputs rather than any other input | Done. Only the three response buttons are recorded; every other key is ignored. "1 and 2" read as all three buttons (decided, B). |
| Psychtoolbox is paywalled; maybe PsychoPy | Noted. Browser is fine (Q3). |
| No colour change after a press | Done. Nothing on the display reacts to a press; only a hit mole goes down. |
| 600 trials, 10 minutes, print the outcome CSV | Done. `examples/example_run.csv`. |
| Output: which mole (row and column), what should be pressed, what was pressed, reaction time | Done. `good_row`, `good_col`, `bad_row`, `bad_col`, `expected_button`, `pressed_buttons`, `first_press_ms`, `good_hit_ms`. |

## Closed by Rehaan Karnik, October 17, 2026

| # | Question | Decision | Change in the code |
|---|----------|----------|--------------------|
| A | Which picture is the distractor | **The sad mole.** The molerat stays available as an option. | None; it was already the default. |
| B | "Record the 1 and 2 inputs" | **Record all three buttons;** every other key is ignored and never stored. Confirming the exact codes the scanner's button box sends is still a hardware check (README 4.2). | None. |
| D | How long a mole stays up in the 1 s cycle | **800 ms up, 200 ms empty.** | None. |
| G | Can the same hole come up twice in a row? | **Yes.** Any hole can come up on any trial, so the same hole (and column) can repeat. The two moles of a both trial still sit in different columns. | The no-repeat rule is removed from `src/schedule.js`. Schedules for a given seed differ from before. |
| I | Should a wrong-column press cost points? | **No.** It is recorded but not scored. | None. |
| J | Very fast presses | **No lower limit in the game.** Any cut-off for anticipations is left to the analysis. | None. |
| K | The score formula | **Keep it:** (happy moles hit − 3 × sad moles hit) ÷ happy moles so far. | None. |
| L | Which feedback stays | **Score, rings, sound, and hammer are all on by default** (the score from October 17, 2026; rings, sound, and hammer from October 26, 2026). This departs from Dr. Song's Q6 answer (no feedback) and from README section 8, which kept the "violence dial" low, so it is worth confirming with her before scanning. Each can still be switched off. | The defaults in `src/config.js` and the console. Links now mention only what is switched off (`score=0`, `rings=0`, `sound=0`, `hammer=0`), and file names carry `_score+rings+sound+hammer_` by default. Browsers block sound until a key press or click in the display, so the display's start screen asks for one click when sound is on. |
| M | Garden scene or plain grey | **The garden,** scanning included. Plain grey stays available. Note for Dr. Song: README 4.3 recommended plain grey for scanning. | None; it was already the default. |
| N | Pop-up or gradual rise | **Moles pop up instantly.** Gradual rise stays available. | None; it was already the default. |
