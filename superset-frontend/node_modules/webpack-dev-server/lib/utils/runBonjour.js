'use strict';

function runBonjour({ port }) {
  const bonjour = require('bonjour')();
  const os = require('os');

  bonjour.publish({
    name: `Webpack Dev Server ${os.hostname()}:${port}`,
    port,
    type: 'http',
    subtypes: ['webpack'],
  });

  process.on('exit', () => {
    bonjour.unpublishAll(() => {
      bonjour.destroy();
    });
  });
}

module.exports = runBonjour;
