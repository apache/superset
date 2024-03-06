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
import rison from 'rison';
import {
  checkUploadExtensions,
  getAlreadyExists,
  getFilterValues,
  getPasswordsNeeded,
  getSSHPasswordsNeeded,
  getSSHPrivateKeysNeeded,
  getSSHPrivateKeyPasswordsNeeded,
  hasTerminalValidation,
  isAlreadyExists,
  isNeedsPassword,
  isNeedsSSHPassword,
  isNeedsSSHPrivateKey,
  isNeedsSSHPrivateKeyPassword,
} from 'src/views/CRUD/utils';
import { User } from 'src/types/bootstrapTypes';
import { WelcomeTable } from 'src/features/home/types';
import { Filter, TableTab } from './types';

const terminalErrors = {
  errors: [
    {
      message: 'Error importing database',
      error_type: 'GENERIC_COMMAND_ERROR',
      level: 'warning',
      extra: {
        'metadata.yaml': { type: ['Must be equal to Database.'] },
        issue_codes: [
          {
            code: 1010,
            message:
              'Issue 1010 - Superset encountered an error while running a command.',
          },
        ],
      },
    },
  ],
};

const terminalErrorsWithOnlyIssuesCode = {
  errors: [
    {
      message: 'Error importing database',
      error_type: 'GENERIC_COMMAND_ERROR',
      level: 'warning',
      extra: {
        issue_codes: [
          {
            code: 1010,
            message:
              'Issue 1010 - Superset encountered an error while running a command.',
          },
        ],
      },
    },
  ],
};

const overwriteNeededErrors = {
  errors: [
    {
      message: 'Error importing database',
      error_type: 'GENERIC_COMMAND_ERROR',
      level: 'warning',
      extra: {
        'databases/imported_database.yaml':
          'Database already exists and `overwrite=true` was not passed',
        issue_codes: [
          {
            code: 1010,
            message:
              'Issue 1010 - Superset encountered an error while running a command.',
          },
        ],
      },
    },
  ],
};

const passwordNeededErrors = {
  errors: [
    {
      message: 'Error importing database',
      error_type: 'GENERIC_COMMAND_ERROR',
      level: 'warning',
      extra: {
        'databases/imported_database.yaml': {
          _schema: ['Must provide a password for the database'],
        },
        issue_codes: [
          {
            code: 1010,
            message:
              'Issue 1010 - Superset encountered an error while running a command.',
          },
        ],
      },
    },
  ],
};

const sshTunnelPasswordNeededErrors = {
  errors: [
    {
      message: 'Error importing database',
      error_type: 'GENERIC_COMMAND_ERROR',
      level: 'warning',
      extra: {
        'databases/imported_database.yaml': {
          _schema: ['Must provide a password for the ssh tunnel'],
        },
        issue_codes: [
          {
            code: 1010,
            message:
              'Issue 1010 - Superset encountered an error while running a command.',
          },
        ],
      },
    },
  ],
};

const sshTunnelPrivateKeyNeededErrors = {
  errors: [
    {
      message: 'Error importing database',
      error_type: 'GENERIC_COMMAND_ERROR',
      level: 'warning',
      extra: {
        'databases/imported_database.yaml': {
          _schema: ['Must provide a private key for the ssh tunnel'],
        },
        issue_codes: [
          {
            code: 1010,
            message:
              'Issue 1010 - Superset encountered an error while running a command.',
          },
        ],
      },
    },
  ],
};

const sshTunnelPrivateKeyPasswordNeededErrors = {
  errors: [
    {
      message: 'Error importing database',
      error_type: 'GENERIC_COMMAND_ERROR',
      level: 'warning',
      extra: {
        'databases/imported_database.yaml': {
          _schema: ['Must provide a private key password for the ssh tunnel'],
        },
        issue_codes: [
          {
            code: 1010,
            message:
              'Issue 1010 - Superset encountered an error while running a command.',
          },
        ],
      },
    },
  ],
};

test('identifies error payloads indicating that password is needed', () => {
  let needsPassword;

  needsPassword = isNeedsPassword({
    _schema: ['Must provide a password for the database'],
  });
  expect(needsPassword).toBe(true);

  needsPassword = isNeedsPassword(
    'Database already exists and `overwrite=true` was not passed',
  );
  expect(needsPassword).toBe(false);

  needsPassword = isNeedsPassword({ type: ['Must be equal to Database.'] });
  expect(needsPassword).toBe(false);
});

test('identifies error payloads indicating that ssh_tunnel password is needed', () => {
  let needsSSHTunnelPassword;

  needsSSHTunnelPassword = isNeedsSSHPassword({
    _schema: ['Must provide a password for the ssh tunnel'],
  });
  expect(needsSSHTunnelPassword).toBe(true);

  needsSSHTunnelPassword = isNeedsSSHPassword(
    'Database already exists and `overwrite=true` was not passed',
  );
  expect(needsSSHTunnelPassword).toBe(false);

  needsSSHTunnelPassword = isNeedsSSHPassword({
    type: ['Must be equal to Database.'],
  });
  expect(needsSSHTunnelPassword).toBe(false);
});

