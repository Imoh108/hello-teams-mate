# App-wide readability and contrast fixes

Improve text readability across QuizPulse without changing its dark, colorful game identity.

## Changes

- Adjust the semantic color tokens so every colored answer block, feedback screen, podium, badge, and action has a readable foreground color.
- Strengthen secondary text, borders, inputs, disabled states, and interactive controls across the dark interface.
- Replace isolated hardcoded white/black text assumptions with the matching semantic foreground tokens.
- Correct chart colors that currently use an incompatible color format, so labels, grids, tooltips, and data remain visible.
- Preserve the existing Kahoot-inspired palette, layout, gameplay, and functionality.

## Verification

- Measure the updated core palette against WCAG contrast targets.
- Check public, player, host, dashboard, admin, and platform screens at desktop and mobile sizes.
- Confirm the preview builds cleanly and that important text is not obscured or washed out.

## Technical details

- Centralize the fix in `src/styles.css` wherever possible, then update only the route or shared-control classes that override those tokens.
- Target at least 4.5:1 contrast for normal text and 3:1 for large text and essential control boundaries.
- Keep status meaning available through text/icons as well as color.