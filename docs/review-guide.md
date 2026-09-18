# How to review this project without reading code

*For Dr. Song, and for anyone looking at this repository for the first time. Written September 18, 2026 by Rehaan Karnik with AI assistance. Plain language on purpose; the technical detail is in the [README](../README.md).*

## What this is, in one paragraph

A short game for the MRI scanner. Moles pop up from holes, one at a time. The participant presses the button for each mole and holds back when an eggplant appears instead. Every appearance and every button press is time-stamped from the scanner's start signal. From those time stamps we can compute how attention rises and falls during the scan and line that up with the brain data. The aim is the engagement of a game with the measurement quality of a standard attention task.

## Try it in two minutes

1. Open the live page: https://rkarnik10.github.io/Engagement-Game/ . If it does not load, GitHub Pages is not switched on yet. Instead, on the repository page click the green **Code** button, choose **Download ZIP**, unzip it, and double-click `index.html`.
2. Press **T**. That key stands in for the scanner's start pulse. Every time in the data is measured from this moment.
3. Press **1**, **2**, **3**, or **4** for the hole a mole comes out of. Do nothing for eggplants. The run lasts 60 seconds. **Esc** ends it early.
4. Scroll down for the attention trace, the event log, and the two data downloads.

The newer, modular build lives in the `src/` folder and looks the same. Browsers block it when it is opened by double-click, so it needs a small local server. From the repository folder, run `npm run serve`, then open http://localhost:8000/ . If Pages is on, it is also at https://rkarnik10.github.io/Engagement-Game/src/ .

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
| `index.html` | The original prototype. One file, runs anywhere. | Only to play it. |
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
| `render/` | Drawing only: the holes, the mole and eggplant art, the trace chart. Swapping the art does not touch the rest. |
| `main.js`, `index.html`, `styles.css` | The web page that connects the pieces. |

## The two data files

**Events table** (`..._events.tsv`). One row per target that appeared. It follows the BIDS convention for fMRI event files, with times in seconds from the start pulse. It opens in Excel or any spreadsheet program.

| Column | Meaning |
|---|---|
| `onset` | When the target appeared, in seconds from the start pulse. |
| `duration` | How long it stayed up. |
| `trial_type` | `go` (mole) or `nogo` (eggplant). |
| `hole` | Which hole, 1 to 4 from left to right. |
| `key` | The key for that hole. |
| `outcome` | `hit`, `omission` (missed mole), `commission` (pressed on an eggplant), `correct_rejection` (left the eggplant alone), or `truncated` (the run ended while it was up). |
| `response_time` | Seconds from appearance to the press, when there was one. `n/a` otherwise. |
| `scheduled_onset` | When it was planned to appear. The difference from `onset` measures display lateness. |
| `preceding_go` | For eggplants only: how many moles came before it since the last eggplant. |

Three example rows from a test run:

```
onset   duration  trial_type  hole  key  outcome     response_time  scheduled_onset  preceding_go
2.000   0.250     go          1     1    hit         0.250          2.000            n/a
3.901   0.278     go          4     4    hit         0.278          3.892            n/a
9.135   0.308     nogo        1     1    commission  0.308          9.133            4
```

**Full log** (`..._log.json`). Everything, for the record, in three parts: `meta` (the settings used, the browser, and display-timing health), `trials` (the same table in milliseconds), and `events` (every single thing that happened, including the start pulse, each simulated scanner pulse, wrong-hole presses, and presses when nothing was up).

## What the tests prove

Running `npm test` in the repository folder runs 55 automatic checks in under a second. In plain terms, they confirm that:

- the same seed number always gives the identical target list, so a run can be reproduced exactly, and the modular build gives the same list as the prototype;
- the mole and eggplant split is exactly the configured share (80/20 by default), the first three targets are moles, no two eggplants come in a row, and the same hole is never used twice in a row, checked across more than a thousand seeds;
- targets never overlap in time;
- each of the seven outcomes is produced in exactly the situation the README describes;
- the engine shows targets on time, takes them down on time, and records display timing;
- the events table and full log have the expected shape and can be read by standard tools.

The tests do not check what the screen looks like, and they cannot check the real timing of a specific computer and projector. That is the hardware check in Phase 4.

## How to give feedback

- Quick answers to the section 11 questions: an email or a message to Rehaan is enough. He will record them in `docs/decisions.md` with the date.
- Comments on specific points: GitHub **Issues** on the repository, one per point, or comments in a shared copy of the README.
- To ask for a change: describe it in plain terms. There is no need to edit code.

## Glossary in plain language

- **Go/no-go task.** Respond to most things (go), hold back for a few (no-go). Here: moles are go, eggplants are no-go.
- **Hit, omission, commission, correct rejection.** Pressed for a mole; missed a mole; pressed for an eggplant; left an eggplant alone.
- **Reaction time (RT).** Time from a mole appearing to the press.
- **Trigger, or start pulse.** The signal the scanner sends when it starts. Time zero for everything.
- **TR and volume.** The scanner takes one whole-brain picture (a volume) every TR, for example every second. Lining up behavior with the brain means lining it up with these pictures.
- **BIDS.** A shared convention for organising brain-imaging data. Following it means the events table drops into standard tools.
- **Seed.** A number that fixes the random choices in a run. Same seed, same run, every time.
- **Frame.** One screen refresh, usually 60 per second. Targets appear on a frame, so onset times are accurate to about a sixtieth of a second.
- **Hold time and gap.** How long a target stays up (0.9 s for now) and the pause before the next one (0.5 to 1.2 s, chosen at random so the brain responses to separate targets can be told apart).
- **Skin.** The look of the targets. Moles and eggplants, or neutral shapes. Changing the skin changes only the drawings.
- **gradCPT.** The lab's existing attention task, where pictures fade gradually into one another instead of popping up.
- **Variance time course (VTC).** The attention curve: how erratic reaction times are over the run. Explained in the analysis plan.
- **d′ (d-prime).** One number for how well someone told moles from eggplants, combining hits and false presses. Explained in the analysis plan.
