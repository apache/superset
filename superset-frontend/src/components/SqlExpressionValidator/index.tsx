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
import { useState, useCallback } from 'react';
import { Button } from 'antd';
import { styled, t, SupersetClient, css, useTheme } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components';

export type ExpressionType = 'metric' | 'column' | 'filter';

interface SqlExpressionValidatorProps {
  expression: string;
  expressionType?: ExpressionType;
  databaseId?: number;
  tableName?: string;
  schema?: string;
  catalog?: string;
  className?: string;
  onValidationComplete?: (isValid: boolean, errors?: ValidationError[]) => void;
}

interface ValidationError {
  line_number?: number;
  start_column?: number;
  end_column?: number;
  message: string;
}

interface ValidationResponse {
  result: ValidationError[];
}

const StyledValidatorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const StyledButtonContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const StyledMessage = styled.div<{ isError?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  background-color: ${({ theme, isError }) =>
    isError ? theme.colors.error.light2 : theme.colors.success.light2};
  color: ${({ theme, isError }) =>
    isError ? theme.colors.error.dark2 : theme.colors.success.dark2};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

const StyledErrorList = styled.ul`
  margin: 0;
  padding-left: ${({ theme }) => theme.sizeUnit * 4}px;
  list-style-type: none;
`;

const StyledErrorItem = styled.li`
  margin: ${({ theme }) => theme.sizeUnit}px 0;
  font-family: ${({ theme }) => theme.fontFamilyCode};
`;

export default function SqlExpressionValidator({
  expression,
  expressionType = 'column',
  databaseId,
  tableName,
  schema,
  catalog,
  className,
  onValidationComplete,
}: SqlExpressionValidatorProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors?: ValidationError[];
  } | null>(null);
  const theme = useTheme();

  const handleValidate = useCallback(async () => {
    if (!expression || !databaseId) {
      setValidationResult({
        isValid: false,
        errors: [
          {
            message: !expression
              ? t('Expression cannot be empty')
              : t('Database ID is required for validation'),
          },
        ],
      });
      onValidationComplete?.(false, [
        {
          message: !expression
            ? t('Expression cannot be empty')
            : t('Database ID is required for validation'),
        },
      ]);
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const endpoint = `/api/v1/database/${databaseId}/validate_expression/`;
      const payload = {
        expression,
        expression_type: expressionType,
        table_name: tableName,
        schema,
        catalog,
      };

      const response = await SupersetClient.post({
        endpoint,
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = response.json as ValidationResponse;

      if (data.result && data.result.length > 0) {
        // Has validation errors
        setValidationResult({
          isValid: false,
          errors: data.result,
        });
        onValidationComplete?.(false, data.result);
      } else {
        // No errors, validation successful
        setValidationResult({
          isValid: true,
        });
        onValidationComplete?.(true);
      }
    } catch (error) {
      console.error('Error validating expression:', error);
      setValidationResult({
        isValid: false,
        errors: [
          {
            message: t('Failed to validate expression. Please try again.'),
          },
        ],
      });
      onValidationComplete?.(false, [
        {
          message: t('Failed to validate expression. Please try again.'),
        },
      ]);
    } finally {
      setIsValidating(false);
    }
  }, [
    expression,
    expressionType,
    databaseId,
    tableName,
    schema,
    catalog,
    onValidationComplete,
  ]);

  return (
    <StyledValidatorContainer className={className}>
      <StyledButtonContainer>
        <Button
          type="primary"
          size="small"
          loading={isValidating}
          onClick={handleValidate}
          disabled={!expression || !databaseId}
        >
          {t('Validate')}
        </Button>

        {validationResult && (
          <StyledMessage isError={!validationResult.isValid}>
            {validationResult.isValid ? (
              <>
                <Icons.CheckCircleOutlined />
                <span>{t('Expression is valid')}</span>
              </>
            ) : (
              <>
                <Icons.WarningOutlined />
                <span>{t('Expression has errors')}</span>
              </>
            )}
          </StyledMessage>
        )}
      </StyledButtonContainer>

      {validationResult?.errors && validationResult.errors.length > 0 && (
        <StyledErrorList>
          {validationResult.errors.map((error, index) => (
            <StyledErrorItem key={index}>
              {error.line_number !== undefined && (
                <span
                  css={css`
                    color: ${theme.colors.grayscale.base};
                    margin-right: ${theme.sizeUnit * 2}px;
                  `}
                >
                  {t('Line %(line)s', { line: error.line_number })}
                  {error.start_column !== undefined && `:${error.start_column}`}
                  {' - '}
                </span>
              )}
              <span>{error.message}</span>
            </StyledErrorItem>
          ))}
        </StyledErrorList>
      )}
    </StyledValidatorContainer>
  );
}
