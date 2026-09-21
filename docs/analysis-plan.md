# Analysis plan, in plain language

*Proposal for Phase 3 of the [README](../README.md): the analysis script. Nothing in this document is built yet. Written September 18, 2026 by Rehaan Karnik with AI assistance; updated September 21, 2026 for the revised task. For Dr. Song to check, and for anyone who wants to know what the numbers will mean. Terms are explained where they first appear, and again in the glossary at the end.*

## 1. What the analysis is for

Each run produces three files (described in the [review guide](review-guide.md)): a run table with one row per mole, the same trials in the BIDS events layout, and a full log with everything else. A complete example is in [../examples/](../examples/). The analysis turns them into:

1. **A few numbers per run** that say how well the person did.
2. **A curve over time** that says how steady their attention was from moment to moment.
3. **That same curve on the scanner's clock**, one value per brain picture, so it can be compared with the fMRI signal.

## 2. The raw ingredients

For every mole, the game records when it appeared, which of the three pictures it was, where in the grid it appeared, which button should have been pressed, which was pressed, and how long it took. Each trial ends with one outcome:

| Outcome | Plain meaning |
|---|---|
| `hit` | Happy mole, the right column pressed in time. Gives a reaction time. |
| `omission` | Happy mole, no press. Usually an attention lapse. |
| `commission` | Sad mole or molerat, pressed anyway. A failure to hold back. Gives a reaction time. |
| `correct_rejection` | Sad mole or molerat, correctly left alone. |
| `truncated` | The run ended while the target was up. Dropped from every measure. |

Two more things are logged but do not end a trial: `wrong_hole` (pressed a different column while a mole was up) and `no_target_press` (pressed when nothing was up). They are counted as quality measures. Because a button is a column, pressing the right column in the wrong row is impossible: any press in the right column counts.

**Two kinds of skip trial.** Sad moles and molerats are both no-go, so they are pooled for the rates below. They are logged separately in the `stimulus` column, so they can also be compared: a molerat is a different animal, while a sad mole differs from a happy one only by its face, which may be harder to spot. Whether that difference matters is worth one look early on.

## 3. Whole-run measures

**Hit rate.** Happy moles pressed, divided by happy moles shown. **Omission rate** is the rest: happy moles missed.

**Commission rate.** Skip trials pressed, divided by skip trials shown. This is the classic measure of failing to hold back.

**d′ (say "d-prime").** Hit rate alone is not enough: someone who presses for everything scores 100% hits and 100% false presses. d′ combines hits and false presses into one number for how well the person told happy moles from the ones to skip. Zero means they could not tell them apart at all; larger is sharper. The formula is the difference between two z-scores (see the glossary): z(hit rate) minus z(false-press rate). Perfect rates of 0% or 100% break the formula, so a small correction is standard. We propose the **log-linear correction**: add 0.5 to each count and 1 to each total before dividing. Any correction works as long as it is written down.

Worked example from a short simulated run (the ten-minute example in [../examples/](../examples/) gives a hit rate of 458/480 and 34 presses on 120 skip trials):

| | Count | Rate | Corrected rate | z |
|---|---|---|---|---|
| Hits | 24 of 26 happy moles | 0.923 | 24.5 / 27 = 0.907 | 1.325 |
| False presses | 1 of 6 skip trials | 0.167 | 1.5 / 7 = 0.214 | -0.792 |

d′ = 1.325 - (-0.792) = **2.12**.

**Reaction time: mean, SD, CV.** The average reaction time on hits; the standard deviation, which is how spread out they are; and the coefficient of variation, which is SD divided by mean. The CV lets us compare people who are faster or slower overall, because it measures spread relative to their own speed.

## 4. The attention curve: variance time course

This is the main attention signal, following Esterman et al. (2013) as summarised in the [research notes](../research-notes.md). The idea: when attention is steady, reaction times are consistent. When it drifts, they become erratic, sometimes unusually fast (pressing on autopilot) and sometimes unusually slow (drifting off). So the size of the swing in reaction time, trial by trial, tracks attention.

Steps, in order:

1. **Take the reaction time of every hit.** Whether to include the reaction times of false presses too is a detail to confirm (section 10).
2. **Convert each to a z-score.** How far it is from that person's own average, in units of their own spread. This removes "some people are just faster".
3. **Take the absolute value.** We care about how far from typical, not which direction.
4. **Fill the gaps.** Missed moles and skip trials have no reaction time. Fill each gap by interpolation, which means drawing a straight line between the neighbouring values, so every trial has a number. With a trial every second, the series is evenly spaced, which makes this simpler than it was in the jittered v0.1 design.
5. **Smooth.** Replace each value with a weighted average of itself and its neighbours, weighting nearby targets most, using a bell-shaped (Gaussian) weighting. The curve then shows the trend rather than trial-to-trial noise. Esterman et al. specify the width of the bell; we will copy it.
6. **Split at the median.** Targets below the run's median curve value are "in the zone" (steady); targets above it are "out of the zone" (erratic). Esterman et al. found more errors, and a different pattern of brain-network activity, out of the zone.

The chart at the bottom of the game page is a rough version of steps 1 to 6. It skips step 4 and uses a placeholder width in step 5, so it is for a first look only.

