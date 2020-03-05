/* eslint-disable import/no-extraneous-dependencies, no-console */
const fg = require('fast-glob');
const fs = require('fs-extra');

const packages = fg.sync([`packages/${process.argv[2] || '*'}`], {
  onlyDirectories: true,
});

console.log('Copying asset files from `src` to {lib,esm}...');
packages.forEach(pkg => {
  const assets = fg.sync([`${pkg}/src/**/*.{png,gif,jpg,css,geojson}`]);
  assets.forEach(filePath => {
    const newPaths = ['lib', 'esm'].map(dir => filePath.replace(`${pkg}/src`, `${pkg}/${dir}`));
    newPaths.forEach(p => {
      fs.copy(filePath, p, err => {
        if (err) {
          console.error(err);
        }
      });
    });
  });
  console.log(
    `  Copied ${assets.length.toString().padStart(2)} asset files for ${pkg.replace(
      'packages/superset-ui-',
      '',
    )}`,
  );
});
