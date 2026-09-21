# Example run

A complete 600-trial run, generated without a browser so Dr. Song can see the
output format. **No human took part.** A simulated participant plays the real
engine under a fake 60 Hz clock, so the timing, the response rules, and the
file formats are exactly what a real run produces.

Regenerate with:

```
node examples/simulate-run.mjs
```

Same seed, same files, every time.

## The three files

| File | What it is |
|---|---|
| `example_run.csv` | The table to open first. One row per mole: which mole it was, the row and column it appeared in, the button that should have been pressed, the button that was pressed, and the reaction time. Opens in Excel. |
| `example_events.tsv` | The same run in the BIDS events layout, times in seconds from the start pulse, for the fMRI model. |
| `example_log.json` | Everything: the settings used, display-timing health, the trial table, and every raw event including simulated scan volumes. |

## What this run contains

| | |
|---|---|
| Trials | 600, one per second, 10.0 minutes |
| Stimulus mix | 480 happy moles, 60 sad moles, 60 molerats |
| Layout | 9 holes in a 3 by 3 grid, 3 buttons, one per column |
| Happy moles hit | 458 of 480 |
| Presses on skip trials | 34 of 120 |
| Wrong-column presses | 5 |
| Presses with no mole up | 3 |
| Reaction time | mean 411 ms, SD 84 ms, CV 0.20 |
| Worst onset lag | 16.7 ms, one screen frame at 60 Hz |

The simulated participant drifts: reaction times wander slowly and get more
erratic after about six minutes, so the attention trace has something to show.

## Things worth checking in the file

- **`expected_button` always equals `mole_col`.** That is the design: a button
  is a column, so the row a mole appears in does not change the right answer.
- **`onset_lag_ms` is at most one screen frame**, which is the best a browser
  can do. Anything larger in a real run means dropped frames.
- **Three trials have a reaction time under 150 ms.** Those are presses that
  happened to land just as a mole appeared. Real data has them too, which is
  why the analysis plan proposes a floor for reaction times.
- **`correct` is `n/a` for a `truncated` trial**, a mole that was still up when
  the run ended. There are none in this file because the run finished.
