# How to review this project without reading code

*For Dr. Song, and for anyone looking at this repository for the first time. Written September 18, 2026 by Rehaan Karnik with AI assistance; updated September 21, 2026 to match her feedback. Plain language on purpose; the technical detail is in the [README](../README.md).*

## What this is, in one paragraph

A short game for the MRI scanner. Moles pop up from nine holes arranged in a three-by-three grid, one at a time, one every second for ten minutes. The participant has three buttons, one per column. When a happy mole appears they press the button for the column it is in; the row does not matter. When a sad mole or a molerat appears they do nothing. Every appearance and every button press is time-stamped from the scanner's start signal. From those time stamps we can compute how attention rises and falls during the scan and line that up with the brain data. The aim is the engagement of a game with the measurement quality of a standard attention task.

One thing to expect: **the screen never reacts to a button press.** There is no score, no flash, and no confirmation. That is deliberate, decided on September 21, 2026. It may feel frustrating to play; that is worth noticing during piloting.

## Try it in two minutes

1. Open the live page: https://rkarnik10.github.io/Engagement-Game/ . If it does not load, GitHub Pages is not switched on yet. Instead, on the repository page click the green **Code** button, choose **Download ZIP**, unzip it, and double-click `index.html`.
2. Press **T**. That key stands in for the scanner's start pulse. Every time in the data is measured from this moment.
3. Press **1**, **2**, or **3** for the *column* a happy mole comes out of. Do nothing for sad moles or molerats. **Esc** ends the run early.
4. Scroll down for the attention trace, the event log, and the three data downloads.

Note that the live page at the link above is still the older four-hole version from September 18. The current design is the one in the `src/` folder, described below.

The current build lives in the `src/` folder. Browsers block it when it is opened by double-click, so it needs a small local server. From the repository folder, run `npm run serve`, then open http://localhost:8000/ . It defaults to the full 600-trial, ten-minute run; lower "Number of trials" in the settings panel to try a short one. The **Participant display** button hides the settings and fills the screen, which is what the participant would see on a second monitor.

## What is on the page

- **Grey panel.** What the participant sees. It stays the same grey in light and dark mode because changes in screen brightness show up in the visual parts of the brain.
- **Run settings.** The experimenter's controls. Every value here is a placeholder until the open questions are answered.
- **Live measures.** Counts and averages that update during the run.
- **Attention trace.** A first version of the reaction-time steadiness curve described in the [analysis plan](analysis-plan.md).
- **Event log.** Everything that happened, newest first.
- **Run data.** The two files the analysis uses, with download buttons.

## A map of the repository

| Where | What it is | Worth opening? |
|---|---|---|
| `README.md` | The blueprint: design, open questions, plan, references. | Yes, start here. Section 11 lists what we need from you. |
| `research-notes.md` | Summaries of the papers behind the design, with links. | Yes, if you want the evidence. |
| `docs/decisions.md` | The open questions with an empty Decision column. | Yes. This is where answers go, with the date. |
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

**Run table** (`..._run.csv`). The one to open first. One row per mole, opens
in Excel.

| Column | Meaning |
|---|---|
| `trial` | 1 to 600, in order. |
| `onset_s` | When the mole appeared, in seconds from the start pulse. |
| `stimulus` | `happy mole`, `sad mole`, or `molerat`. |
| `trial_type` | `go` (press) or `nogo` (do nothing). |
| `mole_row`, `mole_col` | Where it appeared in the grid, 1 to 3 each. |
| `hole` | The same position as one number, 1 to 9, reading order. |
| `expected_button` | The button that should have been pressed. Always equals `mole_col`. |
| `pressed_button` | The button actually pressed, or `n/a` if none. |
| `response_time_ms` | Milliseconds from the mole appearing to the press. `n/a` if none. |
| `outcome` | `hit`, `omission` (missed a happy mole), `commission` (pressed on a skip trial), `correct_rejection` (correctly did nothing), or `truncated` (the run ended while it was up). |
| `correct` | 1 or 0. `n/a` for a truncated trial. |
| `scheduled_onset_s` | When it was planned to appear. |
| `onset_lag_ms` | How late it actually was. Should be under about 17 ms. |
| `preceding_go` | For skip trials only: how many happy moles came before it since the last skip trial. |

Three example rows:

```
trial,onset_s,stimulus,trial_type,mole_row,mole_col,hole,expected_button,pressed_button,response_time_ms,outcome,correct
1,2.000,happy mole,go,1,1,1,1,1,507,hit,1
11,12.017,happy mole,go,3,3,9,3,,,omission,0
549,550.000,molerat,nogo,2,3,6,3,3,36,commission,0
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
- the mix is exactly 80% happy moles, 10% sad moles, and 10% molerats, the first three targets are happy moles, no two skip trials come in a row, and the same hole is never used twice in a row, checked across more than a thousand seeds;
- targets never overlap in time;
- each of the seven outcomes is produced in exactly the situation the README describes;
- the engine shows targets on time, takes them down on time, and records display timing;
- a press counts as correct for any row in the right column, and as a wrong-column press otherwise;
- all three output files have the expected shape and can be read by standard tools.

The tests do not check what the screen looks like, and they cannot check the real timing of a specific computer and projector. That is the hardware check in Phase 4.

## How to give feedback

- Quick answers to the section 11 questions: an email or a message to Rehaan is enough. He will record them in `docs/decisions.md` with the date.
- Comments on specific points: GitHub **Issues** on the repository, one per point, or comments in a shared copy of the README.
- To ask for a change: describe it in plain terms. There is no need to edit code.

## Glossary in plain language

- **Go/no-go task.** Respond to most things (go), hold back for a few (no-go). Here: happy moles are go; sad moles and molerats are no-go.
- **Hit, omission, commission, correct rejection.** Pressed for a happy mole; missed a happy mole; pressed on a skip trial; correctly did nothing on a skip trial.
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
- **d′ (d-prime).** One number for how well someone told happy moles from the ones to skip, combining hits and false presses. Explained in the analysis plan.
