# Engagement Game: a whac-a-mole attention task for fMRI

**Status:** Blueprint v0.1, drafted September 18, 2026 for discussion in the Song Lab. Nothing here has been reviewed by Dr. Song yet.
Every value marked *(placeholder)* is a starting guess to be confirmed, not a decision.

**Author:** Rehaan Karnik (undergraduate RA). Drafted with AI assistance; references were pulled from search and are listed in section 10 with notes on what was and was not verified.

**Build status (September 18, 2026):** Phases 0 and 1 of section 7 are done. The modular build in `src/` reproduces the prototype exactly and has automated tests (`npm test`). **Section 11** lists next steps and what we need from Dr. Song, in plain language.

**Companion documents:** [research-notes.md](research-notes.md) (the reading behind sections 8 and 10), [docs/review-guide.md](docs/review-guide.md) (how to look around this repository without reading code), [docs/analysis-plan.md](docs/analysis-plan.md) (what we will compute from the data), [docs/decisions.md](docs/decisions.md) (where answers to the open questions are recorded).

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

To run locally, open `index.html` in any browser. For the modular build in `src/`, run `npm run serve` from the repository folder and open http://localhost:8000/ (it needs a local server because browsers block ES modules opened straight from disk).

---

## 2. Open questions for Dr. Song (and what this blueprint assumes until answered)

| # | Question | Assumed for now | Why it matters |
|---|----------|-----------------|----------------|
| Q1 | What construct is the game meant to capture: moment-to-moment **attention fluctuations**, **engagement/motivation**, or both? | Both. RT-variability time course for attention; optional self-report probes for engagement. | Decides which measures we build and whether we need probes. |
| Q2 | What **response device** is available in the scanner, and how many buttons? | One hand, 4 buttons. | Decides hole count (4 in a row vs. a 3×3 grid). |
| Q3 | What **presentation software** does the lab use or prefer for scanning (PsychoPy, Psychtoolbox, browser)? | Browser prototype now; scanner platform decided in Phase 4. | Timing precision differs across platforms (section 4.4). |
| Q4 | **TR, run length, number of runs, trigger key**, and any dummy scans? | TR 1.0 s *(placeholder)*, trigger key `t` in development. | Needed to align events to volumes. |
| Q5 | **Continuous** play or **blocks** with rest/fixation? | Continuous with jittered gaps. | Changes schedule generation and analysis. |
| Q6 | Should the player see a **score** or feedback? | Configurable; on for piloting. | Score is a reward signal and could add its own brain response. |
| Q7 | **Adaptive difficulty** (speed up when the player does well)? | Off (fixed difficulty). | Adaptive keeps engagement up but makes runs less comparable. |
| Q8 | **Mole art vs. neutral art** (see section 8)? | Build both; same schedule under each. | Content confound question. |
| Q9 | **Participant population** (adults, adolescents, children, clinical)? | Healthy adults. | Affects the violence question, instructions, and IRB. |
| Q10 | Is **eye tracking** available, and what is the display's visual angle? | Unknown. | Targets spread across the screen cause eye movements, which also show up in fMRI. |
| Q11 | When a no-go target is up and the player presses a **different** hole's key, is that a commission error or a wrong-hole error? | Logged as `wrong_hole` (not a commission). | Changes the commission-error rate. |

Answers should be recorded in `docs/decisions.md` with the date.

---

## 3. Task design

### 3.1 Core loop

1. The scanner trigger (or `t` during development) sets **t = 0**. All timestamps are milliseconds from this moment.
2. Targets appear one at a time, at pre-scheduled times, in one of N holes.
3. **Go target** (mole, or a round light in the neutral look): press that hole's key before it goes back down.
4. **No-go target** (eggplant, or a diamond in the neutral look): do not press.
5. The schedule **never depends on the participant's responses**. A hit makes the target drop early, but the next target still appears at its scheduled time. This means the timing design (and therefore the fMRI design matrix) is fixed before the run starts.

### 3.2 Why go/no-go

- **Whack-a-mole already exists as a research task.** A game-like whack-a-mole go/no-go task, originally distributed by Yale's FAB lab and described as a version of the Casey et al. (1997) go/no-go paradigm, has been used to measure response inhibition in children; it deliberately varies how many go trials come before each no-go trial, because longer go streaks make the no-go harder to withhold (Millisecond task library documentation; see section 10). So this project adapts an established paradigm rather than inventing one.
- A mostly-go stream builds a habitual "press" response. No-go trials then show whether attention is on the task (commission errors), and reaction-time variability across go trials gives a continuous attention time course (Esterman et al., 2013). This is the same logic as the gradCPT, so results can be compared with the lab's existing work.
- We log `preceding_go` (the number of go trials before each no-go) so the Casey-style manipulation is available in analysis even though v0.1 does not control it directly.

