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

const ToggleHelp = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.sizeUnit}px;
  color: ${({ theme }) => theme.colors.grayscale.base};
  padding: ${({ theme }) => theme.sizeUnit}px
    ${({ theme }) => theme.sizeUnit * 2}px;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizeSM}px;

  &:hover {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
  }
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

const HelpSection = styled.div<{ isOpen: boolean }>`
  max-height: ${({ isOpen }) => (isOpen ? '400px' : '0')};
  overflow: hidden;
  transition: max-height 0.3s ease;
  border-top: ${({ isOpen, theme }) =>
    isOpen ? `1px solid ${theme.colors.grayscale.light2}` : 'none'};
  margin-top: ${({ isOpen, theme }) =>
    isOpen ? `${theme.sizeUnit * 2}px` : '0'};
`;

const HelpContent = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  border-radius: ${({ theme }) => theme.sizeUnit}px;
`;

const HelpTitle = styled.h4`
  margin: 0 0 ${({ theme }) => theme.sizeUnit * 2}px 0;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

const HelpText = styled.p`
  margin: 0 0 ${({ theme }) => theme.sizeUnit * 2}px 0;
  color: ${({ theme }) => theme.colors.grayscale.base};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  line-height: 1.4;
`;

const CodeExample = styled.pre`
  background-color: ${({ theme }) => theme.colors.grayscale.light3};
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  border-radius: ${({ theme }) => theme.sizeUnit}px;
  margin: ${({ theme }) => theme.sizeUnit}px 0;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  overflow-x: auto;
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
  const [showHelp, setShowHelp] = useState(false);
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
        <ToggleHelp onClick={() => setShowHelp(!showHelp)}>
          {showHelp ? 'Hide Help' : 'Show Help'}
        </ToggleHelp>
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

      <HelpSection isOpen={showHelp}>
        <HelpContent>
          <HelpTitle>Template Syntax Help</HelpTitle>

          <HelpText>
            Use Handlebars-like syntax to create dynamic tooltips. Available
            syntax:
          </HelpText>

          <HelpTitle>Basic Field Display</HelpTitle>
          <CodeExample>{`{{field_name}}         Display field value
{{field_name.label}}   Display field label`}</CodeExample>

          <HelpTitle>Conditional Logic</HelpTitle>
          <CodeExample>{`{{#if field_name}}
  Show this if field has value
{{else}}
  Show this if field is empty
{{/if}}`}</CodeExample>

          <HelpTitle>Loops (for arrays)</HelpTitle>
          <CodeExample>{`{{#each array_field}}
  <li>{{this}}</li>
{{/each}}`}</CodeExample>

          <HelpTitle>HTML Support</HelpTitle>
          <CodeExample>{`<div class="tooltip-content">
  <h4>{{title}}</h4>
  <p><strong>Value:</strong> {{value}}</p>
  <p><em>{{description}}</em></p>
</div>`}</CodeExample>

          <HelpTitle>Example Template</HelpTitle>
          <CodeExample>{`<div class="custom-tooltip">
  <h3>{{title}}</h3>
  {{#if value}}
    <p><strong>Value:</strong> {{value}}</p>
  {{/if}}
  {{#if category}}
    <p><strong>Category:</strong> {{category}}</p>
  {{/if}}
</div>`}</CodeExample>
        </HelpContent>
      </HelpSection>
    </Container>
  );
};

export default TooltipTemplateEditor;
