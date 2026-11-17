# Design decisions

Why the agent is built the way it is. Each decision came from a failure or a measurement, not from a preference.

## Two independent judges, not one

A single model grading a site gives a number with no error bar. Two judges with different personas (an independent reviewer, a demanding art director) grade the same evidence without seeing each other's score. When they agree, the score means something; when they differ by more than 6 points, a third judge runs and the median is kept.

Every deducted point must cite evidence: a screenshot and an area, or a number from a report. A judge cannot take points off for an impression.

**Lesson that shaped it:** in one early run the judges were told the project had an accessibility test suite. It did not, and the accessibility score came out inflated. Judges now receive only facts that were verified first.

## Targets before the first change

The target score and three to six yes-or-no acceptance criteria are written before any work starts, with the baseline (commit, scores, test counts). Otherwise it is too easy to declare success against a goal chosen afterwards. After the work, a no-regression check confirms that no criterion went down.

## Measured values instead of adjectives

"Premium", "smooth" and "modern" cannot be checked. Pixel sizes, line-heights, easing curves and durations can. The reference library is a set of measurements taken in a real browser on award-level sites, so a design choice reads "reveal: 30 px rise, transform 700 ms, opacity 900 ms, expo-out curve" rather than "a nice fade-in". Picking one register per project (product, studio or editorial) keeps the values consistent across pages.

## The agent must see motion

Static screenshots were approving pages that stuttered or showed half-faded content. The agent now records every animated page while it scrolls and reviews contact sheets frame by frame, with numbers for long tasks and layout shifts. Two capture traps found on the way are now written into the method: Playwright's full-page screenshots can drop animated and sticky layers, and identifiers captured before a test run can go stale after the run reseeds the data.

## Specialists in parallel, findings verified

One general reviewer misses whole categories. Several sub-agents each own one concern (security, a live attacker's view, design, accessibility and copy, motion and performance, tests) and run in parallel. Every finding must be reproduced before it is fixed: confident findings can be wrong, and fixing a non-problem breaks working code.

## A fixed gate before delivery

The same checks in the same order every time, ending in READY or NOT READY. The scan for secrets and stray attribution, and the checksum comparison between the tested files and the delivered ones, exist because those are the mistakes that are invisible until they are public.

## Lessons with confidence, not automatic memory

Automatic memory systems record everything and promote patterns on their own. That spreads mistakes as easily as good habits, and a hook that watches every action is a lot of trust to give. Here, a lesson is written by hand with its evidence and a score from 0.3 to 0.9. It rises when the lesson holds on another project and drops when it is contradicted. It reaches a skill at 0.7, after a second project confirms it, and only with my approval.

## Search before building

Before writing a feature, the agent looks for an existing solution (the starter, the framework, maintained packages) and decides: adopt, extend, compose, or build. It must say which sources it searched and which were unavailable, rather than imply a search it did not do.

## A human ships

The agent prepares changes and proves they pass; I review, commit and deploy. It never handles passwords, sign-in or reset links, and admin rights on every demo belong to a human. Speed matters less than knowing exactly what went live and who approved it.
