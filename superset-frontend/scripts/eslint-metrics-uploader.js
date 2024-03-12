/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
const { google } = require('googleapis');

const { SPREADSHEET_ID } = process.env;
const SERVICE_ACCOUNT_KEY = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

const auth = new google.auth.GoogleAuth({
  credentials: SERVICE_ACCOUNT_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const DATETIME = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

async function writeToGoogleSheet(data, range, headers, append = false) {
  const request = {
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values: append ? data : [headers, ...data] },
  };

  const method = append ? 'append' : 'update';
  await sheets.spreadsheets.values[method](request);
}

// Process ESLint results and prepare data for Google Sheets
module.exports = async results => {
  const enrichedRules = {
    'react-prefer-function-component/react-prefer-function-component': {
      description: 'We prefer function components to class-based components',
    },
    'react/jsx-filename-extension': {
      description:
        'We prefer Typescript - all JSX files should be converted to TSX',
    },
    'react/forbid-component-props': {
      description:
        'We prefer Emotion for styling rather than `className` or `style` props',
    },
    // Ignore thie rule here - the messages in eslintrc_metrics.js are sufficient descriptions, broken down by file type.
    'no-restricted-imports': {
      description:
        "This rule catches several things that shouldn't be used anymore. LESS, antD, enzyme, etc. See individual occurrence messages for details",
    },
    'no-console': {
      description:
        "We don't want a bunch of console noise, but you can use the `logger` from `@superset-ui/core` when there's a reason to.",
    },
  };

  // Consolidate data processing into a single loop for efficiency
  const metricsByRule = {};
  let occurrencesData = [];

  results.forEach(result => {
    result.messages.forEach(({ ruleId, line, column, message }) => {
      const ruleData = metricsByRule[ruleId] || { count: 0 };
      ruleData.count += 1;
      metricsByRule[ruleId] = ruleData;

      occurrencesData.push({
        rule: ruleId,
        message,
        file: result.filePath,
        line,
        column,
        ts: DATETIME,
      });
    });
  });

  // Transform data for Google Sheets
  const metricsData = Object.entries(metricsByRule).map(([rule, { count }]) => [
    'ESLint',
    rule,
    enrichedRules[rule]?.description || 'N/A',
    `${count}`,
    DATETIME,
  ]);

  occurrencesData = occurrencesData.map(
    ({ rule, message, file, line, column }) => [
      rule,
      enrichedRules[rule]?.description || 'N/A',
      message,
      file,
      `${line}`,
      `${column}`,
      DATETIME,
    ],
  );

  const aggregatedHistoryHeaders = [
    'Process',
    'Rule',
    'Description',
    'Count',
    'Timestamp',
  ];
  const eslintBacklogHeaders = [
    'Rule',
    'Rule Description',
    'ESLint Message',
    'File',
    'Line',
    'Column',
    'Timestamp',
  ];

  try {
    await writeToGoogleSheet(
      metricsData,
      'Aggregated History!A:E',
      aggregatedHistoryHeaders,
      true,
    );

    await writeToGoogleSheet(
      occurrencesData,
      'ESLint Backlog!A:G',
      eslintBacklogHeaders,
    );
  } catch (error) {
    console.error('Error writing to Google Sheets:', error);
  }
};
