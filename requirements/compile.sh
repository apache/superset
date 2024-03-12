pip-compile -o requirements/base.txt
pip-compile -o requirements/development.txt  -v \
    --extra bigquery,development,druid,hive,gevent,mysql,postgres,presto,prophet,trino,gsheets,playwright,thumbnails \
echo "-e ." >> requirements/base.txt
echo "-e ." >> requirements/development.txt
