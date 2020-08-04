# Mapbox GL style specification & utilities

This directory contains code and reference files that define the Mapbox GL style specification and provides some utilities for working with Mapbox styles.

## npm package

The Mapbox GL style specification and utilities are published as a seperate npm
package so that they can be installed without the bulk of GL JS.

    npm install @mapbox/mapbox-gl-style-spec

## CLI Tools

If you install this package globally, you will have access to several CLI tools.

    npm install @mapbox/mapbox-gl-style-spec --global


### `gl-style-composite`
```bash
$ gl-style-composite style.json
```

Will take a non-composited style and produce a [composite style](https://www.mapbox.com/blog/better-label-placement-in-mapbox-studio/).

### `gl-style-migrate`

This repo contains scripts for migrating GL styles of any version to the latest version
(currently v8). Migrate a style like this:

```bash
$ gl-style-migrate bright-v7.json > bright-v8.json
```

To migrate a file in place, you can use the `sponge` utility from the `moreutils` package:

```bash
$ brew install moreutils
$ gl-style-migrate bright.json | sponge bright.json
```

### `gl-style-format`

```bash
$ gl-style-format style.json
```

Will format the given style JSON to use standard indentation and sorted object keys.

### `gl-style-validate`

```bash
$ gl-style-validate style.json
```

Will validate the given style JSON and print errors to stdout. Provide a
`--json` flag to get JSON output.
