dbname = 'superset-default'
user = 'postgres'
password = 'Tal!n0|2023'
host = 'kuwago-dev-database.cc35mla5pq1x.ap-southeast-1.rds.amazonaws.com'
port = '5432'

conn = psycopg2.connect(
    dbname=dbname,
    user=user,
    password=password,
    host=host,
    port=port
)
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
rows = cur.fetchall()

for row in rows:
    print(row)



from rediscluster import RedisCluster

# rhost = 'kuwago-cache-cluster-0001-001.kuwago-cache-cluster.qucvhf.apse1.cache.amazonaws.com'
rhost = 'clustercfg.kuwago-test.qucvhf.apse1.cache.amazonaws.com'
# rhost = 'kuwago-test-2.qucvhf.ng.0001.apse1.cache.amazonaws.com'
rport = '6379'

r = redis.Redis(host=rhost, port=rport)
# r = RedisCluster(startup_nodes=[{"host": rhost,"port": rport}], decode_responses=True,skip_full_coverage_check=True)

# Testing the connection
r.ping()

# Performing Redis operations
r.set('key', 'value')
value = r.get('key')
print(value)