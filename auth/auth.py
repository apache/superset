import json

def lambda_handler(event, context):
    # Replace 'https://example.com' with your desired URL
    redirect_url = 'https://dr.eka.care'
    
    return {
        'statusCode': 302,
        'headers': {
            'Location': redirect_url,
        },
        'body': 'Redirecting to ' + redirect_url,
    }
