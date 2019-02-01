/* eslint-disable import/no-extraneous-dependencies, no-console */
const fg = require('fast-glob');
const fs = require('fs-extra');

const packages = fg.sync(['packages/*'], {
  onlyDirectories: true,
});

packages.forEach(pkg => {
  const assets = fg.sync([`${pkg}/src/**/*.{png,gif,jpg,css,geojson}`]);
  assets.forEach(filePath => {
    const newPaths = ['lib', 'esm'].map(dir => filePath.replace(`${pkg}/src`, `${pkg}/${dir}`));
    newPaths.forEach(p => {
      fs.copy(filePath, p, err => {
        if (err) {
          console.error(err);
        }
        console.log(`Copy ${filePath}`);
        console.log(`=> to ${p}`);
      });
    });
  });
});
