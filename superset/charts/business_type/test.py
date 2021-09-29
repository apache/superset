import requests
from bs4 import BeautifulSoup

s = requests.Session()
login_form = s.get("http://localhost:8088/login/")
soup = BeautifulSoup(login_form.text, 'html.parser')
csrf_token = soup.find('input', {'id': 'csrf_token'})['value']

s.post('http://localhost:8088/login/',data=dict(username='admin', password='admin', csrf_token=csrf_token))
resp = s.get('http://localhost:8088/api/v1/business_type/checkport/80')
print(resp.text)
