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
const { execSync } = require('child_process');
const { GoogleAuth } = require('google-auth-library');
const googleSheets = require('@googleapis/sheets');

const { SPREADSHEET_ID } = process.env;
const SERVICE_ACCOUNT_KEY = JSON.parse(process.env.SERVICE_ACCOUNT_KEY || '{}');

// Only set up Google Sheets if we have credentials
let sheets;
if (SERVICE_ACCOUNT_KEY.client_email) {
  const auth = new GoogleAuth({
    credentials: SERVICE_ACCOUNT_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheets = googleSheets.sheets({ version: 'v4', auth });
}

const DATETIME = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

/**
 * Turn an oxlint diagnostic code into the canonical rule id used by the metrics
 * series.
 *
 * oxlint reports `<plugin>(<rule>)`, where the plugin is the linter the rule came
 * from: `eslint(no-console)`, `react-hooks(exhaustive-deps)`, `react(jsx-key)`,
 * `jest(no-conditional-expect)`, `oxc(erasing-op)`, and the legacy
 * `eslint-plugin-unicorn(no-new-array)` spelling.
 *
 * `eslint` is the implicit namespace, so its rules keep their bare name and stay
 * comparable with the rows recorded before the oxlint migration. Every other
 * plugin becomes `<plugin>/<rule>`, which is the id those rules are known by in
 * config and in the pre-migration history.
 *
 * @param {string | undefined} code the diagnostic's `code` field
 * @returns {string} the rule id to record
 */
function parseRuleId(code) {
  if (!code) {
    return 'unknown';
  }

  const match = code.match(/^([\w-]+)\(([^)]+)\)$/);
  if (!match) {
    return code;
  }

  const [, namespace, rule] = match;
  if (namespace === 'eslint') {
    return rule;
  }

  // `eslint-plugin-unicorn(...)` is the same rule as `unicorn/...`
  const plugin = namespace.replace(/^eslint-plugin-/, '');
  return `${plugin}/${rule}`;
}

async function writeToGoogleSheet(data, range, headers, append = false) {
  if (!sheets) {
    console.log('No Google Sheets credentials, skipping upload');
    return;
  }

  const request = {
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values: append ? data : [headers, ...data] },
  };

  const method = append ? 'append' : 'update';
  await sheets.spreadsheets.values[method](request);
}

// Run OXC and get JSON output
async function runOxlintAndProcess() {
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
    'no-restricted-imports': {
      description:
        "This rule catches several things that shouldn't be used anymore. LESS, antD, etc. See individual occurrence messages for details",
    },
    'no-console': {
      description:
        "We don't want a bunch of console noise, but you can use the `logger` from `@superset-ui/core` when there's a reason to.",
    },
  };

  try {
    // Run OXC with JSON format
    console.log('Running OXC linter...');
    // `oxlint.json` is not the `.oxlintrc.json` oxlint auto-discovers, so the
    // config has to be passed explicitly or the run reports oxlint's defaults
    // instead of the project's ruleset. Matches the `lint` scripts in
    // package.json.
    const oxlintOutput = execSync(
      'npx oxlint --config oxlint.json --format json',
      {
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
        stdio: ['pipe', 'pipe', 'ignore'], // Ignore stderr to avoid error output
      },
    );

    const results = JSON.parse(oxlintOutput);

    // Process OXC JSON output
    const metricsByRule = {};
    let occurrencesData = [];

    // OXC JSON format has diagnostics array
    if (results.diagnostics && Array.isArray(results.diagnostics)) {
      results.diagnostics.forEach(diagnostic => {
        const ruleId = parseRuleId(diagnostic.code);

        const file = diagnostic.filename || 'unknown';
        const line = diagnostic.labels?.[0]?.span?.line || 0;
        const column = diagnostic.labels?.[0]?.span?.column || 0;
        const message = diagnostic.message || '';

        const ruleData = metricsByRule[ruleId] || { count: 0 };
        ruleData.count += 1;
        metricsByRule[ruleId] = ruleData;

        occurrencesData.push({
          rule: ruleId,
          message,
          file,
          line,
          column,
          ts: DATETIME,
        });
      });
    }

    console.log(
      `OXC found ${results.diagnostics?.length || 0} issues across ${results.number_of_files} files`,
    );

    // Also run minimal ESLint for custom rules and merge results
    console.log('Running minimal ESLint for custom rules...');
    let eslintOutput = '[]';
    try {
      // Run ESLint and capture output directly.
      // Flat config (eslint.config.minimal.js) is explicitly selected via
      // --config; ESLint v9+/v10 no longer support eslintrc or --no-eslintrc.
      eslintOutput = execSync(
        'npx eslint --config eslint.config.minimal.js --no-inline-config --format json src',
        {
          encoding: 'utf8',
          maxBuffer: 50 * 1024 * 1024,
          stdio: ['pipe', 'pipe', 'ignore'], // Ignore stderr
        },
      );
    } catch (e) {
      // ESLint exits with non-zero when it finds issues, capture the stdout
      if (e.stdout) {
        eslintOutput = e.stdout.toString();
      }
    }

    // Parse minimal ESLint output
    try {
      const eslintResults = JSON.parse(eslintOutput);

      eslintResults.forEach(result => {
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

      console.log(
        `ESLint found ${eslintResults.reduce((sum, r) => sum + r.messages.length, 0)} custom rule violations`,
      );
    } catch (e) {
      console.log('No ESLint issues found or parsing error:', e.message);
    }

    // Transform data for Google Sheets
    const metricsData = Object.entries(metricsByRule).map(
      ([rule, { count }]) => [
        'OXC+ESLint',
        rule,
        enrichedRules[rule]?.description || 'N/A',
        `${count}`,
        DATETIME,
      ],
    );

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

    console.log(
      `Found ${Object.keys(metricsByRule).length} unique rules with ${occurrencesData.length} total occurrences`,
    );

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

    console.log('Successfully uploaded metrics to Google Sheets');
  } catch (error) {
    console.error('Error processing lint results:', error);
    process.exit(1);
  }
}

// Run the process, unless this file was imported (e.g. by a test) rather than
// executed, in which case nothing should be linted or uploaded on import.
if (require.main === module) {
  runOxlintAndProcess().catch(console.error);
}

module.exports = { parseRuleId };
