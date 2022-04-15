module.exports = {
  appName: 'Apache Superset',
  apiKey: process.env.APPLITOOLS_API_KEY,
  batchId: process.env.APPLITOOLS_BATCH_ID,
  batchName: 'Cypress-GitActions',
  browser: [{ width: 800, height: 600, name: 'chrome' }],
  failCypressOnDiff: true,
  isDisabled: false,
  showLogs: true,
  testConcurrency: 5,
};
