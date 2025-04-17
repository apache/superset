from flask import Flask, jsonify
import jwt
import time

app = Flask(__name__)

@app.route('/api/guest-token')
def get_guest_token():
    payload = {
        "user": {
            "username": "guest-user",
            "roles": ["Public"]
        },
        "resources": [
            {"type": "dashboard", "id": "PUT-YOUR-DASHBOARD-UUID-HERE"}
        ],
        "exp": int(time.time()) + 60 * 60  # 1 hour expiry
    }

    secret_key = "PUT-YOUR-SUPERSET-SECRET-KEY-HERE"
    token = jwt.encode(payload, secret_key, algorithm="HS256")

    return jsonify({"token": token})

if __name__ == "__main__":
    app.run(port=5000)
