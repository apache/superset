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
import { SupersetTheme, useTheme } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { ErrorAlert } from 'src/components';
import { EncryptedExtraExpiration } from '../types';
import { ExpiryLine, expiryLines, ReplacedTokens } from './expiry';
import { antDAlertStyles, StyledAlertMargin } from './styles';

// One token is named in the title; several share a plain one.
const alertTitle = (lines: ExpiryLine[]) => {
  if (lines.length > 1) {
    return t('Tokens expired or expiring soon');
  }
  const [{ label, expired }] = lines;
  return expired ? t('%s expired', label) : t('%s expires soon', label);
};

/**
 * Warns, when an edit opens, about stored JWTs that have expired or expire soon,
 * and about a new token pasted over one of them that does too.
 */
const StoredSecretExpiryAlert = ({
  isEditMode,
  sensitiveFields,
  expirations,
  replacedSecrets,
  onGoToSecureExtra,
}: {
  isEditMode: boolean;
  sensitiveFields?: Record<string, string>;
  expirations?: Record<string, EncryptedExtraExpiration>;
  replacedSecrets?: ReplacedTokens;
  onGoToSecureExtra: () => void;
}) => {
  const theme = useTheme();
  const lines =
    isEditMode && expirations
      ? expiryLines(sensitiveFields ?? {}, expirations, replacedSecrets).filter(
          ({ severity }) => severity !== 'success',
        )
      : [];
  if (lines.length === 0) {
    return null;
  }
  return (
    <StyledAlertMargin>
      {/* Titled like the connection error alert of this modal. */}
      <ErrorAlert
        css={(alertTheme: SupersetTheme) => antDAlertStyles(alertTheme)}
        errorType={alertTitle(lines)}
        type={lines.some(({ expired }) => expired) ? 'error' : 'warning'}
        message={
          <>
            {lines.map(({ path, text }) => (
              <div key={path}>{text}</div>
            ))}
            {lines.some(({ replaced }) => !replaced) && (
              <div>
                {t('Paste a new token into Secure extra and click Finish.')}{' '}
                <Button
                  buttonStyle="link"
                  buttonSize="xsmall"
                  // The link style defaults to the small button text.
                  styleConfig={{ paddingInline: 0, fontSize: theme.fontSize }}
                  data-test="go-to-secure-extra"
                  onClick={onGoToSecureExtra}
                >
                  {t('Go to Secure extra')}
                </Button>
              </div>
            )}
          </>
        }
      />
    </StyledAlertMargin>
  );
};

export default StoredSecretExpiryAlert;
