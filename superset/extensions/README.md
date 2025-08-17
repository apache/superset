# Superset Extension Management System

This document describes the filesystem-based extension management system that automatically loads and updates extensions during application startup.

## Overview

The extension management system has been redesigned to eliminate the security risks associated with API-based extension uploads. Extensions are now automatically discovered and loaded from the filesystem during worker startup, with distributed locking to ensure consistency across multiple workers.

## Key Components

### 1. Extension Discovery (`discovery.py`)
- **`ExtensionBundleDiscovery`**: Discovers `.supx` files and extension directories
- Supports both packaged extensions (`.supx` files) and development directories
- Validates bundle integrity before loading

### 2. Checksum Management (`checksum.py`)
- **`ExtensionChecksumService`**: Calculates deterministic checksums for extensions
- **`ExtensionChecksumComparator`**: Compares filesystem vs database checksums
- Ensures consistent ordering of dictionaries for reliable checksum calculation

### 3. Startup Orchestration (`startup_upsert.py`)
- **`LockedExtensionUpsertCommand`**: Performs extension upserts with distributed locking
- **`ExtensionStartupUpdateOrchestrator`**: Coordinates the entire update process
- Uses per-extension locks to allow parallel updates of different extensions

### 4. Enhanced Models (`types.py`, `models.py`)
- Both `LoadedExtension` and `Extension` now have consistent `checksum` properties
- Checksums are calculated using the centralized service for consistency

## Configuration

### Environment Variables

- **`SUPERSET_EXTENSIONS_PATH`**: Path to directory containing extension bundles
  - If not set, extension updates are skipped
  - If path doesn't exist, a warning is logged and updates are skipped

### Configuration Options

```python
# Timeout for acquiring locks during extension updates (seconds)
EXTENSION_STARTUP_LOCK_TIMEOUT = 30
```

## Extension Bundle Format

### .supx Files
- Extension bundles use the `.supx` extension (Superset Extension)
- These are ZIP files with specific internal structure
- Must contain a `manifest.json` file with extension metadata

### Directory Structure
For development, extensions can be directories with the following structure:
```
extension-name/
├── dist/
│   ├── manifest.json
│   ├── frontend/
│   │   └── dist/
│   │       └── [frontend assets]
│   └── backend/
│       └── src/
│           └── [backend code]
```

## Startup Process

1. **Discovery Phase**: Scan `SUPERSET_EXTENSIONS_PATH` for `.supx` files and directories
2. **Loading Phase**: Load each extension and calculate its checksum
3. **Comparison Phase**: Compare filesystem checksum with database checksum
4. **Update Phase**: For changed extensions, acquire lock and perform upsert
5. **Statistics**: Log summary of discovered, updated, skipped, and failed extensions

## Distributed Locking

- Uses existing `KeyValueDistributedLock` infrastructure
- Lock namespace: `extension_upsert`
- Lock key includes extension name: `extension_name=<name>`
- Default timeout: 30 seconds per extension
- If lock acquisition fails, extension is skipped (another worker is handling it)

## Error Handling

The system is designed to be resilient:
- **Bundle Discovery Errors**: Log warning, continue with other bundles
- **Lock Acquisition Failures**: Log info, skip extension (handled by another worker)
- **Checksum Calculation Errors**: Log error, skip extension
- **Database Upsert Errors**: Log error, continue with other extensions
- **Overall Process Errors**: Log warning, don't block application startup

## Security Benefits

- **Eliminates API Attack Vector**: No longer possible to upload malicious extensions via API
- **Filesystem-Based Control**: Extensions must be placed on the filesystem by administrators
- **Startup-Only Updates**: Extensions are only processed during controlled startup sequences
- **Distributed Locking**: Prevents race conditions and ensures consistency

## Monitoring and Logging

The system provides comprehensive logging at different levels:

- **INFO**: Extension update statistics, successful operations
- **DEBUG**: Detailed operation flow, checksum calculations
- **WARNING**: Configuration issues, missing paths
- **ERROR**: Failed operations, invalid bundles

Example log output:
```
INFO - Extension update check completed successfully. Discovered: 3, Updated: 1, Skipped: 2, Errors: 0
```

## Development Workflow

For extension developers:

1. **Development**: Use directory structure in `SUPERSET_EXTENSIONS_PATH`
2. **Testing**: Restart Superset to trigger extension reload
3. **Production**: Package as `.supx` file and deploy to production path
4. **Deployment**: Extensions are automatically updated on next worker restart

## Troubleshooting

### Common Issues

1. **Extensions not loading**: Check `SUPERSET_EXTENSIONS_PATH` is set and path exists
2. **Extensions not updating**: Verify checksum changes (check manifest, frontend, backend)
3. **Lock timeouts**: Increase `EXTENSION_STARTUP_LOCK_TIMEOUT` if needed
4. **Bundle format errors**: Ensure `.supx` files are valid ZIP files with correct structure

### Debug Steps

1. Check environment variable: `echo $SUPERSET_EXTENSIONS_PATH`
2. Verify path exists and contains extensions: `ls -la $SUPERSET_EXTENSIONS_PATH`
3. Check Superset logs for extension-related messages
4. Verify bundle integrity: `unzip -l extension.supx`
