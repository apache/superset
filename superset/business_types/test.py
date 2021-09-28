import requests
from bs4 import BeautifulSoup

s = requests.Session()
login_form = s.get("http://localhost:9000/login/")
soup = BeautifulSoup(login_form.text, 'html.parser')
csrf_token = soup.find('input', {'id': 'csrf_token'})['value']

s.post('http://localhost:9000/login/',data=dict(username='admin', password='admin', csrf_token=csrf_token))
resp = s.get('http://localhost:9000/api/v1/business_type')
print(resp)
print(str(resp.content))
