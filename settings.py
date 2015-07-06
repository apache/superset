
ROW_LIMIT = 10000

DRUID_HOST = '10.181.47.80'
DRUID_PORT = 8088
DRUID_BASE_ENDPOINT = 'druid/v2'

def get_pydruid_client():
query = client.PyDruid(
    "http://{0}:{1}".format(DRUID_HOST, DRUID_PORT),
    DRUID_BASE_ENDPOINT)
