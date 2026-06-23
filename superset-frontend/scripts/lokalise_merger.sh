#!/bin/bash

set -e

for file in $( find ../superset/translations/** -name '*.json' );
do
  extension=${file##*.}
  filename="${file%.*}"
  if [ $extension == "json" ]
  then
    locale=${file/#..\/superset\/translations\/}
    locale=${locale%\/LC_MESSAGES\/messages.json}
    if [ -f "../locales/$locale/translation.json" ]
    then
      output=$(
        jq -s '
          .[0].locale_data.superset *= (
            .[1]
            | with_entries(
                select(.value != "")
                | if (.value | type) == "object" and (.value | has("one")) and (.value | has("other")) then
                    .value = [.value.one, .value.other]
                  else
                    .value = [.value]
                  end
              )
          )
          | first
        ' "$file" "../locales/$locale/translation.json"
      )
      echo "$output" > "$file"
    fi
  fi
done
