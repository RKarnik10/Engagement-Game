# How to review this project without reading code

*For Dr. Song, and for anyone looking at this repository for the first time. Written September 18, 2026 by Rehaan Karnik with AI assistance; updated September 21 and 25, 2026 to match her feedback. Plain language on purpose; the technical detail is in the [README](../README.md).*

## What this is, in one paragraph

A short game for the MRI scanner. Moles pop up from nine holes arranged in a three-by-three grid, one trial every second for ten minutes. The participant has three buttons, one per column. Most trials (80%) show one happy mole: they press the button for the column it is in, and the row does not matter. Some (10%) show one sad mole: they do nothing. The rest (10%) show a happy mole and a sad mole at the same time, in different columns: they press only for the happy one. Every appearance and every button press is time-stamped from the scanner's start signal. From those time stamps we can compute how attention rises and falls during the scan and line that up with the brain data. The aim is the engagement of a game with the measurement quality of a standard attention task.

One thing to expect: **the screen never reacts to a button press.** There is no score, no flash, and no confirmation. That is deliberate, decided on September 21, 2026. It may feel frustrating to play; that is worth noticing during piloting.

## Try it

**Quickest:** open https://rkarnik10.github.io/Engagement-Game/ (once publishing is switched on). Nothing to install. For a single-screen version, see [for-labmates.md](for-labmates.md).

**On your own computer:**

The current build lives in the `src/` folder and uses two browser tabs: one
for the experimenter, one for the participant.

1. From the repository folder, run `npm run serve` in a terminal. Browsers block
   this build when it is opened by double-click, so it needs this small local
   server.
2. Open http://localhost:8000/ . This is the **experimenter console**.
3. Click **Open participant display**. A second tab opens. Drag it out into its
   own window and put it on the participant's screen. Press **F** in it for
   full screen. It must stay visible during a run; browsers pause hidden tabs.
4. Start the run from the console, or press **T** in the display (T stands in
   for the scanner's start pulse).
5. In the display, press **1**, **2**, or **3** for the *column* a happy mole
   comes out of. Do nothing for a sad mole. When both appear, press only for the
   happy one. **Esc** ends the run early.
6. Watch the console: it mirrors the display and updates the measures.
7. To pause, click **Pause** in the console or press **P** in the display; the
   same again resumes. To stop early, click **End run** or press **Esc** in the
   display (twice in full screen: the first Esc only leaves full screen).
   Pausing is for testing only: a scanner cannot pause.
8. However the run ends, the console keeps its results, the reaction-time
   trace, and the three download buttons until the next run starts. Files go
   to your usual downloads folder. For testing on one screen, tick **Testing:
   also show results and downloads on the participant display** in the console
   settings, and the display shows them too after each run. Leave it off with
   real participants, who should see nothing (Q6).

The run defaults to 600 trials, ten minutes. Lower "Number of trials" in the
console to try a short one.

**If something looks wrong:**

- *A red box says the code has not loaded, or the page looks like an older
  version, or the button does nothing.* The browser is using old copies of the
  files. Press **Cmd+Shift+R** (Windows: Ctrl+Shift+R) in that tab, or open
  the page in a private window.
- *The terminal says port 8000 is already in use.* An earlier server is still
  running. Press Ctrl+C in its terminal and run `npm run serve` again.
- *No new tab opens.* Open one yourself and go to
  http://localhost:8000/display.html . The two tabs find each other on their
  own.

The live page at https://rkarnik10.github.io/Engagement-Game/ (if GitHub Pages
is switched on) is still the older four-hole prototype from September 18.

## What is on the two pages

**Participant display** (`display.html`): only the grey field and the moles.
It stays the same grey in light and dark mode because changes in screen
brightness show up in the visual parts of the brain. Before the run it shows
the instructions; after it, a thank-you. It never shows a score or a summary.

**Experimenter console** (`index.html`):

- **Run settings.** Where the run happens, the trial mix, the bad mole's picture, timing, and the seed.
- **What the participant sees.** A small mirror of the display.
- **Live measures.** Counts and averages that update during the run, including a warning if the display tab was hidden.
- **Attention trace.** A first version of the reaction-time steadiness curve described in the [analysis plan](analysis-plan.md).
- **Event log.** Everything that happened, newest first.
- **Run data.** The three files, with download buttons.

