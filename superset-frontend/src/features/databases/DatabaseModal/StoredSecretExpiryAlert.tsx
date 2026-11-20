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
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { SupersetTheme } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { EncryptedExtraExpiration } from '../types';
import { expiryLines } from './expiry';
import { antDAlertStyles, StyledAlertMargin } from './styles';

/**
 * Warns, when an edit opens, about stored JWTs that have expired or expire soon.
 */
const StoredSecretExpiryAlert = ({
  isEditMode,
  sensitiveFields,
  expirations,
  onGoToSecureExtra,
}: {
  isEditMode: boolean;
  sensitiveFields?: Record<string, string>;
  expirations?: Record<string, EncryptedExtraExpiration>;
  onGoToSecureExtra: () => void;
}) => {
  const lines =
    isEditMode && expirations
      ? expiryLines(sensitiveFields ?? {}, expirations)
      : [];
  if (lines.length === 0) {
    return null;
  }
  return (
    <StyledAlertMargin>
      <Alert
        css={(theme: SupersetTheme) => antDAlertStyles(theme)}
        type={lines.some(({ expired }) => expired) ? 'error' : 'warning'}
        showIcon
      >
        {lines.map(({ path, text }) => (
          <div key={path}>{text}</div>
        ))}
        <div>
          {t('Paste a new token into Secure extra and click Finish.')}{' '}
          <Button
            buttonStyle="link"
            buttonSize="xsmall"
            styleConfig={{ paddingInline: 0 }}
            data-test="go-to-secure-extra"
            onClick={onGoToSecureExtra}
          >
            {t('Go to Secure extra')}
          </Button>
        </div>
      </Alert>
    </StyledAlertMargin>
  );
};

export default StoredSecretExpiryAlert;
