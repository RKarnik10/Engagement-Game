# Decisions log

Dated answers to the open questions in README section 2. Until a row has a
decision, the code uses the "Assumed for now" value. Each assumption is marked
in the source with a `TODO(Qn)` comment so it can be found with
`grep -rn "TODO(Q" src/`.

| # | Question | Assumed for now (where in code) | Decision | Date |
|---|----------|----------------------------------|----------|------|
| Q1 | Construct: attention fluctuations, engagement/motivation, or both? | Both. RT-variability time course for attention; self-report probes optional (not built). | pending | |
| Q2 | Response device and button count? | One hand, 4 buttons: `layout: "row4"`, `keys: ["1","2","3","4"]` in `src/config.js`. | pending | |
| Q3 | Presentation software for scanning? | Browser build now; scanner platform decided in Phase 4. | pending | |
| Q4 | TR, run length, number of runs, trigger key, dummy scans? | `trS: 1.0`, `durationS: 60`, `triggerKey: "t"`, `firstOnsetMs: 2000` in `src/config.js`. Rehaan expects real runs of about 10 to 15 minutes (noted September 18, 2026, to confirm); the settings panel's run-length limit is 600 s and must be raised for 15-minute runs. | pending | |
| Q5 | Continuous play or blocks? | Continuous with jittered gaps (`src/schedule.js`). | pending | |
| Q6 | Show a score or feedback? | Configurable, on for piloting: `showScore: true`; hit +1, false press -1 (`src/engine.js`). | pending | |
| Q7 | Adaptive difficulty? | Off. Fixed timing from config; nothing adapts. | pending | |
| Q8 | Mole art vs. neutral art? | Build both; mole skin only in Phase 1 (`src/render/skin-mole.js`). | pending | |
| Q9 | Participant population? | Healthy adults. | pending | |
| Q10 | Eye tracking and visual angle? | Unknown. Hole spacing is a placeholder (`src/render/board.js`). | pending | |
| Q11 | Different-hole press during a no-go target: commission or wrong-hole? | Logged as `wrong_hole`, trial continues (`src/classify.js`). | pending | |

## Other placeholders not tied to a numbered question

| Item | Assumed for now (where in code) | Decision | Date |
|------|----------------------------------|----------|------|
| Go proportion | 0.8, exact per run (`goProb`) | pending | |
| Schedule constraints | First 3 trials go; no two no-go in a row; same hole never twice in a row (`src/schedule.js`) | pending | |
| Target up time | 900 ms (`holdMs`) | pending | |
| Gap between targets | uniform 500 to 1200 ms (`isiMinMs`, `isiMaxMs`) | pending | |
| Pop-up vs. gradual onset | `onset: "instant"` by default; `"gradual"` uses `rampMs: 350` each way (README 3.5) | pending | |