test('identifies error payloads indicating that ssh_tunnel private_key is needed', () => {
  let needsSSHTunnelPrivateKey;

  needsSSHTunnelPrivateKey = isNeedsSSHPrivateKey({
    _schema: ['Must provide a private key for the ssh tunnel'],
  });
  expect(needsSSHTunnelPrivateKey).toBe(true);

  needsSSHTunnelPrivateKey = isNeedsSSHPrivateKey(
    'Database already exists and `overwrite=true` was not passed',
  );
  expect(needsSSHTunnelPrivateKey).toBe(false);

  needsSSHTunnelPrivateKey = isNeedsSSHPrivateKey({
    type: ['Must be equal to Database.'],
  });
  expect(needsSSHTunnelPrivateKey).toBe(false);
});

test('identifies error payloads indicating that ssh_tunnel private_key_password is needed', () => {
  let needsSSHTunnelPrivateKeyPassword;

  needsSSHTunnelPrivateKeyPassword = isNeedsSSHPrivateKeyPassword({
    _schema: ['Must provide a private key password for the ssh tunnel'],
  });
  expect(needsSSHTunnelPrivateKeyPassword).toBe(true);

  needsSSHTunnelPrivateKeyPassword = isNeedsSSHPrivateKeyPassword(
    'Database already exists and `overwrite=true` was not passed',
  );
  expect(needsSSHTunnelPrivateKeyPassword).toBe(false);

  needsSSHTunnelPrivateKeyPassword = isNeedsSSHPrivateKeyPassword({
    type: ['Must be equal to Database.'],
  });
  expect(needsSSHTunnelPrivateKeyPassword).toBe(false);
});

test('identifies error payloads indicating that overwrite confirmation is needed', () => {
  let alreadyExists;

  alreadyExists = isAlreadyExists(
    'Database already exists and `overwrite=true` was not passed',
  );
  expect(alreadyExists).toBe(true);

  alreadyExists = isAlreadyExists({
    _schema: ['Must provide a password for the database'],
  });
  expect(alreadyExists).toBe(false);

  alreadyExists = isAlreadyExists({ type: ['Must be equal to Database.'] });
  expect(alreadyExists).toBe(false);
});

test('extracts DB configuration files that need passwords', () => {
  const passwordsNeeded = getPasswordsNeeded(passwordNeededErrors.errors);
  expect(passwordsNeeded).toEqual(['databases/imported_database.yaml']);
});

test('extracts DB configuration files that need ssh_tunnel passwords', () => {
  const sshPasswordsNeeded = getSSHPasswordsNeeded(
    sshTunnelPasswordNeededErrors.errors,
  );
  expect(sshPasswordsNeeded).toEqual(['databases/imported_database.yaml']);
});

test('extracts DB configuration files that need ssh_tunnel private_keys', () => {
  const sshPrivateKeysNeeded = getSSHPrivateKeysNeeded(
    sshTunnelPrivateKeyNeededErrors.errors,
  );
  expect(sshPrivateKeysNeeded).toEqual(['databases/imported_database.yaml']);
});

test('extracts DB configuration files that need ssh_tunnel private_key_passwords', () => {
  const sshPrivateKeyPasswordsNeeded = getSSHPrivateKeyPasswordsNeeded(
    sshTunnelPrivateKeyPasswordNeededErrors.errors,
  );
  expect(sshPrivateKeyPasswordsNeeded).toEqual([
    'databases/imported_database.yaml',
  ]);
});

test('extracts files that need overwrite confirmation', () => {
  const alreadyExists = getAlreadyExists(overwriteNeededErrors.errors);
  expect(alreadyExists).toEqual(['databases/imported_database.yaml']);
});

test('detects if the error message is terminal or if it requires uses intervention', () => {
  let isTerminal;

  isTerminal = hasTerminalValidation(terminalErrors.errors);
  expect(isTerminal).toBe(true);

  isTerminal = hasTerminalValidation(overwriteNeededErrors.errors);
  expect(isTerminal).toBe(false);

  isTerminal = hasTerminalValidation(passwordNeededErrors.errors);
  expect(isTerminal).toBe(false);

  isTerminal = hasTerminalValidation(sshTunnelPasswordNeededErrors.errors);
  expect(isTerminal).toBe(false);

  isTerminal = hasTerminalValidation(sshTunnelPrivateKeyNeededErrors.errors);
  expect(isTerminal).toBe(false);

  isTerminal = hasTerminalValidation(
    sshTunnelPrivateKeyPasswordNeededErrors.errors,
  );
  expect(isTerminal).toBe(false);
});

test('error message is terminal when the "extra" field contains only the "issue_codes" key', () => {
  expect(hasTerminalValidation(terminalErrorsWithOnlyIssuesCode.errors)).toBe(
    true,
  );
});

