import json
from flask import current_app, Flask, g, Request, request, flash, redirect

def lambda_handler(event, context):
    # Replace 'https://example.com' with your desired URL
    redirect_url = 'https://dr.eka.care'
    token = request.headers.get("jwt-payload")
    if token and isinstance(token, str):
        token = json.loads(token)
        doc_id = token.get("doc-id", "")
    if token and doc_id:
        # redirect forward to dr superset

    else:
        # redirect to login on dr.eka.care
        return {
            'statusCode': 302,
            'headers': {
                'Location': redirect_url,
            },
            'body': 'Redirecting to ' + redirect_url,
        }
