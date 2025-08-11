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
import { styled, t, SupersetClient } from '@superset-ui/core';
import { Button, Icons, Tooltip } from '@superset-ui/core/components';

export type ExpressionType = 'metric' | 'column' | 'filter';

interface SqlExpressionValidatorButtonProps {
  expression: string;
  expressionType?: ExpressionType;
  databaseId?: number;
  tableName?: string;
  schema?: string;
  catalog?: string;
  buttonSize?: 'small' | 'default' | 'xsmall';
  buttonStyle?: 'primary' | 'secondary' | 'tertiary' | 'danger' | 'link';
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

const StyledValidationIcon = styled.span<{ isValid?: boolean }>`
  margin-left: ${({ theme }) => theme.sizeUnit}px;
  color: ${({ theme, isValid }) =>
    isValid === true
      ? theme.colors.success.base
      : isValid === false
        ? theme.colors.error.base
        : 'inherit'};
`;

export default function SqlExpressionValidatorButton({
  expression,
  expressionType = 'column',
  databaseId,
  tableName,
  schema,
  catalog,
  buttonSize = 'small',
  buttonStyle = 'secondary',
  onValidationComplete,
}: SqlExpressionValidatorButtonProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationState, setValidationState] = useState<{
    isValid?: boolean;
    errors?: ValidationError[];
    lastValidatedExpression?: string;
  }>({});

  const handleValidate = useCallback(async () => {
    if (!expression || !databaseId) {
      const error = {
        message: !expression
          ? t('Expression cannot be empty')
          : t('Database ID is required for validation'),
      };
      setValidationState({
        isValid: false,
        errors: [error],
        lastValidatedExpression: expression,
      });
      onValidationComplete?.(false, [error]);
      return;
    }

    setIsValidating(true);

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
        setValidationState({
          isValid: false,
          errors: data.result,
          lastValidatedExpression: expression,
        });
        onValidationComplete?.(false, data.result);
      } else {
        // No errors, validation successful
        setValidationState({
          isValid: true,
          lastValidatedExpression: expression,
        });
        onValidationComplete?.(true);
      }
    } catch (error) {
      console.error('Error validating expression:', error);
      const validationError = {
        message: t('Failed to validate expression. Please try again.'),
      };
      setValidationState({
        isValid: false,
        errors: [validationError],
        lastValidatedExpression: expression,
      });
      onValidationComplete?.(false, [validationError]);
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

  // Reset validation state if expression changed since last validation
  const hasExpressionChanged =
    validationState.lastValidatedExpression !== undefined &&
    validationState.lastValidatedExpression !== expression;

  const buttonContent = (
    <>
      {t('Validate')}
      {validationState.isValid !== undefined && !hasExpressionChanged && (
        <StyledValidationIcon isValid={validationState.isValid}>
          {validationState.isValid ? (
            <Icons.CheckCircleOutlined />
          ) : (
            <Icons.WarningOutlined />
          )}
        </StyledValidationIcon>
      )}
    </>
  );

  const tooltipContent = validationState.errors?.length ? (
    <div>
      {validationState.errors.map((error, index) => (
        <div key={index}>
          {error.line_number !== undefined && (
            <span>{t('Line %(line)s', { line: error.line_number })}: </span>
          )}
          {error.message}
        </div>
      ))}
    </div>
  ) : validationState.isValid === true && !hasExpressionChanged ? (
    t('Expression is valid')
  ) : null;

  const button = (
    <Button
      buttonSize={buttonSize}
      buttonStyle={buttonStyle}
      loading={isValidating}
      onClick={handleValidate}
      disabled={!expression || !databaseId}
    >
      {buttonContent}
    </Button>
  );

  return tooltipContent ? (
    <Tooltip title={tooltipContent} placement="top">
      {button}
    </Tooltip>
  ) : (
    button
  );
}
