# linkinator-action
> A happy little GitHub Action that checks your README.md and other markdown for broken links.  Uses [linkinator](https://github.com/JustinBeckwith/linkinator) under the hood.

## Example usage
With no arguments, this will scan your `README.md` in the root of the GitHub repository:

```yaml
on:
  push:
    branches:
      - main
  pull_request:
name: ci
jobs:
  linkinator:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: JustinBeckwith/linkinator-action@v1
```

Or you can pass many of the same parameters [linkinator](https://github.com/JustinBeckwith/linkinator) provides!

```yaml
on:
  push:
    branches:
      - main
  pull_request:
name: ci
jobs:
  linkinator:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: JustinBeckwith/linkinator-action@v1
        with:
          paths: test/fixtures/test.md
          concurrency: 1
          markdown: true
          linksToSkip: "http://fake.local, http://fake.local/fake"
```

## Inputs
- `paths` - Paths to scan for 404s. Defaults to `*.md`.
- `config` - Path to a config file to use. Looks for `linkinator.config.json` by default. Options defined via the GitHub Action config will take precedence.
- `concurrency` - The number of connections to make simultaneously. Defaults to `100`.
- `recurse` - Recursively follow links on the same root domain.  Defaults to `false`.
- `linksToSkip` - List of urls in regexy form to not include in the check. (`skip` is also accepted)
- `timeout` - Request timeout in ms.  Defaults to 0 (no timeout).
- `markdown` - Automatically parse and scan markdown if scanning from a location on disk. Defaults to `true`.
- `serverRoot` - When scanning a local directory, customize the location on disk where the server is started.  Defaults to the root of your GitHub repository.
- `directoryListing` - Include an automatic directory index file when linking to a directory. Defaults to `false`.
- `retry` - Automatically retry requests that return HTTP 429 responses and include a `retry-after` header.
- `urlRewriteSearch` - Pattern to search for in urls.  Must be used with `urlRewriteReplace`.
- `urlRewriteReplace` - Expression used to replace search content.  Must be used with `urlRewriteSearch`.
- `verbosity` - Override the default verbosity for this command. Available options are "DEBUG", "INFO", "WARNING", "ERROR", and "NONE".  Defaults to "WARNING".

## Outputs
- `results` - An object with the results of the run.

## Debugging
To view skipped links, failure details, and more debugging information [enable step debug logging](https://docs.github.com/en/free-pro-team@latest/actions/managing-workflow-runs/enabling-debug-logging#enabling-step-debug-logging).

## License
[MIT](LICENSE)
