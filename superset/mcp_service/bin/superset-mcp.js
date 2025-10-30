#!/usr/bin/env node

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Apache Superset MCP (Model Context Protocol) Server Runner
 *
 * OVERVIEW:
 * This Node.js wrapper script provides an npx-compatible entry point for the Superset MCP service.
 * It acts as a bridge between npm/npx tooling and the Python-based MCP server implementation.
 *
 * FUNCTIONALITY:
 * - Detects and validates Python environment and Superset installation
 * - Supports both stdio (Claude Desktop integration) and HTTP transport modes
 * - Handles command-line argument parsing and environment variable configuration
 * - Manages Python subprocess lifecycle with proper signal handling
 * - Provides comprehensive help documentation and error diagnostics
 *
 * USAGE PATTERNS (DEVELOPMENT - Not yet published to npm):
 * - Direct execution: node superset/mcp_service/bin/superset-mcp.js --stdio
 * - HTTP server: node superset/mcp_service/bin/superset-mcp.js --http --port 6000
 * - Development debugging: node superset/mcp_service/bin/superset-mcp.js --debug
 *
 * FUTURE USAGE (Once published to npm registry):
 * - npx @superset/mcp-server --stdio
 * - npx @superset/mcp-server --http --port 6000
 *
 * ARCHITECTURE:
 * This wrapper enables the MCP service to be distributed as an npm package while
 * maintaining the core Python implementation, bridging Node.js tooling with Python execution.
 *
 * PACKAGE STATUS (as of 2025-01-10):
 * - NOT YET PUBLISHED to npm registry
 * - Package name reserved: @superset/mcp-server
 * - Requires package.json with proper metadata and "bin" field for npx execution
 * - Will need to be published to npm registry before npx commands work
 *
 * TODO FOR NPM PUBLISHING:
 * 1. Create package.json with name "@superset/mcp-server"
 * 2. Add "bin" field pointing to this file
 * 3. Set version, description, repository, license
 * 4. Run npm publish with appropriate access rights
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const isStdio = args.includes('--stdio') || process.env.FASTMCP_TRANSPORT === 'stdio';
const isDebug = args.includes('--debug') || process.env.MCP_DEBUG === '1';
const showHelp = args.includes('--help') || args.includes('-h');

// Configuration
const DEFAULT_PORT = process.env.MCP_PORT || '5008';
const DEFAULT_HOST = process.env.MCP_HOST || '127.0.0.1';

// Show help
if (showHelp) {
    console.log(`
Apache Superset MCP Server

Usage:
  Development: node superset/mcp_service/bin/superset-mcp.js [options]
  Future (npm): npx @superset/mcp-server [options]

Options:
  --stdio       Run in stdio mode for direct Claude Desktop integration
  --http        Run in HTTP mode (default)
  --port PORT   HTTP port to bind to (default: ${DEFAULT_PORT})
  --host HOST   HTTP host to bind to (default: ${DEFAULT_HOST})
  --debug       Enable debug mode
  --help        Show this help message

Environment Variables:
  FASTMCP_TRANSPORT     Transport mode (stdio or http)
  MCP_PORT              HTTP port (default: ${DEFAULT_PORT})
  MCP_HOST              HTTP host (default: ${DEFAULT_HOST})
  MCP_DEBUG             Enable debug (set to 1)
  PYTHONPATH            Python path including Superset root
  SUPERSET_CONFIG_PATH  Path to superset_config.py

Examples (Development):
  # Run in stdio mode for Claude Desktop
  node superset/mcp_service/bin/superset-mcp.js --stdio

  # Run in HTTP mode on custom port
  node superset/mcp_service/bin/superset-mcp.js --http --port 6000

  # Run with debug output
  node superset/mcp_service/bin/superset-mcp.js --debug

  # Or use the Python CLI directly:
  superset mcp run --host 127.0.0.1 --port 6000
`);
    process.exit(0);
}

// Find Superset root directory
function findSupersetRoot() {
    // Start from the mcp_service directory
    let currentDir = path.resolve(__dirname, '..');

    // Walk up until we find the superset root (contains setup.py or pyproject.toml)
    while (currentDir !== path.dirname(currentDir)) {
        if (fs.existsSync(path.join(currentDir, 'pyproject.toml')) ||
            fs.existsSync(path.join(currentDir, 'setup.py'))) {
            // Check if it's actually the superset root (has superset directory)
            if (fs.existsSync(path.join(currentDir, 'superset'))) {
                return currentDir;
            }
        }
        currentDir = path.dirname(currentDir);
    }

    // Fallback to environment variable
    if (process.env.PYTHONPATH) {
        return process.env.PYTHONPATH;
    }

    throw new Error('Could not find Superset root directory. Please set PYTHONPATH environment variable.');
}

