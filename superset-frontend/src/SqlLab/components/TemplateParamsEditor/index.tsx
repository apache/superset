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
import { useState, useEffect } from 'react';
import { t, styled } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import { debounce } from 'lodash';

import Badge from 'src/components/Badge';
import ModalTrigger from 'src/components/ModalTrigger';
import { ConfigEditor } from 'src/components/AsyncAceEditor';
import { FAST_DEBOUNCE } from 'src/constants';
import { Tooltip } from 'src/components/Tooltip';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';

const StyledConfigEditor = styled(ConfigEditor)`
  &.ace_editor {
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }
`;

export type TemplateParamsEditorProps = {
  queryEditorId: string;
  language: 'yaml' | 'json';
  onChange: (params: any) => void;
};

const TemplateParamsEditor = ({
  queryEditorId,
  language,
  onChange = () => {},
}: TemplateParamsEditorProps) => {
  const [parsedJSON, setParsedJSON] = useState({});
  const [isValid, setIsValid] = useState(true);

  const { templateParams } = useQueryEditor(queryEditorId, ['templateParams']);
  const code = templateParams ?? '{}';

  useEffect(() => {
    try {
      setParsedJSON(JSON.parse(code));
      setIsValid(true);
    } catch {
      setParsedJSON({} as any);
      setIsValid(false);
    }
  }, [code]);

  const modalBody = (
    <div>
      <p>
        {t('Assign a set of parameters as')}
        <code>JSON</code>
        {t('below (example:')}
        <code>{'{"my_table": "foo"}'}</code>
        {t('), and they become available in your SQL (example:')}
        <code>SELECT * FROM {'{{ my_table }}'} </code>) {t('by using')}&nbsp;
        <a
          href="https://superset.apache.org/sqllab.html#templating-with-jinja"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Jinja templating')}
        </a>{' '}
        {t('syntax.')}
      </p>
      <StyledConfigEditor
        mode={language}
        minLines={25}
        maxLines={50}
        onChange={debounce(onChange, FAST_DEBOUNCE)}
        width="100%"
        editorProps={{ $blockScrolling: true }}
        enableLiveAutocompletion
        value={code}
      />
    </div>
  );

  const paramCount = parsedJSON ? Object.keys(parsedJSON).length : 0;

  return (
    <ModalTrigger
      modalTitle={t('Template parameters')}
      triggerNode={
        <Tooltip
          id="parameters-tooltip"
          placement="top"
          title={t('Edit template parameters')}
          trigger={['hover']}
        >
          <div role="button" css={{ width: 'inherit' }}>
            {t('Parameters ')}
            <Badge count={paramCount} />
            {!isValid && (
              <InfoTooltipWithTrigger
                icon="exclamation-triangle"
                bsStyle="danger"
                tooltip={t('Invalid JSON')}
                label="invalid-json"
              />
            )}
          </div>
        </Tooltip>
      }
      modalBody={modalBody}
    />
  );
};

export default TemplateParamsEditor;