### 3.3 Response classification

| Situation | Outcome code | Meaning |
|-----------|--------------|---------|
| Go target up, matching key pressed | `hit` | Correct; reaction time (RT) recorded |
| Go target goes down, no matching press | `omission` | Miss; likely attention lapse |
| No-go target up, matching key pressed | `commission` | False press; inhibition failure |
| No-go target goes down, no press | `correct_rejection` | Correct skip |
| Target up, key for a *different* hole pressed | `wrong_hole` | Error; trial continues (see Q11) |
| No target up, any mapped key pressed | `no_target_press` | Anticipatory or stray press |
| Run ends while a target is up | `truncated` | Excluded from measures |

`e.repeat` key events (holding a key down) are ignored.

### 3.4 Timing parameters (all placeholders)

| Parameter | Default | Notes |
|-----------|---------|-------|
| Holes | 4 in a row | One per finger on a 4-button box (Q2). 9-hole grid kept for desktop piloting only. |
| Go proportion | 80% | Exact proportion per run, shuffled. The gradCPT uses a higher go share (roughly 90%; verify). |
| Constraints | First 3 trials go; no two no-go in a row; same hole never twice in a row | Placeholder rules; confirm with PI. |
| Target up time | 900 ms | How long a target stays up if not hit. |
| Gap between targets | uniform 500 to 1200 ms | Jittered so the fMRI response to each event can be separated. |
| First target | 2000 ms after trigger | Placeholder; depends on dummy scans (Q4). |
| Run length | 60 s in demo | Real runs likely several minutes (Q4). |
| Gradual rise/sink | 350 ms each way | Only when `onset: "gradual"` (section 3.5). |

### 3.5 How targets appear: pop-up vs. gradual rise

A classic whack-a-mole target **pops up abruptly**. Abrupt visual onsets grab attention automatically, which helps the participant stay on task without effort. The gradCPT removes abrupt onsets (images fade gradually from one to the next) specifically so that the task is sensitive to lapses (see section 10, gradCPT notes).

Implication: a pop-up whack-a-mole might be *less* sensitive to attention lapses than the lab's existing task. v0.1 supports both as a config option (`onset: "instant" | "gradual"`). Which one to use is a question for Dr. Song, and it could also be tested in piloting.

### 3.6 Looks ("skins")

A skin changes **only the drawings**. Schedule, positions, sizes, timing, keys, and scoring are identical across skins, so the same seed produces the same run under either look.

