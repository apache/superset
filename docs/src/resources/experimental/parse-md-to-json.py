#!/usr/bin/python3
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
To regenerate JSON from the INTHEWILD.md page.
For running locally:
- replace paths with local files
- replace superset.utils.json with json

Logos and contributor(s) are optional.
This treats md entries like this:

### Sharing Economy

- [Airbnb](https://github.com/airbnb) <!--airbnb.png-->
- [Faasos](https://faasos.com/) [@shashanksingh] <!--fassos.svg-->

And parses it into:

{
    "categories": {
        "Sharing Economy": [
            {
                "name": "Airbnb",
                "url": "https://github.com/airbnb",
                "logo": "",
                "contributors": ""
            },
            {
                "name": "Faasos",
                "url": "https://faasos.com/",
                "logo": "faasos.svg",
                "contributors": "[@shashanksingh]"
            }, ...
        ]
    }
}

"""
import superset.utils.json as json
import re

categories = {}
FILEPATH_IN = "text.md" #CHANGE TO YOUR PATH
FILEPATH_OUT = "new.json" #CHANGE TO YOUR PATH

### For Parsing:
ID_CAT = "###" # Category Identifier
ID_ENTRY = "-" # Entry Identifier
PATTERN = r'(?:<!--\s*(.*?)\s*-->)|(\[.*?\])|(\(.*?\))' \
  ''
def to_json(line): #str -> dict
   line = line[2:]

   # Split the string using re.split
   # Filter out empty strings and whitespace
   result = [p for p in re.split(PATTERN, line) if p and not p.isspace() and p != '']
   print(result)
   name = result[0][1:-1]
   url = result[1][1:-1]

   contributors = ""
   logo = ""

   # if contributor and logo:
   if len(result) == 4:
     contributors = result[2]
     logo = result[3]
   #if contributor but not logo
   if len(result) == 3:
    if '@' in result[2]:
      contributors = result[2]
   #if logo but not contributor
    elif '@' not in result[2]:
      logo = result[2]
    
   return {
      "name": name,
      "url": url,
      "logo" : logo,
      "contributors": contributors
    }

if __name__ == "__main__":
  with open(FILEPATH_IN, "r") as file:
    while True:
      line = file.readline()

      if not line: #EOF
        break

      # Category identifer is "###"
      if (line[0:3] == ID_CAT):
        last_category_position = file.tell() # Record position to return

        category_name = line[3:].strip()
        entries_list = []
        # Loop unil the next category or end of file
        # Use seek/tell for moving file pointer back to last category

        # If next category, or end of file, stop.
        looping_through_line = file.readline()
        while looping_through_line[0:3] != ID_CAT:
          # If an entry, add it to the category
          if looping_through_line[0] == ID_ENTRY:
             entries_list.append(to_json(looping_through_line))
          looping_through_line = file.readline()
          if not looping_through_line:
            break
          
        # If finished adding entries, add the category to our categories
        categories.update({category_name: entries_list})
        file.seek(last_category_position)

    # Finally export or write out
    with open(FILEPATH_OUT, "w") as file:
       result = {"categories": categories}
       file.write(json.dumps(result, indent = 4, ensure_ascii=False))