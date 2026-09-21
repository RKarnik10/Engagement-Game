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
| Q8 | Mole art vs. neutral art? | **Moles, no eggplants.** Go is a happy mole. The two skip stimuli are a sad mole and a molerat. | `src/render/skin-mole.js`. | 2026-09-21 |
| Q9 | Participant population? | **All adults.** | Affects instructions and IRB only. | 2026-09-21 |
| Q10 | Eye tracking and visual angle? | **No eye tracking available.** Visual angle still unknown. | Hole spacing in `src/styles.css` is still a placeholder. | 2026-09-21 |
| Q11 | Wrong-hole press during a skip trial: commission or wrong-hole? | **Wrong-hole is fine.** Logged as `wrong_hole`; the trial continues. | `src/classify.js`. Now means the wrong *column*. | 2026-09-21 |

## Other decisions from the same feedback

| Item | Decision | Where | Date |
|------|----------|-------|------|
| Trial rate | One trial per second, fixed, not jittered | `trialMs: 1000` | 2026-09-21 |
| Trials per run | 600, so a run is about 10 minutes | `nTrials: 600` | 2026-09-21 |
| Stimulus mix | 80 / 10 / 10 | `goProb: 0.8`, `nogoSadShare: 0.5` | 2026-09-21 |
| Experimenter and participant screens | Settings hidden from the participant; a full-screen participant display on a separate screen | "Participant display" button in `src/main.js`, `body.participant-view` in `src/styles.css` | 2026-09-21 |
| Where the run happens | Recorded per run as scanner = 1 or behavioral suite = 0 | `setting` in `src/config.js`, `in_scanner` in the JSON metadata | 2026-09-21 |
| Which inputs are recorded | Only the mapped response buttons; every other key is ignored | `src/input.js` | 2026-09-21 |
| Output columns | Which mole appeared (row and column), what should have been pressed, what was pressed, and the reaction time | `buildRunCSV` in `src/export.js` | 2026-09-21 |

## Still open, and how the code reads the feedback today

These are the places where the written feedback could be read more than one
way, or where a value had to be picked to make the build run. Each needs a
one-line confirmation.

| # | Open point | What the code does now | Why it needs confirming |
|---|------------|------------------------|--------------------------|
| A | "Try some trials with correct, trials with incorrect, and both (80-10-10)" | 80% happy mole (press), 10% sad mole (hold back), 10% molerat (hold back). Go/no-go stays 80/20. | Three shares and three pictures line up, but "and both" is ambiguous. If instead it means three *runs* to compare, or a different three-way split, only `goProb` and `nogoSadShare` change. |
| B | "Record the 1 and 2 inputs rather than any other input" | All three mapped buttons (1, 2, 3) are recorded as responses; every other key is ignored and never stored. | Q2 settled on three buttons, so "1 and 2" may be shorthand, or may name the exact codes the button box sends. |
| C | Sad mole and molerat: one skip stimulus or two? | Two, at 10% each, logged separately in `stimulus`. | If they are meant as alternative designs rather than both at once, set `nogoSadShare` to 1 or 0. |
| D | How long a mole stays up inside the 1 s cycle | 800 ms up, then 200 ms empty before the next trial. | The 1 s cycle is settled; the split inside it is not. |
| E | Whether the on-screen button labels stay | Shown under each column. | Useful for piloting; the scanner participant uses a button box. |
| F | Q4 remainder | TR 1 s, trigger key `t`, 2 s lead-in, one run. | Needed before any scan. Dr. Song said this is still to be discussed. |
| G | Same-hole and same-column repeats | The same hole never repeats on consecutive trials; the same column may. | Carried over from v0.1 and never confirmed. |
