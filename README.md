# Engagement Game: a whac-a-mole attention task for fMRI

**Status:** Blueprint v0.3. Drafted September 18, 2026; revised September 21 after Dr. Song's first round of feedback, September 25 when the trial mix was clarified, and October 11 to 17 after piloting feedback. Six decisions are still open (section 2); every answered one is in [process/decisions.md](process/decisions.md).
The open questions in section 2 now carry her answers. Values still marked *(placeholder)* are starting guesses, not decisions.

**Author:** Rehaan Karnik (undergraduate RA). Drafted with AI assistance; references were pulled from search and are listed in section 10 with notes on what was and was not verified.

**Build status (October 26, 2026):** Phases 0, 1, and 2 of section 7 are done; Phase 3 (the analysis script) is next. `src/` follows Dr. Song's feedback: nine holes in a three-by-three grid, three buttons (one per column), a fixed one-second trial, 600 trials for a ten-minute run. Each trial shows a happy mole to press, a sad mole to leave alone, or both at once in different columns, at 80 / 10 / 10. The participant display runs in its own browser tab, separate from the experimenter console, and the game is published at the link below. The score is shown by default, with an optional health-bar game style; rings, sound (a bonk), and a hammer that hits the mole are optional; the background is a garden scene. Runs carry a participant ID and run number, save their files automatically, and record every press at full precision. The mole pictures are matched for size and brightness ([docs/stimuli.md](docs/stimuli.md)). 131 automated tests (`npm test`). A complete example run is in [examples/](examples/). **Section 2** lists the open decisions.

**Contributors and AI disclosure:** see [section 12](#12-contributors-and-ai-disclosure). Code and documentation in this repository were written by an AI assistant under the author's direction, as recorded there.

**Companion documents:** [docs/for-labmates.md](docs/for-labmates.md) (for labmates testing the game; no coding), [examples/](examples/) (a full 600-trial example run and what to look for in it), [research-notes.md](research-notes.md) (the reading behind sections 8 and 10), [docs/review-guide.md](docs/review-guide.md) (how to look around this repository without reading code), [docs/analysis-plan.md](docs/analysis-plan.md) (what we will compute from the data), [process/decisions.md](process/decisions.md) (every answered decision, dated), [docs/analysis-plan.md].

---

## 1. What this is

A short, game-like **go/no-go task**. Targets pop up from holes one at a time; the participant presses the matching button for "go" targets and holds back on "no-go" targets.

The goal is a task that sits between a classic sustained-attention task (such as the gradCPT used in Song, Shim & Rosenberg, 2023) and fully naturalistic stimuli like movies. It should feel more like a game than a CPT, but every stimulus and every response is still time-stamped, so behavioral attention measures can be lined up with the fMRI time series.

The game records:

- when each target was **scheduled** to appear and when it **actually** appeared (frame-locked),
- which button was pressed and when,
- how each trial ended (hit, miss, false press, correct skip, and so on).

Attention and engagement measures are computed from those logs offline (section 5).

**Published game:** https://rkarnik10.github.io/Engagement-Game/ (the experimenter console; labmate links point to `display.html` under it). It is rebuilt from `src/` by `.github/workflows/pages.yml` on every push to `main`, once the tests pass. The original v0.1 prototype is kept at https://rkarnik10.github.io/Engagement-Game/prototype/ . Publishing is switched on (repository Settings > Pages > Source: GitHub Actions); after a push, the site may show the old version for about 10 minutes because of caching. Labmates: see [docs/for-labmates.md](docs/for-labmates.md).

`index.html` is the v0.1 prototype: one self-contained HTML file with no dependencies. It implements sections 3 and 4.5 of this document with placeholder parameters. The modular build described in sections 6 and 7 will live in `src/` and should not replace `index.html` until it matches the prototype's behavior.

To run locally, open `index.html` in any browser. For the current build in `src/`, run `npm run serve` from the repository folder, open http://localhost:8000/ (the experimenter console), and click **Open participant display**. It needs a local server because browsers block ES modules opened straight from disk. `npm run serve` starts one that tells the browser not to cache, so a reload always shows the latest code. If a page shows a red "code has not loaded" box, press Cmd+Shift+R to reload without the cache.

---

## 2. Open decisions

Only the decisions that are **still open** are listed here. Every answered
decision, with its date and where it lives in the code, is in
[process/decisions.md](process/decisions.md). Letters match that log.

| # | Open decision | What the game does now | Why it is open |
|---|---------------|------------------------|----------------|
| C | Both trials, after the good mole is hit | The bad mole stays up until the window ends; pressing it later still counts as a commission, and the trial's outcome is then `commission`. The sad-first case was settled on October 26, 2026 (a sad-mole hit overrides the happy mole's scoring). Still open: happy hit first, then the sad mole, which currently counts both. | Part of the wider question H. The alternative is to take both moles down on the first press, which would make any second press a stray press instead. |
| F | Q4 remainder | TR 1 s, trigger key `t`, 2 s lead-in, one run. | Needed before any scan. Dr. Song said this is still to be discussed. |
| H | Several presses in one trial: does every press count, or only the first? | **Every press counts.** Pressing a sad mole and then an empty column records both a sad-mole hit and a wrong-column press. A wrong-column press followed by the right one counts as a hit. In a both trial, hitting the happy mole and then the sad one counts as a hit and a sad-mole hit, and the trial's outcome is `commission`. | Raised by Rehaan Karnik on October 17, 2026. A "first press only" rule (later presses recorded with their times but ignored for scoring) was built and reverted the same day, because it also turns a quick correction into a miss, which Dr. Song's feedback described. Options: (1) every press counts, as now; (2) only the first press counts; (3) a middle way, e.g. only the first press *on a mole* counts, so a wrong-column press can still be corrected but a happy-mole hit cannot be followed by a sad-mole hit. Every press is recorded with its time whichever is chosen, so the analysis can apply any rule later. |
| O | Same schedule for everyone, or one per participant and run? | Same for everyone: every run uses the schedule from `seed` (1234), unless "Give each participant and run its own schedule" is ticked (`seedFromIds`). | The same schedule for everyone makes participants directly comparable trial by trial and keeps one fMRI design matrix; different schedules avoid order effects and stop anything tied to one particular sequence. Common in fMRI either way. Added October 17, 2026. |
| P | How should the health bar work, exactly? | Starts at 100 and changes only on mistakes (no drain over time). Stops at 0 and the run continues (no game over). "Correct" for regeneration means a trial with every happy mole hit and every sad mole left alone; five in a row gives +5. | Irene's note ("start slowly decrementing from 100 … slowly regenerating with like 5 correct ones in a row") could also mean a slow drain over time, and a game over at 0 would add the drama she asked for but cut the fixed 600-trial schedule short. Added October 26, 2026. |
| Q | Behavioral comparison with the gradCPT tasks | Not built. | Dr. Song asked (October 26, 2026) for the game to be turned into a behavioral task and reported against the lab's gradCPT scenes, to show how whac-a-mole differs. Needs a design (the same participants on both tasks for ten minutes each, matched measures such as RT variability, d′, and the variance time course) and the Phase 3 analysis script reading both tasks' data. The gradCPT scripts are in the local `experiment/` folder (not in this repository). |

