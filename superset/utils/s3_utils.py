import boto3
from botocore.exceptions import ClientError
import asyncio

def get_file_data(bucket_name, object_name, file_name):
    s3 = boto3.client('s3')
    with open(file_name, 'wb') as f:
        s3.download_fileobj(bucket_name, object_name, f)