## 5. Putting the curve on the scanner's clock

The scanner takes one whole-brain picture every TR (for example every 1 s). The curve above has one value per trial, and trials are exactly 1 s apart. If the TR turns out to be 1 s as well, the two grids line up almost one to one, which is convenient but still needs interpolation because the run starts 2 s before the first mole. The result is a list with exactly one number per picture: the behavioural attention level during that picture.

That list can be compared directly with per-picture brain measures, for example the sequence of brain states found with a hidden Markov model in Song, Shim & Rosenberg (2023). See the glossary for the term.

Separately, the events table gives every trial's onset and duration in seconds, which is what the standard fMRI model (the design matrix) needs. Each happy mole, skip trial, and error can be an event type in that model. One caution: trials are now evenly spaced one second apart, which is good for the attention curve but leaves less room for the model to separate the brain response to one trial from the next. Worth raising before scanning.

## 6. Errors in context: what came before each skip trial

The `preceding_go` column records how many happy moles came in a row before each skip trial. The more in a row, the stronger the habit of pressing, and the harder the skip trial is to resist. This is the manipulation the original whack-a-mole task was built around. We propose plotting the commission rate against the number of preceding happy moles, in bins such as 1 to 2, 3 to 4, and 5 or more.

## 7. Data-quality checks

Cheap checks that should run on every file before anything else:

- **Display timing.** The full log records the average and maximum time between screen frames and how many frames took longer than 20 ms. Many long frames mean targets may have appeared late.
- **Lateness.** The `onset_lag_ms` column. Should be under one frame (about 17 ms at 60 Hz). In the ten-minute example run the worst was 16.7 ms.
- **Counts** of truncated trials, wrong-column presses, and presses with nothing up. A high count suggests the person was confused about the buttons or the task. With no feedback at all, this is the only way to notice someone has misunderstood.
- **Clock drift.** When the scanner's pulses are being received, the log holds both the simulated pulse times and the real ones. Their difference over a 10 to 15 minute run measures drift between the game's clock and the scanner.

## 8. Engagement (only if Q1 says so)

If we want to measure how engaged the person feels, not just how steady their attention is, the plan is short self-report questions between runs or every so many targets, for example "How focused were you just now?" on a 1 to 5 scale. The Rosenberg lab abstract in the research notes compared this kind of probe with reaction-time variability in one task, and is the model to follow. Nothing is built for this yet.

## 9. Proposed tools and outputs

- **Language:** Python 3. It is the common choice for fMRI pipelines and BIDS tools. If the lab's own analysis code is in another language, matching that is fine; the computations are simple.
- **Libraries:** pandas (tables), NumPy (arithmetic), SciPy (the Gaussian smoothing, `scipy.ndimage.gaussian_filter1d`), Matplotlib (figures). All standard and free.
- **One script:** `analysis/compute_measures.py`. Input: one events table and its full log. Output, per run:
  1. `..._summary.csv`: one row with the section 3 numbers and the section 7 checks.
  2. `..._per_tr.csv`: one row per brain picture with the attention level (section 5).
  3. `..._trace.png`: the curve, the median split, error marks, and picture ticks.
- **Later:** a second script that stacks summaries across runs and participants into one table.

## 10. What we need Dr. Song to confirm

1. Whether reaction times from false presses go into the attention curve, or hits only.
2. Whether very fast presses (for example under 100 ms, which are likely anticipations rather than reactions) should be excluded from reaction-time measures.
3. The smoothing width and the interpolation method for the curve, from Esterman et al. (2013).
4. The d′ correction (log-linear as proposed, or another).
5. The minimum number of hits for a curve to be meaningful.
6. For the per-picture list: the curve's value at the start of each picture, at its middle, or averaged over it.
7. The column names her pipeline expects in the events table.
8. Whether sad moles and molerats are pooled as one skip condition or compared.
9. Whether the evenly spaced one-second trials cause a problem for the fMRI design matrix (section 5), since v0.1 jittered the gaps for exactly that reason.

## 11. Glossary

- **Mean.** The average.
- **Standard deviation (SD).** How spread out a set of numbers is around its mean. Small SD: values cluster tightly.
- **Coefficient of variation (CV).** SD divided by mean. Spread relative to size.
- **Median.** The middle value when everything is sorted. Half the values are below it.
- **z-score.** A value expressed as "how many SDs from the mean". A z-score of 2 is unusually high for that person; -2 is unusually low.
- **Interpolation.** Filling in a missing value by drawing a line between its neighbours.
- **Gaussian smoothing.** Averaging each point with its neighbours, giving nearby points more weight, using a bell-shaped curve for the weights. Turns a jagged series into a trend.
- **d′ (d-prime).** A sensitivity score that combines hits and false presses. Used across psychology to measure how well two kinds of things are told apart.
- **TR and volume.** The scanner takes one whole-brain picture (a volume) every TR seconds.
- **Design matrix.** The table that tells the standard fMRI model when each kind of event happened, so it can look for brain responses to them.
- **Hidden Markov model.** A statistical method that finds a small number of recurring "states" in a signal over time and says which state is active at each moment. Song, Shim & Rosenberg (2023) used it on brain data; our per-picture attention level can be compared with those states.
