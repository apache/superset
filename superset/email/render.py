"""
Runs render.js as a bash command. Defines user credentials and formats the output file name
"""

import os
from compose import Email
import datetime



def format_request(endpoint,
                   username,
                   password,
                   filename):

    return 'phantomjs render.js {endpoint} {username} {password} {filename}'.format(
                                                                        endpoint=endpoint,
                                                                        username=username,
                                                                        password=password,
                                                                        filename=filename)

def render_dash(command):
    try:
        os.system(command)
        print('Dashboard rendered successfully')
    except Exception as e:
        print('Error rendering dash')
        print(e)
        pass

def gen_filename(base_name):
    date = str(datetime.datetime.now()).split(' ')[0]
    return base_name+date




