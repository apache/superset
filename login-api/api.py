import flask
from flask import request, jsonify

app = flask.Flask(__name__)
app.config["DEBUG"] = True
users = [
    {"token": "a", "user_info": {"username": "karen"}},
    {
        "token": "b",
        "user_info": {
            "username": "test1",
            "first_name": "nombre",
            "last_name": "apellido",
            "email": "email",
        },
    },
    {
        "token": "c",
        "user_info": {
            "username": "test3",
            "first_name": "nombre3",
            "last_name": "apellido3",
            "email": "email3",
        },
    },
    {
        "token": "d",
        "user_info": {
            "username": "testd",
            "first_name": "nombre3",
            "last_name": "apellido3",
            "email": "email3",
        },
    },
]


@app.route("/", methods=["GET"])
def home():
    token = request.args.get("token")

    if token is not None:
        search = list(filter(lambda person: person["token"] == token, users))
        if search != []:
            user_info = search[0]["user_info"]
            print(user_info)
            return jsonify(user_info)

    return jsonify(None)


app.run()