How to answer one: send the letter and your answer to Rehaan Karnik, who moves
it into [process/decisions.md](process/decisions.md) with the date and, where an
answer changes behavior, changes the game.

---

## 3. Task design

### 3.1 Core loop

1. The scanner trigger (or `t` during development) sets **t = 0**. All timestamps are milliseconds from this moment.
2. One trial starts every second, at a pre-scheduled time. Moles pop up from nine holes arranged in a 3 by 3 grid.
3. The participant has three buttons, one per **column**. The row a mole is in never changes the correct button.
4. Each trial is one of three types (decided with Dr. Song, confirmed September 25, 2026):
   - **Good** (80%): one happy mole. Press its column's button. The mole goes down when hit ("killed").
   - **Bad** (10%): one sad mole. Do not press. It is not killed; it goes down on its own.
   - **Both** (10%): a happy mole and a sad mole at the same time, in different columns. Press only the happy mole's column.
5. Nothing on screen reacts to a press. The participant gets no confirmation, no score, and no highlight. The only change is that a hit mole goes down.
6. For testing, a run can be **paused** (the console's Pause button, or <kbd>P</kbd> in the display) and **ended early** (End run, or <kbd>Esc</kbd> in the display). A pause stops the run clock, so the schedule resumes exactly where it stopped. A scanner cannot pause, so pauses are logged and a paused run is marked as not usable for scanning. However a run ends, its results, trace, and downloads stay in the console until the next run starts.
7. The schedule **never depends on the participant's responses**. A hit makes a mole drop early, but the next trial still starts at its scheduled time. This means the timing design (and therefore the fMRI design matrix) is fixed before the run starts.

### 3.2 Why go/no-go

- **Whack-a-mole already exists as a research task.** A game-like whack-a-mole go/no-go task, originally distributed by Yale's FAB lab and described as a version of the Casey et al. (1997) go/no-go paradigm, has been used to measure response inhibition in children; it deliberately varies how many go trials come before each no-go trial, because longer go streaks make the no-go harder to withhold (Millisecond task library documentation; see section 10). So this project adapts an established paradigm rather than inventing one.
- A mostly-go stream builds a habitual "press" response. No-go trials then show whether attention is on the task (commission errors), and reaction-time variability across go trials gives a continuous attention time course (Esterman et al., 2013). This is the same logic as the gradCPT, so results can be compared with the lab's existing work.
- We log `preceding_go` (the number of go trials before each no-go) so the Casey-style manipulation is available in analysis even though v0.1 does not control it directly.

### 3.3 Response classification

Each mole is scored on its own:

| Situation | Outcome code | Meaning |
|-----------|--------------|---------|
| Good mole up, its column's button pressed | `hit` | Correct; reaction time (RT) recorded; the mole goes down |
| Good mole goes down with no press on its column | `omission` | Miss; likely attention lapse |
| Bad mole up, its column's button pressed | `commission` | False press; inhibition failure; the mole goes down |
| Bad mole goes down with no press | `correct_rejection` | Correct skip |
| Run ends while a mole is up | `truncated` | Excluded from measures |

Presses that land on no mole:

| Situation | Outcome code | Meaning |
|-----------|--------------|---------|
| Mole(s) up, a column with no mole pressed | `wrong_hole` | Error; the trial continues (Q11) |
| No mole up, any mapped button pressed | `no_target_press` | Anticipatory or stray press |

Each trial also gets one overall outcome. A good or bad trial takes its mole's outcome. A **both** trial is:

| Good mole | Bad mole | Trial outcome | Correct |
|-----------|----------|---------------|---------|
| `hit` | `correct_rejection` | `hit` | yes |
| `hit` | `commission` | `commission` | no |
| `omission` | `correct_rejection` | `omission` | no |
| `omission` | `commission` | `commission` | no |

In a both trial, hitting the good mole takes only that mole down; the bad one stays up until the window ends, so a later press on it still counts as a commission. *(These two rules are a reading of the design, not yet confirmed by Dr. Song; see [section 2](#2-open-decisions) and [process/decisions.md](process/decisions.md).)*

`e.repeat` key events (holding a key down) are ignored.

### 3.4 Task parameters

Settled values are marked **decided**; the rest are still placeholders.

| Parameter | Value | Notes |
|-----------|-------|-------|
| Holes | 9, in a 3 by 3 grid | **Decided (Q2).** |
| Buttons | 3, one per column | **Decided (Q2).** The row a mole appears in does not change the correct button. |
| Trials per run | 600 | **Decided.** About 10 minutes. |
| Trial rate | one every 1000 ms, fixed | **Decided (Q5).** Not jittered, so onsets are exact. |
| Trial mix | 80% good, 10% bad, 10% both | **Decided** (confirmed September 25, 2026). A both trial shows a good and a bad mole at once, in different columns. |
| Bad mole picture | sad mole | **Decided** (A, October 17, 2026). A molerat stays available (`badStim`). |
| Target up time | 800 ms | **Decided** (D, October 17, 2026). Inside the 1000 ms cycle, leaving 200 ms empty. |
| Constraints | First 3 trials good; no two bad trials in a row; the same hole **may** come up on consecutive trials | The repeat rule was **decided** (G, October 17, 2026); the other two are placeholders carried over from v0.1. |
| Feedback | none | **Decided (Q6).** No score, no highlight, no sound. |
| First target | 2000 ms after trigger *(placeholder)* | Depends on dummy scans (Q4). |
| Gradual rise/sink | 350 ms each way *(placeholder)* | Only when `onset: "gradual"` (section 3.5). Does not fit a 1 s cycle without a shorter up time. |

Fixed one-second trials are a change from v0.1, which jittered the gaps so
that the fMRI response to each target could be separated. A fixed rate matches
the lab's gradCPT and suits the variance-time-course analysis (section 5), but
it means the events are evenly spaced, which is worth keeping in mind when the
design matrix is built.

### 3.5 How targets appear: pop-up vs. gradual rise

A classic whack-a-mole target **pops up abruptly**. Abrupt visual onsets grab attention automatically, which helps the participant stay on task without effort. The gradCPT removes abrupt onsets (images fade gradually from one to the next) specifically so that the task is sensitive to lapses (see section 10, gradCPT notes).

Implication: a pop-up whack-a-mole might be *less* sensitive to attention lapses than the lab's existing task. Both are supported (`onset: "instant" | "gradual"`). **Decided** (N, October 17, 2026): moles pop up instantly. Gradual rise stays available as an option.

### 3.6 Looks ("skins")

A skin changes **only the drawings**. Schedule, positions, sizes, timing, and keys are identical across skins, so the same seed produces the same run under either look. Decided (Q8): the mole skin is the one to build. The good mole is a happy mole; the bad mole is a sad mole by default, or a molerat.

| Skin | Go target | No-go target |
|------|-----------|--------------|
| `mole` | Happy mole | Sad mole (or a molerat) |
| `neutral` | Round light | Diamond, and a second neutral shape |

Requirements for the real build:

- Match the go and no-go drawings across skins for **size and average brightness (luminance)**, so any brain difference between skins comes from meaning, not from low-level visual properties. **Done** for the mole skin on October 17, 2026: happy mole, sad mole, and molerat are equal in area and within 0.3% in mean brightness ([docs/stimuli.md](docs/stimuli.md); re-check with `scripts/measure-stimuli.py`).
- Distinguish go from no-go by **shape**, not color alone, so color-blind participants can play. The happy mole's mouth curves up and the sad mole's curves down, with its inner brows raised; the molerat has a bald head, big ears, and buck teeth. (Fixed September 25, 2026: the first sad mole's brows read as angry, and the molerat's outlined teeth looked like a pause symbol.)
- Keep the "violence dial" at its lowest setting: no hammer, no impact animation, no sound. Adding those would be a separate, deliberate decision (section 8).

---

## 4. fMRI integration

### 4.1 Clock and trigger

- t = 0 is the first scanner trigger. In development, the `t` key simulates it.
- Every later trigger pulse is logged as a `volume` event, so the log can be checked for clock drift against the scanner.
- In the browser, timestamps come from `performance.now()` (milliseconds, high resolution). Browsers intentionally reduce this timer's precision for security reasons, and the amount varies by browser, so it must be checked on the actual machine.
- Target onsets are **frame-locked**: the logged onset is the animation frame on which the target was first drawn (`requestAnimationFrame`). The delay between that and light actually leaving the projector is not measured by software (section 4.4).

### 4.2 Response device

- The key-to-button mapping lives in config, not in code. A button is a column: `holeResponse` in `src/config.js` maps each of the nine holes to one of three buttons.
- Only the mapped buttons are recorded as responses. Every other key is ignored and never stored.
- Many MR-compatible button boxes present themselves to the computer as a keyboard, but which keys they send depends on the site's hardware. **Confirm the key codes at the scanner we will use.**
- Known gotcha: some trigger boxes send the key `5`. The three response buttons are `1`, `2`, and `3`, so `5` is free, but the config refuses any trigger key that collides with a response key.

### 4.3 Display

- The participant display runs in its own browser tab or window, separate from the experimenter console, so the participant never sees the settings or the data. See section 6.4.
- Background is a fixed mid-grey in every theme. Large brightness changes on screen produce responses in visual cortex that we don't want mixed into the attention signal. Since October 17, 2026 the display can instead show a static garden scene (sky, hills, grass, brown holes) for piloting; it is the default, and plain grey is one click away in the console (`scene`). The garden never changes during a run, so it adds no brightness changes over time, but it is brighter and busier than grey. **Decided** (M, October 17, 2026): the garden is used, scanning included.
- Confirm projector resolution, refresh rate, and visual angle (Q10) before finalizing hole spacing.

### 4.4 Timing precision

Bridges et al. (2020) compared many experiment packages. Lab-based tools (PsychoPy, Psychtoolbox, Presentation, E-Prime) reached sub-millisecond precision in their tests; browser-based studies were more variable, though often still good, with performance depending on the browser and operating system combination. The authors stress that each lab should validate timing on its own setup.

Implication for us: the browser prototype is fine for design discussion and behavioral piloting. Before scanning, either port the game to the lab's standard presentation software or validate the browser build with hardware (for example a photodiode on the screen and the real button box). This decision is Phase 4.

### 4.5 Output files

Each run writes three files. A complete example of all three is in
[examples/](examples/).

1. **Run table (CSV).** The one to open first, and the one Dr. Song asked for
   on September 21, 2026. One row per trial: `participant, run, trial, onset_s, trial_type,
   good_row, good_col, bad_row, bad_col, correct_action, expected_button,
   n_presses, press_1_button, press_1_ms, … press_5_button, press_5_ms,
   first_press_ms, good_hit_ms, good_outcome, bad_outcome, outcome, correct,
   score_points, score_pct, scheduled_onset_s, onset_lag_ms, preceding_go`.
   Opens in Excel. Missing values are `n/a`, which pandas reads as NaN with no
   options. Each of the first five presses in a trial gets its own button and
   time column, filled from `press_1` in the order pressed; `n_presses` is the
   true count, and the full log keeps every press beyond five. All times are
   written at full precision, exactly as the browser's clock gave them, so
   every time column loads as a number (October 16, 2026). Trailing digits
   such as `291.999999999997` are how computers store decimals, not real
   precision; the browser clock is itself coarsened (about 0.1 ms in Chrome)
   and the screen updates about every 16.7 ms. `score_points` and `score_pct`
   are the running score at the end of the trial (section 6.4), recorded
   whether or not the player saw it.
2. **Events table (TSV), BIDS-style.** The same trials with `onset` and
   `duration` in seconds from the trigger, for the fMRI design matrix.
   Columns: `onset, duration, trial_type, good_row, good_col, bad_row,
   bad_col, expected_button, n_presses, press_1_button, press_1_time, …
   press_5_button, press_5_time, outcome, response_time, scheduled_onset,
   preceding_go`. Times are in seconds at full precision. *(Column names beyond `onset`/`duration`
   should be checked against the current BIDS specification before we rely
   on them.)*
3. **Full log (JSON).** Metadata (task version, whether the run was in the
   scanner, the trial mix and pictures, config, user agent, frame-interval
   statistics), the trial table with each mole and each press, and every raw
   event including trigger pulses, wrong-column presses, stray presses, and
   any moment the participant display was hidden.

The files are built when the run ends and saved automatically to the
browser's downloads folder (`autoSave`, on by default; the download buttons
also work). With a participant ID, file names start with BIDS-style labels,
for example `sub-07_task-whacamole_run-02_20261017-143012_behavioral_seed1234_score_run.csv`;
without one they start `engagement-game_`. The first time, a browser may ask
whether the site may download several files; allow it once.

Every run records whether it happened in the scanner (`in_scanner: 1`) or in
the behavioral suite (`in_scanner: 0`).

Frame-interval statistics (mean, max, count over 20 ms) are a cheap health check: many long frames mean onsets may be late.

---

## 5. Measures (computed offline in `analysis/`)

**Per run:**

- Hit rate, omission rate, commission (false alarm) rate.
- d′ (sensitivity) from hit and false-alarm rates, with a standard correction for rates of 0 or 1 (choose and document one, for example the log-linear correction).
- Mean RT, RT standard deviation, RT coefficient of variation (SD ÷ mean).

**Over time (the main attention signal):**

- **Variance time course (VTC)**, following Esterman et al. (2013): convert go-trial RTs to z-scores, take each trial's absolute deviation from the run mean, fill in missing trials by interpolation, and smooth with a Gaussian kernel. A median split labels "in the zone" (low variability) and "out of the zone" (high variability) periods. *The demo uses a simplified version; check the paper for the exact interpolation and kernel width before implementing.*
- **Resample onto the TR grid** so each volume has a behavioral value. That makes it directly comparable with per-volume neural measures such as the hidden-Markov-model states in Song, Shim & Rosenberg (2023).

**Engagement (optional, Q1):**

- Short self-report probes between runs or every N trials (for example, "How focused were you just now?"). A 2024 conference abstract from the Rosenberg lab compared RT-variability and thought-probe approaches in a single go/no-go task, which is a useful model if we add probes.

---

## 6. Architecture

Vanilla HTML, CSS, and JavaScript with **no framework and no build step**, so it runs on any lab computer with a browser. ES modules, so it must be served from a local web server (opening `index.html` directly from disk will block module imports).

```
Engagement-Game/
├── README.md               # this blueprint
├── research-notes.md       # literature notes behind sections 8 and 10
├── index.html              # v0.1 single-file prototype (served by GitHub Pages)
├── examples/               # a full 600-trial example run, generated without a browser
│   ├── simulate-run.mjs
│   └── example_run.csv, example_events.tsv, example_log.json
├── .github/workflows/
│   └── pages.yml           # test, then publish src/ to GitHub Pages on every push to main
├── package.json            # {"type": "module"}, test and serve scripts, no dependencies
├── scripts/
│   ├── serve.mjs           # `npm run serve`: local server for src/ that disables caching
│   └── measure-stimuli.py  # size and brightness of each mole picture (macOS)
├── src/
│   ├── index.html          # experimenter console page; loads main.js
│   ├── display.html        # participant display page; loads display.js
│   ├── styles.css
│   ├── main.js             # console: settings, mirror, live measures, exports
│   ├── display.js          # display: drawing, keys, full screen
│   ├── link.js             # console <-> display messages (BroadcastChannel)
│   ├── session.js          # runs the game inside the display tab
│   ├── summary.js          # PURE: run summary shown after a run (console and display)
│   ├── query.js            # PURE: settings <-> web address, for labmate links
│   ├── config.js           # defaults, validation, presets ("desktop-pilot", "scanner")
│   ├── rng.js              # seeded PRNG (mulberry32)
│   ├── schedule.js         # PURE: (config) -> trial list. No DOM.
│   ├── classify.js         # PURE: (moles up, pressed button) -> outcome. No DOM.
│   ├── engine.js           # run state machine + requestAnimationFrame loop; one or two moles per trial
│   ├── input.js            # keyboard/pointer -> hole index; trigger detection
│   ├── logger.js           # append-only event log
│   ├── export.js           # run CSV + events TSV + full JSON; download via Blob
│   └── render/
│       ├── board.js        # hole layout shared by all skins
│       ├── trace.js        # attention-trace chart, experimenter view only
│       ├── skin-mole.js    # happy mole, sad mole, molerat
│       ├── sound.js        # good/bad feedback sounds (piloting only)
│       └── skin-neutral.js # not built
├── tests/
│   ├── schedule.test.js
│   ├── classify.test.js
│   ├── engine.test.js
│   ├── export.test.js
│   ├── link.test.js        # console and display over a real BroadcastChannel
│   ├── pause.test.js       # pausing, ending early, and the run summary
│   ├── variants.test.js    # feedback variants and labmate links
│   ├── phase2.test.js      # participant/run labels, per-run seeds, auto-save files
│   ├── pages.test.js       # both pages, each in its own worker, under a fake page
│   └── pages/              # the fake page and the per-page scripts for pages.test.js
│   ├── input.test.js
│   ├── config.test.js
│   └── _sim.js             # fake-clock helper for the engine tests
├── analysis/               # Phase 3 (Python)
│   └── compute_measures.py
├── process/
│   └── decisions.md        # every answered decision, dated (open ones live in README section 2)
└── docs/
    ├── review-guide.md     # how to review this repository without reading code
    ├── stimuli.md          # size and brightness matching of the mole pictures
    └── analysis-plan.md    # Phase 3 analysis plan in plain language
```

**Rules that keep it analyzable and portable:**

- `schedule.js` and `classify.js` are pure functions with no DOM access, so they can be unit-tested in Node and ported to Python/PsychoPy line for line if needed.
- The renderer only draws; it never decides outcomes.
- A skin only changes drawings (section 3.6).
- Same config + same seed = identical schedule, always.

### 6.1 Config (example)

```json
{
  "version": "0.3",
  "skin": "mole",
  "layout": "grid3x3",
  "keys": ["1", "2", "3"],
  "triggerKey": "t",
  "setting": "behavioral",
  "onset": "instant",
  "rampMs": 350,
  "nTrials": 600,
  "trialMs": 1000,
  "holdMs": 800,
  "firstOnsetMs": 2000,
  "goodShare": 0.8,
  "badShare": 0.1,
  "bothShare": 0.1,
  "badStim": "mole_sad",
  "trS": 1.0,
  "showScore": false,
  "feedback": false,
  "seed": 1234
}
```

`durationS` is derived, not set: 600 trials of 1000 ms plus a 2000 ms lead-in
is 602 seconds. The three shares must add up to 1; 600 trials give exactly 480
good, 60 bad, and 60 both. `badStim` is `mole_sad` or `molerat`.

### 6.2 Trial record

| Field | Type | Notes |
|-------|------|-------|
| `trial` | int | 1-based |
| `type` | `"good"`, `"bad"`, or `"both"` | |
| `targets` | list | One mole, or two for `both` (good one first). Each has `valence` (`"good"`/`"bad"`), `stim`, `hole` (reading order), `row`, `col`, `response` (its column's button), and after the run `outcome`, `rt_ms`, `offset_ms`, `input` |
| `scheduled_onset_ms` | number | From the schedule |
| `actual_onset_ms` | number | Frame on which the moles were first drawn |
| `offset_ms` | number | When the last mole went down |
| `outcome` | string | The trial's overall outcome (section 3.3) |
| `correct` | 1, 0, or null | Null for a truncated trial |
| `good_rt_ms` | number or null | RT of the press that hit the good mole |
| `presses` | list | Every press while the moles were up: `button`, `rt_ms`, `outcome`, `input` |
| `preceding_go` | int or null | On trials with a bad mole: trials in a row that needed a press since the last bad trial |

### 6.3 Event record

Every event has `t_ms` (from trigger) and `event` (one of `trigger`, `volume`, `target_on`, the outcome codes, `run_end`), plus relevant fields such as `trial`, `type`, `target`, `valence`, `hole`, `row`, `col`, `stim`, `button`, `pressed_button`, `up_buttons`, `rt_ms`, `lag_ms`, `source`. More event types: `trial_end` (one per trial, with its overall outcome), `display_hidden` / `display_visible` (the participant tab lost or regained visibility during a run), and `pause` / `resume` (testing only; `resume` carries `paused_ms`, and the run clock excludes the pause).

### 6.4 Two tabs: console and display

The experimenter console (`index.html`) and the participant display (`display.html`) run in separate tabs of the same browser and talk over a BroadcastChannel (`link.js`). The game runs in the **display**, not the console, for two reasons: browsers pause animation frames in hidden tabs, and key presses (including the scanner's trigger and button box) go to the window in front, which is the participant's. The console sends settings and start/stop, mirrors what the display shows, and receives every event plus the finished run, from which it builds the three files.

- The display must stay visible for the whole run. Drag its tab out into its own window on the participant's screen. If it is hidden anyway, the gap is logged as `display_hidden`.
- The display keeps its last run. A console that is reloaded asks for it again, so data is not lost.
- If two displays are open, the console warns and sends Start only to the newest.
- **Feedback variants for piloting** (October 11, 2026). Four switches in the console, all on by default (the score since October 17, 2026, rings, sound, and hammer since October 26; decision L). Dr. Song's Q6 answer was no feedback, so a link or the console can switch each off (`score=0`, `rings=0`, `sound=0`, `hammer=0`). They are: a score, rings (white on a hit, red on a distractor pressed; only the front arc below the hole's rim, so it never crosses a mole), sound (a "bonk" when a mole is hit, with a low buzz added when it is a sad mole; silent for a press on an empty column; with the hammer on, timed to the strike), and a hammer that swings onto a pressed mole. With the hammer on, a hit mole stays up until the hammer lands (about 90 ms), is squashed under a small impact burst while the hammer rebounds, and sinks, all within 300 ms; this is display only, and the data records the hit at the moment of the press. They never change the schedule. Each run records its variant (`feedback_variant` in the log, and in the file names, e.g. `_score_`). Sound and hammer turn up the "violence dial" that section 8 kept low, so they are for piloting only. Sound is synthesised with the Web Audio API and needs one key press or click in the display first.
- **The score** (feedback of October 13, 2026) is a percentage, so it does not reveal how many trials are left: points = happy moles hit × 1 − distractors hit × 3 (`scorePenalty`, adjustable; 10 until October 17, 2026, briefly 5), divided by the happy moles that could have been hit so far (each counts once it is hit or goes down missed). A perfect player stays at 100%; hitting distractors can push it below zero. It is shown at the top centre of the display, above the grid, with a bar that fills to the percentage. Its colour slides smoothly with the score: dark red, red, orange, yellow through the 50s to the low 70s, light green, then green at 100% (`scoreColor` in `src/summary.js`; October 17, 2026). A negative score shows an empty bar. Wrong-column presses cost nothing. Every trial records the running score in the data, shown or not.
- **Health bar game style** (October 26, 2026, from Irene's feedback that the score felt passive, "like Flappy Bird, except you can't die"). An alternative to the percentage score, chosen in the console (`gameStyle: 'health'`; `?style=health` in a link). Health starts at 100. A sad mole hit costs 10, a missed happy mole costs 3, and every 5 correct trials in a row give back 5, never above 100 (`healthSadHit`, `healthMiss`, `healthStreak`, `healthRegen`, all adjustable; the first defaults were 3, 1, and 5, changed the same day). A "correct" trial is one where every happy mole was hit and every sad mole left alone. The bar uses the same dark-red-to-green colours, shakes and flashes red when health drops, and pulses when it is low (25 or less). Health stops at 0 and the run carries on: a game over would cut the fixed ten-minute schedule short (open decision P). Health is recorded on every trial (`health` in the run table) whichever style is shown.
- **Both trials: a sad-mole hit overrides the happy mole** (Rehaan Karnik, October 26, 2026). Once the sad mole has been hit in a both trial, the trial counts only as that error: the happy mole stops counting toward the score and health, whether it is then pressed or missed. So sad-then-happy costs only the sad-mole penalty (no +1 for the happy hit), and sad-then-missed-happy costs only the sad-mole penalty (no extra miss). If the happy mole is hit *before* the sad one, it had already counted and still does. The data keeps both moles' raw outcomes and press times; the JSON log marks the ignored happy mole `counted: false`, and the hit and miss statistics in the summary still count what happened.
- **How the bar is laid out** (October 26, 2026): the value in large bold numerals on top, the bar below it, and a small spaced-out label (SCORE or HEALTH) under the bar. The score shows as a percentage (72%), health as a plain number (87).
- **Labmate links.** Settings can travel in the display's web address (`display.html?trials=60&score=1&results=1`; `src/query.js`). A display opened from such a link runs on its own: the tester presses T and sees the results and downloads at the end. The console builds the link for its current settings under "Link for labmates".
- The participant display shows no results by default (Q6). For testing, the console's "Testing" option also shows the results, the reaction-time trace, and the downloads on the display after a run (`showResultsOnDisplay`).
- BroadcastChannel is supported in all current major browsers (Safari since 15.4, 2022). Full screen uses `requestFullscreen`, with the `webkit` prefix for Safari before 16.4.

---

## 7. Implementation phases

### Phase 0: Scaffolding
- Folder structure from section 6, `package.json` with `"type": "module"` and a `test` script, a decisions log (now `process/decisions.md`).
- **Done when:** `npm test` runs (even with zero tests) and `src/index.html` loads from a local server (for example `python3 -m http.server` run from `src/`).

### Phase 1: Desktop prototype (match the demo)
- Seeded schedule, engine loop, keyboard and pointer input, mole skin, logging, both exports as downloads.
- **Done (September 18, 2026), revised to Dr. Song's feedback September 21 and 25:**
  - Same seed produces an identical schedule (test).
  - The 80 / 10 / 10 good / bad / both counts are exact, the first 3 trials are good, no two bad trials in a row, both-trial moles are always in different columns, and the same hole repeats at about the chance rate (tests, over 1,200 seeds).
  - The console and participant display run in separate tabs and talk over a BroadcastChannel (tests over a real channel).
  - Every row of the classification table in section 3.3 has a test.
  - Target windows never overlap, at 1 s per trial.
  - The CSV and TSV load cleanly in pandas and the JSON parses.
  - Frame statistics are recorded in the JSON metadata.
  - A full 600-trial example run is in [examples/](examples/).

### Phase 2: Matched art, labels, and auto-save
- **Done (October 17, 2026):**
  - The three mole pictures are matched for size and average brightness (section 3.6, [docs/stimuli.md](docs/stimuli.md)).
  - Each run carries a participant ID and run number: in the file names (`sub-07_task-whacamole_run-02_...`), the first two columns of the run table, and the log.
  - Optional per-run schedules: the seed for each participant and run is worked out from the base seed, ID, and run, so it differs between runs but can always be recreated (`seedFromIds`; whether to use it is open decision O).
  - A finished run saves its three files to the downloads folder automatically (`autoSave`, on by default), once.
  - `skin-neutral.js` was not built, because Q8 settled on moles.
- Tests cover the labels, the per-run seeds, and auto-save (`tests/phase2.test.js`, and both pages in `tests/pages.test.js`).

### Phase 3: Analysis script
- `analysis/compute_measures.py`: read TSV/JSON, compute section 5 measures, resample VTC onto the TR grid, plot.
- Use NumPy/pandas; for Gaussian smoothing, `scipy.ndimage.gaussian_filter1d` is one option (verify against current SciPy docs).
- **Done when:** running it on a demo export produces a per-TR CSV and a figure.

### Phase 4: Scanner readiness (decision point with Dr. Song)
- Choose platform (keep browser and validate, or port to the lab's standard software).
- Hardware timing check with the real display and button box.
- Behavioral pilot outside the scanner, including a mole-vs-neutral comparison if Q8 calls for it.
- Confirm the study falls under an existing IRB protocol or needs an amendment (the lab handles this; just flag it).

---

## 8. Content valence: does "whacking" matter?

**Concern raised:** whack-a-mole frames the response as hitting an animal. Could that (a) affect participants, (b) add brain responses unrelated to attention, or (c) be what makes the game engaging, so that removing it would cost engagement?

**What the literature I found says:**

- **Whack-a-mole is already an accepted research task.** It has been used as a go/no-go measure in children, and a modified tablet version has been used with patients with moderate dementia (both per the Millisecond task library documentation). The cognitive-task literature appears to treat the framing as benign.
- **Realistic virtual violence does change fMRI signals, strongly.** Mathiak & Weber (2006) scanned 13 experienced gamers playing a first-person shooter and found that violent moments increased activity in dorsal anterior cingulate cortex and decreased it in rostral anterior cingulate and amygdala, with large effects. Those regions overlap with networks involved in attention and control, which is why content matters for a confound, not just for ethics.
- **Violence adds little to enjoyment.** Across six studies, Przybylski, Ryan & Rigby (2009) found that enjoyment and desire to keep playing tracked feelings of competence and autonomy; violent content added little once those were accounted for. So a neutral version should not lose much engagement if the challenge stays the same.
- **Participant harm risk is low.** Kühn et al. (2019) had adults play a violent game (GTA V) daily for two months and found no increase in aggression or loss of empathy compared with a non-violent game or no game. Hilgard, Engelhardt & Rouder (2017) argue that earlier evidence for short-term effects was overstated.

**Gap:** I did not find any study comparing cartoon "whacking" with a neutral version of the same task under fMRI. Everything above is extrapolated from realistic shooters on one side and child-friendly cognitive tasks on the other.

**Assessment:** probably **not** a major problem for healthy adults, because a cartoon mole with no hammer or impact effects is far from a first-person shooter. It is a real but modest **design-cleanliness** issue: any aggression or social content adds brain responses the attention analysis does not model. It is cheap to address: build the engine skin-agnostic (section 3.6), default to the neutral skin if Dr. Song prefers, and optionally compare skins behaviorally in piloting.

### 8.1 Alternative A: tile-tap lanes (recommended if we swap)

A rhythm-tile-style version where targets light up in **lanes** instead of holes.

- **Why it fits:** it has the same structure as whack-a-mole (a target appears in one of N positions; press the matching button), so `schedule.js`, `classify.js`, logging, and analysis are reused unchanged. Four lanes map naturally onto four fingers on a button box.
- **Smallest version:** four vertical lanes; a tile flashes in one lane (go) or a crossed tile appears (no-go). Only a new renderer is needed.
- **Avoid for now:** continuously scrolling tiles. Constant motion adds visual-motion and eye-tracking demands and makes "onset" harder to define for the fMRI model.

### 8.2 Alternative B: match-3 puzzle (not recommended as a replacement)

A match-3 puzzle is engaging but measures something different:

- It is **self-paced**: there are no externally timed targets, so there is no clean RT series and no go/no-go structure.
- The main demands are **planning and visual search**, not sustained attention.
- It needs many more buttons or a cursor, which is harder in the scanner.

It could be interesting later as a separate "free play" naturalistic condition, but it would be a different study, not a drop-in swap.

---

## 9. Glossary

- **Go/no-go:** respond to most stimuli (go), withhold for rare ones (no-go).
- **Omission / commission error:** missing a go target / pressing on a no-go target.
- **RT:** reaction time. **CV:** coefficient of variation, SD ÷ mean.
- **VTC:** variance time course, a trial-by-trial measure of how unstable RTs are.
- **TR:** repetition time; how often the scanner records one brain volume.
- **Trigger:** the pulse (usually sent as a keypress) marking the start of a volume.
- **BIDS:** Brain Imaging Data Structure, a community standard for organizing neuroimaging data; task events go in a TSV file.
- **Skin:** the visual look of targets, independent of task logic.

---

## 10. References

Verification notes are in brackets. "Checked" means I saw the abstract or publisher page through search; it does not mean I read the full paper.

1. Bridges, D., Pitiot, A., MacAskill, M. R., & Peirce, J. W. (2020). The timing mega-study: comparing a range of experiment generators, both lab-based and online. *PeerJ, 8*, e9414. https://doi.org/10.7717/peerj.9414 [checked]
2. Casey, B. J., et al. (1997). A developmental functional MRI study of prefrontal activation during performance of a Go-No-Go task. *Journal of Cognitive Neuroscience, 9*, 835–847. [listed as the paradigm source in the Millisecond whack-a-mole manual; not independently checked]
3. Chidharom, M., Vogel, E., & Rosenberg, M. (2024). Elucidating fluctuations of visual attention: reaction time variability and mind-wandering provide complementary insights. Vision Sciences Society 2024 poster abstract. [checked; conference abstract, not a peer-reviewed paper]
4. Esterman, M., Noonan, S. K., Rosenberg, M., & DeGutis, J. (2013). In the zone or zoning out? Tracking behavioral and neural fluctuations during sustained attention. *Cerebral Cortex, 23*(11), 2712–2723. [citation checked via a reference list; method details to verify in the paper]
5. Hilgard, J., Engelhardt, C. R., & Rouder, J. N. (2017). Overstated evidence for short-term effects of violent games on affect and behavior: A reanalysis of Anderson et al. (2010). *Psychological Bulletin, 143*(7), 757–774. https://doi.org/10.1037/bul0000074 [citation seen; paper not read]
6. Kühn, S., Kugler, D. T., Schmalen, K., Weichenberger, M., Witt, C., & Gallinat, J. (2019). Does playing violent video games cause aggression? A longitudinal intervention study. *Molecular Psychiatry, 24*(8), 1220–1234. https://doi.org/10.1038/s41380-018-0031-7 [checked]
7. Mathiak, K., & Weber, R. (2006). Toward brain correlates of natural behavior: fMRI during violent video games. *Human Brain Mapping, 27*(12), 948–956. https://doi.org/10.1002/hbm.20234 [checked]
8. Millisecond Software. Whack-A-Mole Test (Inquisit task library). https://www.millisecond.com/library/whackamole [checked; the manual names the Yale FAB lab assays page as the original task source]
9. Przybylski, A. K., Ryan, R. M., & Rigby, C. S. (2009). The motivating role of violence in video games. *Personality and Social Psychology Bulletin, 35*(2), 243–259. https://doi.org/10.1177/0146167208327216 [checked]
10. Song, H., Shim, W. M., & Rosenberg, M. D. (2023). *eLife, 12*, e85487. [the lab's required pre-read; add the exact title from the paper]
11. Weber, R., Ritterfeld, U., & Mathiak, K. (2006). Does playing violent video games induce aggression? Empirical evidence of a functional magnetic resonance imaging study. *Media Psychology, 8*(1), 39–60. [checked]
12. gradCPT and abrupt onsets: the point in section 3.5 comes from the introduction of a bioRxiv preprint on oscillatory dynamics of sustained attention states (doi 10.1101/2024.09.25.614991), which credits the gradCPT to Rosenberg et al. (2013) and Esterman et al. (2013). [preprint, not peer reviewed; pull the original Rosenberg et al. 2013 citation before citing formally]

---

## 11. Where things stand and what is still open

*Updated September 25, 2026, in plain language. Companion documents:
[examples/](examples/) (a full example run), [process/decisions.md](process/decisions.md)
(every answer, dated), [docs/review-guide.md](docs/review-guide.md) (how to look
around this repository without reading code),
[docs/analysis-plan.md](docs/analysis-plan.md) (what we will compute).*

### 11.1 Done

- Dr. Song reviewed the v0.1 prototype and answered the questions in section 2.
- The build in `src/` follows that feedback: nine holes in a three-by-three
  grid, three buttons (one per column), a fixed one-second trial, 600 trials for
  a ten-minute run, and no on-screen feedback of any kind.
- Trials are good (80%), bad (10%), or both at once in different columns (10%),
  confirmed September 25, 2026.
- The participant display runs in its own tab, separate from the experimenter
  console, so the participant never sees settings or data.
- A ten-minute example run, played by a simulated participant through the real
  engine, is in [examples/](examples/) as all three output files.
- Phase 2: participant and run labels, optional per-run schedules, auto-save, and matched pictures.
- 131 automated tests pass (`npm test`), including both pages running together.
- Published at https://rkarnik10.github.io/Engagement-Game/ , rebuilt after every push once the tests pass. Labmates get one-click links with the settings built in ([docs/for-labmates.md](docs/for-labmates.md)).
- Feedback: a percentage score (+1 per happy mole, −3 per sad mole) with a bar that slides from dark red to green, shown by default, or a health-bar game style (100 down on mistakes, −10 for a sad mole, −3 for a miss, regenerating +5 after five correct trials in a row); and, all on by default, white and red rings, a bonk sound, and a hammer that strikes and sinks the mole. The garden scene (sky, hills, grass) is the background; plain grey stays available.
- Every press in a trial is saved with its own button and full-precision time (up to five per trial in the run table; all in the full log).

### 11.2 Still open

The open decisions (C, F, H, O, P, Q) are listed in [section 2](#2-open-decisions).

### 11.3 Next

1. Answer the open decisions in section 2, with Dr. Song (F is hers).
2. Pilot with labmates, trying the score and the health bar, and check the
   other feedback options still feel worth keeping.
3. Plan the behavioral comparison with the gradCPT tasks Dr. Song asked for
   (decision Q): the same participants, ten minutes on each, the same
   measures from both. This needs the analysis script (Phase 3) to read both
   tasks' data.
4. Look at [examples/example_run.csv](examples/) with Dr. Song and confirm the
   columns are what the analysis needs.
5. Build the analysis script (Phase 3) and run it on the example file.
6. Confirm whether this falls under an existing IRB protocol or needs an
   amendment, and who will validate timing on the scanner computer (Phase 4).

## 12. Contributors and AI disclosure

This is research software that may be used with human participants, so how it was made is recorded here.

| Contributor | Role |
|---|---|
| Rehaan Karnik (undergraduate RA, Song Lab) | Human author. Defined the task, wrote the blueprint (sections 1 to 10) and `research-notes.md` with AI assistance, directed and reviewed the AI-written work, and is responsible for this repository. |
| Claude, an AI assistant made by Anthropic (used through the Claude Code tool) | AI contributor. On September 18, 2026 (model Claude Fable 5.1, `claude-fable-5-1`), under Rehaan's instructions and following this blueprint, wrote the modular build in `src/`, the test suite in `tests/`, `package.json`, the decisions log (`process/decisions.md`, first written as `docs/decisions.md`), `docs/review-guide.md`, `docs/analysis-plan.md`, and README sections 11 and 12. On September 21, 2026 (model Claude Opus 5, `claude-opus-5`), revised `src/` and `tests/` to Dr. Song's feedback, wrote the example-run generator in `examples/`, and updated this blueprint and the decisions log. On September 25, 2026 (model Claude Opus 5.5, `claude-opus-5-5`), added the good / bad / both trial types, split the participant display into its own tab (`display.html`, `display.js`, `session.js`, `link.js`), added the no-cache local server (`scripts/serve.mjs`), fixed the sad-mole and molerat drawings, and updated the tests, example run, and documents. On September 28, 2026 (model Claude Opus 5.5), added pausing for testing, kept results, trace, and downloads on screen after a run however it ends, added an optional results panel on the display for testing (`summary.js`), and the matching tests. On October 11, 2026 (model Claude Opus 5.5), added the four feedback variants for piloting (`sound.js`, ring and hammer drawing in `board.js`), labmate links (`query.js`), the GitHub Pages workflow (`.github/workflows/pages.yml`), `docs/for-labmates.md`, and page-level tests (`tests/pages.test.js`, `tests/pages/`). On October 13, 2026 (model Claude Opus 5.5), recorded every press time, kept decimals in reaction times, and changed the score to a percentage with a 10-point penalty for hitting a distractor. On October 16, 2026 (model Claude Opus 5.5), gave each of the first five presses its own button and time columns and stopped rounding times anywhere in the data. On October 17, 2026 (model Claude Opus 5.5), lowered the default penalty to 3, moved the score to the top centre with a progress bar whose colour slides from dark red to green, made a hit mole wait for the hammer before sinking, silenced presses on empty columns, kept only the front arc of the feedback ring so it no longer crosses a raised mole, and added the garden scene. The same day it recorded ten closed decisions, turned the score on by default, and let the same hole come up on consecutive trials. It then finished Phase 2: participant and run labels, per-run schedules (`scheduleSeed`), auto-save (`downloadRun`), and matching the molerat to the moles (`docs/stimuli.md`, `scripts/measure-stimuli.py`, `tests/phase2.test.js`). On October 26, 2026 (model Claude Sonnet 5.5), added the health-bar game style (`engine.js`, `display.js`, `tests/health.test.js`), replaced the hit sound with a bonk timed to the hammer (`render/sound.js`, `tests/sound.test.js`), added the hammer's impact burst and harder squash, applied the sad-mole reaction-time summary supplied by Rehaan (`summary.js`, `tests/commission-rt.test.js`), and commented `render/trace.js` step by step. Later the same day it applied the both-trial rule that a sad-mole hit overrides the happy mole (`engine.js`, `tests/both-trial-scoring.test.js`) and redesigned the score and health bar layout. Also checked that the exported files load in pandas. |

**What the AI did not do.** It did not run the game in a real browser (the pages were exercised under a simulated page in Node, and the drawings were checked as rendered images), did not validate timing on any hardware, and its work has not yet been checked by a second person. The example run in [examples/](examples/) was played by a simulated participant, not a person. No part of this repository has been used with participants, and no human data exists.

**Commit history.** Commits `640cd1b` and `464ba6a` were generated by Claude in Claude Code and committed under Rehaan Karnik's git identity without a co-author line. From the commit that adds this section onward, commits containing AI-written changes carry a `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.

**Responsibility.** AI tools cannot take responsibility for research outputs, so this is a disclosure of how the work was produced rather than a claim of authorship in the academic sense. The human authors are responsible for reviewing, validating, and approving everything here before it is used with participants, and for disclosing AI use in any publication, protocol, or IRB submission according to that venue's policy.

Suggested one-sentence disclosure for a methods section or IRB document: "The task software and its documentation were written with the assistance of Claude (Anthropic; models Claude Fable 5.1, Claude Opus 5, and Claude Opus 5.5, via Claude Code) under the direction of the authors, who reviewed and validated all outputs."
