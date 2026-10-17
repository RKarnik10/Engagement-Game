# Matching the mole pictures

*October 17, 2026. README 3.6 requires the pictures to be matched for size and
average brightness, so that any difference in brain response between them
comes from what they mean, not from one being bigger or brighter.*

## Result

| Picture | Visible area | vs. happy mole | Mean brightness (relative luminance Y) | vs. happy mole |
|---|---|---|---|---|
| Happy mole (press) | 28.22% of the hole's square | — | 0.1168 | — |
| Sad mole (don't press; the distractor in use) | 28.22% | +0.0% | 0.1166 | −0.1% |
| Molerat (optional distractor) | 28.22% | +0.0% | 0.1171 | +0.3% |

- **Happy and sad mole:** already matched. They are the same drawing apart
  from the mouth and eyebrows, so nothing needed to change.
- **Molerat:** was 3× brighter and 6% smaller. Its body and muzzle were
  darkened (`#B08C88` to `#644F4C`, `#D8BDB6` to `#7C6C68`) and it was scaled
  up 2.94% about the centre of the hole. It still differs by shape: bald head,
  round ears, buck teeth.

## How it was measured

`scripts/measure-stimuli.py` (macOS) renders each picture alone, fully up and
clipped by the hole as in the game, on a magenta background. Pixels that are
clearly not magenta count as the picture; the blended edge pixels are left
out. It reports the picture's share of the 120 × 120 square and its mean
relative luminance, Y = 0.2126 R + 0.7152 G + 0.0722 B on linearised sRGB
values. Run it again after any change to `src/render/skin-mole.js`:

```
python3 scripts/measure-stimuli.py
```

## What this does not cover

- **The screen.** These numbers come from the drawing's colours. What reaches
  the participant's eye depends on the projector. Before scanning, measure the
  real display with a photometer (README 4.4).
- **Shape and contrast.** Matching mean brightness and area does not match
  every visual feature. The sad mole differs from the happy one only in its
  face, which keeps low-level differences small; the molerat differs more in
  shape by design.
- **The background.** The pictures sit on brown holes on grass (or on grey).
  The scene is the same for every picture, so it does not affect the
  comparison between them.
