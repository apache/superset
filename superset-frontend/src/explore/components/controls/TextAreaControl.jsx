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
import { Component } from 'react';
import PropTypes from 'prop-types';
import { TextArea } from 'src/components/Input';
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
};

class TextAreaControl extends Component {
  onControlChange(event) {
    const { value } = event.target;
    this.props.onChange(value);
  }

  onAreaEditorChange(value) {
    this.props.onChange(value);
  }

  renderEditor(inModal = false) {
    const minLines = inModal ? 40 : this.props.minLines || 12;
    if (this.props.language) {
      const style = {
        border: `1px solid ${this.props.theme.colors.grayscale.light1}`,
        minHeight: `${minLines}em`,
        width: 'auto',
        ...this.props.textAreaStyles,
      };
      if (this.props.resize) {
        style.resize = this.props.resize;
      }
      if (this.props.readOnly) {
        style.backgroundColor = '#f2f2f2';
      }

      return (
        <TextAreaEditor
          mode={this.props.language}
          style={style}
          minLines={minLines}
          maxLines={inModal ? 1000 : this.props.maxLines}
          editorProps={{ $blockScrolling: true }}
          defaultValue={this.props.initialValue}
          readOnly={this.props.readOnly}
          key={this.props.name}
          {...this.props}
          onChange={this.onAreaEditorChange.bind(this)}
        />
      );
    }
    return (
      <TextArea
        placeholder={t('textarea')}
        onChange={this.onControlChange.bind(this)}
        defaultValue={this.props.initialValue}
        disabled={this.props.readOnly}
        style={{ height: this.props.height }}
      />
    );
  }

  renderModalBody() {
    return (
      <>
        <div>{this.props.aboveEditorSection}</div>
        {this.renderEditor(true)}
      </>
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
            modalTitle={controlHeader}
            triggerNode={
              <Button buttonSize="small" className="m-t-5">
                {t('Edit')} <strong>{this.props.language}</strong>{' '}
                {t('in modal')}
              </Button>
            }
            modalBody={this.renderModalBody(true)}
            responsive
          />
        )}
      </div>
    );
  }
}

TextAreaControl.propTypes = propTypes;
TextAreaControl.defaultProps = defaultProps;

export default withTheme(TextAreaControl);
