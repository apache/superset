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
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && cd ../.. && pwd )"
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
  --no-location \
  --sort-output \
  --copyright-holder=Superset \
  --project=Superset \
  -k _ -k __ -k t -k tn:1,2 -k tct .

# Normalize .pot file
msgcat --sort-by-msgid --no-wrap --no-location superset/translations/messages.pot -o superset/translations/messages.pot

cat $LICENSE_TMP superset/translations/messages.pot > messages.pot.tmp \
  && mv messages.pot.tmp superset/translations/messages.pot

# Stamp do-not-translate msgids (superset/translations/do-not-translate.txt) with
# a `#. do-not-translate` extracted comment. Extracted comments
# propagate from the .pot into every catalog on the `pybabel update` below, so
# the do-not-translate status stays consistent across all languages.
# Fail fast: without this guard the script would continue past a marker-stamping
# failure and `pybabel update` would publish catalogs missing the markers.
python scripts/translations/apply_do_not_translate.py superset/translations/messages.pot || exit 1

# --no-fuzzy-matching: when a *new* source string is added, Babel's fuzzy
# matcher otherwise guesses a "close" existing translation and marks it
# `#, fuzzy` in every language catalog. Those guesses are (a) usually wrong
# (e.g. a new "valuename" string mapped onto an unrelated "table name"
# translation) and (b) counted by check_translation_regression.py as a
# regression, so every PR that merely adds a translatable string failed the
# babel-extract check. Disabling fuzzy matching means new strings land as
# cleanly untranslated (empty msgstr) instead — accurate, and no spurious
# regression. Renames likewise drop the stale translation rather than
# stranding a wrong guess; the string is re-translated by the community.
pybabel update \
  -i superset/translations/messages.pot \
  -d superset/translations \
  --ignore-obsolete \
  --no-fuzzy-matching

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

# A few UI labels ("% calculation" etc.) parse as accidentally-valid
# %-format directives (a space flag plus a conversion character), so
# babel auto-flags them python-format on every write and msgfmt then
# fatals on their translations. The app never %-formats them; strip the
# flag AFTER the update pass (babel re-adds it during the update, so
# this must run last). Line-targeted so canonical wrapping is untouched.
python3 - <<'PYEOF'
import glob

TARGETS = {'msgid "% calculation"\n', 'msgid "% of parent"\n', 'msgid "% of total"\n'}
paths = ["superset/translations/messages.pot"] + sorted(
    glob.glob("superset/translations/*/LC_MESSAGES/messages.po")
)
for path in paths:
    lines = open(path, encoding="utf-8").readlines()
    changed = False
    for i, line in enumerate(lines):
        if line in TARGETS and i > 0 and lines[i - 1].startswith("#,"):
            tokens = [t.strip() for t in lines[i - 1][2:].split(",")]
            if "python-format" in tokens:
                tokens = [t for t in tokens if t != "python-format"]
                if "no-python-format" not in tokens:
                    tokens.append("no-python-format")
                lines[i - 1] = "#, " + ", ".join(tokens) + "\n"
                changed = True
    if changed:
        open(path, "w", encoding="utf-8").writelines(lines)
PYEOF

cd $CURRENT_DIR
