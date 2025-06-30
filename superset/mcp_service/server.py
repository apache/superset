# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

"""Standalone server for the Model Context Protocol (MCP) service"""
import logging
import os
import threading
import time
from typing import Optional

import werkzeug.serving
from flask import Flask

from superset.app import SupersetApp
from superset.extensions import csrf, db
from superset.mcp_service.api import init_app

# Global Flask app instance
_app = None

def create_app(config_module: Optional[str] = None) -> Flask:
    """Create and configure the Flask application for MCP service"""
    global _app
    
    app = SupersetApp(__name__)
    
    # Load configuration
    config_module = config_module or os.environ.get("SUPERSET_CONFIG", "superset.config")
    app.config.from_object(config_module)
    
    # Configure security settings
    app.config.setdefault("AUTH_ROLE_ADMIN", "Admin")
    app.config.setdefault("AUTH_ROLE_PUBLIC", "Public")
    app.config.setdefault("AUTH_TYPE", "AUTH_DB")
    app.config.setdefault("SECRET_KEY", "your-secret-key-here")
    
    # Initialize extensions
    db.init_app(app)
    csrf.init_app(app)
    init_app(app)
    
    _app = app
    return app

def start_fastmcp(host: str, port: int) -> None:
    """Start FastMCP server in background thread"""
    env_key = f"FASTMCP_RUNNING_{port}"
    
    if os.environ.get(env_key):
        print(f"FastMCP already running on {host}:{port}")
        return
    
    os.environ[env_key] = "1"
    
    def run_fastmcp():
        try:
            print(f"Starting FastMCP on {host}:{port}")
            from superset.mcp_service.fastmcp_server import mcp
            mcp.run(transport="streamable-http", host=host, port=port)
        except Exception as e:
            print(f"FastMCP failed: {e}")
            os.environ.pop(env_key, None)
    
    thread = threading.Thread(target=run_fastmcp, daemon=True)
    thread.start()
    time.sleep(0.5)

def configure_logging(debug: bool) -> None:
    """Configure logging based on debug mode"""
    if debug or os.environ.get("SQLALCHEMY_DEBUG"):
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        for logger_name in ['sqlalchemy.engine', 'sqlalchemy.pool', 'sqlalchemy.dialects']:
            logging.getLogger(logger_name).setLevel(logging.INFO)
        
        print("🔍 SQL Debug logging enabled")

def run_server(host: str = "0.0.0.0", port: int = 5008, debug: bool = False) -> None:
    """Run the MCP service server"""
    configure_logging(debug)
    
    print(f"Creating MCP app...")
    app = create_app()
    
    # Start FastMCP on next port
    fastmcp_port = port + 1
    start_fastmcp(host, fastmcp_port)
    
    api_key = app.config.get("MCP_API_KEY", "your-secret-api-key-here")
    print(f"🚀 MCP Service starting on {host}:{port}")
    print(f"📡 FastMCP server on {host}:{fastmcp_port}")
    print(f"🔑 API Key: {api_key}")
    
    werkzeug.serving.run_simple(
        hostname=host,
        port=port,
        application=app,
        use_reloader=False,
        use_debugger=debug,
        threaded=True
    )

def get_app() -> Optional[Flask]:
    """Get the shared Flask app instance"""
    return _app

if __name__ == "__main__":
    run_server() 
