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
