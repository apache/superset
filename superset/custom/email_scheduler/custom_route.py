from flask import Flask, Blueprint, send_file
from .token_api import fetch_guest_token
from flask_restx import Api, Resource
from .custom_helper import send_email, writeFileToMemory, \
    getReportData, parse_json_data, getExploreChartColumn, FetchingSchedulerTable, SupersetSqlQueryExecutor

from superset.superset_config import SQLALCHEMY_DATABASE_URI, LINK_EXPIRY_TIME, SENDER, APP_PASSWORD,\
    BASE_URL, DB_PASSWORD, DB_HOST, DB_USER, DB_NAME

import time
import io
from datetime import datetime

from superset.custom.custom_logger import get_logger
logger = get_logger(__name__)

app = Flask(__name__)
email_bp = Blueprint('email_api', __name__, url_prefix='/api/send-email')
api = Api(email_bp)

@api.route('/send')
class FileUploadAndEmailSending(Resource):

    logger.info("superset custom email sending api called...")
    def post(self):
        try:
            scheduler = FetchingSchedulerTable(host=DB_HOST, database=DB_NAME, user=DB_USER,
                                               password=DB_PASSWORD, database_uri=str(SQLALCHEMY_DATABASE_URI))
            scheduler_list = scheduler.fetch_data()
            logger.info("Email credential fetch from scheduler table : ", scheduler_list)
            if scheduler_list:
                data_list = []
                for row in scheduler_list:
                    slice_id = row.get("slice_id")
                    if row.get("is_active") != 0:
                        parse_obj = SupersetSqlQueryExecutor()
                        if row.get("role_id") != 0:
                            query = f"SELECT * FROM DIM_USER WHERE USERS_ROLE_ID={row.get('role_id')};"
                            d = parse_obj.ExecuteSQLQuery(query=query)
                            if not d :
                                print("")
                                continue
                            if d.get("status") == "success":
                                data_list = d.get("data")

                        if row.get("user_id") != 0:
                            query = f"SELECT * FROM DIM_USER WHERE USERS_ID={row.get('user_id')};"
                            d = parse_obj.ExecuteSQLQuery(query=query)
                            if not d:
                                print("")
                            if d.get("status") == "success":
                                data_list = d.get("data")

                    for r_data in data_list:
                        user_uuid = r_data.get("USERS_UUID")
                        name_query = r_data.get("USERS_NAME")
                        email_query =r_data.get("USERS_EMAIL")

                        name_query = f"SELECT decrypt_field(USERS_NAME) AS decrypted_email\nFROM DIM_USER\nWHERE USERS_NAME='{name_query}';"
                        email_query = f"SELECT decrypt_field(USERS_EMAIL) AS decrypted_email\nFROM DIM_USER\nWHERE USERS_EMAIL='{email_query}';"

                        name = parse_obj.ExecuteSQLQuery(query=name_query)
                        name = name.get("data")[0].get("DECRYPTED_EMAIL")
                        email = parse_obj.ExecuteSQLQuery(query=email_query)
                        email = email.get("data")[0].get("DECRYPTED_EMAIL")
                        expire_time = int(time.time() + LINK_EXPIRY_TIME)
                        report_data = getExploreChartColumn(slice_id=slice_id, user_uuid=user_uuid)
                        if not report_data:
                            continue
                        result = getReportData(explore_data=report_data, user_uuid=user_uuid,
                                               slice_id=slice_id)
                        if not result:
                            continue
                        parse_data = parse_json_data(result)
                        if parse_data is None:
                            continue

                        report_name = report_data.get("result").get("dataset").get("datasource_name")
                        download_link = f"{BASE_URL}/api/download-report/{user_uuid}/{slice_id}/{expire_time}"
                        date_of_report = datetime.now().strftime("%d-%m-%Y")
                        subject = f"Scheduled Report {report_name} run on {date_of_report}"
                        msg = f""" Hi {name},
    
 Please find below the report link to download the {report_name} report.  
 Link {download_link} 
 
 Regards
 Veefin Reporting Tool
 """
                        report_email = send_email(subject=subject,app_password=str(APP_PASSWORD),\
                            mail_body=msg, sender_email=str(SENDER), recipient_emails=["bipin@veefin.com"])
                        if not report_email:
                            print("Failed to send email")
                            continue
                logger.info("Scheduled report successfully sent...")
                return "Email send successfully to users", 200
            else:
                logger.error("Scheduled report not sent..")
                return str("Email Not sent"), 500
        except Exception as e:
            logger.error(f"Error occurs while sending scheduled report email is : {e}")
            return str(e), 403



#=======================================================================================

download_bp = Blueprint('download_api', __name__, url_prefix='/api/download-report')

@download_bp.route('/<string:user_uuid>/<string:slice_id>/<string:link_expiry_time>')
def fetch_file(user_uuid, slice_id, link_expiry_time):
    try:
        current_time = int(time.time())
        if int(link_expiry_time) < current_time:
            logger.warning("Download link expired..")
            return "Download Link Expired", 404

        getColumns = getExploreChartColumn(slice_id=slice_id, user_uuid=user_uuid)
        if not getColumns:
            return "Not Found", 404

        result = getReportData(explore_data=getColumns, user_uuid=user_uuid, slice_id=slice_id)
        if not result:
            return "Not Found", 404

        parse_data = parse_json_data(result)
        if parse_data is None:
            return "Not Found", 404

        file_data, file_format = writeFileToMemory(file_data=parse_data)
        if not file_data:
            return "Not Found", 404

        file_data = file_data.getvalue()
        mime_type = 'text/csv' if file_format.lower() == 'csv' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        return send_file(
            io.BytesIO(file_data), mimetype=mime_type, as_attachment=True,
                         download_name=f"{user_uuid}.{file_format}"
        )
    except Exception as e:
        logger.error(f"Error while downloading report using link : {e}")
        return "Failed to download report", 500


#=======================================================================================
token_bp = Blueprint('token_api', __name__, url_prefix='/api')
@token_bp.route('/get_guest_token/<dashboard_id>')
def get_guest_token(dashboard_id):
    token = fetch_guest_token(dashboard_id)
    if token:
        return token
    else:
        return "API call failed."
