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
import { useState, useCallback, useMemo } from 'react';
import { styled } from '@superset-ui/core';
import { AsyncAceEditor } from '@superset-ui/core/components/AsyncAceEditor';
import { TooltipField } from './TooltipFieldSelector';

const Container = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.sizeUnit}px;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const Title = styled.div`
  font-weight: bold;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
`;

const EditorContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.sizeUnit}px;
  overflow: hidden;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
`;

const FieldInsertBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.sizeUnit}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  background-color: ${({ theme }) => theme.colors.grayscale.light4};
  border-radius: ${({ theme }) => theme.sizeUnit}px;
`;

const FieldButton = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.sizeUnit}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  padding: ${({ theme }) => theme.sizeUnit}px
    ${({ theme }) => theme.sizeUnit * 2}px;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primary.light4};
    border-color: ${({ theme }) => theme.colors.primary.base};
  }
`;

const TemplateEditor = AsyncAceEditor([
  'mode/html',
  'mode/javascript',
  'theme/github',
  'ext/language_tools',
  'ext/searchbox',
]);

interface TooltipTemplateEditorProps {
  template: string;
  onTemplateChange: (template: string) => void;
  availableFields: TooltipField[];
  onFieldInsert?: (field: TooltipField) => void;
}

const TooltipTemplateEditor = ({
  template,
  onTemplateChange,
  availableFields,
  onFieldInsert,
}: TooltipTemplateEditorProps) => {
  const [aceEditorRef, setAceEditorRef] = useState<any>(null);

  const handleFieldInsert = useCallback(
    (field: TooltipField) => {
      const fieldTemplate = `{{${field.name}}}`;

      if (aceEditorRef?.editor) {
        const { editor } = aceEditorRef;
        const cursorPosition = editor.getCursorPosition();
        editor.session.insert(cursorPosition, fieldTemplate);
        editor.focus();
      } else {
        const newTemplate = template + fieldTemplate;
        onTemplateChange(newTemplate);
      }

      onFieldInsert?.(field);
    },
    [aceEditorRef, template, onTemplateChange, onFieldInsert],
  );

  const keywords = useMemo(
    () =>
      availableFields.map(field => ({
        name: field.name,
        value: `{{${field.name}}}`,
        score: 100,
        meta: field.type === 'metric' ? 'metric' : 'column',
        docText: `Insert ${field.label} field`,
      })),
    [availableFields],
  );

  const getFieldIcon = (type: string) => (type === 'metric' ? '📊' : '📝');

  return (
    <Container>
      <Header>
        <Title>Template Editor</Title>
      </Header>

      {availableFields.length > 0 && (
        <FieldInsertBar>
          {availableFields.map(field => (
            <FieldButton
              key={field.name}
              onClick={() => handleFieldInsert(field)}
              title={`Insert ${field.label} field`}
            >
              <span>{getFieldIcon(field.type)}</span>
              <span>{field.label}</span>
            </FieldButton>
          ))}
        </FieldInsertBar>
      )}

      <EditorContainer>
        <TemplateEditor
          ref={setAceEditorRef}
          mode="html"
          theme="github"
          value={template}
          onChange={onTemplateChange}
          keywords={keywords}
          width="100%"
          height="200px"
          showPrintMargin={false}
          showGutter
          highlightActiveLine
          setOptions={{
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            enableSnippets: true,
            showLineNumbers: true,
            tabSize: 2,
            fontFamily: 'Menlo, Monaco, Courier New, monospace',
            fontSize: 13,
          }}
          placeholder="Enter your tooltip template here..."
        />
      </EditorContainer>
    </Container>
  );
};

export default TooltipTemplateEditor;
