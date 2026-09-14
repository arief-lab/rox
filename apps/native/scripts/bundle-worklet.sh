#!/usr/bin/env bash
# Bundle the Bare worklet core (worklet/app.js) into a single .bundle
# the RN host loads via worklet.start('/app.bundle', bundle).
#
# bare-pack pre-resolves the module graph (hyperdrive, hyperswarm,
# bare-*) and embeds assets. `--linked` makes native addons resolve to
# linked: specifiers — required on iOS/Android, which link addons ahead
# of time instead of loading from disk. The linked addon .so/.a files
# are provided by the bare-runtime prebuilds wired through the dev
# build's native linking (see AGENTS.md dev build checklist).
#
# Usage: bash scripts/bundle-worklet.sh
set -euo pipefail
cd "$(dirname "$0")"

OUT="../lib/worklet.bundle.mjs"

bunx bare-pack \
	--linked \
	--host android-arm64 \
	--host android-x64 \
	--host ios-arm64 \
	--host ios-arm64-simulator \
	--out "$OUT" \
	../worklet/app.js

echo "wrote $OUT ($(wc -c < "$OUT") bytes)"
