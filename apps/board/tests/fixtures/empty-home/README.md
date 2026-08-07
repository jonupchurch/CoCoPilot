# A home directory with no `.claude/projects` in it.

The E2E harness points `COCOPILOT_HOME` here by default, so a test that says
nothing about transcripts gets a board that finds none — rather than one that
reads the developer.
