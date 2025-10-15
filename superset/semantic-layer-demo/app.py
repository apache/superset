"""
Flask application demonstrating dynamic form generation.

This server provides endpoints to:
1. Get the initial configuration schema
2. Get an updated configuration schema based on partial configuration
3. Get the runtime schema based on full configuration
"""

from __future__ import annotations

import json

from flask import Flask, jsonify, make_response, render_template, request
from flask_cors import CORS
from models import (
    get_configuration_schema,
    get_runtime_schema,
    SnowflakeConfiguration,
)
from pydantic import ValidationError

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False  # Preserve key order from Pydantic
CORS(app)  # Enable CORS for development


def json_response(data, status=200):
    """
    Return JSON response with preserved key order.

    Flask's jsonify() may sort keys even with JSON_SORT_KEYS=False,
    so we use json.dumps() directly with sort_keys=False.
    """
    response = make_response(json.dumps(data, sort_keys=False), status)
    response.headers['Content-Type'] = 'application/json'
    return response


@app.route("/")
def index():
    """Serve the main page."""
    return render_template("index.html")


@app.route("/api/schema/configuration", methods=["GET"])
def get_initial_configuration_schema():
    """
    Get the initial configuration schema with empty dynamic fields.
    """
    schema = get_configuration_schema(configuration=None)
    return json_response(schema)


@app.route("/api/schema/configuration", methods=["POST"])
def get_updated_configuration_schema():
    """
    Get an updated configuration schema based on partial configuration.

    The frontend sends the current form data, and we return an enriched schema
    with options for dynamic fields whose dependencies are satisfied.
    """
    try:
        # Get the partial configuration from request
        data = request.json or {}

        # Try to validate it (will fail if required fields are missing, but that's ok)
        try:
            configuration = SnowflakeConfiguration.model_validate(data)
        except ValidationError:
            # Partial validation - create a configuration with available fields
            # We'll use construct to bypass validation
            configuration = SnowflakeConfiguration.model_construct(**data)

        # Get the enriched schema
        schema = get_configuration_schema(configuration=configuration)
        return json_response(schema)

    except Exception as e:
        return json_response({"error": str(e)}, 400)


@app.route("/api/schema/runtime", methods=["POST"])
def get_runtime_schema_endpoint():
    """
    Get the runtime schema based on a configuration and optional runtime data.

    This is called:
    1. Initially after the user has completed the configuration form
    2. When runtime data changes (e.g., database selected) to get updated schema

    Request body should contain:
    - configuration: The full configuration object
    - runtime_data: (optional) The current runtime data for dynamic updates
    """
    try:
        data = request.json or {}

        # Extract configuration and runtime data
        if "configuration" in data:
            # New format: separate configuration and runtime_data
            config_data = data["configuration"]
            runtime_data = data.get("runtime_data")
        else:
            # Legacy format: just configuration
            config_data = data
            runtime_data = None

        configuration = SnowflakeConfiguration.model_validate(config_data)
        schema = get_runtime_schema(configuration, runtime_data)
        return json_response(schema)

    except ValidationError as e:
        return json_response({"error": "Invalid configuration", "details": e.errors()}, 400)
    except Exception as e:
        return json_response({"error": str(e)}, 500)


@app.route("/api/validate/configuration", methods=["POST"])
def validate_configuration():
    """
    Validate a configuration and return any errors.
    """
    try:
        data = request.json or {}
        configuration = SnowflakeConfiguration.model_validate(data)
        return json_response({"valid": True, "data": configuration.model_dump(mode="json")})

    except ValidationError as e:
        return json_response({"valid": False, "errors": e.errors()}, 400)


if __name__ == "__main__":
    print("Starting demo server...")
    print("Open http://localhost:5001 in your browser")
    app.run(debug=True, port=5001)
