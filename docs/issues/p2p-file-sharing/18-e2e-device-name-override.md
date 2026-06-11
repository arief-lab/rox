Status: done

## What to build

A Playwright E2E test that exercises the device name override flow. The user opens Settings, changes their device name, starts pairing, and the peer sees the overridden name (not the auto-generated one) in the pairing UI and Inbox rows.

Modules touched:

- `apps/web/tests/e2e/device-name-override.spec.ts` — new E2E spec

User stories covered: 32, 33, 34, 35.

## Acceptance criteria

- [ ] Default device name is auto-generated (e.g. "Linux Desktop" in headless Chrome)
- [ ] User opens Settings, types a custom name ("My Test Device"), clicks Save
- [ ] User starts pairing as Offerer; the Answerer sees "My Test Device" as the peer name
- [ ] After pairing, the Answerer sends a file; the Offerer's Inbox row shows "From: My Test Device"
- [ ] The custom name persists across page reload (read from localStorage)
- [ ] Reset button clears the custom name and reverts to auto-generated

## Blocked by

None.
