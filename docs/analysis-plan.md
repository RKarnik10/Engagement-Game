# Analysis plan, in plain language

*Proposal for Phase 3 of the [README](../README.md): the analysis script. Nothing in this document is built yet. Written September 18, 2026 by Rehaan Karnik with AI assistance, for Dr. Song to check and for anyone who wants to know what the numbers will mean. Terms are explained where they first appear, and again in the glossary at the end.*

## 1. What the analysis is for

Each run of the game produces two files (described in the [review guide](review-guide.md)): an events table with one row per target, and a full log with everything else. The analysis turns them into:

1. **A few numbers per run** that say how well the person did.
2. **A curve over time** that says how steady their attention was from moment to moment.
3. **That same curve on the scanner's clock**, one value per brain picture, so it can be compared with the fMRI signal.

## 2. The raw ingredients

For every target, the game records when it appeared, whether it was a mole (respond) or an eggplant (hold back), what the person did, and how long they took. Each target ends with one outcome:

| Outcome | Plain meaning |
|---|---|
| `hit` | Mole, pressed in time. Gives a reaction time. |
| `omission` | Mole, no press. Usually an attention lapse. |
| `commission` | Eggplant, pressed anyway. A failure to hold back. Gives a reaction time. |
| `correct_rejection` | Eggplant, left alone. Correct. |
| `truncated` | The run ended while the target was up. Dropped from every measure. |

Two more things are logged but do not end a target: `wrong_hole` (pressed the key for a different hole while a target was up) and `no_target_press` (pressed when nothing was up). They are counted as quality measures, and the wrong-hole rule is open question Q11.

## 3. Whole-run measures

**Hit rate.** Moles pressed, divided by moles shown. **Omission rate** is the rest: moles missed.

**Commission rate.** Eggplants pressed, divided by eggplants shown. This is the classic measure of failing to hold back.

**d′ (say "d-prime").** Hit rate alone is not enough: someone who presses for everything scores 100% hits and 100% false presses. d′ combines hits and false presses into one number for how well the person told moles from eggplants. Zero means they could not tell them apart at all; larger is sharper. The formula is the difference between two z-scores (see the glossary): z(hit rate) minus z(false-press rate). Perfect rates of 0% or 100% break the formula, so a small correction is standard. We propose the **log-linear correction**: add 0.5 to each count and 1 to each total before dividing. Any correction works as long as it is written down.

Worked example from a simulated test run:

| | Count | Rate | Corrected rate | z |
|---|---|---|---|---|
| Hits | 24 of 26 moles | 0.923 | 24.5 / 27 = 0.907 | 1.325 |
| False presses | 1 of 6 eggplants | 0.167 | 1.5 / 7 = 0.214 | -0.792 |

d′ = 1.325 - (-0.792) = **2.12**.

**Reaction time: mean, SD, CV.** The average reaction time on hits; the standard deviation, which is how spread out they are; and the coefficient of variation, which is SD divided by mean. The CV lets us compare people who are faster or slower overall, because it measures spread relative to their own speed.

## 4. The attention curve: variance time course

This is the main attention signal, following Esterman et al. (2013) as summarised in the [research notes](../research-notes.md). The idea: when attention is steady, reaction times are consistent. When it drifts, they become erratic, sometimes unusually fast (pressing on autopilot) and sometimes unusually slow (drifting off). So the size of the swing in reaction time, trial by trial, tracks attention.

Steps, in order:

1. **Take the reaction time of every hit.** Whether to include the reaction times of false presses too is a detail to confirm (section 10).
2. **Convert each to a z-score.** How far it is from that person's own average, in units of their own spread. This removes "some people are just faster".
3. **Take the absolute value.** We care about how far from typical, not which direction.
4. **Fill the gaps.** Missed moles and eggplants have no reaction time. Fill each gap by interpolation, which means drawing a straight line between the neighbouring values, so every target has a number.
5. **Smooth.** Replace each value with a weighted average of itself and its neighbours, weighting nearby targets most, using a bell-shaped (Gaussian) weighting. The curve then shows the trend rather than trial-to-trial noise. Esterman et al. specify the width of the bell; we will copy it.
6. **Split at the median.** Targets below the run's median curve value are "in the zone" (steady); targets above it are "out of the zone" (erratic). Esterman et al. found more errors, and a different pattern of brain-network activity, out of the zone.

The chart at the bottom of the game page is a rough version of steps 1 to 6. It skips step 4 and uses a placeholder width in step 5, so it is for a first look only.

## 5. Putting the curve on the scanner's clock

The scanner takes one whole-brain picture every TR (for example every 1 s). The curve above has one value per target, and targets are about 1.75 s apart on average. To compare the two, we compute the curve's value at the time of each picture, by interpolation again. The result is a list with exactly one number per picture: the behavioural attention level during that picture.

That list can be compared directly with per-picture brain measures, for example the sequence of brain states found with a hidden Markov model in Song, Shim & Rosenberg (2023). See the glossary for the term.

Separately, the events table gives every target's onset and duration in seconds, which is what the standard fMRI model (the design matrix) needs. Each mole, eggplant, and error can be an event type in that model.

## 6. Errors in context: what came before each eggplant

The `preceding_go` column records how many moles came in a row before each eggplant. The more moles in a row, the stronger the habit of pressing, and the harder the eggplant is to resist. This is the manipulation the original whack-a-mole task was built around. We propose plotting the commission rate against the number of preceding moles, in bins such as 1 to 2, 3 to 4, and 5 or more.

## 7. Data-quality checks

Cheap checks that should run on every file before anything else:

- **Display timing.** The full log records the average and maximum time between screen frames and how many frames took longer than 20 ms. Many long frames mean targets may have appeared late.
- **Lateness.** `onset` minus `scheduled_onset` for each target. Should be under one frame (about 17 ms at 60 Hz).
- **Counts** of truncated targets, wrong-hole presses, and presses with nothing up. A high count suggests the person was confused about the keys or the task.
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
8. Whether runs with different looks (moles versus neutral shapes) are analysed together or separately.

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
