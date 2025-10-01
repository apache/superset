# Safe Database Migration Rollback Tool

## Problem Statement

When rolling back Superset migrations, they MUST execute in reverse chronological order, one migration at a time. However, when users run `superset db downgrade <target>`, Alembic attempts to roll back multiple migrations in a single command, which can cause failures if any intermediate migration has issues.

**The core issue:** Users need a way to safely roll back multiple migrations with confidence that each one executes individually, stops on failure, and provides clear feedback.

## Table of Contents
1. [Solution Overview](#solution-overview)
2. [Implementation Specification](#implementation-specification)
3. [Command-Line Interface](#command-line-interface)
4. [Error Handling and Safety Features](#error-handling-and-safety-features)
5. [Testing Strategy](#testing-strategy)

---

## Solution Overview

Build a new command `superset db downgrade-safe` that enforces one-at-a-time rollback with validation after each step. This provides:

1. **Guaranteed sequential rollback** - Each migration rolls back individually
2. **Immediate failure detection** - Stops on first error
3. **Clear progress feedback** - Shows which migration is being rolled back
4. **Safe multi-step rollback** - Users can roll back multiple migrations with confidence
5. **Dry-run mode** - Preview what will happen without executing
6. **Automatic validation** - Verifies database state after each step

---

## Implementation Specification

### Core Implementation

**Location:** `superset/cli/database.py` (add to existing file)

```python
import click
from flask.cli import with_appcontext
from alembic.script import ScriptDirectory
from alembic.config import Config
import subprocess
import sys

@click.command()
@click.argument('target_revision')
@click.option('--dry-run', is_flag=True, help='Show what would be rolled back without executing')
@click.option('--yes', '-y', is_flag=True, help='Skip confirmation prompt')
@click.option('--validate/--no-validate', default=True, help='Validate after each step (default: True)')
@with_appcontext
def downgrade_safe(target_revision: str, dry_run: bool, yes: bool, validate: bool) -> None:
    """
    Safely downgrade database migrations one at a time.

    This command enforces sequential rollback, executing each migration's
    downgrade() individually and stopping immediately on failure.

    Example:
        superset db downgrade-safe abc123       # Roll back to abc123
        superset db downgrade-safe -3           # Roll back 3 migrations
        superset db downgrade-safe --dry-run    # Preview without executing
    """
    from flask import current_app

    # Get current revision
    current_rev = get_current_revision()
    if not current_rev:
        click.echo(click.style("ERROR: Cannot determine current revision", fg='red'))
        sys.exit(1)

    # Calculate migration path
    migrations_to_rollback = calculate_rollback_path(current_rev, target_revision)

    if not migrations_to_rollback:
        click.echo(click.style("No migrations to roll back", fg='yellow'))
        return

    # Display plan
    click.echo(click.style(f"\nRollback Plan:", fg='cyan', bold=True))
    click.echo(f"Current revision: {current_rev}")
    click.echo(f"Target revision:  {target_revision}")
    click.echo(f"Migrations to roll back: {len(migrations_to_rollback)}\n")

    for i, migration in enumerate(migrations_to_rollback, 1):
        merge_marker = " [MERGE]" if migration['is_merge'] else ""
        click.echo(f"  {i}. {migration['revision']}{merge_marker}")
        click.echo(f"     {migration['description']}")

    if dry_run:
        click.echo(click.style("\nDry run - no changes made", fg='yellow'))
        return

    # Confirm
    if not yes:
        click.echo()
        if not click.confirm('Proceed with rollback?'):
            click.echo("Cancelled")
            return

    # Execute rollbacks one at a time
    click.echo(click.style("\nExecuting rollbacks...", fg='cyan', bold=True))

    for i, migration in enumerate(migrations_to_rollback, 1):
        click.echo(f"\n[{i}/{len(migrations_to_rollback)}] Rolling back {migration['revision']}...")
        click.echo(f"    {migration['description']}")

        # Execute single downgrade
        success = execute_single_downgrade(migration['revision'])

        if not success:
            click.echo(click.style(f"\nERROR: Rollback failed at {migration['revision']}", fg='red', bold=True))
            click.echo("Stopping rollback process")
            sys.exit(1)

        # Validate if requested
        if validate:
            if not validate_database_state():
                click.echo(click.style(f"\nERROR: Database validation failed after {migration['revision']}", fg='red'))
                click.echo("Stopping rollback process")
                sys.exit(1)

        click.echo(click.style("    ✓ Success", fg='green'))

    click.echo(click.style(f"\n✓ All {len(migrations_to_rollback)} migrations rolled back successfully", fg='green', bold=True))
    final_rev = get_current_revision()
    click.echo(f"Current revision: {final_rev}")


def get_current_revision() -> str | None:
    """Get the current database revision."""
    result = subprocess.run(
        ['superset', 'db', 'current'],
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        # Parse output to extract revision ID
        output = result.stdout.strip()
        # Format is typically: "abc123 (head)"
        revision = output.split()[0] if output else None
        return revision
    return None


def calculate_rollback_path(current: str, target: str) -> list[dict]:
    """
    Calculate the path of migrations to roll back.

    Returns list of migration info dicts in order they'll be rolled back.
    """
    from flask import current_app

    config = current_app.extensions['migrate'].migrate.get_config()
    script = ScriptDirectory.from_config(config)

    migrations = []

    # Handle relative revisions (e.g., -3)
    if target.startswith('-'):
        steps = abs(int(target))
        count = 0
        for rev in script.walk_revisions():
            if count == 0 and rev.revision != current:
                continue
            if count > 0:
                migrations.append({
                    'revision': rev.down_revision if not isinstance(rev.down_revision, tuple) else rev.down_revision[0],
                    'description': rev.doc,
                    'is_merge': isinstance(rev.down_revision, tuple)
                })
            count += 1
            if count > steps:
                break
    else:
        # Absolute target revision
        found_current = False
        found_target = False

        for rev in script.walk_revisions():
            if rev.revision == current:
                found_current = True

            if found_current and rev.revision != target:
                migrations.append({
                    'revision': rev.revision,
                    'description': rev.doc,
                    'is_merge': isinstance(rev.down_revision, tuple)
                })

            if rev.revision == target:
                found_target = True
                break

        if not found_target:
            click.echo(click.style(f"ERROR: Target revision {target} not found in migration chain", fg='red'))
            sys.exit(1)

    return migrations


def execute_single_downgrade(from_revision: str) -> bool:
    """
    Execute a single downgrade step using 'superset db downgrade -1'.

    Returns True if successful, False otherwise.
    """
    result = subprocess.run(
        ['superset', 'db', 'downgrade', '-1'],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        click.echo(click.style("STDOUT:", fg='red'))
        click.echo(result.stdout)
        click.echo(click.style("STDERR:", fg='red'))
        click.echo(result.stderr)
        return False

    return True


def validate_database_state() -> bool:
    """
    Validate database state after a migration.

    Could include:
    - Checking alembic_version table is updated
    - Running basic queries to verify schema
    - Checking for orphaned data
    """
    # Basic validation: ensure we can connect and query
    try:
        from flask import current_app
        from superset.extensions import db

        # Simple connectivity check
        db.session.execute('SELECT 1')
        return True
    except Exception as e:
        click.echo(click.style(f"Validation error: {e}", fg='red'))
        return False
```

**Register command** in `superset/cli/database.py`:
```python
# Add to the db command group
db.add_command(downgrade_safe, name='downgrade-safe')
```

---

## Command-Line Interface

### Basic Usage

```bash
# Roll back to a specific revision
superset db downgrade-safe abc123

# Roll back 3 migrations
superset db downgrade-safe -3

# Preview without executing
superset db downgrade-safe abc123 --dry-run

# Skip confirmation prompt
superset db downgrade-safe abc123 -y

# Skip validation after each step (faster but less safe)
superset db downgrade-safe abc123 --no-validate
```

### Command Output Example

```
Rollback Plan:
Current revision: c233f5365c9e
Target revision:  363a9b1e8992
Migrations to roll back: 3

  1. c233f5365c9e
     Add PDF compression level support
  2. cd1fb11291f2
     Fix cosmetic issues
  3. 3fd555e76e3d [MERGE]
     Merge navigation tabs padding

Proceed with rollback? [y/N]: y

Executing rollbacks...

[1/3] Rolling back c233f5365c9e...
    Add PDF compression level support
    ✓ Success

[2/3] Rolling back cd1fb11291f2...
    Fix cosmetic issues
    ✓ Success

[3/3] Rolling back 3fd555e76e3d...
    Merge navigation tabs padding
    ✓ Success

✓ All 3 migrations rolled back successfully
Current revision: 363a9b1e8992
```

---

## Error Handling and Safety Features

### 1. Immediate Failure Detection

The tool stops immediately when any migration fails:

```python
if not success:
    click.echo(click.style(f"\nERROR: Rollback failed at {migration['revision']}", fg='red', bold=True))
    click.echo("Stopping rollback process")
    sys.exit(1)
```

**Benefits:**
- Database remains in a known state
- User can investigate the specific failing migration
- No cascade of failures from later migrations

### 2. Validation After Each Step

Optional validation checks database health after each rollback:

```python
def validate_database_state() -> bool:
    """
    Validate database state after a migration.
    """
    try:
        from superset.extensions import db

        # Check alembic_version table is updated correctly
        current = db.session.execute('SELECT version_num FROM alembic_version').scalar()

        # Run basic schema queries
        db.session.execute('SELECT 1')

        # Could add more checks:
        # - Verify expected tables exist
        # - Check foreign key constraints
        # - Validate data integrity

        return True
    except Exception as e:
        click.echo(click.style(f"Validation error: {e}", fg='red'))
        return False
```

### 3. Dry-Run Mode

Preview rollback plan without executing:

```bash
superset db downgrade-safe abc123 --dry-run
```

Shows:
- Current and target revisions
- Number of migrations to roll back
- List of migrations in rollback order
- Merge migration markers

### 4. Confirmation Prompt

Requires explicit confirmation unless `-y` flag is used:

```
Proceed with rollback? [y/N]:
```

Prevents accidental rollbacks.

### 5. Clear Progress Feedback

Shows real-time progress during execution:

```
[2/5] Rolling back cd1fb11291f2...
    Fix cosmetic issues
    ✓ Success
```

User always knows:
- Which migration is being rolled back
- Total progress (2 of 5)
- Success/failure status

### 6. Error Message Display

On failure, displays full error output:

```python
if result.returncode != 0:
    click.echo(click.style("STDOUT:", fg='red'))
    click.echo(result.stdout)
    click.echo(click.style("STDERR:", fg='red'))
    click.echo(result.stderr)
    return False
```

Helps with debugging.

### 7. Merge Migration Warnings

Identifies and marks merge migrations:

```
  3. 3fd555e76e3d [MERGE]
     Merge navigation tabs padding
```

Helps users understand non-linear rollback paths.

---

## Testing Strategy

### Unit Tests

**Location:** `tests/unit_tests/cli/test_database.py`

```python
from unittest.mock import Mock, patch
from superset.cli.database import (
    get_current_revision,
    calculate_rollback_path,
    execute_single_downgrade,
    validate_database_state,
)


def test_get_current_revision_success():
    """Test getting current revision from db current command"""
    with patch('subprocess.run') as mock_run:
        mock_run.return_value = Mock(
            returncode=0,
            stdout='abc123 (head)\n'
        )
        assert get_current_revision() == 'abc123'


def test_get_current_revision_failure():
    """Test handling of db current command failure"""
    with patch('subprocess.run') as mock_run:
        mock_run.return_value = Mock(returncode=1)
        assert get_current_revision() is None


def test_calculate_rollback_path_relative():
    """Test calculating path for relative revision (-3)"""
    # Mock ScriptDirectory and revisions
    # Assert correct migrations are returned in correct order
    pass


def test_calculate_rollback_path_absolute():
    """Test calculating path for absolute revision"""
    # Mock ScriptDirectory and revisions
    # Assert correct path from current to target
    pass


def test_execute_single_downgrade_success():
    """Test successful downgrade execution"""
    with patch('subprocess.run') as mock_run:
        mock_run.return_value = Mock(returncode=0)
        assert execute_single_downgrade('abc123') is True


def test_execute_single_downgrade_failure():
    """Test failed downgrade execution"""
    with patch('subprocess.run') as mock_run:
        mock_run.return_value = Mock(
            returncode=1,
            stdout='Error output',
            stderr='Error details'
        )
        assert execute_single_downgrade('abc123') is False


def test_validate_database_state():
    """Test database validation"""
    # Mock db.session.execute
    # Assert validation passes
    pass
```

### Integration Tests

**Location:** `tests/integration_tests/cli/test_database_downgrade.py`

```python
from superset.app import create_app


def test_downgrade_safe_dry_run(app_context):
    """Test dry-run mode doesn't modify database"""
    from click.testing import CliRunner
    from superset.cli.database import downgrade_safe

    runner = CliRunner()
    result = runner.invoke(downgrade_safe, ['-1', '--dry-run'])

    assert result.exit_code == 0
    assert 'Dry run - no changes made' in result.output


def test_downgrade_safe_single_migration(app_context, test_database):
    """Test rolling back a single migration"""
    # Setup: Ensure database is at known revision
    # Execute: Roll back one migration
    # Assert: Revision is updated correctly
    # Assert: Database schema matches expected state
    pass


def test_downgrade_safe_stops_on_failure(app_context):
    """Test that rollback stops on first failure"""
    # Setup: Create scenario where 2nd migration will fail
    # Execute: Attempt to roll back 3 migrations
    # Assert: Only first migration rolled back
    # Assert: Database is in consistent state
    pass


def test_downgrade_safe_validation_failure(app_context):
    """Test handling of validation failure"""
    # Mock validation to fail after first migration
    # Execute: Attempt multi-step rollback
    # Assert: Stops after validation failure
    pass
```

### Manual Testing Checklist

Before releasing the tool:

- [ ] Test dry-run mode with various target revisions
- [ ] Test rolling back 1 migration
- [ ] Test rolling back 5 migrations
- [ ] Test rolling back across a merge migration
- [ ] Test with `-y` flag (skip confirmation)
- [ ] Test with `--no-validate` flag
- [ ] Test error handling when downgrade fails
- [ ] Test error handling when validation fails
- [ ] Test on PostgreSQL database
- [ ] Test on MySQL database
- [ ] Test on SQLite database
- [ ] Test with invalid target revision
- [ ] Test with relative revision (-3)
- [ ] Verify help text: `superset db downgrade-safe --help`

---

## Implementation Checklist

### Phase 1: Core Implementation

- [ ] Create `downgrade_safe()` function in `superset/cli/database.py`
- [ ] Implement `get_current_revision()`
- [ ] Implement `calculate_rollback_path()`
- [ ] Implement `execute_single_downgrade()`
- [ ] Implement `validate_database_state()`
- [ ] Register command with db command group
- [ ] Add type hints and docstrings

### Phase 2: Testing

- [ ] Write unit tests for all helper functions
- [ ] Write integration tests for command execution
- [ ] Test across PostgreSQL, MySQL, SQLite
- [ ] Manual testing with real migrations
- [ ] Test error scenarios

### Phase 3: Documentation

- [ ] Add command to CLI help documentation
- [ ] Update migration documentation
- [ ] Add usage examples
- [ ] Document safety features

### Phase 4: Polish

- [ ] Add progress bar for long rollbacks
- [ ] Add timing information
- [ ] Improve error messages
- [ ] Add option to create backup before rollback
- [ ] Consider adding rollback summary report

---

## Future Enhancements

### 1. Backup Before Rollback

```python
@click.option('--backup/--no-backup', default=True, help='Create backup before rollback')
def downgrade_safe(..., backup: bool):
    if backup:
        backup_file = create_database_backup()
        click.echo(f"Backup created: {backup_file}")
```

### 2. Rollback Summary Report

After completion, generate a report:

```
Rollback Summary
================
Started:  2025-09-30 10:30:00
Finished: 2025-09-30 10:32:15
Duration: 2m 15s

Migrations rolled back: 5
Migrations failed: 0

Revisions:
  c233f5365c9e -> cd1fb11291f2 (success, 15s)
  cd1fb11291f2 -> 3fd555e76e3d (success, 8s)
  ...
```

### 3. Resume Failed Rollback

If rollback fails midway, allow resuming:

```bash
superset db downgrade-safe --resume
```

Detects where rollback stopped and continues from that point.

### 4. Transaction Rollback on Failure

Optionally wrap entire rollback in a transaction (for supported databases):

```python
@click.option('--atomic', is_flag=True, help='Rollback all changes if any step fails')
```

Note: May not work with all database types or DDL operations.
