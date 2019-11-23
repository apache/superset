#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// TODO: better output

const PACKAGES_ROOT = path.join(
  process.env.SUPERSET_UI_PLUGINS_PATH ||
    path.resolve("../../../superset-ui-plugins"),
  "packages"
);

if (require.main === module) {
  console.log(`Enabling plugin devmode: Linking packages in ${PACKAGES_ROOT}`);

  linkPackages(findPackages());

  console.log("Plugin devmode enabled!");
}

function findPackages() {
  return fs
    .readdirSync(path.join(PACKAGES_ROOT), {
      withFileTypes: true
    })
    .filter(thing => thing.isDirectory());
}

function linkPackages(packageDirs) {
  packageDirs.forEach((directory, i) => {
    const directoryPath = path.join(PACKAGES_ROOT, directory.name);
    const packageName = require(path.join(directoryPath, "package.json")).name;
    console.log(`[${i + 1}/${packageDirs.length}] ${packageName}`);
    execSync("npm link --loglevel error", {
      cwd: directoryPath,
      stdio: "inherit"
    });
    execSync(`npm link ${packageName} --loglevel error`, {
      stdio: "inherit"
    });
  });
}

module.exports = {
  findPackages,
  PACKAGES_ROOT
};
