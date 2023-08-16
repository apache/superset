import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import io
from datetime import datetime
import requests
import pandas as pd
import json
import mysql.connector
from mysql.connector import Error
import sqlite3
from superset.custom.email_scheduler.token_api import fetch_guest_token, fetch_access_token

from superset.custom.custom_logger import get_logger

logger = get_logger(__name__)

def writeFileToMemory(file_data):
    try:
        df = pd.DataFrame(file_data)
        buffer = io.BytesIO()
        file_format = "csv"
        if file_format.lower() == 'excel':
            df.to_excel(buffer, index=False)
        else:
            df.to_csv(buffer, index=False)
        buffer.seek(0)
        logger.info("Report File is Successfully created...")
        return buffer, "csv"
    except Exception as e:
        logger.error(f"Exception occur while creating report file is : {str(e)}")
        return False, "csv"

def send_email(subject: str, app_password: str, mail_body: str, sender_email: str,
              recipient_emails: list[str]) -> bool:
    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = ', '.join(x for x in recipient_emails)
    msg['Subject'] = subject

    msg.attach(MIMEText(mail_body, 'plain'))
    try:
        sender_password = app_password
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
        logger.info(f"Email sent successfully to recipients: {recipient_emails}")
        return True
    except Exception as e:
        logger.error(f"Exception occur while sending email using send_email function, error: {str(e)}")
        return False

#
# def accessToken(user, password) -> str:
#     url = f'{BASE_URL}/api/v1/security/login'
#     login_payload = {
#         'username': user,
#         'password': password,
#         'provider': 'db',
#         'refresh': True
#     }
#     try:
#         response = requests.post(url, json=login_payload)
#         if response.status_code == 200:
#             return response.json().get('access_token')
#         else:
#             return False
#     except requests.exceptions.RequestException as e:
#         print(str(e))
#         return False

#
# def guestToken(user, first_name, last_name, resources):
#     access_token = accessToken(user=USER_NAME, password=USER_PASSWORD)
#     if not access_token:
#         return "Failed to generate access token"
#     url = f'{BASE_URL}/api/v1/security/guest_token'
#     headers = {
#         'Authorization': f'Bearer {access_token}',
#         'Content-Type': 'application/json',
#         "accept": "application/json"
#     }
#     token_payload = {
#         "user": {
#             "username": user,
#             "first_name": first_name,
#             "last_name": last_name,
#         },
#         "resources": resources,
#         "rls": []
#     }
#     try:
#         response = requests.post(url, headers=headers, json=token_payload)
#         if response.status_code == 200:
#             return response.json().get("token")
#         else:
#             return False
#     except requests.exceptions.RequestException as e:
#         print(str(e))
#         return False


def getReportData(explore_data, user_uuid, slice_id):

    token = fetch_guest_token()
    url = f"http://127.0.0.1:8088/api/v1/chart/data?slice_id={slice_id}&user_uuid={user_uuid}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "Cookie": "session=eyJfZnJlc2giOmZhbHNlLCJsb2NhbGUiOiJlbiJ9.ZL-jXA.0OWn5gcERLXY3La-l6qEciGOPL8"
    }
    try:
        id = 0
        type = ""
        granularity = ""
        time_grain_sqla = ""
        form_data = []
        all_columns = []
        url_params = {}

        if explore_data.get("result"):
            result = explore_data.get("result")
            dataset = result.get("dataset")
            id = dataset.get("id")
            type = dataset.get("type")
            form_data = result.get("form_data")
            form_data["user_uuid"] = user_uuid
            all_columns = form_data.get("all_columns")
            granularity = form_data.get("granularity_sqla")
            url_params = form_data.get("url_params")
            time_grain_sqla = form_data.get("time_grain_sqla")

        data = {
            "datasource": {
                "id": id,
                "type": type
            },
            "force": "false",
            "queries": [
                {
                    "time_range": "No filter",
                    "granularity": granularity,
                    "filters": [],
                    "extras": {
                        "time_grain_sqla": time_grain_sqla,
                        "having": "",
                        "where": ""
                    },
                    "applied_time_extras": {},
                    "columns": all_columns,
                    "orderby": [],
                    "annotation_layers": [],
                    "row_limit": 1000,
                    "series_limit": 0,
                    "order_desc": "true",
                    "url_params": url_params,
                    "custom_params": {},
                    "custom_form_data": {},
                    "post_processing": []
                }
            ],
            "form_data": form_data,
            "result_format": "json",
            "result_type": "full"
        }

        try:
            response = requests.post(url, headers=headers, json=data)
            logger.info(f"Report Data Fetching.. Status: {response.status_code}")
            if response.status_code == 200:
                json_data = response.json()
                return json_data
            else:
                return False

        except requests.exceptions.RequestException as e:
            logger.error(f"Error While Calling {url}, error is : {str(e)}")
            return False
    except Exception as p:
        logger.error(f"Exception Occur While Calling getReportData function internally, Execption : {str(e)}")
        return False

