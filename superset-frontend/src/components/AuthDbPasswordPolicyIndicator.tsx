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
import {
  css,
  styled,
  useTheme,
  type SupersetTheme,
} from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import {
  Flex,
  Icons,
  Popover,
  Progress,
  Typography,
} from '@superset-ui/core/components';
import {
  AUTH_DB_BCRYPT_MAX_PASSWORD_BYTES,
  AUTH_DB_DEFAULT_PASSWORD_POLICY,
  AuthDbPasswordPolicy,
  getAuthDbPasswordPolicyChecks,
} from 'src/utils/generateAuthDbPassword';

interface AuthDbPasswordPolicyIndicatorProps {
  password: string;
  policy?: AuthDbPasswordPolicy;
}

const StrengthBarContainer = styled.div`
  flex: 1;
  cursor: help;
`;

const Checklist = styled.div`
  ${({ theme }) => css`
    min-width: ${theme.sizeUnit * 70}px;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
  `}
`;

const ChecklistItem = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    font-size: ${theme.fontSize}px;
  `}
`;

const requirementText = {
  minLength: (minLength: number) => t('At least %s characters', minLength),
  uppercase: t('Contains an uppercase letter'),
  lowercase: t('Contains a lowercase letter'),
  digit: t('Contains a digit'),
  special: t('Contains a special character'),
  commonPassword: t('Is not a common password'),
  bcryptByteLimit: t(
    'At most %s bytes (bcrypt limit)',
    AUTH_DB_BCRYPT_MAX_PASSWORD_BYTES,
  ),
};

function getStrengthState(percent: number, theme: SupersetTheme) {
  if (percent <= 33) {
    return { color: theme.colorError, label: t('Very weak') };
  }
  if (percent <= 50) {
    return { color: theme.colorWarningText, label: t('Weak') };
  }
  if (percent <= 67) {
    return { color: theme.colorWarning, label: t('Medium') };
  }
  if (percent <= 83) {
    return { color: theme.colorSuccess, label: t('Strong') };
  }
  return { color: theme.colorSuccessTextActive, label: t('Very strong') };
}

export default function AuthDbPasswordPolicyIndicator({
  password,
  policy = AUTH_DB_DEFAULT_PASSWORD_POLICY,
}: AuthDbPasswordPolicyIndicatorProps) {
  const theme = useTheme();
  const checks = getAuthDbPasswordPolicyChecks(password, policy);
  const hasPassword = password.length > 0;
  const checklist = [
    {
      label: requirementText.minLength(policy.password_min_length),
      passed: hasPassword && checks.minLength,
    },
    ...(policy.password_require_uppercase
      ? [
          {
            label: requirementText.uppercase,
            passed: hasPassword && checks.uppercase,
          },
        ]
      : []),
    ...(policy.password_require_lowercase
      ? [
          {
            label: requirementText.lowercase,
            passed: hasPassword && checks.lowercase,
          },
        ]
      : []),
    ...(policy.password_require_digit
      ? [{ label: requirementText.digit, passed: hasPassword && checks.digit }]
      : []),
    ...(policy.password_require_special
      ? [
          {
            label: requirementText.special,
            passed: hasPassword && checks.special,
          },
        ]
      : []),
    ...(policy.password_common_list_check
      ? [
          {
            label: requirementText.commonPassword,
            passed: hasPassword && checks.commonPassword,
          },
        ]
      : []),
    ...((policy.password_hash_algorithm ?? 'bcrypt') === 'bcrypt'
      ? [
          {
            label: requirementText.bcryptByteLimit,
            passed: hasPassword && checks.bcryptByteLimit,
          },
        ]
      : []),
  ];
  const passedChecks = checklist.filter(item => item.passed).length;
  const percent = Math.round((passedChecks / checklist.length) * 100);
  const strength = getStrengthState(percent, theme);

  return (
    <Flex align="center" gap={theme.sizeUnit * 2}>
      <Popover
        trigger="hover"
        placement="topLeft"
        content={
          <Checklist>
            {checklist.map(item => (
              <ChecklistItem key={item.label}>
                {item.passed ? (
                  <Icons.CheckCircleFilled iconColor="success" iconSize="m" />
                ) : (
                  <Icons.CloseCircleOutlined iconColor="danger" iconSize="m" />
                )}
                <Typography.Text>{item.label}</Typography.Text>
              </ChecklistItem>
            ))}
          </Checklist>
        }
      >
        <StrengthBarContainer>
          <Progress
            percent={percent}
            showInfo={false}
            strokeColor={strength.color}
            size="small"
            style={{ marginBottom: 0 }}
          />
        </StrengthBarContainer>
      </Popover>
      <Typography.Text type="secondary">{strength.label}</Typography.Text>
    </Flex>
  );
}
