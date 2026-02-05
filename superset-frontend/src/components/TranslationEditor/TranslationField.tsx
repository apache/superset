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
import { useCallback } from 'react';
import { css } from '@apache-superset/core/ui';
import { Icons, Input } from '@superset-ui/core/components';

interface TranslationFieldProps {
  /** BCP 47 locale code (e.g., "de", "pt-BR"). */
  locale: string;
  /** Human-readable locale name (e.g., "German"). */
  localeName: string;
  /** Translation value for this locale. */
  value: string;
  /** Called with the new translation string on input change. */
  onChange: (value: string) => void;
  /** Called when the user removes this locale translation. */
  onRemove: () => void;
}

/**
 * Single translation row: locale label, input field, and remove button.
 * Used inside TranslationEditorModal for each locale.
 */
export default function TranslationField({
  locale,
  localeName,
  value,
  onChange,
  onRemove,
}: TranslationFieldProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: 8px;
      `}
      data-test={`translation-field-${locale}`}
    >
      <span
        css={css`
          min-width: 120px;
          white-space: nowrap;
        `}
      >
        {localeName} ({locale})
      </span>
      <Input
        value={value}
        onChange={handleChange}
        data-test={`translation-input-${locale}`}
      />
      <Icons.DeleteOutlined
        iconSize="m"
        onClick={onRemove}
        data-test={`translation-remove-${locale}`}
        css={css`
          cursor: pointer;
          flex-shrink: 0;
        `}
      />
    </div>
  );
}
