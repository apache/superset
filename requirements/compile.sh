pip-compile -o requirements/base.txt
pip-compile -o requirements/development.txt -v \
    --extra bigquery,druid,hive,gevent,mysql,postgres,presto,prophet,trino,gsheets,playwright,thumbnails
