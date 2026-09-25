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
| `example_run.csv` | The table to open first. One row per trial: its type (good, bad, or both), where each mole appeared (row and column), the button that should have been pressed, every button that was pressed, and the reaction times. Opens in Excel. |
| `example_events.tsv` | The same run in the BIDS events layout, times in seconds from the start pulse, for the fMRI model. |
| `example_log.json` | Everything: the settings used, display-timing health, the trial table with each mole and each press, and every raw event including simulated scan volumes. |

## What this run contains

| | |
|---|---|
| Trials | 600, one per second, 10.0 minutes |
| Trial mix | 480 good, 60 bad, 60 both |
| Layout | 9 holes in a 3 by 3 grid, 3 buttons, one per column |
| Good moles hit | 509 of 540 (480 good trials plus 60 both trials) |
| Bad moles pressed | 23 of 120 (60 bad trials plus 60 both trials) |
| Both trials fully right | 48 of 60 |
| Wrong-column presses | 9 |
| Presses with no mole up | 5 |
| Reaction time on good moles | mean 420 ms, SD 82 ms, CV 0.20 |
| Worst onset lag | 16.7 ms, one screen frame at 60 Hz |

The simulated participant drifts: reaction times wander slowly and get more
erratic after about six minutes, so the attention trace has something to show.
Both trials are about 60 ms slower, because the participant has to pick a mole.
It also sometimes presses a wrong column and then corrects itself, so the file
shows how several presses in one trial are recorded.

## Things worth checking in the file

- **`expected_button` always equals `good_col`**, and is `n/a` on bad trials.
  A button is a column, so the row a mole appears in never changes the answer.
- **On both trials, `good_col` and `bad_col` always differ.**
- **`pressed_buttons` lists every press in order.** Trial 34, for example, is
  `1 2`: a wrong column first, then the right one. `first_press_ms` is the
  first press; `good_hit_ms` is the one that hit the good mole. When loading in
  pandas, read `pressed_buttons` as text (`dtype={"pressed_buttons": str}`),
  or runs with no double presses will load it as numbers.
- **Both trials cover all four combinations** of good and bad outcome: 48 fully
  right, 3 with the good mole hit and the bad one pressed too, 6 with the bad
  one pressed instead, and 3 with nothing pressed.
- **`onset_lag_ms` is at most one screen frame**, the best a browser can do.
  Anything larger in a real run means dropped frames.
- **`correct` is `n/a` for a `truncated` trial**, one still up when the run
  ended. There are none here because the run finished.
