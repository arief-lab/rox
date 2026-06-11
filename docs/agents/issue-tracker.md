# Issue tracker: Local Markdown

Issues and PRDs for this repo live as markdown files in `docs/`.

## Conventions

- Implementation issues live under `docs/issues/<feature-slug>/<NN>-<slug>.md`, numbered from `01`
- PRDs live at `docs/prd/<feature-slug>.md`
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `docs/issues/<feature-slug>/` (creating the directory if needed). For a new PRD, create `docs/prd/<feature-slug>.md`.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Note on the existing PRD

The PRD for the P2P file-sharing feature was produced before this tracker was finalised; it lives at `docs/prd/0001-p2p-file-sharing.md` and its implementation issues live at `docs/issues/p2p-file-sharing/`. This matches the convention above.
