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
import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup, FormControl } from 'react-bootstrap';
import { debounce } from 'lodash';
import { t } from '@superset-ui/core';

import Button from 'src/components/Button';
import { TextAreaEditor } from 'src/components/AsyncAceEditor';
import ModalTrigger from 'src/components/ModalTrigger';

import ControlHeader from '../ControlHeader';

const propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.string,
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
};

const defaultProps = {
  onChange: () => {},
  value: '',
  height: 250,
  minLines: 3,
  maxLines: 10,
  offerEditInModal: true,
  readOnly: false,
};

export default class TextAreaControl extends React.Component {
  constructor() {
    super();
    this.onAceChangeDebounce = debounce(value => {
      this.onAceChange(value);
    }, 300);
  }
  onControlChange(event) {
    this.props.onChange(event.target.value);
  }

  onAceChange(value) {
    this.props.onChange(value);
  }

  renderEditor(inModal = false) {
    const value = this.props.value || '';
    const minLines = inModal ? 40 : this.props.minLines || 12;
    if (this.props.language) {
      return (
        <TextAreaEditor
          mode={this.props.language}
          style={{ border: '1px solid #CCC' }}
          minLines={minLines}
          maxLines={inModal ? 1000 : this.props.maxLines}
          onChange={this.onAceChangeDebounce}
          width="100%"
          height={`${minLines}em`}
          editorProps={{ $blockScrolling: true }}
          value={value}
          readOnly={this.props.readOnly}
        />
      );
    }
    return (
      <FormGroup controlId="formControlsTextarea">
        <FormControl
          componentClass="textarea"
          placeholder={t('textarea')}
          onChange={this.onControlChange.bind(this)}
          value={value}
          disabled={this.props.readOnly}
          style={{ height: this.props.height }}
        />
      </FormGroup>
    );
  }

  renderModalBody() {
    return (
      <div>
        <div>{this.props.aboveEditorSection}</div>
        {this.renderEditor(true)}
      </div>
    );
  }

  render() {
    const controlHeader = <ControlHeader {...this.props} />;
    return (
      <div>
        {controlHeader}
        {this.renderEditor()}
        {this.props.offerEditInModal && (
          <ModalTrigger
            bsSize="large"
            modalTitle={controlHeader}
            triggerNode={
              <Button buttonSize="small" className="m-t-5">
                {t('Edit')} <strong>{this.props.language}</strong>{' '}
                {t('in modal')}
              </Button>
            }
            modalBody={this.renderModalBody(true)}
          />
        )}
      </div>
    );
  }
}

TextAreaControl.propTypes = propTypes;
TextAreaControl.defaultProps = defaultProps;
