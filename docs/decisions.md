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
way, or where a value had to be picked to make the build run. Each needs a
one-line confirmation.

| # | Open point | What the code does now | Why it needs confirming |
|---|------------|------------------------|--------------------------|
| A | Which picture is the bad mole | Sad mole by default; molerat as an option (`badStim`). | The notes mention both a molerat and a happy/sad mole. The sad mole is the same size and brightness as the happy one apart from its face, which helps the matching required in README 3.6, but it is harder to tell apart at one per second. The molerat is easier to spot. |
| B | "Record the 1 and 2 inputs rather than any other input" | All three mapped buttons (1, 2, 3) are recorded as responses; every other key is ignored and never stored. | Q2 settled on three buttons, so "1 and 2" may be shorthand, or may name the exact codes the button box sends. |
| C | Both trials, after the good mole is hit | The bad mole stays up until the window ends; pressing it later still counts as a commission, and the trial's outcome is then `commission`. | The alternative is to take both moles down on the first press, which would make any second press a stray press instead. |
| D | How long a mole stays up inside the 1 s cycle | 800 ms up, then 200 ms empty before the next trial. | The 1 s cycle is settled; the split inside it is not. |
| F | Q4 remainder | TR 1 s, trigger key `t`, 2 s lead-in, one run. | Needed before any scan. Dr. Song said this is still to be discussed. |
| G | Same-hole and same-column repeats | The same hole never repeats on consecutive trials; the same column may. | Carried over from v0.1 and never confirmed. |
