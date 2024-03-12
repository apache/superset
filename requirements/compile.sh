pip-compile -o requirements/base.txt requirements/base.in
pip-compile -o requirements/development.txt  -v \
    --extra bigquery,druid,hive,gevent,mysql,postgres,presto,prophet,trino,gsheets,playwright,thumbnails \
    requirements/base.in
echo "-e ." >> requirements/base.txt
echo "-e ." >> requirements/development.txt