def parse_json_data(data):

    try:
        data = json.dumps(data)
        result_dict = json.loads(data)
        if "result" in result_dict:
            result = result_dict.get("result")
            result = result[0]
            for key, val in result.items():
                if key == "data":
                    if len(val) != 0:
                        return val
                        logger.info(f" columns data successfully fetched : {val}")
                    else:
                        return  None
    except Exception as e:
        logger.error(f"Exception occur while parsing data from the data: {data}, Error is : {str(e)}")
        return None


def getExploreChartColumn(slice_id, user_uuid):

    access_token = fetch_access_token()
    url = f"http://127.0.0.1:8088/api/v1/explore/?slice_id={slice_id}&user_uuid={user_uuid}"
    headers = {
        "Authorization": f"Bearer {access_token}",
    }
    try:
        response = requests.get(url, headers=headers, json={"form_data":{"slice_id":f"{slice_id}", "user_uuid":f"{user_uuid}"}})
        logger.info(f"Start Calling.. fetching report columns against slice_id={slice_id} & user_uuid={user_uuid}")
        if response.status_code == 200:
            json_data = response.json()
            return json_data
        else:
            return False
    except requests.exceptions.RequestException as e:
        logger.error(f"Exception Caught While Calling API internally- {url}, exception are: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Exception Caught While Calling getExploreChartColumn functions ,exception are: {str(e)}")
        return False