## A map of the repository

| Where | What it is | Worth opening? |
|---|---|---|
| `README.md` | The blueprint: design, open questions, plan, references. | Yes, start here. Section 11 lists what we need from you. |
| `research-notes.md` | Summaries of the papers behind the design, with links. | Yes, if you want the evidence. |
| `docs/decisions.md` | Every answer so far, dated, a checklist against the September 21 feedback, and the points still open. | Yes. |
| `docs/analysis-plan.md` | What we will compute from the data, in plain language. | Yes. |
| `index.html` | The original September 18 prototype, four holes. Kept as the published demo. | Only for reference. |
| `examples/` | A complete ten-minute example run, with notes on what to look for. | **Yes, start with `example_run.csv`.** |
| `src/` | The same game split into small files so each part can be tested. | See the list below. |
| `tests/` | Automated checks of the rules. | No, but see "What the tests prove". |
| `analysis/` | Empty until Phase 3, the analysis script. | Not yet. |

Inside `src/`, in case you want to look at one thing:

| File | One-line description |
|---|---|
| `config.js` | Every setting with its placeholder value and a `TODO(Qn)` tag pointing at the open question. One screen long. The most useful file to read. |
| `schedule.js` | Builds the list of targets for a run from the settings and a seed number. It never looks at what the player does, so the timing is fixed before the run starts. |
| `classify.js` | The seven outcomes (hit, miss, false press, and so on) and the rule for each. |
| `engine.js` | Runs the clock, shows targets on time, and records what happens. |
| `input.js` | Turns key presses and screen taps into hole numbers. |
| `logger.js`, `export.js` | The event log and the two output files. |
| `render/` | Drawing only: the holes, the three mole drawings, the trace chart. Swapping the art does not touch the rest. |
| `main.js`, `index.html`, `styles.css` | The web page that connects the pieces. |

## The three data files

A complete example of all three, from a ten-minute run, is in the `examples/`
folder. No person took part: a simulated participant played the real game.

**Run table** (`..._run.csv`). The one to open first. Files save themselves to the downloads folder when a run ends; with a participant ID, their names start like `sub-07_task-whacamole_run-02_`. One row per trial,
opens in Excel.

| Column | Meaning |
|---|---|
| `participant`, `run` | Who played and which of their runs this was, as typed in the console. `n/a` when left blank. |
| `trial` | 1 to 600, in order. |
| `onset_s` | When the moles appeared, in seconds from the start pulse. |
| `trial_type` | `good` (one happy mole), `bad` (one sad mole), or `both`. |
| `good_row`, `good_col` | Where the happy mole appeared, 1 to 3 each. `n/a` on a bad trial. |
| `bad_row`, `bad_col` | Where the sad mole appeared. `n/a` on a good trial. |
| `correct_action` | `press` or `withhold`. |
| `expected_button` | The button that should have been pressed: the happy mole's column. `n/a` on a bad trial. |
| `n_presses` | How many buttons were pressed while the moles were up. |
| `press_1_button`, `press_1_ms` … `press_5_button`, `press_5_ms` | Each press in order: which button, and how many milliseconds after the moles appeared. Up to five; empty (`n/a`) where there was no such press. The full log keeps any beyond five. |
| `first_press_ms` | Milliseconds from the moles appearing to the first press. |
| `good_hit_ms` | Milliseconds to the press that hit the happy mole. This is the reaction time the attention analysis uses. |
| `good_outcome` | `hit` or `omission` (missed the happy mole). |
| `bad_outcome` | `commission` (pressed the sad mole) or `correct_rejection` (left it alone). |
| `outcome` | One word for the whole trial. On a both trial, pressing the sad mole makes it `commission` even if the happy one was hit too. |
| `correct` | 1 or 0. `n/a` for a trial cut off by the end of the run. |
| `score_points`, `score_pct` | The running score after this trial: points (+1 per happy mole hit, −3 per sad mole hit), and points as a percentage of the happy moles so far. Recorded even when the score isn't shown. |
| `scheduled_onset_s` | When it was planned to appear. |
| `onset_lag_ms` | How late it actually was. Should be under about 17 ms. |
| `preceding_go` | On trials with a sad mole: how many trials in a row needed a press before it. |

