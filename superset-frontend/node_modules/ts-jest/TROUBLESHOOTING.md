# Troubleshooting

## Running ts-jest on CI tools

### PROBLEM

Cannot find module "" from ""

### SOLUTION

- Check if `rootDir` is referenced correctly. If not add this on your existing jest configuration.

```javascipt
module.exports = {
  ...
   roots: ["<rootDir>"]
}
```

- Check if module directories are included on your jest configuration. If not add this on your existing jest configuration.

```javascipt
module.exports = {
  ...
  moduleDirectories: ["node_modules","<module-directory>"],
  modulePaths: ["<path-of-module>"],
}
```

- Check if module name is properly mapped and can be referenced by jest. If not, you can define moduleNameMapper for your jest configuration.

```javascipt
module.exports = {
  ...
  moduleNameMapper: {
    "<import-path>": "<rootDir>/<real-physical-path>",
  },
}
```

- Check github folder names if its identical to you local folder names. Sometimes github never updates your folder names even if you rename it locally. If this happens rename your folders via github or use this command `git mv <source> <destination>` and commit changes.
