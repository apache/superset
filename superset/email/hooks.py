"""
Class to create a hook into SuperX
It will simply login and generate a session_id that can be passed
The session_id holds permissions for the particular user
Logout method available to terminate the session

Usage: initialize hook with appropriate credentials
       pass hook (externally) to additional methods to retrieve necessary data
       call hook.logout() to terminate the session
"""

# HTTP modules
import requests
from bs4 import BeautifulSoup



BASE_URL = 'http://localhost:8088/'


class SupersetHook:

    def __init__(self, username=None, password=None):
        self.session = requests.Session()
        self.csrf_token = None
        self.username = username
        self.password = password
        self._login()

    def _login(self):
        endpoint = 'login/'
        resp = self.send_request(method='GET', endpoint=endpoint)

        soup = BeautifulSoup(resp.content, 'html.parser')
        self.csrf_token = soup.find('input', {"id": "csrf_token"})['value']

        credentials = {'username': self.username, 'password': self.password, 'csrf_token': self.csrf_token}
        self.send_request(endpoint=endpoint, payload=credentials)
        self.auth = {'Cookie': 'session='+self.session.cookies.items()[0][1]}
        self.data = {'csrf_token': self.csrf_token}

    def logout(self):
        try:
            endpoint = 'logout/'
            self.send_request(method='GET', endpoint=endpoint)
            # self.session.get(BASE_URL+endpoint)
            print('\nSUCCESSFULLY LOGGED OUT')
        except:
            print('\nERROR LOGGING OUT')

    def send_request(self, method='POST', endpoint='', payload=None, headers=None, params=None):
        if method == 'POST':
            response = self.session.post(BASE_URL+endpoint, data=payload, headers=headers, params=params)
        elif method == 'GET':
            response = self.session.get(BASE_URL+endpoint, data=payload, headers=headers, params=params)
        else:
            response = None
        return response


s = SupersetHook(username='user', password='password')
s.logout()


