import requests
from superset.superset_config import USER_NAME, USER_PASSWORD, FIRST_NAME, LAST_NAME, \
    BASE_URL
from superset.custom.custom_logger import get_logger

logger = get_logger(__name__)

def fetch_access_token():
    url = f'{BASE_URL}/api/v1/security/login'
    login_payload = {
        'username': USER_NAME,
        'password': USER_PASSWORD,
        'provider': 'db',
        'refresh': True
    }
    try:
        response = requests.post(url, json=login_payload)
        logger.info(f"Fetching Access-Token.... Status : {response.status_code}")
        if response.status_code == 200:
            return response.json().get('access_token')
        else:
            return False
    except requests.exceptions.RequestException as e:
        logger.error(f"Error occur while fetching access-token is : {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Exception Caught While Calling fetch_access_token API : {e}")
        return False

def fetch_guest_token(dashboard_id=None):
    access_token = fetch_access_token()
    url = f'{BASE_URL}/api/v1/security/guest_token'
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        "accept": "application/json"
    }
    reso = [{"type": "dashboard","id": dashboard_id}] if dashboard_id is not None else []
    token_payload = {
        "user": {
            "username": USER_NAME,
            "first_name": FIRST_NAME,
            "last_name": LAST_NAME,
        },
        "resources": reso,
        "rls": []
    }
    try:
        response = requests.post(url, headers=headers, json=token_payload)
        logger.info(f"Fetching Guest-Token... Status : {response.status_code}")
        if response.status_code == 200:
            return response.json().get("token")
        else:
            return False
    except requests.exceptions.RequestException as e:
        logger.error(f"Error Occur While Fetching Guest-Token is : {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Exception Caught While Calling fetch_guest_token API : {e}")
        return False




