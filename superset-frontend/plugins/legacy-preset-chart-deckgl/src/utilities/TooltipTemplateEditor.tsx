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

import { useCallback, useEffect, useState } from 'react';
import { styled, css, useThemeMode } from '@superset-ui/core';
import { CodeEditor } from '@superset-ui/core/components';

const EditorContainer = styled.div`
  ${({ theme }) => css`
    min-height: ${theme.sizeUnit * 50}px;
    width: 100%;

    .ace_editor {
      font-family: ${theme.fontFamilyCode};
    }
  `}
`;

interface TooltipTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  name: string;
}

export function TooltipTemplateEditor({
  value,
  onChange,
  name,
}: TooltipTemplateEditorProps) {
  const [localValue, setLocalValue] = useState(value);
  const isDarkMode = useThemeMode();

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);
      onChange(newValue);
    },
    [onChange],
  );

  return (
    <div>
      <EditorContainer>
        <CodeEditor
          mode="handlebars"
          theme={isDarkMode ? 'dark' : 'light'}
          name={name}
          height="200px"
          width="100%"
          value={localValue}
          onChange={handleChange}
        />
      </EditorContainer>
    </div>
  );
}
