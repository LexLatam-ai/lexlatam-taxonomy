# Issue tracker: GitHub

Issues and PRDs for this repository live as GitHub issues in `LexLatam-ai/lexlatam-taxonomy`. Use the `gh` CLI for issue operations.

## Conventions

- Create issues with `gh issue create`.
- Read issues and comments with `gh issue view <number> --comments`.
- List issues with `gh issue list` and the appropriate state or label filters.
- Add or remove labels with `gh issue edit`.
- Close issues with `gh issue close`.

Infer the repository from its configured Git remote by running commands inside this clone.

## Skill integration

When a skill says to publish to the issue tracker, create a GitHub issue. When a skill says to fetch a relevant ticket, read the GitHub issue and its comments.