test('does not ask for password when the import type is wrong', () => {
  const error = {
    errors: [
      {
        message: 'Error importing database',
        error_type: 'GENERIC_COMMAND_ERROR',
        level: 'warning',
        extra: {
          'metadata.yaml': {
            type: ['Must be equal to Database.'],
          },
          'databases/examples.yaml': {
            _schema: ['Must provide a password for the database'],
          },
          issue_codes: [
            {
              code: 1010,
              message:
                'Issue 1010 - Superset encountered an error while running a command.',
            },
          ],
        },
      },
    ],
  };
  expect(hasTerminalValidation(error.errors)).toBe(true);
});

test('successfully modified rison to encode correctly', () => {
  const problemCharacters = '& # ? ^ { } [ ] | " = + `';

  problemCharacters.split(' ').forEach(char => {
    const testObject = { test: char };

    const actualEncoding = rison.encode(testObject);
    const expectedEncoding = `(test:'${char}')`; // Ex: (test:'&')

    expect(actualEncoding).toEqual(expectedEncoding);
    expect(rison.decode(actualEncoding)).toEqual(testObject);
  });
});

test('checkUploadExtensions should return valid upload extensions', () => {
  const uploadExtensionTest = ['a', 'b', 'c'];
  const randomExtension = ['a', 'c'];
  const randomExtensionTwo = ['c'];
  const randomExtensionThree: Array<any> = [];
  expect(
    checkUploadExtensions(randomExtension, uploadExtensionTest),
  ).toBeTruthy();
  expect(
    checkUploadExtensions(randomExtensionTwo, uploadExtensionTest),
  ).toBeTruthy();
  expect(
    checkUploadExtensions(randomExtensionThree, uploadExtensionTest),
  ).toBeFalsy();
});

test('getFilterValues', () => {
  const userId = 1234;
  const mockUser: User = {
    firstName: 'foo',
    lastName: 'bar',
    username: 'baz',
    userId,
    isActive: true,
    isAnonymous: false,
  };
  const testCases: [
    TableTab,
    WelcomeTable,
    User | undefined,
    Filter[] | undefined,
    ReturnType<typeof getFilterValues>,
  ][] = [
    [
      TableTab.Mine,
      WelcomeTable.SavedQueries,
      mockUser,
      undefined,
      [
        {
          id: 'created_by',
          operator: 'rel_o_m',
          value: `${userId}`,
        },
      ],
    ],
    [
      TableTab.Favorite,
      WelcomeTable.SavedQueries,
      mockUser,
      undefined,
      [
        {
          id: 'id',
          operator: 'saved_query_is_fav',
          value: true,
        },
      ],
    ],
    [
      TableTab.Created,
      WelcomeTable.Charts,
      mockUser,
      undefined,
      [
        {
          id: 'created_by',
          operator: 'rel_o_m',
          value: `${userId}`,
        },
      ],
    ],
    [
      TableTab.Created,
      WelcomeTable.Dashboards,
      mockUser,
      undefined,
      [
        {
          id: 'created_by',
          operator: 'rel_o_m',
          value: `${userId}`,
        },
      ],
    ],
    [
      TableTab.Created,
      WelcomeTable.Recents,
      mockUser,
      undefined,
      [
        {
          id: 'created_by',
          operator: 'rel_o_m',
          value: `${userId}`,
        },
      ],
    ],
    [
      TableTab.Mine,
      WelcomeTable.Charts,
      mockUser,
      undefined,
      [
        {
          id: 'owners',
          operator: 'rel_m_m',
          value: `${userId}`,
        },
      ],
    ],
    [
      TableTab.Mine,
      WelcomeTable.Dashboards,
      mockUser,
      undefined,
      [
        {
          id: 'owners',
          operator: 'rel_m_m',
          value: `${userId}`,
        },
      ],
    ],
    [
      TableTab.Favorite,
      WelcomeTable.Dashboards,
      mockUser,
      undefined,
      [
        {
          id: 'id',
          operator: 'dashboard_is_favorite',
          value: true,
        },
      ],
    ],
    [
      TableTab.Favorite,
      WelcomeTable.Charts,
      mockUser,
      undefined,
      [
        {
          id: 'id',
          operator: 'chart_is_favorite',
          value: true,
        },
      ],
    ],
    [
      TableTab.Other,
      WelcomeTable.Charts,
      mockUser,
      [
        {
          col: 'created_by',
          opr: 'rel_o_m',
          value: 0,
        },
      ],
      [
        {
          id: 'created_by',
          operator: 'rel_o_m',
          value: 0,
        },
      ],
    ],
  ];
  testCases.forEach(testCase => {
    const [tab, welcomeTable, user, otherTabFilters, expectedValue] = testCase;
    expect(getFilterValues(tab, welcomeTable, user, otherTabFilters)).toEqual(
      expectedValue,
    );
  });
});
