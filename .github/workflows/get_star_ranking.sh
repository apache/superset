#!/bin/bash

# GitHub token (replace with your own token)
GITHUB_TOKEN="blah"

OUTPUT_FILE="top_repos.csv"

# Function to perform the GraphQL query
perform_query() {
  local cursor=$1
  local query

  if [ "$cursor" == "null" ]; then
    query='{"query": "query { search(query: \"stars:>0\", type: REPOSITORY, first: 100) { edges { cursor node { ... on Repository { nameWithOwner stargazers { totalCount } } } } pageInfo { endCursor hasNextPage } } }"}'
  else
    query=$(jq -n --arg cursor "$cursor" \
      '{query: "query { search(query: \"stars:>0\", type: REPOSITORY, first: 100, after: \($cursor|@json)) { edges { cursor node { ... on Repository { nameWithOwner stargazers { totalCount } } } } pageInfo { endCursor hasNextPage } } }"}')
  fi

  curl -s -H "Authorization: bearer $GITHUB_TOKEN" -H "Content-Type: application/json" \
    --data "$query" \
    https://api.github.com/graphql
}

# Initial query without a cursor
result=$(perform_query "null")

# Print the raw result for debugging
echo "Initial result: $result"

# Check if the result contains errors
if echo "$result" | jq -e '.errors' > /dev/null; then
  echo "Error: $(echo "$result" | jq -r '.errors[0].message')"
  exit 1
fi

# Extract repositories and next cursor
repositories=$(echo "$result" | jq -r '.data.search.edges[] | "\(.node.nameWithOwner), \(.node.stargazers.totalCount)"')
next_cursor=$(echo "$result" | jq -r '.data.search.pageInfo.endCursor')
has_next_page=$(echo "$result" | jq -r '.data.search.pageInfo.hasNextPage')

# Print CSV header to file
echo "Rank,Repository,Stars" > "$OUTPUT_FILE"

# Initialize rank
rank=1

# Continue fetching pages until no more results
while true; do
  # Append repositories with rank to file
  while IFS= read -r line; do
    echo "$rank,$line" >> "$OUTPUT_FILE"
    rank=$((rank + 1))
  done <<< "$repositories"

  # Break the loop if no more pages
  if [ "$has_next_page" != "true" ]; then
    break
  fi

  # Fetch next page
  result=$(perform_query "$next_cursor")

  # Print the raw result for debugging
  echo "Result: $result"

  # Check if the result contains errors
  if echo "$result" | jq -e '.errors' > /dev/null; then
    echo "Error: $(echo "$result" | jq -r '.errors[0].message')"
    exit 1
  fi

  repositories=$(echo "$result" | jq -r '.data.search.edges[] | "\(.node.nameWithOwner), \(.node.stargazers.totalCount)"')
  next_cursor=$(echo "$result" | jq -r '.data.search.pageInfo.endCursor')
  has_next_page=$(echo "$result" | jq -r '.data.search.pageInfo.hasNextPage')
done

echo "Repositories written to $OUTPUT_FILE"
