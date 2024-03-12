pip-compile -v -o requirements/base.txt --no-upgrade
pip-compile -v -o requirements/development.txt --no-upgrade \
    --extra bigquery,development,druid,hive,gevent,mysql,postgres,presto,prophet,trino,gsheets,playwright,thumbnails
echo "-e ." >> requirements/base.txt
echo "-e ." >> requirements/development.txt