// Find Python executable
function findPython() {
    // Check for virtual environment in common locations
    const supersetRoot = findSupersetRoot();
    const venvPaths = [
        path.join(supersetRoot, 'venv', 'bin', 'python'),
        path.join(supersetRoot, '.venv', 'bin', 'python'),
        path.join(supersetRoot, 'venv', 'Scripts', 'python.exe'),
        path.join(supersetRoot, '.venv', 'Scripts', 'python.exe'),
    ];

    for (const venvPath of venvPaths) {
        if (fs.existsSync(venvPath)) {
            return venvPath;
        }
    }

    // Check if python3 is available
    try {
        execSync('python3 --version', { stdio: 'ignore' });
        return 'python3';
    } catch (e) {
        // Fall back to python
        return 'python';
    }
}

// Check Python and Superset installation
function checkEnvironment() {
    const python = findPython();
    const supersetRoot = findSupersetRoot();

        console.error(`Using Python: ${python}`);
        console.error(`Superset root: ${supersetRoot}`);

    // Check if Superset is installed
    try {
        execSync(`${python} -c "import superset"`, {
            env: { ...process.env, PYTHONPATH: supersetRoot },
            stdio: 'ignore'
        });
    } catch (e) {
        console.error(`
Error: Superset is not installed or not accessible.

Please ensure:
1. You have activated your virtual environment
2. Superset is installed (pip install -e .)
3. PYTHONPATH is set correctly

Current PYTHONPATH: ${supersetRoot}
`);
        process.exit(1);
    }

    return { python, supersetRoot };
}

// Main execution
function main() {
    const { python, supersetRoot } = checkEnvironment();

    // Prepare environment variables
    const env = {
        ...process.env,
        PYTHONPATH: supersetRoot,
        FASTMCP_TRANSPORT: isStdio ? 'stdio' : 'http',
    };

    if (!env.SUPERSET_CONFIG_PATH) {
        const configPath = path.join(supersetRoot, 'superset_config.py');
        if (fs.existsSync(configPath)) {
            env.SUPERSET_CONFIG_PATH = configPath;
        }
    }

    if (isDebug) {
        env.MCP_DEBUG = '1';
    }

    // Prepare command and arguments
    let pythonArgs;
    if (isStdio) {
        console.error('Starting Superset MCP server in STDIO mode...');
        pythonArgs = ['-m', 'superset.mcp_service'];
    } else {
        console.error(`Starting Superset MCP server in HTTP mode on ${DEFAULT_HOST}:${DEFAULT_PORT}...`);

        // Parse port and host from arguments
        const portIndex = args.indexOf('--port');
        const port = portIndex !== -1 && args[portIndex + 1] ? args[portIndex + 1] : DEFAULT_PORT;

        const hostIndex = args.indexOf('--host');
        const host = hostIndex !== -1 && args[hostIndex + 1] ? args[hostIndex + 1] : DEFAULT_HOST;

        pythonArgs = [
            '-m', 'superset',
            'mcp', 'run',
            '--host', host,
            '--port', port
        ];

        if (isDebug) {
            pythonArgs.push('--debug');
        }
    }

    // Spawn the Python process
    const pythonProcess = spawn(python, pythonArgs, {
        env,
        stdio: isStdio ? ['inherit', 'inherit', 'inherit'] : 'inherit',
        cwd: supersetRoot
    });

    // Handle process events
    pythonProcess.on('error', (err) => {
        console.error('Failed to start MCP server:', err);
        process.exit(1);
    });

    pythonProcess.on('exit', (code, signal) => {
        if (signal) {
            console.error(`MCP server terminated by signal: ${signal}`);
        } else if (code !== 0) {
            console.error(`MCP server exited with code: ${code}`);
        }
        process.exit(code || 0);
    });

    // Handle termination signals
    process.on('SIGINT', () => {
        pythonProcess.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
        pythonProcess.kill('SIGTERM');
    });
}

// Run the main function
main();
