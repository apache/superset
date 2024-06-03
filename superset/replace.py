import os
import re

# Define the replacements and filename regex
REPLACEMENTS = [
    (r"SqlaTable", "Dataset"),
]
FILENAME_REGEX = r".*\.py"


def replace_in_files(patterns_targets, filename_regex):
    # Compile the filename regex
    filename_pattern = re.compile(filename_regex)

    # Get the list of files in the current directory
    files = [
        f for f in os.listdir(".") if os.path.isfile(f) and filename_pattern.match(f)
    ]

    # Iterate through the files
    for filename in files:
        with open(filename, "r") as file:
            content = file.read()

        # Apply each pattern and target replacement
        for pattern, target in patterns_targets:
            content = re.sub(pattern, target, content)

        # Write the modified content back to the file
        with open(filename, "w") as file:
            file.write(content)


# Run the replacement
replace_in_files(REPLACEMENTS, FILENAME_REGEX)
