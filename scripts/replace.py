#!/usr/bin/env python3
import os
import re
import subprocess
from typing import List, Tuple

# Define replacement patterns as tuples of (pattern, replacement)
REPLACE_PATTERNS: List[Tuple[str, str]] = [
    # Example patterns - replace these with your actual patterns
    (r"'src\/components\/", "'@superset-ui/core/components/"),
]


def get_git_files(directory: str = ".") -> List[str]:
    """
    Get all files tracked by Git in the repository relative to the current working directory.

    Args:
        directory: The directory to start from (defaults to current directory)

    Returns:
        A list of file paths tracked by Git
    """
    try:
        # Use 'git ls-files' to get all tracked files
        result = subprocess.run(
            ["git", "ls-files"],
            cwd=directory,
            check=True,
            capture_output=True,
            text=True,
        )

        # Split the output by newlines and filter out empty strings
        files = [f for f in result.stdout.split("\n") if f]
        return files

    except subprocess.CalledProcessError as e:
        print(f"Error running git command: {e}")
        return []
    except Exception as e:
        print(f"Unexpected error: {e}")
        return []


def replace_in_file(file_path: str, patterns: List[Tuple[str, str]]) -> int:
    """
    Replace all occurrences of patterns in a file.

    Args:
        file_path: Path to the file
        patterns: List of (pattern, replacement) tuples

    Returns:
        Number of replacements made
    """
    # Check if file exists and is readable
    if not os.path.isfile(file_path):
        print(f"Skipping {file_path}: Not a file or doesn't exist")
        return 0

    try:
        # Read file content
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        original_content = content
        total_replacements = 0

        # Apply each pattern
        for pattern, replacement in patterns:
            # Count occurrences before replacement
            matches = re.findall(pattern, content)
            replacements = len(matches)

            # Perform replacement
            content = re.sub(pattern, replacement, content)

            total_replacements += replacements

        # Write back only if changes were made
        if content != original_content:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Updated {file_path}: {total_replacements} replacements")

        return total_replacements

    except UnicodeDecodeError:
        print(f"Skipping {file_path}: Not a text file or encoding issues")
        return 0
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return 0


def main():
    """Main function to process all git files."""
    # Get all files tracked by git
    git_files = get_git_files()

    if not git_files:
        print("No files found in git repository or not in a git repository")
        return

    print(f"Found {len(git_files)} files to process")

    # Process each file
    total_files = 0
    total_replacements = 0

    for file_path in git_files:
        print("Processing: ", file_path)
        replacements = replace_in_file(file_path, REPLACE_PATTERNS)

        if replacements > 0:
            total_files += 1
            total_replacements += replacements

    # Print summary
    print("\nSummary:")
    print(f"Processed {len(git_files)} files")
    print(f"Made changes to {total_files} files")
    print(f"Total replacements: {total_replacements}")


if __name__ == "__main__":
    main()
