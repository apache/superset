#!/bin/bash

# Forward all script arguments to pip-compile
# you can pass things like `--no-upgrade` or target a specific package
# with `-P "flask"`
pip_compile_flags="$@"

# Compile the base requirements
pip-compile -o requirements/base.txt $pip_compile_flags

# Compile the development requirements with extras
pip-compile -o requirements/development.txt -v $pip_compile_flags \
    --extra bigquery,development,druid,hive,gevent,mysql,postgres,presto,prophet,trino,gsheets,playwright,thumbnails

# Append '-e .' to both requirements files to include the project itself
echo "-e ." >> requirements/base.txt
echo "-e ." >> requirements/development.txt
