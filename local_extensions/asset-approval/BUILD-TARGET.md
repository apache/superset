# Build target

QA ran against this branch and asked which Superset it is (S-09). It is the
PCS 6.1 build line, not master.

## Base

| | |
|---|---|
| Base tag | `v6.1.0.14` -- the newest PCS 6.1 build tag |
| Base commit | `fb79c3c16d890b65a167ce3758e5cd30e3a3e264` (`fb79c3c16d`, 2026-10-24) |
| Commits on top | 89, of which 15 are upstream and the rest are this delivery |

Every PCS 6.1 tag, `v6.1.0.0` through `v6.1.0.14`, is an ancestor of this
branch. Nothing here was written against a 6.1 that this branch is not built
on.

Reproduce:

```bash
git merge-base --is-ancestor v6.1.0.14 HEAD && echo "on the 6.1 line"
```

## The upstream delta

These are the only commits between the base tag and this branch that are not
part of the delivery. They are listed so a result from this branch can be
read as a result for PCS 6.1 plus a known difference, rather than for an
unspecified master.

- \`f829175e94\` fix(sunburst): keep the saved time grain in Explore (#45571)
- \`b966813c09\` chore(deps): bump sqlalchemy-continuum from 1.8.0 to 2.0.0 (#45687)
- \`bea6db6d05\` chore: replace remaining deprecated datetime.utcnow with naive_utcnow (#45697)
- \`7d27e467f1\` chore(dependabot): restrict Dependabot to only open PR for SQLAlchemy v2.0.x patch version (#45693)
- \`6d986408f6\` chore(deps-dev): bump lerna from 10.0.1 to 10.1.1 in /superset-frontend (#45715)
- \`ae9fc20c65\` chore(deps): bump sqlalchemy from 2.0.52 to 2.0.55 (#45703)
- \`a028e65ba3\` chore(deps-dev): bump clickhouse-connect from 1.10.1 to 1.11.0 (#45708)
- \`3f85ceb15b\` chore(deps-dev): bump duckdb from 1.5.5 to 1.5.6 (#45705)
- \`b5c959cfe9\` chore(deps): bump jsonpath-ng from 1.8.0 to 1.13.0 (#45710)
- \`6f4b99f792\` chore(deps): bump cachetools from 7.2.1 to 7.2.5 (#45707)
- \`e3b8026e4e\` chore(deps-dev): bump syntaqlite from 0.12.1 to 0.13.2 (#45706)
- \`0ccb586540\` fix(docker): use the system CA store for build-time downloads (#45678)
- \`b645ac2c40\` chore(deps): bump acorn from 8.18.0 to 8.19.0 in /superset-frontend (#45714)
- \`889653076b\` chore(deps-dev): bump @oxlint/plugins from 1.86.0 to 1.88.0 in /superset-frontend (#45711)
- \`9c31d12edd\` chore(deps): bump ace-builds from 1.44.0 to 1.45.0 in /superset-frontend (#45712)

They touch exactly one file this delivery also touches:
`superset/translations/messages.pot`, which is generated. Thirteen are
dependency bumps; the other two are a sunburst time-grain fix and a Docker
build change. None of them touch the subsystems the delivery depends on.

Reproduce:

```bash
git log --format= --name-only --perl-regexp --author='^(?!amaannawab923)' \
  v6.1.0.14..HEAD | sort -u | grep . > /tmp/upstream.txt
git log --format= --name-only --author=amaannawab923 \
  v6.1.0.14..HEAD | sort -u | grep . > /tmp/ours.txt
comm -12 /tmp/upstream.txt /tmp/ours.txt
```

## What the delivery needs from the host

| What | At `v6.1.0.14` | Provided by |
|---|---|---|
| `superset/subjects` -- editorship as subjects | present | host |
| `security_manager.get_extra_editor_subject_ids` | present | host |
| `superset/versioning`, including `changes.ACTION_META_KEY` and `build_action_headline` | present | host |
| `superset/commands/version_restore.py` | present | host |
| Extension pages (`superset/extensions/view.py`, `EXTENSION_VIEW_MENU_PREFIX`) | absent | this branch, from apache/superset#45522 |
| `superset/change_management.py` -- the hook core refuses writes without | absent | this branch |

The two absent rows are carried by the delivery, so a PCS 6.1 build does not
need to grow them first. Nothing in either needs a migration.

## Verification

The delivery applies to the base tag on its own, with none of the upstream
delta, and the suite passes there:

```bash
git worktree add /tmp/s61 --detach v6.1.0.14
git diff v6.1.0.14 HEAD -- $(cat /tmp/ours.txt | tr '\n' ' ') > /tmp/delivery.patch
cd /tmp/s61 && git apply /tmp/delivery.patch
python -m pytest tests/unit_tests/
```

`git apply` reports no conflict: 217 files changed, and the
change-management suite gives the same 251 passed / 4 skipped it gives on
this branch.

One limit worth stating plainly. That run used this branch's installed
dependencies, not the tag's pins -- `sqlalchemy-continuum` is 1.8.0 at the
tag and 2.0.0 here, and `sqlalchemy` 2.0.52 against 2.0.55. The delivery
reaches continuum in one place: `entrypoint._published_in_version_history`,
a best-effort read of the dashboard version history, inside
`except Exception`. If it fails on 1.8.0 the cost is one dashboard staying
exempt from review until it is next published, which that function already
documents. Everything else in the delivery goes through SQLAlchemy and FAB
APIs that did not move between those versions.
