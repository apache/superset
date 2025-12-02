"""
To regenerate JSON from the INTHEWILD.md page.
Replace paths with local files.

Logos and contributor(s) are optional.
This treats entries like so:

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
import json
import re

categories = {}
FILEPATH_IN = "text.md" #CHANGE TO YOUR PATH
FILEPATH_OUT = "new.json" #CHANGE TO YOUR PATH

### For Parsing:
ID_CAT = "###" # Category Identifier
ID_ENTRY = "-" # Entry Identifier

def to_json(line): #str -> dict
   PATTERN = r'(?:<!--\s*(.*?)\s*-->)|(\[.*?\])|(\(.*?\))'
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
      if (line[0:3]== ID_CAT):
        last_category_position = file.tell() # special

        category_name = line[3:].strip()
        # Perform validation (?) Not needed if just trusting the inthewildmd file.
        entries_list = []
        #loop unil the next category or end of file
        # Use seek and tell for last category file reading pointer
        # If next category, or end of file, stop.
        # If entry, add entry
        looping_through_line = file.readline()
        while looping_through_line[0:3] != ID_CAT:

          if looping_through_line[0] == ID_ENTRY:
             entries_list.append(to_json(looping_through_line))
          looping_through_line = file.readline()
          if not looping_through_line:
            break
          
        # if category ended
        categories.update({category_name: entries_list})
        file.seek(last_category_position)

    # Finally export or write out
    with open(FILEPATH_OUT, "w") as file:
       result = dict({"categories": categories})
       file.write(json.dumps(result, indent = 4, ensure_ascii=False))