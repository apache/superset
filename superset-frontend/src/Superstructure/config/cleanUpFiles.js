/* eslint-disable import/no-extraneous-dependencies */
const findRemoveSync = require('find-remove');

findRemoveSync('./public', { extensions: ['.geojson'] });
