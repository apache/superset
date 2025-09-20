/**
 * Apache Superset MCP Server
 *
 * Entry point for the MCP server when used as a Node.js module.
 */

const { spawn } = require('child_process');
const path = require('path');

class SupersetMCPServer {
    constructor(options = {}) {
        this.options = {
            transport: options.transport || 'http',
            host: options.host || '127.0.0.1',
            port: options.port || 5008,
            debug: options.debug || false,
            pythonPath: options.pythonPath || null,
            supersetRoot: options.supersetRoot || null,
            configPath: options.configPath || null,
        };
        this.process = null;
    }

    start() {
        const runner = require('./bin/superset-mcp.js');
        // The bin script handles the execution
    }

    stop() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }
}

module.exports = SupersetMCPServer;