| Skin | Go target | No-go target |
|------|-----------|--------------|
| `mole` | Mole | Eggplant (from the original research task's variant) |
| `neutral` | Round light | Diamond |

Requirements for the real build (not done in the demo):

- Match the go and no-go drawings across skins for **size and average brightness (luminance)**, so any brain difference between skins comes from meaning, not from low-level visual properties.
- Distinguish go from no-go by **shape**, not color alone, so color-blind participants can play.
- Keep the "violence dial" at its lowest setting: no hammer, no impact animation, no sound. Adding those would be a separate, deliberate decision (section 8).

---

## 4. fMRI integration

### 4.1 Clock and trigger

- t = 0 is the first scanner trigger. In development, the `t` key simulates it.
- Every later trigger pulse is logged as a `volume` event, so the log can be checked for clock drift against the scanner.
- In the browser, timestamps come from `performance.now()` (milliseconds, high resolution). Browsers intentionally reduce this timer's precision for security reasons, and the amount varies by browser, so it must be checked on the actual machine.
- Target onsets are **frame-locked**: the logged onset is the animation frame on which the target was first drawn (`requestAnimationFrame`). The delay between that and light actually leaving the projector is not measured by software (section 4.4).

### 4.2 Response device

- The key-to-hole mapping lives in config, not in code.
- Many MR-compatible button boxes present themselves to the computer as a keyboard, but which keys they send depends on the site's hardware. **Confirm the key codes at the scanner we will use.**
- Known gotcha: some trigger boxes send the key `5`. That collides with the 9-hole number-pad layout, which is one more reason to default to 4 holes.

### 4.3 Display

- Background is a fixed mid-grey in every theme. Large brightness changes on screen produce responses in visual cortex that we don't want mixed into the attention signal.
- Confirm projector resolution, refresh rate, and visual angle (Q10) before finalizing hole spacing.

### 4.4 Timing precision

Bridges et al. (2020) compared many experiment packages. Lab-based tools (PsychoPy, Psychtoolbox, Presentation, E-Prime) reached sub-millisecond precision in their tests; browser-based studies were more variable, though often still good, with performance depending on the browser and operating system combination. The authors stress that each lab should validate timing on its own setup.

Implication for us: the browser prototype is fine for design discussion and behavioral piloting. Before scanning, either port the game to the lab's standard presentation software or validate the browser build with hardware (for example a photodiode on the screen and the real button box). This decision is Phase 4.

### 4.5 Output files

Each run writes two files:

1. **Events table (TSV), BIDS-style.** One row per shown trial, with `onset` and `duration` in seconds from the trigger. Columns: `onset, duration, trial_type, hole, key, outcome, response_time, scheduled_onset, preceding_go`. Missing values are `n/a`. *(Column names beyond `onset`/`duration` should be checked against the current BIDS specification before we rely on them.)*
2. **Full log (JSON).** Metadata (task version, config, user agent, frame-interval statistics), the trial table, and every raw event including trigger pulses, wrong-hole presses, and stray presses.

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
├── package.json            # {"type": "module"}, test script only, no dependencies
├── src/
│   ├── index.html          # page shell; loads main.js as an ES module
│   ├── styles.css
│   ├── main.js             # wires config, engine, input, renderer, export
│   ├── config.js           # defaults, validation, presets ("desktop-pilot", "scanner")
│   ├── rng.js              # seeded PRNG (mulberry32)
│   ├── schedule.js         # PURE: (config) -> trial list. No DOM.
│   ├── classify.js         # PURE: (active trial, pressed hole) -> outcome. No DOM.
│   ├── engine.js           # run state machine + requestAnimationFrame loop
│   ├── input.js            # keyboard/pointer -> hole index; trigger detection
│   ├── logger.js           # append-only event log
│   ├── export.js           # events TSV + full JSON; download via Blob
│   └── render/
│       ├── board.js        # hole layout shared by all skins
│       ├── trace.js        # attention-trace chart, experimenter view only
│       ├── skin-mole.js
│       └── skin-neutral.js
├── tests/
│   ├── schedule.test.js
│   ├── classify.test.js
│   ├── engine.test.js
│   ├── export.test.js
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
  "version": "0.1",
  "skin": "mole",
  "layout": "row4",
  "keys": ["1", "2", "3", "4"],
  "triggerKey": "t",
  "onset": "instant",
  "rampMs": 350,
  "goProb": 0.8,
  "holdMs": 900,
  "isiMinMs": 500,
  "isiMaxMs": 1200,
  "firstOnsetMs": 2000,
  "durationS": 60,
  "trS": 1.0,
  "showScore": true,
  "seed": 1234
}
```

### 6.2 Trial record

| Field | Type | Notes |
|-------|------|-------|
| `trial` | int | 1-based |
| `type` | `"go"` or `"nogo"` | |
| `hole` | int | 1-based, reading order (left to right, top to bottom) |
| `scheduled_onset_ms` | number | From the schedule |
| `actual_onset_ms` | number | Frame on which it was first drawn |
| `offset_ms` | number | When it went down (hit, timeout, or run end) |
| `outcome` | string | Codes in section 3.3 |
| `rt_ms` | number or null | Only for `hit` and `commission` |
| `preceding_go` | int or null | Only for no-go trials |
| `input` | string or null | For example `"key 3"` or `"pointer"` |

### 6.3 Event record

Every event has `t_ms` (from trigger) and `event` (one of `trigger`, `volume`, `target_on`, the outcome codes, `run_end`), plus relevant fields such as `trial`, `hole`, `target_hole`, `rt_ms`, `lag_ms`, `source`.

---

## 7. Implementation phases

### Phase 0: Scaffolding
- Folder structure from section 6, `package.json` with `"type": "module"` and a `test` script, `docs/decisions.md` with the open-question table.
- **Done when:** `npm test` runs (even with zero tests) and `src/index.html` loads from a local server (for example `python3 -m http.server` run from `src/`).

### Phase 1: Desktop prototype (match the demo)
- Seeded schedule, engine loop, keyboard and pointer input, mole skin, logging, both exports as downloads.
- **Done when:**
  - Same seed produces an identical schedule (test).
  - Go/no-go counts are exact for the configured proportion, first 3 trials are go, no consecutive no-go, no repeated hole (tests, over many seeds).
  - Every row of the classification table in section 3.3 has a test.
  - Target windows never overlap.
  - The TSV loads cleanly in pandas and the JSON parses.
  - Frame statistics are recorded in the JSON metadata.

### Phase 2: Neutral skin and presets
- `skin-neutral.js`, luminance-matching notes, config presets, optional between-run engagement probe screen (only if Q1 says so).
- **Done when:** switching skin with the same seed yields byte-identical schedules and TSV timing columns.

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

## 11. Next steps and what we need from Dr. Song

*Written September 18, 2026, in plain language. Companion documents: [docs/review-guide.md](docs/review-guide.md) (how to look around this repository without reading code), [docs/analysis-plan.md](docs/analysis-plan.md) (what we will compute from the data), [research-notes.md](research-notes.md) (the reading behind sections 8 and 10).*

### 11.1 Where things stand

- This blueprint is drafted but not yet reviewed.
- The prototype (`index.html`) works in any browser.
- The modular build (`src/`) reproduces the prototype exactly, is split into small files, and has 55 automated checks. Phases 0 and 1 of section 7 are done.
- Nothing has been decided. Every number is a placeholder until Dr. Song weighs in.
- Rehaan expects real runs of about 10 to 15 minutes. The game handles that; the one change needed is raising the run-length limit in the settings panel, which currently stops at 10 minutes.

### 11.2 Step 1: try the game (about 10 minutes)

1. Open the live page, or download the repository and double-click `index.html`. Press **T** to start. The T key stands in for the scanner's start pulse.
2. Play the 60-second run. Press the key under each mole (keys 1 to 4). Do not press for eggplants.
3. In the settings panel, switch "How targets appear" to "Rise and sink gradually" and play again. This is the version closer to the lab's gradCPT, where nothing pops up suddenly.
4. Scroll down. The attention trace is a first look at reaction-time steadiness over the run. The two downloads (events table, full log) are the files the analysis would use.

What we want to know: does this feel like the right task, and are these the outputs you would want to work with?

### 11.3 Step 2: decide the open questions

Each row below is a row of section 2 and of `docs/decisions.md`. A one-line answer per row is enough.

| # | Question, in plain terms | What the code assumes today |
|---|---|---|
| Q1 | What are we trying to measure: how attention drifts moment to moment, how engaged the person feels, or both? | Both. Steadiness of reaction times for attention; optional "how focused were you?" questions for engagement. |
| Q2 | What button box does the scanner have, and how many buttons? | One hand, four buttons, keys 1 to 4. |
| Q3 | Which software should the scanner version run on? | Browser for now; decide before scanning (Phase 4). |
| Q4 | Scan settings: TR (how often the scanner takes one brain picture), run length, number of runs, the key the scanner sends at each picture, and how many throwaway pictures at the start. | TR 1 s, 60 s demo runs, key `t`, first target 2 s after the start. |
| Q5 | One continuous run, or blocks with rest in between? | Continuous, with random gaps between targets. |
| Q6 | Should the player see a score? | Yes, for piloting. A score is a reward and may add its own brain response. |
| Q7 | Should the game speed up when someone does well? | No. Fixed speed keeps runs comparable. |
| Q8 | Moles and eggplants, or neutral shapes? | Build both; moles first. |
| Q9 | Who are the participants? | Healthy adults. |
| Q10 | Is eye tracking available, and how big is the screen at the viewing distance? | Unknown. |
| Q11 | If an eggplant is up and the player presses the key for a *different* hole, is that a false press or just a wrong-hole press? | Wrong-hole; the target stays up. |

### 11.4 Step 3: check the design details

1. The outcome table in section 3.3: do the seven outcomes and their names match how you want targets scored?
2. The timing values in section 3.4: 80% moles, each target up for 0.9 s, gaps of 0.5 to 1.2 s, first three targets always moles, never two eggplants in a row, never the same hole twice in a row.
3. The events file columns in section 4.5: are these the columns your fMRI pipeline expects, and are the names right for BIDS?
4. The measures in section 5, especially how the attention trace is computed. The details to confirm are listed in section 10 of `docs/analysis-plan.md`.
5. Pop-up or gradual rise (section 3.5): which one, or pilot both?

### 11.5 Lab logistics

- Does this fall under an existing IRB protocol, or does it need an amendment?
- Who will validate timing on the scanner computer (Phase 4), and which display and button box will be used?
- Is a public GitHub repository acceptable for this project?

### 11.6 After the answers

Answers go in `docs/decisions.md` with the date. Then, in order: the neutral look (Phase 2), the analysis script (Phase 3), participant and run numbering in the data files, a full-screen participant view, automatic saving at the end of a run, and the scanner-readiness work (Phase 4).
