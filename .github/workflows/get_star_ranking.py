import csv
import json
import time
from typing import Any, Dict, List, Optional, Tuple

import requests
from requests.exceptions import RequestException

# Configuration
GITHUB_API_URL = "https://api.github.com/graphql"
GITHUB_TOKEN = ""  # Replace with your actual token
QUERY = """
{
  search(query: "stars:>1", type: REPOSITORY, first: 100, after: AFTER_CURSOR) {
    edges {
      cursor
      node {
        ... on Repository {
          nameWithOwner
          stargazers {
            totalCount
          }
          watchers {
            totalCount
          }
          openIssues: issues(states: OPEN) {
            totalCount
          }
          discussions {
            totalCount
          }
        }
      }
    }
  }
}
"""
HEADERS = {"Authorization": f"Bearer {GITHUB_TOKEN}"}
TARGET_REPOSITORY: Optional[str] = None  # Set this to None to print all repositories
MAX_REPOS = 200  # Limit to the first 200 repositories
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds


class RepositoryFetchError(Exception):
    """Custom exception for repository fetching errors."""


def fetch_repositories(after_cursor: Optional[str] = None) -> Dict[str, Any]:
    query = QUERY.replace(
        "AFTER_CURSOR", f'"{after_cursor}"' if after_cursor else "null"
    )
    for attempt in range(MAX_RETRIES):
        try:
            response = requests.post(
                GITHUB_API_URL, json={"query": query}, headers=HEADERS, timeout=30
            )
            response.raise_for_status()
            result = response.json()
            if "errors" in result:
                print(f"GraphQL errors: {json.dumps(result['errors'], indent=2)}")
                raise RepositoryFetchError("GraphQL query returned errors")
            if "data" not in result or "search" not in result["data"]:
                print(f"Unexpected response structure: {json.dumps(result, indent=2)}")
                raise RepositoryFetchError("Unexpected response structure")
            return result["data"]["search"]
        except RequestException as request_error:
            print(f"Attempt {attempt + 1} failed: {str(request_error)}")
            if attempt < MAX_RETRIES - 1:
                print(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            else:
                print("Max retries reached. Exiting.")
                raise RepositoryFetchError(
                    "Failed to fetch repositories after all retries"
                ) from request_error
        except json.JSONDecodeError as json_error:
            print(f"Error decoding JSON response: {str(json_error)}")
            if attempt < MAX_RETRIES - 1:
                print(f"Retrying in {RETRY_DELAY} seconds...")
                time.sleep(RETRY_DELAY)
            else:
                print("Max retries reached. Exiting.")
                raise RepositoryFetchError(
                    "Failed to decode JSON response"
                ) from json_error

    raise RepositoryFetchError("Failed to fetch repositories after all retries")


def main() -> None:
    repositories: List[Tuple[int, str, int, int, int, int]] = []
    after_cursor: Optional[str] = None
    rank = 0
    target_repo_found = False

    while not target_repo_found and rank < MAX_REPOS:
        try:
            result = fetch_repositories(after_cursor)
        except RepositoryFetchError as fetch_error:
            print(f"Error fetching repositories: {str(fetch_error)}")
            break

        for edge in result["edges"]:
            rank += 1
            repo = edge["node"]
            repo_name = repo["nameWithOwner"]
            stars = repo["stargazers"]["totalCount"]
            watchers = repo["watchers"]["totalCount"]
            open_issues = repo["openIssues"]["totalCount"]
            discussions = repo["discussions"]["totalCount"]

            repositories.append(
                (rank, repo_name, stars, watchers, open_issues, discussions)
            )

            if TARGET_REPOSITORY and repo_name == TARGET_REPOSITORY:
                target_repo_found = True
                print(
                    f"Found target repository: {repo_name} at rank {rank} with {stars} stars"
                )
                break

            if rank >= MAX_REPOS:
                break

        if target_repo_found or not result["edges"] or rank >= MAX_REPOS:
            break
        after_cursor = result["edges"][-1]["cursor"]

    # Save to CSV
    with open("github_top_repositories.csv", "w", newline="") as csvfile:
        csvwriter = csv.writer(csvfile)
        csvwriter.writerow(
            ["Rank", "Repository", "Stars", "Watchers", "Open Issues", "Discussions"]
        )
        csvwriter.writerows(repositories)

    # Print all rows if TARGET_REPOSITORY is None or False
    if not TARGET_REPOSITORY:
        for repo in repositories:
            print(
                f"Rank: {repo[0]}, Repository: {repo[1]}, Stars: {repo[2]}, Watchers: {repo[3]}, Open Issues: {repo[4]}, Discussions: {repo[5]}"
            )


if __name__ == "__main__":
    main()
