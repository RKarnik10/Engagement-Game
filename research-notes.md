# Research notes: whac-a-mole engagement game

Compiled September 18, 2026 for the Song Lab meeting. Summaries are based on abstracts and publisher pages, not full-text reads, so check details before citing anything. "Free" = full text readable without a login.

---

## 1. Is whac-a-mole a real research task? (read first)

**Millisecond Software: Whack-A-Mole task** (free)
- https://www.millisecond.com/library/whackamole
- Manual: https://www.millisecond.com/library/v7/whackamole/whackamole_keyboard/whackamole_gonogo_keyboard.manual
- Used to measure response inhibition in children. Commission errors (pressing when you should hold back) are the main measure; omission errors (missing go targets) measure attention.
- Described as a version of Casey's go/no-go paradigm, built to test how the number of go trials before a no-go affects inhibition. The manual names Yale's FAB lab (https://fablab.yale.edu/page/assays-tools) as the original source.
- **For us:** proves the paradigm exists; our `preceding_go` column comes from here.

**Tong et al. (2016), JMIR Serious Games. "A Serious Game for Clinical Assessment of Cognitive Status: Validation Study"** (free)
- https://games.jmir.org/2016/1/e7/
- Game modeled on the go/no-go task in whack-a-mole form. In healthy young adults, performance correlated with the Stroop task (r = .60). Feasibility then tested with 146 elderly adults in a hospital emergency department.
- **For us:** a whack-a-mole format can track a standard inhibition measure, so the game wrapper doesn't break the measurement.

**Iglar et al. (2023). "Designing Feasible and Effective Cognitive Assessment for Older Adults in Long-Term Care"**
- https://journals.sagepub.com/doi/full/10.1177/21695067231192552
- Whack-a-mole games worked in the emergency department, but some long-term-care residents found the theme juvenile. The team re-skinned it as gardening (dig up weeds, not flowers) and started a playing-card version.
- **For us:** published precedent for our neutral-skin idea: same task, different look.

---

## 2. Does violent content change the fMRI signal?

**Mathiak & Weber (2006), Human Brain Mapping, 27(12), 948–956** (free full text)
- https://pmc.ncbi.nlm.nih.gov/articles/PMC6871426
- 13 experienced gamers (18–26) played a violent first-person shooter in a 3T scanner. Violent scenes raised activity in dorsal anterior cingulate and lowered it in rostral anterior cingulate and amygdala; the authors describe effect sizes in those areas as large.
- They argue virtual environments can be used to study semi-naturalistic behavior.
- **For us:** strongest evidence that content adds its own brain responses. Also a naturalistic-fMRI paper, which fits the lab's framing.

**Weber, Ritterfeld & Mathiak (2006), Media Psychology, 8(1), 39–60**
- https://www.tandfonline.com/doi/abs/10.1207/S1532785XMEP0801_4
- Companion study: 13 male participants; gameplay recorded and coded frame by frame.
- **For us:** coding game events to line up with fMRI is similar to what our event log does.

---

## 3. Does violence make games more engaging?

**Przybylski, Ryan & Rigby (2009), Personality and Social Psychology Bulletin, 35(2), 243–259**
- Free PDF: https://selfdeterminationtheory.org/SDT/documents/2009_PrzbylskiRyanRigby_PSPB.pdf
- PubMed: https://pubmed.ncbi.nlm.nih.gov/19141627/
- Six studies. Enjoyment tracked players' sense of autonomy and competence; violent content added little on top of that. High-trait-aggression players preferred violent games but didn't enjoy them more.
- **For us:** a neutral skin shouldn't lose much engagement if the challenge stays the same.

**Lumsden et al. (2016), JMIR Serious Games, 4(2), e11. Gamification of cognitive tasks review** (free)
- https://games.jmir.org/2016/2/e11/
- PMC: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4967181/
- Cognitive tasks are often experienced as effortful and repetitive, leading to disengagement and worse data. Reviews whether game features can help without undermining the science.
- **For us:** the literature this project sits in. Cite it when explaining why a game instead of a plain task.

**"The Effects of Gamification on Computerized Cognitive Training" (2020), JMIR Serious Games** (free)
- https://games.jmir.org/2020/3/e18644
- Meta-analysis: moderate positive effect of gamification on motivation/engagement (Hedges g = 0.72), but based on only 8 studies, so tentative. Notes game elements could also distract.
- Author names not captured; check the page.

**Lead to follow up (score question, Q6):** a related study listed on Semantic Scholar reported that adding points raised reaction times and error rates. Source paper not identified; treat as a lead, not a finding.

---

## 4. Could it harm participants?

**Kühn et al. (2019), Molecular Psychiatry, 24(8), 1220–1234** (free)
- https://www.nature.com/articles/s41380-018-0031-7
- Adults played a violent game daily for two months. No change in aggression or empathy compared with a non-violent game group or a no-game group, right after or at follow-up.
- Caveat: adult sample; authors say younger players need more research.

**Hilgard, Engelhardt & Rouder (2017), Psychological Bulletin, 143(7), 757–774**
- https://doi.org/10.1037/bul0000074
- Reanalysis arguing earlier evidence for short-term effects of violent games was overstated. Only the citation seen, not the paper.

---

## 5. Measuring attention moment to moment (the lab's approach)

**Esterman et al. (2013), Cerebral Cortex, 23(11), 2712–2723. "In the zone or zoning out?"**
- No verified link yet; search the title on Google Scholar.
- Free summary in a follow-up from the same group: https://pmc.ncbi.nlm.nih.gov/articles/PMC6827583
- Higher reaction-time variability went with more task-positive network activity and less default mode network activity. Separates stable, low-error "in the zone" periods from unstable "out of the zone" periods.
- **For us:** source of the attention trace (variance time course) in the game.

**bioRxiv preprint on oscillatory dynamics of sustained attention (2024)** (free, not peer reviewed)
- https://www.biorxiv.org/content/10.1101/2024.09.25.614991.full.pdf
- The gradCPT replaced abrupt image onsets with gradual transitions. Abrupt onsets grab attention automatically, so removing them makes the task better at catching lapses.
- **For us:** source of the pop-up vs. gradual-rise design flag.

**Chidharom, Vogel & Rosenberg (2024), Vision Sciences Society abstract** (free)
- https://www.visionsciences.org/presentation/?id=543
- 38 participants, ~40-minute go/no-go task. Compared reaction-time variability with thought probes every 30 trials.
- **For us:** model for engagement probes (Q1).

**Seeburger et al. (2024), Cognitive, Affective, & Behavioral Neuroscience** (free PDF)
- https://control.gatech.edu/wp-content/uploads/2024/09/Seeburger-et-al-2024-CABN.pdf
- Argues reaction-time variability is a better trial-by-trial attention measure than error rates alone; lists tasks (including gradCPT) that track attention over time.

---

## 6. Technical: timing

**Bridges et al. (2020), PeerJ, 8, e9414** (free)
- https://peerj.com/articles/9414.pdf
- Lab software (PsychoPy, Psychtoolbox, Presentation, E-Prime) reached under 1 ms precision. Online setups were less precise, though the best came close to millisecond precision on some browser/system combinations. Labs should validate their own setup.
- **For us:** backs "prototype in the browser, validate before scanning."

---

## 7. The lab's own paper

**Song, Shim & Rosenberg (2023), eLife, 12, e85487.** Code: GitHub `hyssong/neuraldynamics`. Data: OpenNeuro `ds004592`.

---

## Short on time?

Read these four: the Millisecond page, the skin section of Iglar 2023, and the Mathiak & Weber and Przybylski abstracts. Together they cover the violence argument.
