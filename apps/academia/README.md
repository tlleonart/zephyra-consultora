# @zephyra/academia

Learner-facing LMS (catalogue, checkout, SCORM player). **Placeholder** — routes are moved here in M3; nothing
lives here yet.

Deliberately declares no `dev`/`build`/`lint`/`typecheck`/`test` scripts: turbo
skips a workspace for any task it does not define, so an empty placeholder
cannot break `turbo run <task>`. Add the scripts in the same change that adds
real code.
