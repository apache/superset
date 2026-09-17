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

import { FunctionComponent } from 'react';
import { t, SupersetTheme } from '@superset-ui/core';

import { getDatabaseDocumentationLinks } from 'src/views/CRUD/hooks';
import Alert from 'src/components/Alert';
import { antdWarningAlertStyles } from './styles';

const supersetTextDocs = getDatabaseDocumentationLinks();
export const DOCUMENTATION_LINK = supersetTextDocs
  ? supersetTextDocs.support
  : 'https://superset.apache.org/docs/databases/installing-database-drivers';

export interface IProps {
  errorMessage: string;
  showDbInstallInstructions: boolean;
}

const ErrorAlert: FunctionComponent<IProps> = ({
  errorMessage,
  showDbInstallInstructions,
}) => (
  <Alert
    closable={false}
    css={(theme: SupersetTheme) => antdWarningAlertStyles(theme)}
    type="error"
    showIcon
    message={errorMessage}
    description={
      showDbInstallInstructions ? (
        <>
          <br />
          {t(
            'Database driver for importing maybe not installed. Visit the Superset documentation page for installation instructions: ',
          )}
          <a
            href={DOCUMENTATION_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="additional-fields-alert-description"
          >
            {t('here')}
          </a>
          .
        </>
      ) : (
        ''
      )
    }
  />
);

export default ErrorAlert;
