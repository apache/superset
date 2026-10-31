# Superset configuration file - generated for security hardening
# Run: openssl rand -base64 42 to generate strong random values

# Main SECRET_KEY for Flask sessions
SECRET_KEY="quOaBLgg9tA+qaa1NYxMBpSLiztU2W1JVVj9O1/KwgiZgqkgdlr1EexJ"

# WebSocket JWT secret - must be >= 32 bytes for production
WEBSOCKET_JWT_SECRET="quOaBLgg9tA+qaa1NYxMBpSLiztU2W1JVVj9O1/KwgiZgqkgdlr1EexJ"

# Guest token JWT secret - must be changed from default when EMBEDDED_SUPERSET is enabled
GUEST_TOKEN_JWT_SECRET="quOaBLgg9tA+qaa1NYxMBpSLiztU2W1JVVj9O1/KwgiZgqkgdlr1EexJ"

# Optional: override with environment variables if preferred
# SUPERSET_SECRET_KEY="${SUPERSET_SECRET_KEY}"
# WEBSOCKET_JWT_SECRET="${WEBSOCKET_JWT_SECRET}"
# GUEST_TOKEN_JWT_SECRET="${GUEST_TOKEN_JWT_SECRET}"