#!/bin/bash
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && cd .. && pwd )"
LICENSE_TMP=$(mktemp)
cat <<'EOF'> "$LICENSE_TMP"
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

EOF

cd $ROOT_DIR
pybabel extract \
  -F superset/translations/babel.cfg \
  -o superset/translations/messages.pot \
  --sort-output \
  --copyright-holder=Superset \
  --project=Superset \
  -k _ -k __ -k t -k tn:1,2 -k tct .
cat $LICENSE_TMP superset/translations/messages.pot > messages.pot.tmp \
  && mv messages.pot.tmp superset/translations/messages.pot

pybabel update \
  -i superset/translations/messages.pot \
  -d superset/translations \
  --ignore-obsolete

# Chop off last blankline from po/pot files, see https://github.com/python-babel/babel/issues/799
for file in $( find superset/translations/** );
do
  extension=${file##*.}
  filename="${file%.*}"
  if [ $extension == "po" ] || [ $extension == "pot" ]
  then
    mv $file $file.tmp
    sed "$ d" $file.tmp > $file
    rm $file.tmp
  fi
done

cd $CURRENT_DIR
