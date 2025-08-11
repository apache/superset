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
import { useCallback, useState, useEffect } from 'react';
import { styled, t, SupersetClient } from '@superset-ui/core';
import {
  SQLEditor,
  Button,
  Icons,
  Tooltip,
} from '@superset-ui/core/components';

export type ExpressionType = 'metric' | 'column' | 'filter';

interface SQLEditorWithValidationProps {
  // SQLEditor props
  value: string;
  onChange: (value: string) => void;
  width?: string;
  height?: string;
  showGutter?: boolean;
  editorProps?: any;
  enableLiveAutocompletion?: boolean;
  className?: string;
  wrapEnabled?: boolean;
  keywords?: string[];
  showLoadingForImport?: boolean;
  onRef?: (ref: any) => void;
  // Validation props
  showValidation?: boolean;
  expressionType?: ExpressionType;
  databaseId?: number;
  tableName?: string;
  schema?: string;
  catalog?: string;
  clause?: string; // For filters: "WHERE" or "HAVING"
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

const StyledEditorContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const StyledValidationBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.sizeUnit}px;
  padding: ${({ theme }) => theme.sizeUnit}px 0;
  min-height: 32px;
`;

const StyledValidationMessage = styled.div<{
  isError?: boolean;
  isUnverified?: boolean;
  isValidating?: boolean;
}>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
  color: ${({ theme, isError, isUnverified, isValidating }) => {
    if (isUnverified || isValidating) return theme.colorTextTertiary;
    return isError ? theme.colorErrorText : theme.colorSuccessText;
  }};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  flex: 1;
  min-width: 0;

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

export default function SQLEditorWithValidation({
  // SQLEditor props
  value,
  onChange,
  width = '100%',
  height,
  showGutter = false,
  editorProps,
  enableLiveAutocompletion,
  className,
  wrapEnabled,
  keywords,
  showLoadingForImport,
  onRef,
  // Validation props
  showValidation = false,
  expressionType = 'column',
  databaseId,
  tableName,
  schema,
  catalog,
  clause,
  onValidationComplete,
}: SQLEditorWithValidationProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors?: ValidationError[];
  } | null>(null);

  // Reset validation state when value prop changes
  useEffect(() => {
    if (validationResult !== null || isValidating) {
      setValidationResult(null);
      setIsValidating(false);
    }
  }, [value]);

  const handleValidate = useCallback(async () => {
    if (!value || !databaseId) {
      const error = {
        message: !value
          ? t('Expression cannot be empty')
          : t('Database ID is required for validation'),
      };
      setValidationResult({
        isValid: false,
        errors: [error],
      });
      onValidationComplete?.(false, [error]);
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const endpoint = `/api/v1/database/${databaseId}/validate_expression/`;
      const payload = {
        expression: value,
        expression_type: expressionType,
        table_name: tableName,
        schema,
        catalog,
        clause,
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
      const validationError = {
        message: t('Failed to validate expression. Please try again.'),
      };
      setValidationResult({
        isValid: false,
        errors: [validationError],
      });
      onValidationComplete?.(false, [validationError]);
    } finally {
      setIsValidating(false);
    }
  }, [
    value,
    expressionType,
    databaseId,
    tableName,
    schema,
    catalog,
    clause,
    onValidationComplete,
  ]);

  // Reset validation when value changes
  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
      // Clear validation result when expression changes
      if (validationResult !== null) {
        setValidationResult(null);
      }
    },
    [onChange, validationResult],
  );

  return (
    <StyledEditorContainer>
      <SQLEditor
        ref={onRef}
        value={value}
        onChange={handleChange}
        width={width}
        height={height}
        showGutter={showGutter}
        editorProps={editorProps}
        enableLiveAutocompletion={enableLiveAutocompletion}
        className={className}
        wrapEnabled={wrapEnabled}
        keywords={keywords}
        showLoadingForImport={showLoadingForImport}
      />

      {showValidation && (
        <StyledValidationBar>
          <StyledValidationMessage
            isError={validationResult ? !validationResult.isValid : false}
            isUnverified={!validationResult && !isValidating}
            isValidating={isValidating}
          >
            {isValidating ? (
              <span>{t('Status: Validating...')}</span>
            ) : validationResult ? (
              <>
                {validationResult.isValid ? (
                  <>
                    <Icons.CheckCircleOutlined />
                    <span>{t('Status: Valid SQL expression')}</span>
                  </>
                ) : (
                  <>
                    <Icons.WarningOutlined />
                    <Tooltip
                      title={
                        validationResult.errors
                          ?.map(e => e.message)
                          .join('\n') || t('Invalid expression')
                      }
                      placement="top"
                    >
                      <span>
                        {t('Status: ')}
                        {validationResult.errors &&
                        validationResult.errors.length > 0
                          ? validationResult.errors[0].message
                          : t('Invalid expression')}
                      </span>
                    </Tooltip>
                  </>
                )}
              </>
            ) : (
              <span>{t('Status: Unverified')}</span>
            )}
          </StyledValidationMessage>
          <Button
            buttonSize="small"
            buttonStyle={validationResult ? 'secondary' : 'primary'}
            loading={isValidating}
            onClick={handleValidate}
            disabled={!value || !databaseId || isValidating}
          >
            {t('Validate')}
          </Button>
        </StyledValidationBar>
      )}
    </StyledEditorContainer>
  );
}
