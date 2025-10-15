# Dynamic Schema Demo - Snowflake Configuration

This is a self-contained demo showing how to build dynamic forms using Pydantic, OpenAPI/JSON Schema, and JSONForms. It demonstrates the pattern used in `superset/semantic_layers/snowflake_.py` for dynamic configuration forms.

## Key Features

- **Dynamic Fields**: Fields marked with `x-dynamic: true` in the JSON schema
- **Dependencies**: Fields specify their dependencies via `x-dependsOn`
- **Automatic Updates**: When dependencies are satisfied, the backend is queried for updated schema with actual options
- **Real Snowflake Integration**: Connects to actual Snowflake accounts to fetch databases and schemas

## How It Works

1. **Initial Schema**: The frontend loads an initial schema with empty dynamic fields
2. **User Input**: As the user fills in the form (e.g., account identifier and auth)
3. **Dependency Check**: Frontend detects when dependencies are satisfied
4. **Schema Update**: Frontend sends current data to backend
5. **Enriched Schema**: Backend returns updated schema with actual options (e.g., list of databases)
6. **Form Refresh**: Form updates to show the new dropdown options

## Project Structure

```
semantic-layer-demo/
├── app.py                 # Flask server with API endpoints
├── models.py              # Pydantic models with dynamic schema logic
├── templates/
│   └── index.html         # Frontend with JSONForms integration
├── requirements.txt       # Python dependencies
└── README.md             # This file
```

## Setup

1. Install dependencies:

```bash
cd superset/semantic-layer-demo
pip install -r requirements.txt
```

2. Run the server:

```bash
python app.py
```

3. Open your browser to http://localhost:5001

## Usage

### Configuration Form

1. **Account Identifier**: Enter your Snowflake account identifier (e.g., `abc12345` or `orgname-accountname`)
2. **Role** (optional): Enter a role name as freeform text
3. **Warehouse** (optional): Enter a warehouse name as freeform text
4. **Authentication**: Select either "Username and password" or "Private key" from the dropdown, then fill in credentials
5. **Database**: Once account and auth are provided, this dropdown will **automatically populate** with your real Snowflake databases
6. **Schema**: Once database is selected, this dropdown will **automatically populate** with schemas in that database

### Real Snowflake Integration

The demo connects to your Snowflake account using:
- `SHOW DATABASES` - to fetch available databases
- `INFORMATION_SCHEMA.SCHEMATA` - to fetch schemas for a selected database

The dynamic schema refresh happens automatically when you fill in the required fields!

### Runtime Form

After completing the configuration form:

1. Click "Get Runtime Schema" button
2. The runtime form appears on the right side
3. Shows fields that need to be provided at runtime (database/schema if not specified in config or if changing is allowed)

**Dynamic Runtime Schema:**
If you didn't specify a database/schema in the configuration (or allowed changing them), the runtime form will be dynamic:
- First, you'll see a database dropdown (populated from your Snowflake account)
- After selecting a database, the **schema dropdown will automatically populate** with schemas from that database
- This uses the same dynamic schema pattern as the configuration form!

## API Endpoints

### GET /api/schema/configuration

Returns the initial configuration schema with empty dynamic fields.

### POST /api/schema/configuration

Send partial configuration data to get an enriched schema with populated dynamic fields.

**Request Body:**
```json
{
  "account_identifier": "abc12345",
  "auth": {
    "auth_type": "user_password",
    "username": "myuser",
    "password": "mypass"
  }
}
```

**Response:**
```json
{
  "properties": {
    "database": {
      "enum": ["SAMPLE_DATA", "PRODUCTION", "ANALYTICS", "DEV"],
      "x-dynamic": true,
      "x-dependsOn": ["account_identifier", "auth"]
    },
    ...
  }
}
```

### POST /api/schema/runtime

Get the runtime schema based on configuration and optional runtime data.

**Request Body (Initial):**
```json
{
  "configuration": {
    "account_identifier": "abc12345",
    "auth": { ... },
    "allow_changing_database": true,
    "allow_changing_schema": true
  },
  "runtime_data": null
}
```

**Response (Initial):**
```json
{
  "properties": {
    "database": {
      "enum": ["SAMPLE_DATA", "PRODUCTION", ...],
      "type": "string"
    },
    "schema": {
      "enum": [],
      "type": "string",
      "x-dynamic": true,
      "x-dependsOn": ["database"]
    }
  }
}
```

**Request Body (After database selected):**
```json
{
  "configuration": { ... },
  "runtime_data": {
    "database": "SAMPLE_DATA"
  }
}
```

**Response (Updated):**
```json
{
  "properties": {
    "database": {
      "enum": ["SAMPLE_DATA", "PRODUCTION", ...],
      "type": "string"
    },
    "schema": {
      "enum": ["PUBLIC", "TPCDS_SF10TCL", "INFORMATION_SCHEMA"],
      "type": "string",
      "x-dynamic": true,
      "x-dependsOn": ["database"]
    }
  }
}
```

## Implementation Details

### Custom JSON Schema Fields

The demo uses custom JSON schema extensions:

- `x-dynamic`: Boolean flag indicating this field's options are fetched dynamically
- `x-dependsOn`: Array of field names that must be filled before this field can be populated

Example from `models.py`:

```python
database: str | None = Field(
    default=None,
    description="The default database to use.",
    json_schema_extra={
        "examples": ["testdb"],
        "x-dynamic": True,
        "x-dependsOn": ["account_identifier", "auth"],
    },
)
```

### Frontend Logic

The frontend (`index.html`) implements:

1. **Dependency Tracking**: Parses `x-dependsOn` from schema
2. **Change Detection**: Debounced onChange handler (500ms)
3. **Dependency Satisfaction Check**: Validates all dependencies have non-empty values
4. **Schema Refresh**: Fetches updated schema and re-renders form

### Backend Logic

The backend (`app.py` and `models.py`) implements:

1. **Partial Validation**: Accepts incomplete configurations using `model_construct()`
2. **Dependency Checking**: Uses `getattr()` to check if dependencies are satisfied
3. **Option Fetching**: Connects to Snowflake and runs queries to fetch databases and schemas
4. **Schema Enrichment**: Updates `enum` fields in the schema with actual options from Snowflake

## Production Considerations

To use this pattern in production:

1. Add connection pooling for better performance
2. Add better error handling and user feedback for connection failures
3. Add authentication/authorization for the API endpoints
4. Consider caching schema results to reduce database queries
5. Add rate limiting to prevent excessive Snowflake queries

## Related Files

This demo is based on the pattern in:
- `superset/semantic_layers/snowflake_.py` - Full Snowflake semantic layer implementation

## License

This demo is part of Apache Superset and follows the same license.
