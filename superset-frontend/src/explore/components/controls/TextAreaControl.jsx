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
import PropTypes from 'prop-types';
import { TextArea } from 'src/components/Input';
import {
  Tooltip,
  TooltipProps as TooltipOptions,
} from 'src/components/Tooltip';
import { t, withTheme } from '@superset-ui/core';

import Button from 'src/components/Button';
import { TextAreaEditor } from 'src/components/AsyncAceEditor';
import ModalTrigger from 'src/components/ModalTrigger';

import ControlHeader from 'src/explore/components/ControlHeader';

const propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func,
  initialValue: PropTypes.string,
  height: PropTypes.number,
  minLines: PropTypes.number,
  maxLines: PropTypes.number,
  offerEditInModal: PropTypes.bool,
  language: PropTypes.oneOf([
    null,
    'json',
    'html',
    'sql',
    'markdown',
    'javascript',
  ]),
  aboveEditorSection: PropTypes.node,
  readOnly: PropTypes.bool,
  resize: PropTypes.oneOf([
    null,
    'block',
    'both',
    'horizontal',
    'inline',
    'none',
    'vertical',
  ]),
  textAreaStyles: PropTypes.object,
  tooltipOptions: PropTypes.oneOf([null, TooltipOptions]),
};

const defaultProps = {
  onChange: () => {},
  initialValue: '',
  height: 250,
  minLines: 3,
  maxLines: 10,
  offerEditInModal: true,
  readOnly: false,
  resize: null,
  textAreaStyles: {},
  tooltipOptions: {},
};

const TextAreaControl = props => {
  const {
    onChange,
    initialValue,
    language,
    minLines,
    maxLines,
    readOnly,
    name,
    theme,
    textAreaStyles,
    tooltipOptions,
    height,
    offerEditInModal,
    aboveEditorSection,
    resize,
  } = props;

  const onControlChange = useCallback(
    event => {
      const { value } = event.target;
      onChange(value);
    },
    [onChange],
  );

  const onAreaEditorChange = useCallback(
    value => {
      onChange(value);
    },
    [onChange],
  );

  const renderEditor = (inModal = false) => {
    const editorMinLines = inModal ? 40 : minLines || 12;
    if (language) {
      const style = {
        border: `1px solid ${theme.colors.grayscale.light1}`,
        minHeight: `${editorMinLines}em`,
        width: 'auto',
        ...textAreaStyles,
      };
      if (resize) {
        style.resize = resize;
      }
      if (readOnly) {
        style.backgroundColor = '#f2f2f2';
      }
      const codeEditor = (
        <div>
          <TextAreaEditor
            mode={language}
            style={style}
            minLines={editorMinLines}
            maxLines={inModal ? 1000 : maxLines}
            editorProps={{ $blockScrolling: true }}
            defaultValue={initialValue}
            readOnly={readOnly}
            key={name}
            {...props}
            onChange={onAreaEditorChange}
          />
        </div>
      );

      if (tooltipOptions) {
        return <Tooltip {...tooltipOptions}>{codeEditor}</Tooltip>;
      }
      return codeEditor;
    }

    const textArea = (
      <div>
        <TextArea
          placeholder={t('textarea')}
          onChange={onControlChange}
          defaultValue={initialValue}
          disabled={readOnly}
          style={{ height }}
        />
      </div>
    );
    if (tooltipOptions) {
      return <Tooltip {...tooltipOptions}>{textArea}</Tooltip>;
    }
    return textArea;
  };

  const renderModalBody = () => (
    <>
      <div>{aboveEditorSection}</div>
      {renderEditor(true)}
    </>
  );

  const controlHeader = <ControlHeader {...props} />;
  return (
    <div>
      {controlHeader}
      {renderEditor()}
      {offerEditInModal && (
        <ModalTrigger
          modalTitle={controlHeader}
          triggerNode={
            <Button buttonSize="small" className="m-t-5">
              {t('Edit')} <strong>{language}</strong> {t('in modal')}
            </Button>
          }
          modalBody={renderModalBody(true)}
          responsive
        />
      )}
    </div>
  );
};

TextAreaControl.propTypes = propTypes;
TextAreaControl.defaultProps = defaultProps;

export default withTheme(TextAreaControl);
