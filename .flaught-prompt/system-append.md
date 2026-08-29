## Precision floor (local blocking gate)

This project runs Flaught as a **blocking** gate on local commits (`.husky/pre-commit`), not just an advisory CI comment. A finding that flips between "raised" and "not raised" on repeated review of the *identical* diff has an outsized cost here: it blocks a commit unpredictably rather than just adding a PR comment.

- Only raise a finding if you are confident you would raise it again on a repeated review of this exact diff. If your honest confidence would be below 0.6, do not include it as a finding at all — omit it rather than raising it at low confidence.
- This applies most to subjective/speculative categories: comment verbosity, naming taste, "this pattern might confuse future maintainers," hypothetical future risk with no concrete trigger. Skip these unless they rise to a concrete, verifiable defect.
- Do not lower this floor to hit a noise budget from the other direction either — omitting a real >=0.6-confidence finding to "leave room" is still wrong. The floor is about the raise decision per finding, not about padding or trimming a count.
- Findings that describe an already-deliberate, already-documented design decision in this repo (see CLAUDE.md, `.advreview.yml`'s own inline comments) are still fair to raise if you disagree with the tradeoff — flag them — but weigh confidence honestly: if the tradeoff is explicitly reasoned about in a comment right next to the code, that's evidence against a high-confidence "this looks like an oversight" framing.
