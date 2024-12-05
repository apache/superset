import logging
import requests
import json

logger = logging.getLogger(__name__)

def make_request(uri, method, headers=None, data=None):
    try:
        if method == "POST":
            response = requests.post(uri, headers=headers, json=data)
        else:
            response = requests.get(uri, headers=headers)
        response.raise_for_status()
        return response.text
    except requests.exceptions.RequestException as e:
        return f"Error: {str(e)}"

def get_api_token():
    uri = "https://reports.bi.numerator.cloud/api/token/"
    data = {'username': 'spotfire_maestro_image', 'password': 'BAQN0I8LbF70it#,7^(?'}
    response = make_request(uri, "POST", data=data)
    try:
        response_json = json.loads(response)
        logger.warning(f"*#*#*** in the get api token {response_json}", exc_info=True)
        #print('*#*#*** in the get api token')
        # Check if 'access' is in the response, else return the full error message
        if 'access' in response_json:
            return response_json['access']
        else:
            return f"Error: {response_json.get('detail', 'Failed to retrieve access token')}"
    
    except json.JSONDecodeError:
        # Handle cases where response is not JSON
        return f"Error: Unexpected response format: {response}"
    except Exception as e:
        # Catch any other unexpected errors
        return f"Error: {str(e)}"

def get_presigned_url(token, urls):
    uri = "https://reports.bi.numerator.cloud/get-presigned-urls/"
    headers = {"Authorization": f"Bearer {token}"}
    data = {"s3_urls": urls}
    return make_request(uri, "POST", headers=headers, data=data)

def get_image_func(image_links):
    #print('*#*#*** duck duck in the get api token')
    logger.warning("*#*#*** duck duck in the get api token", exc_info=True)
    token = get_api_token()
    if image_links != '(Empty)' and ("key" in image_links):
        val3temp = []
        for val33 in json.loads(image_links.replace("[\"{","[{").replace("}\"]", "}]").replace("}\",\"{", "},{")):
            val3temp.append('https://s3.amazonaws.com/'+val33["bucket"]+'/'+val33["key"])
        image_links1 = val3temp
    elif image_links!='(Empty)':
    	image_links1 = json.loads(image_links)
    else:
    	image_links1 = {}
    logger.warning(f"*#*#*** in the get image {image_links1}", exc_info=True)
    if "Error" not in token:
        urls_response = get_presigned_url(token, image_links1)
        logger.warning(f"*#*#*** in the get_presigned_url response {urls_response}", exc_info=True)
        try:
            presigned_urls = json.loads(urls_response)['presigned_urls']
            return json.dumps(presigned_urls)
        except KeyError:
            return ''
    return ''