# Fetching data from report_scheduler tables i.e slice_id, expire_time, recievers-list
class FetchingSchedulerTable:
    def __init__(self, host, database, user, password, database_uri):
        self.host = host
        self.database = database
        self.user = user
        self.password = password
        self.database_uri = database_uri

    def dbms_type(self):
        dbms = self.database_uri.split(":", 1)[0]
        return dbms

    def create_connection(self):
        dbms = self.dbms_type()
        connection = None
        if dbms == "sqlite":
            # db_path = "/home/azureuser/superset-veefin/superset_venv/lib/python3.9/site-packages/superset/superset.db"
            db_path = "/home/bipin/Desktop/veefin/venv/lib/python3.9/site-packages/superset/superset.db"
            try:
                connection = sqlite3.connect(db_path)
                logger.info(f"SQLITE dbms connection successfully connected, connection: {connection}")
            except sqlite3.Error as e:
                logger.error(f" Error While connecting to SQLite3: {e}")
            return connection

        if dbms == "mysql":
            try:
                connection = mysql.connector.connect(
                    host=self.host,
                    database=self.database,
                    user=self.user,
                    password=self.password
                )
                logger.info(f" Mysql dbms successfully connected: {connection}")
            except Error as e:
                logger.error(f"Error while connecting to MySQL: {e}")
            return connection

    def create_table(self, connection):
        try:
            cursor = connection.cursor()
            create_query = """CREATE TABLE superset_report_scheduler (
                                id INTEGER PRIMARY KEY,
                                role_id INTEGER,
                                user_id INTEGER,
                                slice_id INTEGER NOT NULL,
                                created_at TIMESTAMP NOT NULL,
                                is_active BOOLEAN DEFAULT 1);
                            """
            logger.info("Table is created successfully...")
            cursor.execute(create_query)
            created_at = datetime.now()
            data = [
                (2, 0 ,  2, created_at),
                (0, 532, 2, created_at),
            ]
            for i in data:
                insert_query = """INSERT INTO superset_report_scheduler (role_id, user_id, slice_id, created_at) VALUES (?, ?, ?, ?);"""
                cursor.execute(insert_query, i)
            logger.info("Row inserted successfully into the table...")
            return True
        except sqlite3.Error as e:
            logger.error(f"Exception Occur while creating table into database.... Error is: {str(e)}")
            return False

    def fetch_data(self):
        dbms = self.dbms_type()
        if dbms == "sqlite":
            connection = self.create_connection()
            try:
                cursor = connection.cursor()
                try:
                    cursor.execute(f"SELECT * FROM superset_report_scheduler")
                    #cursor.execute("DROP TABLE IF EXISTS superset_report_scheduler")
                except sqlite3.Error as e:
                    logger.warning("Table Not Fetched or not existed, by default creating ...", str(e))
                    solve_table_not_found_error = self.create_table(connection)
                    logger.warning(solve_table_not_found_error)
                    cursor.execute("SELECT * FROM superset_report_scheduler")

                data = cursor.fetchall()
                scheduler_list = []
                for row in data:
                    row_dict = {}
                    row_dict["role_id"] = row[1]
                    row_dict["user_id"] = row[2]
                    row_dict["slice_id"] = row[3]
                    row_dict["created_at"] = row[4]
                    row_dict["is_active"] = row[5]
                    scheduler_list.append(row_dict)
                return scheduler_list
            except sqlite3.Error as e:
                logger.warning("Error while fetching data from sqlite3 dbms-:", str(e))
                return []
            finally:
                connection.commit()
                connection.close()
                pass
        if dbms == "mysql":
            connection = self.create_connection()
            if connection:
                try:
                    query = "SELECT * FROM superset_report_scheduler;"
                    cursor = connection.cursor(dictionary=True)
                    cursor.execute(query)
                    result = cursor.fetchall()

                    # Display rows with column names
                    scheduler_list = []
                    for row in result:
                        row_dict = {}
                        for column, value in row.items():
                            if column == "role_id":
                                row_dict["role_id"] = value
                            if column == "user_id":
                                row_dict["user_id"] = value
                            if column == "slice_id":
                                row_dict["slice_id"] = value
                            if column == "is_active":
                                row_dict["is_active"] = value
                        scheduler_list.append(row_dict)
                    return scheduler_list
                except Error as e:
                    logger.error(f"Error while fetching data: {e}")
                    return []
                finally:
                    cursor.close()
                    connection.close()



# decode base 64:-

class SupersetSqlQueryExecutor():

    def ExecuteSQLQuery(self, query):

        access_token = fetch_access_token()
        url = f"http://127.0.0.1:8088/api/v1/sqllab/execute/"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            'Cookie': "eJwlzjEOwjAMRuG7ZGZwUsdJepkqjv0LpAqklk6IuxOJ8XvT-4QNh5_3sL6Py29he1hYgzlac4pjEMSFUjLTWCQWEnIj4wULiVKapS0wj1564grXwXUoD6HectRiQImOIbmaeZdSeyW2bIpSUVgbdzilDMDYukEThTlynX78b-Lk_hp99wl_hu8P-6U1eg.ZNMtBw.yowqwpdEvtTxZxzEpaRE28h1Jgg; session=eyJfZnJlc2giOmZhbHNlLCJsb2NhbGUiOiJlbiJ9.ZNPNYw.iq45hzgSNvtYn16QaxX1wdZ97nw"
        }
        payload = {
            "client_id": "",
            "database_id": 1,
            "json": True,
            "runAsync": False,
            "schema": "veefin_superset",
            "sql": query,
            "sql_editor_id": "1",
            "tab": "Untitled Query 1",
            "tmp_table_name": "",
            "select_as_cta": False,
            "ctas_method": "TABLE",
            "queryLimit": 1000,
            "expand_data": True
        }
        try:
            response = requests.post(url, headers=headers,
                                    json=payload)
            logger.info(f"Executing SQL Query using superset API, Status: {response.status_code}")
            if response.status_code == 200:
                json_data = response.json()
                return json_data
            else:
                return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Error While Calling API-{url}, Error: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Exception caught internally while calling ExecuteSqlQuery function, exception: {str(e)}")
            return False









