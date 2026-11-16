# todo-cli

Small, dependency-free (Node 22) todo CLI for teams. Tasks live in one JSON file
that you commit to git or put on a shared path.

## Usage

```
node bin/todo.js add "Write docs" -p high -d 2025-03-01 -a alice
node bin/todo.js list [--status open|done|all] [-p high] [-a alice] [--overdue] [--sort due|priority|created|id] [--reverse] [--json]
node bin/todo.js done 1
node bin/todo.js delete 1
node bin/todo.js help
```

- Priorities: `high|medium|low` (default `medium`).
- Dates: `YYYY-MM-DD`, `today`, `tomorrow`, `+3d`.
- Use `--` before titles that start with a dash: `todo add -- "-fix"`.
- Default list: open tasks, overdue first, then priority, then due date.
- Overdue = open with due date before today (local time); marked `[OVERDUE]`
  (red on a TTY unless `NO_COLOR` is set).
- Exit codes: 0 ok, 1 domain error, 2 usage error.

## Team workflow

- File: `--file`, else `$TODO_FILE`, else `./.todo/todo.json`. Commit it to share.
- `createdBy` comes from `--user`, `$TODO_USER`, or the OS username; use
  `--assignee` to assign and filter.
- Writes are atomic (temp file + rename), last write wins, no locking. Output is
  sorted, 2-space JSON, so git diffs/merges stay clean.
- IDs are never reused; delete is permanent with no prompt.

## Tests

`npm test`
