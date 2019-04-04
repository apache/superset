const path = require('path');
const fs = require('fs');
const http = require('http');

const WebSocket = require('ws');
const _ = require('lodash');
const express = require('express');
const ejs = require('ejs');
const opener = require('opener');
const mkdir = require('mkdirp');
const {bold} = require('chalk');

const Logger = require('./Logger');
const analyzer = require('./analyzer');

const projectRoot = path.resolve(__dirname, '..');

module.exports = {
  startServer,
  generateReport,
  // deprecated
  start: startServer
};

async function startServer(bundleStats, opts) {
  const {
    port = 8888,
    host = '127.0.0.1',
    openBrowser = true,
    bundleDir = null,
    logger = new Logger(),
    defaultSizes = 'parsed',
    excludeAssets = null
  } = opts || {};

  const analyzerOpts = {logger, excludeAssets};

  let chartData = getChartData(analyzerOpts, bundleStats, bundleDir);

  if (!chartData) return;

  const app = express();

  // Explicitly using our `ejs` dependency to render templates
  // Fixes #17
  app.engine('ejs', require('ejs').renderFile);
  app.set('view engine', 'ejs');
  app.set('views', `${projectRoot}/views`);
  app.use(express.static(`${projectRoot}/public`));

  app.use('/', (req, res) => {
    res.render('viewer', {
      mode: 'server',
      get chartData() { return JSON.stringify(chartData) },
      defaultSizes: JSON.stringify(defaultSizes),
      enableWebSocket: true
    });
  });

  const server = http.createServer(app);

  await new Promise(resolve => {
    server.listen(port, host, () => {
      resolve();

      const url = `http://${host}:${server.address().port}`;

      logger.info(
        `${bold('Webpack Bundle Analyzer')} is started at ${bold(url)}\n` +
        `Use ${bold('Ctrl+C')} to close it`
      );

      if (openBrowser) {
        opener(url);
      }
    });
  });

  const wss = new WebSocket.Server({server});

  wss.on('connection', ws => {
    ws.on('error', err => {
      // Ignore network errors like `ECONNRESET`, `EPIPE`, etc.
      if (err.errno) return;

      logger.info(err.message);
    });
  });

  return {
    ws: wss,
    http: server,
    updateChartData
  };

  function updateChartData(bundleStats) {
    const newChartData = getChartData(analyzerOpts, bundleStats, bundleDir);

    if (!newChartData) return;

    chartData = newChartData;

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          event: 'chartDataUpdated',
          data: newChartData
        }));
      }
    });
  }
}

function generateReport(bundleStats, opts) {
  const {
    openBrowser = true,
    reportFilename = 'report.html',
    bundleDir = null,
    logger = new Logger(),
    defaultSizes = 'parsed',
    excludeAssets = null
  } = opts || {};

  const chartData = getChartData({logger, excludeAssets}, bundleStats, bundleDir);

  if (!chartData) return;

  ejs.renderFile(
    `${projectRoot}/views/viewer.ejs`,
    {
      mode: 'static',
      chartData: JSON.stringify(chartData),
      assetContent: getAssetContent,
      defaultSizes: JSON.stringify(defaultSizes),
      enableWebSocket: false
    },
    (err, reportHtml) => {
      if (err) return logger.error(err);

      const reportFilepath = path.resolve(bundleDir || process.cwd(), reportFilename);

      mkdir.sync(path.dirname(reportFilepath));
      fs.writeFileSync(reportFilepath, reportHtml);

      logger.info(
        `${bold('Webpack Bundle Analyzer')} saved report to ${bold(reportFilepath)}`
      );

      if (openBrowser) {
        opener(`file://${reportFilepath}`);
      }
    }
  );
}

function getAssetContent(filename) {
  return fs.readFileSync(`${projectRoot}/public/${filename}`, 'utf8');
}

function getChartData(analyzerOpts, ...args) {
  let chartData;
  const {logger} = analyzerOpts;

  try {
    chartData = analyzer.getViewerData(...args, analyzerOpts);
  } catch (err) {
    logger.error(`Could't analyze webpack bundle:\n${err}`);
    logger.debug(err.stack);
    chartData = null;
  }

  if (_.isPlainObject(chartData) && _.isEmpty(chartData)) {
    logger.error("Could't find any javascript bundles in provided stats file");
    chartData = null;
  }

  return chartData;
}