Five example rows from the example run (some columns left out). Times are saved exactly as measured, so they have many digits; numbers like `382.999999999367` are how computers store decimals, and equal 383 for every practical purpose:

```
trial,trial_type,expected_button,n_presses,press_1_button,press_1_ms,press_2_button,press_2_ms,good_hit_ms,outcome,score_pct
1,good,3,1,3,291.9999999999966,n/a,n/a,291.9999999999966,hit,100.0
34,good,2,2,1,382.999999999367,2,552.999999999367,552.999999999367,hit,90.6
14,bad,n/a,0,n/a,n/a,n/a,n/a,n/a,correct_rejection,100.0
19,both,1,1,1,350.99999999997453,n/a,n/a,350.99999999997453,hit,100.0
124,both,2,1,1,535.9999999865104,n/a,n/a,n/a,commission,79.6
```

**Events table** (`..._events.tsv`). The same trials in the BIDS layout for
fMRI, with `onset` and `duration` in seconds from the start pulse.

**Full log** (`..._log.json`). Everything, in three parts: `meta` (the settings
used, whether the run was in the scanner, the browser, and display-timing
health), `trials` (the same table in milliseconds), and `events` (every single
thing that happened, including each simulated scanner pulse, wrong-column
presses, and presses when nothing was up).

## What the tests prove

Running `npm test` in the repository folder runs 55 automatic checks in under a second. In plain terms, they confirm that:

- the same seed number always gives the identical target list, so a run can be reproduced exactly;
- the mix is exactly 80% good, 10% bad, and 10% both, the first three trials are good, no two bad trials come in a row, no hole is reused from one trial to the next, and the two moles of a both trial are always in different columns, checked across more than a thousand seeds;
- targets never overlap in time;
- each of the seven outcomes is produced in exactly the situation the README describes;
- the engine shows targets on time, takes them down on time, and records display timing;
- a press counts as correct for any row in the right column, and as a wrong-column press otherwise, including every combination of presses on a both trial;
- the console and the display, in separate tabs, pass settings, the live events, and the finished run between them, and a reloaded console gets the last run back;
- all three output files have the expected shape and can be read by standard tools.

The tests do not check what the screen looks like, and they cannot check the real timing of a specific computer and projector. That is the hardware check in Phase 4.

## How to give feedback

- Quick answers to the section 11 questions: an email or a message to Rehaan is enough. He will record them in `docs/decisions.md` with the date.
- Comments on specific points: GitHub **Issues** on the repository, one per point, or comments in a shared copy of the README.
- To ask for a change: describe it in plain terms. There is no need to edit code.

## Glossary in plain language

- **Go/no-go task.** Respond to most things (go), hold back for a few (no-go). Here: happy moles are go; sad moles are no-go.
- **Both trial.** A happy and a sad mole at the same time. Tests whether the participant can pick the right one, not just hold back.
- **Hit, omission, commission, correct rejection.** Pressed for a happy mole; missed a happy mole; pressed a sad mole; correctly left a sad mole alone.
- **Reaction time (RT).** Time from a happy mole appearing to the press.
- **Trigger, or start pulse.** The signal the scanner sends when it starts. Time zero for everything.
- **TR and volume.** The scanner takes one whole-brain picture (a volume) every TR, for example every second. Lining up behavior with the brain means lining it up with these pictures.
- **BIDS.** A shared convention for organising brain-imaging data. Following it means the events table drops into standard tools.
- **Seed.** A number that fixes the random choices in a run. Same seed, same run, every time.
- **Frame.** One screen refresh, usually 60 per second. Targets appear on a frame, so onset times are accurate to about a sixtieth of a second.
- **Hold time and trial rate.** How long a mole stays up (0.8 s for now) and how often a trial starts (every 1 s exactly).
- **Skin.** The look of the targets. Changing the skin changes only the drawings, never the timing or the schedule.
- **gradCPT.** The lab's existing attention task, where pictures fade gradually into one another instead of popping up.
- **Variance time course (VTC).** The attention curve: how erratic reaction times are over the run. Explained in the analysis plan.
- **d′ (d-prime).** One number for how well someone told happy moles from sad ones, combining hits and false presses. Explained in the analysis plan.
