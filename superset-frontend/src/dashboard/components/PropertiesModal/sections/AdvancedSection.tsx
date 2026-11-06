/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import type { editors } from '@apache-superset/core';
import { EditorHost } from 'src/core/editors';
import { Typography } from '@superset-ui/core/components';
import { ModalFormField } from 'src/components/Modal';
import { ValidationObject } from 'src/components/Modal/useModalValidation';

type EditorAnnotation = editors.EditorAnnotation;

/**
 * Convert Ace annotation format to EditorAnnotation format.
 */
const toEditorAnnotations = (
  aceAnnotations: Array<{
    type: string;
    row: number;
    column: number;
    text: string;
  }>,
): EditorAnnotation[] =>
  aceAnnotations.map(ann => ({
    severity: ann.type as EditorAnnotation['severity'],
    line: ann.row,
    column: ann.column,
    message: ann.text,
  }));

const StyledEditorHost = styled(EditorHost)`
  /* Border is already applied by AceEditor itself */
`;

interface AdvancedSectionProps {
  jsonMetadata: string;
  jsonAnnotations: any[];
  validationStatus: ValidationObject;
  onJsonMetadataChange: (value: string) => void;
  extraErrors?: string[];
}

const AdvancedSection = ({
  jsonMetadata,
  jsonAnnotations,
  validationStatus,
  onJsonMetadataChange,
  extraErrors = [],
}: AdvancedSectionProps) => {
  const [editorReady, setEditorReady] = useState(0);
  const errorIds = extraErrors
    .map((_, index) => `dashboard-json-metadata-error-${index}`)
    .join(' ');

  // The editor loads asynchronously and renders its textarea later, so the
  // attributes are applied again on onReady; the retry is only a fallback.
  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      const textarea = document.querySelector<HTMLElement>(
        '#dashboard-json-metadata textarea',
      );
      if (!textarea) {
        if (tries < 10) {
          tries += 1;
          timer = setTimeout(apply, 0);
        }
        return;
      }
      if (errorIds) {
        textarea.setAttribute('aria-describedby', errorIds);
        textarea.setAttribute('aria-invalid', 'true');
      } else {
        textarea.removeAttribute('aria-describedby');
        textarea.removeAttribute('aria-invalid');
      }
    };
    apply();
    return () => clearTimeout(timer);
  }, [errorIds, editorReady]);

  return (
    <>
      <ModalFormField
        label={t('JSON Metadata')}
        testId="dashboard-metadata-field"
        helperText={t(
          'This JSON object is generated dynamically when clicking the save ' +
            'or overwrite button in the dashboard view. It is exposed here for ' +
            'reference and for power users who may want to alter specific parameters.',
        )}
        error={
          validationStatus.advanced?.hasErrors && jsonAnnotations.length > 0
            ? t('Invalid JSON metadata')
            : undefined
        }
        bottomSpacing={false}
      >
        <StyledEditorHost
          id="dashboard-json-metadata"
          data-test="dashboard-metadata-editor"
          value={jsonMetadata}
          onChange={onJsonMetadataChange}
          language="json"
          tabSize={2}
          wordWrap
          width="100%"
          height="60vh"
          annotations={toEditorAnnotations(jsonAnnotations)}
          onReady={() => setEditorReady(ready => ready + 1)}
        />
      </ModalFormField>
      <div aria-live="polite">
        {extraErrors.map((error, index) => (
          <div key={error}>
            <Typography.Text
              type="danger"
              id={`dashboard-json-metadata-error-${index}`}
            >
              {error}
            </Typography.Text>
          </div>
        ))}
      </div>
    </>
  );
};

export default AdvancedSection;
