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
import {
  Input,
  Tooltip,
  Button,
  TextAreaEditor,
  ModalTrigger,
} from '@superset-ui/core/components';
import { t, withTheme } from '@superset-ui/core';

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
  tooltipOptions: PropTypes.object,
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

class TextAreaControl extends Component {
  onControlChange(event: $TSFixMe) {
    const { value } = event.target;
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(value);
  }

  onAreaEditorChange(value: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(value);
  }

  renderEditor(inModal = false) {
    // @ts-expect-error TS(2339): Property 'minLines' does not exist on type 'Readon... Remove this comment to see the full error message
    const minLines = inModal ? 40 : this.props.minLines || 12;
    // @ts-expect-error TS(2339): Property 'language' does not exist on type 'Readon... Remove this comment to see the full error message
    if (this.props.language) {
      const style = {
        // @ts-expect-error TS(2339): Property 'theme' does not exist on type 'Readonly<... Remove this comment to see the full error message
        border: `1px solid ${this.props.theme.colorBorder}`,
        minHeight: `${minLines}em`,
        width: 'auto',
        // @ts-expect-error TS(2339): Property 'textAreaStyles' does not exist on type '... Remove this comment to see the full error message
        ...this.props.textAreaStyles,
      };
      // @ts-expect-error TS(2339): Property 'resize' does not exist on type 'Readonly... Remove this comment to see the full error message
      if (this.props.resize) {
        // @ts-expect-error TS(2339): Property 'resize' does not exist on type 'Readonly... Remove this comment to see the full error message
        style.resize = this.props.resize;
      }
      // @ts-expect-error TS(2339): Property 'readOnly' does not exist on type 'Readon... Remove this comment to see the full error message
      if (this.props.readOnly) {
        style.backgroundColor = '#f2f2f2';
      }
      const codeEditor = (
        <div>
          <TextAreaEditor
            // @ts-expect-error TS(2339): Property 'language' does not exist on type 'Readon... Remove this comment to see the full error message
            mode={this.props.language}
            style={style}
            minLines={minLines}
            // @ts-expect-error TS(2339): Property 'maxLines' does not exist on type 'Readon... Remove this comment to see the full error message
            maxLines={inModal ? 1000 : this.props.maxLines}
            editorProps={{ $blockScrolling: true }}
            // @ts-expect-error TS(2339): Property 'initialValue' does not exist on type 'Re... Remove this comment to see the full error message
            defaultValue={this.props.initialValue}
            // @ts-expect-error TS(2339): Property 'readOnly' does not exist on type 'Readon... Remove this comment to see the full error message
            readOnly={this.props.readOnly}
            // @ts-expect-error TS(2339): Property 'name' does not exist on type 'Readonly<{... Remove this comment to see the full error message
            key={this.props.name}
            {...this.props}
            onChange={this.onAreaEditorChange.bind(this)}
          />
        </div>
      );

      // @ts-expect-error TS(2339): Property 'tooltipOptions' does not exist on type '... Remove this comment to see the full error message
      if (this.props.tooltipOptions) {
        // @ts-expect-error TS(2339): Property 'tooltipOptions' does not exist on type '... Remove this comment to see the full error message
        return <Tooltip {...this.props.tooltipOptions}>{codeEditor}</Tooltip>;
      }
      return codeEditor;
    }

    const textArea = (
      <div>
        <Input.TextArea
          placeholder={t('textarea')}
          onChange={this.onControlChange.bind(this)}
          // @ts-expect-error TS(2339): Property 'initialValue' does not exist on type 'Re... Remove this comment to see the full error message
          defaultValue={this.props.initialValue}
          // @ts-expect-error TS(2339): Property 'readOnly' does not exist on type 'Readon... Remove this comment to see the full error message
          disabled={this.props.readOnly}
          // @ts-expect-error TS(2339): Property 'height' does not exist on type 'Readonly... Remove this comment to see the full error message
          style={{ height: this.props.height }}
        />
      </div>
    );
    // @ts-expect-error TS(2339): Property 'tooltipOptions' does not exist on type '... Remove this comment to see the full error message
    if (this.props.tooltipOptions) {
      // @ts-expect-error TS(2339): Property 'tooltipOptions' does not exist on type '... Remove this comment to see the full error message
      return <Tooltip {...this.props.tooltipOptions}>{textArea}</Tooltip>;
    }
    return textArea;
  }

  renderModalBody() {
    return (
      <>
        // @ts-expect-error TS(2339): Property 'aboveEditorSection' does not
        exist on ty... Remove this comment to see the full error message
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
        // @ts-expect-error TS(2339): Property 'offerEditInModal' does not exist
        on type... Remove this comment to see the full error message
        {this.props.offerEditInModal && (
          <ModalTrigger
            // @ts-expect-error TS(2322): Type 'Element' is not assignable to type 'string'.
            modalTitle={controlHeader}
            triggerNode={
              <Button
                buttonSize="small"
                // @ts-expect-error TS(2339): Property 'theme' does not exist on type 'Readonly<... Remove this comment to see the full error message
                style={{ marginTop: this.props.theme.sizeUnit }}
              >
                // @ts-expect-error TS(2339): Property 'language' does not exist
                on type 'Readon... Remove this comment to see the full error
                message
                {t('Edit')} <strong>{this.props.language}</strong>{' '}
                {t('in modal')}
              </Button>
            }
            // @ts-expect-error TS(2554): Expected 0 arguments, but got 1.
            modalBody={this.renderModalBody(true)}
            responsive
          />
        )}
      </div>
    );
  }
}

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
TextAreaControl.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
TextAreaControl.defaultProps = defaultProps;

export default withTheme(TextAreaControl);
