# Engagement Game: a whac-a-mole attention task for fMRI

**Status:** Blueprint v0.3. Drafted September 18, 2026; revised September 21 after Dr. Song's first round of feedback, and September 25 when the trial mix was clarified.
The open questions in section 2 now carry her answers. Values still marked *(placeholder)* are starting guesses, not decisions.

**Author:** Rehaan Karnik (undergraduate RA). Drafted with AI assistance; references were pulled from search and are listed in section 10 with notes on what was and was not verified.

**Build status (September 25, 2026):** Phases 0 and 1 of section 7 are done, and `src/` follows Dr. Song's feedback: nine holes in a three-by-three grid, three buttons (one per column), a fixed one-second trial, 600 trials for a ten-minute run, and no on-screen feedback. Each trial shows a good (happy) mole to press, a bad mole to leave alone, or both at once in different columns, at 80 / 10 / 10. The participant display runs in its own browser tab, separate from the experimenter console. 84 automated tests (`npm test`). A complete example run is in [examples/](examples/). **Section 11** lists what is still open.

**Contributors and AI disclosure:** see [section 12](#12-contributors-and-ai-disclosure). Code and documentation in this repository were written by an AI assistant under the author's direction, as recorded there.

**Companion documents:** [examples/](examples/) (a full 600-trial example run and what to look for in it), [research-notes.md](research-notes.md) (the reading behind sections 8 and 10), [docs/review-guide.md](docs/review-guide.md) (how to look around this repository without reading code), [docs/analysis-plan.md](docs/analysis-plan.md) (what we will compute from the data), [docs/decisions.md](docs/decisions.md) (where answers to the open questions are recorded).

---

## 1. What this is

A short, game-like **go/no-go task**. Targets pop up from holes one at a time; the participant presses the matching button for "go" targets and holds back on "no-go" targets.

The goal is a task that sits between a classic sustained-attention task (such as the gradCPT used in Song, Shim & Rosenberg, 2023) and fully naturalistic stimuli like movies. It should feel more like a game than a CPT, but every stimulus and every response is still time-stamped, so behavioral attention measures can be lined up with the fMRI time series.

The game records:

- when each target was **scheduled** to appear and when it **actually** appeared (frame-locked),
- which button was pressed and when,
- how each trial ended (hit, miss, false press, correct skip, and so on).

Attention and engagement measures are computed from those logs offline (section 5).

**Live prototype:** https://rkarnik10.github.io/Engagement-Game/ (served by GitHub Pages from `index.html` at the repo root).

`index.html` is the v0.1 prototype: one self-contained HTML file with no dependencies. It implements sections 3 and 4.5 of this document with placeholder parameters. The modular build described in sections 6 and 7 will live in `src/` and should not replace `index.html` until it matches the prototype's behavior.

To run locally, open `index.html` in any browser. For the current build in `src/`, run `npm run serve` from the repository folder, open http://localhost:8000/ (the experimenter console), and click **Open participant display**. It needs a local server because browsers block ES modules opened straight from disk. `npm run serve` starts one that tells the browser not to cache, so a reload always shows the latest code. If a page shows a red "code has not loaded" box, press Cmd+Shift+R to reload without the cache.

---

## 2. Questions for Dr. Song, and her answers

Answered September 21, 2026 unless noted. Full detail, including the points
that still need a one-line confirmation, is in [docs/decisions.md](docs/decisions.md).

| # | Question | Answer |
|---|----------|--------|
| Q1 | What construct is the game meant to capture: **attention fluctuations**, **engagement/motivation**, or both? | **Both.** |
| Q2 | What **response device** is available, and how many buttons? | **One hand, 3 buttons.** Nine holes in a 3 by 3 grid; each button is a column. |
| Q3 | What **presentation software** should the scanner version use? | **Browser is fine.** Psychtoolbox was the lab's tool but is now paywalled; PsychoPy is the fallback. |
| Q4 | **TR, run length, number of runs, trigger key**, dummy scans? | **Still to be discussed**, except run length: 600 trials, about 10 minutes. |
| Q5 | **Continuous** play or **blocks** with rest? | **Continuous.** One trial per second, no rest blocks. |
| Q6 | Should the player see a **score** or feedback? | **No.** Nothing on screen reacts to a press. |
| Q7 | **Adaptive difficulty**? | **No.** |
| Q8 | **Mole art vs. neutral art**? | **Moles.** No eggplants. A happy mole to press; a sad mole (or a molerat) to leave alone. |
| Q9 | **Participant population**? | **Adults.** |
| Q10 | Is **eye tracking** available, and what is the visual angle? | **No eye tracking.** Visual angle still unknown. |
| Q11 | A press on a **different hole** while a target is up: commission or wrong-hole? | **Wrong-hole**, and the trial continues. Now means the wrong column. |

Points from the same feedback that could be read more than one way are listed at the end of [docs/decisions.md](docs/decisions.md) with what the code does today. Further answers should be recorded there with the date.

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

In a both trial, hitting the good mole takes only that mole down; the bad one stays up until the window ends, so a later press on it still counts as a commission. *(These two rules are a reading of the design, not yet confirmed by Dr. Song; see [docs/decisions.md](docs/decisions.md).)*

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
| Bad mole picture | sad mole *(placeholder)* | A molerat is the alternative (`badStim`). |
| Target up time | 800 ms *(placeholder)* | Inside the 1000 ms cycle, leaving 200 ms empty. The split inside the cycle is not settled. |
| Constraints | First 3 trials good; no two bad trials in a row; no hole reused from one trial to the next | Placeholder rules carried over from v0.1; never confirmed. |
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

Implication: a pop-up whack-a-mole might be *less* sensitive to attention lapses than the lab's existing task. v0.1 supports both as a config option (`onset: "instant" | "gradual"`). Which one to use is a question for Dr. Song, and it could also be tested in piloting.

### 3.6 Looks ("skins")

A skin changes **only the drawings**. Schedule, positions, sizes, timing, and keys are identical across skins, so the same seed produces the same run under either look. Decided (Q8): the mole skin is the one to build. The good mole is a happy mole; the bad mole is a sad mole by default, or a molerat.

| Skin | Go target | No-go target |
|------|-----------|--------------|
| `mole` | Happy mole | Sad mole (or a molerat) |
| `neutral` | Round light | Diamond, and a second neutral shape |

Requirements for the real build (not done in the demo):

- Match the go and no-go drawings across skins for **size and average brightness (luminance)**, so any brain difference between skins comes from meaning, not from low-level visual properties.
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
- Background is a fixed mid-grey in every theme. Large brightness changes on screen produce responses in visual cortex that we don't want mixed into the attention signal.
- Confirm projector resolution, refresh rate, and visual angle (Q10) before finalizing hole spacing.

### 4.4 Timing precision

Bridges et al. (2020) compared many experiment packages. Lab-based tools (PsychoPy, Psychtoolbox, Presentation, E-Prime) reached sub-millisecond precision in their tests; browser-based studies were more variable, though often still good, with performance depending on the browser and operating system combination. The authors stress that each lab should validate timing on its own setup.

Implication for us: the browser prototype is fine for design discussion and behavioral piloting. Before scanning, either port the game to the lab's standard presentation software or validate the browser build with hardware (for example a photodiode on the screen and the real button box). This decision is Phase 4.

### 4.5 Output files

Each run writes three files. A complete example of all three is in
[examples/](examples/).

1. **Run table (CSV).** The one to open first, and the one Dr. Song asked for
   on September 21, 2026. One row per trial: `trial, onset_s, trial_type,
   good_row, good_col, bad_row, bad_col, correct_action, expected_button,
   pressed_buttons, first_press_ms, good_hit_ms, good_outcome, bad_outcome,
   outcome, correct, scheduled_onset_s, onset_lag_ms, preceding_go`. Opens in
   Excel. Missing values are `n/a`. `pressed_buttons` lists every button
   pressed while the trial's moles were up, in order, separated by spaces
   (for example `1 3`), so read it as text.
2. **Events table (TSV), BIDS-style.** The same trials with `onset` and
   `duration` in seconds from the trigger, for the fMRI design matrix.
   Columns: `onset, duration, trial_type, good_row, good_col, bad_row,
   bad_col, expected_button, pressed_buttons, outcome, response_time,
   scheduled_onset, preceding_go`. *(Column names beyond `onset`/`duration`
   should be checked against the current BIDS specification before we rely
   on them.)*
3. **Full log (JSON).** Metadata (task version, whether the run was in the
   scanner, the trial mix and pictures, config, user agent, frame-interval
   statistics), the trial table with each mole and each press, and every raw
   event including trigger pulses, wrong-column presses, stray presses, and
   any moment the participant display was hidden.

The files are built by the experimenter console when the run ends and saved
through the browser, so they land in the browser's downloads folder. File
names carry the date, time, setting, and seed, for example
`engagement-game_20260925-143012_behavioral_seed1234_run.csv`.

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
├── package.json            # {"type": "module"}, test and serve scripts, no dependencies
├── scripts/
│   └── serve.mjs           # `npm run serve`: local server for src/ that disables caching
├── src/
│   ├── index.html          # experimenter console page; loads main.js
│   ├── display.html        # participant display page; loads display.js
│   ├── styles.css
│   ├── main.js             # console: settings, mirror, live measures, exports
│   ├── display.js          # display: drawing, keys, full screen
│   ├── link.js             # console <-> display messages (BroadcastChannel)
│   ├── session.js          # runs the game inside the display tab
│   ├── summary.js          # PURE: run summary shown after a run (console and display)
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
│       └── skin-neutral.js # not built
├── tests/
│   ├── schedule.test.js
│   ├── classify.test.js
│   ├── engine.test.js
│   ├── export.test.js
│   ├── link.test.js        # console and display over a real BroadcastChannel
│   ├── pause.test.js       # pausing, ending early, and the run summary
│   ├── input.test.js
│   ├── config.test.js
│   └── _sim.js             # fake-clock helper for the engine tests
├── analysis/               # Phase 3 (Python)
│   └── compute_measures.py
└── docs/
    ├── decisions.md        # dated answers to the open questions
    ├── review-guide.md     # how to review this repository without reading code
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
- The participant display shows no results by default (Q6). For testing, the console's "Testing" option also shows the results, the reaction-time trace, and the downloads on the display after a run (`showResultsOnDisplay`).
- BroadcastChannel is supported in all current major browsers (Safari since 15.4, 2022). Full screen uses `requestFullscreen`, with the `webkit` prefix for Safari before 16.4.

---

## 7. Implementation phases

### Phase 0: Scaffolding
- Folder structure from section 6, `package.json` with `"type": "module"` and a `test` script, `docs/decisions.md` with the open-question table.
- **Done when:** `npm test` runs (even with zero tests) and `src/index.html` loads from a local server (for example `python3 -m http.server` run from `src/`).

### Phase 1: Desktop prototype (match the demo)
- Seeded schedule, engine loop, keyboard and pointer input, mole skin, logging, both exports as downloads.
- **Done (September 18, 2026), revised to Dr. Song's feedback September 21 and 25:**
  - Same seed produces an identical schedule (test).
  - The 80 / 10 / 10 good / bad / both counts are exact, the first 3 trials are good, no two bad trials in a row, no hole reused between trials, and both-trial moles are always in different columns (tests, over 1,200 seeds).
  - The console and participant display run in separate tabs and talk over a BroadcastChannel (tests over a real channel).
  - Every row of the classification table in section 3.3 has a test.
  - Target windows never overlap, at 1 s per trial.
  - The CSV and TSV load cleanly in pandas and the JSON parses.
  - Frame statistics are recorded in the JSON metadata.
  - A full 600-trial example run is in [examples/](examples/).

### Phase 2: Matched art and presets
- Match the three mole drawings for size and average brightness (section 3.6). This is required before scanning and is not done.
- Participant and run identifiers in the file names and metadata, and a per-run seed rule so every run differs but stays reproducible.
- Save the three files automatically when a run ends, so ten minutes of data never depends on a click.
- `skin-neutral.js` only if Q8 is revisited.
- **Done when:** switching skin with the same seed yields byte-identical schedules and timing columns, and a finished run writes its files without being asked.

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
[examples/](examples/) (a full example run), [docs/decisions.md](docs/decisions.md)
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
- 84 automated tests pass (`npm test`).

### 11.2 Still open

Six points need a one-line answer. The full version, with what the code does
today for each, is at the end of [docs/decisions.md](docs/decisions.md). (Decided September 25: the
button labels under each column stay.)

1. **The bad mole's picture.** A sad mole by default; a molerat is the
   alternative. The notes mention both.
2. **Both trials, after the good mole is hit.** The bad mole stays up until the
   window ends, and pressing it then still counts as a commission. The
   alternative is to take both moles down on the first press.
3. **Which inputs to record.** All three buttons are recorded; every other key
   is ignored. The note said "the 1 and 2 inputs", which may name exact codes
   the button box sends.
4. **How long a mole stays up** inside the one-second cycle. Currently 800 ms
   up, 200 ms empty.
5. **The rest of Q4:** TR, number of runs, trigger key, dummy scans.
6. **Repeats:** no hole is reused from one trial to the next, but the same
   column can be. Carried over from v0.1 and never confirmed.

### 11.3 Next

1. Look at [examples/example_run.csv](examples/) together, as Dr. Song
   suggested, and confirm the columns are what the analysis needs.
2. Try a full run with the display in its own window, to check it feels right,
   especially whether no feedback at all is too frustrating.
3. Build the analysis script (Phase 3) and run it on the example file.
4. Match the drawings for size and brightness (Phase 2).
5. Confirm whether this falls under an existing IRB protocol or needs an
   amendment, and who will validate timing on the scanner computer (Phase 4).

## 12. Contributors and AI disclosure

This is research software that may be used with human participants, so how it was made is recorded here.

| Contributor | Role |
|---|---|
| Rehaan Karnik (undergraduate RA, Song Lab) | Human author. Defined the task, wrote the blueprint (sections 1 to 10) and `research-notes.md` with AI assistance, directed and reviewed the AI-written work, and is responsible for this repository. |
| Claude, an AI assistant made by Anthropic (used through the Claude Code tool) | AI contributor. On September 18, 2026 (model Claude Fable 5.1, `claude-fable-5-1`), under Rehaan's instructions and following this blueprint, wrote the modular build in `src/`, the test suite in `tests/`, `package.json`, `docs/decisions.md`, `docs/review-guide.md`, `docs/analysis-plan.md`, and README sections 11 and 12. On September 21, 2026 (model Claude Opus 5, `claude-opus-5`), revised `src/` and `tests/` to Dr. Song's feedback, wrote the example-run generator in `examples/`, and updated this blueprint and the decisions log. On September 25, 2026 (model Claude Opus 5.5, `claude-opus-5-5`), added the good / bad / both trial types, split the participant display into its own tab (`display.html`, `display.js`, `session.js`, `link.js`), added the no-cache local server (`scripts/serve.mjs`), fixed the sad-mole and molerat drawings, and updated the tests, example run, and documents. On September 28, 2026 (model Claude Opus 5.5), added pausing for testing, kept results, trace, and downloads on screen after a run however it ends, added an optional results panel on the display for testing (`summary.js`), and the matching tests. Also checked that the exported files load in pandas. |

**What the AI did not do.** It did not run the game in a real browser (the pages were exercised under a simulated page in Node, and the drawings were checked as rendered images), did not validate timing on any hardware, and its work has not yet been checked by a second person. The example run in [examples/](examples/) was played by a simulated participant, not a person. No part of this repository has been used with participants, and no human data exists.

**Commit history.** Commits `640cd1b` and `464ba6a` were generated by Claude in Claude Code and committed under Rehaan Karnik's git identity without a co-author line. From the commit that adds this section onward, commits containing AI-written changes carry a `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.

**Responsibility.** AI tools cannot take responsibility for research outputs, so this is a disclosure of how the work was produced rather than a claim of authorship in the academic sense. The human authors are responsible for reviewing, validating, and approving everything here before it is used with participants, and for disclosing AI use in any publication, protocol, or IRB submission according to that venue's policy.

Suggested one-sentence disclosure for a methods section or IRB document: "The task software and its documentation were written with the assistance of Claude (Anthropic; models Claude Fable 5.1, Claude Opus 5, and Claude Opus 5.5, via Claude Code) under the direction of the authors, who reviewed and validated all outputs."
