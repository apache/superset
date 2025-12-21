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
import { debounce } from 'lodash';
import {
  Input,
  Tooltip,
  Button,
  TextAreaEditor,
  ModalTrigger,
} from '@superset-ui/core/components';
import { t } from '@superset-ui/core';
import { withTheme } from '@apache-superset/core/ui';

import 'ace-builds/src-min-noconflict/mode-handlebars';

import ControlHeader from 'src/explore/components/ControlHeader';

interface HotkeyConfig {
  name: string;
  key: string;
  func: () => void;
}

interface ThemeType {
  colorBorder: string;
  colorBgMask: string;
  sizeUnit: number;
}

interface TextAreaControlProps {
  name?: string;
  onChange?: (value: string) => void;
  initialValue?: string;
  height?: number;
  minLines?: number;
  maxLines?: number;
  offerEditInModal?: boolean;
  language?: 'json' | 'html' | 'sql' | 'markdown' | 'javascript' | 'handlebars' | null;
  aboveEditorSection?: React.ReactNode;
  readOnly?: boolean;
  resize?: 'block' | 'both' | 'horizontal' | 'inline' | 'none' | 'vertical' | null;
  textAreaStyles?: React.CSSProperties;
  tooltipOptions?: Record<string, unknown>;
  hotkeys?: HotkeyConfig[];
  debounceDelay?: number | null;
  theme?: ThemeType;
  'aria-required'?: boolean;
  value?: string;
  [key: string]: unknown;
}

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
    'handlebars',
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
  hotkeys: PropTypes.array,
  debounceDelay: PropTypes.number,
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
  hotkeys: [],
  debounceDelay: null,
};

class TextAreaControl extends Component<TextAreaControlProps> {
  static propTypes = propTypes;

  static defaultProps = defaultProps;

  debouncedOnChange: ReturnType<typeof debounce<(value: string) => void>> | undefined;

  constructor(props: TextAreaControlProps) {
    super(props);
    if (props.debounceDelay && props.onChange) {
      this.debouncedOnChange = debounce(props.onChange, props.debounceDelay);
    }
  }

  componentDidUpdate(prevProps: TextAreaControlProps) {
    if (
      this.props.onChange !== prevProps.onChange &&
      this.props.debounceDelay &&
      this.props.onChange
    ) {
      if (this.debouncedOnChange) {
        this.debouncedOnChange.cancel();
      }
      this.debouncedOnChange = debounce(
        this.props.onChange,
        this.props.debounceDelay,
      );
    }
  }

  handleChange(value: string | { target: { value: string } }) {
    const finalValue = typeof value === 'object' ? value.target.value : value;
    if (this.debouncedOnChange) {
      this.debouncedOnChange(finalValue);
    } else {
      this.props.onChange?.(finalValue);
    }
  }

  componentWillUnmount() {
    if (this.debouncedOnChange) {
      this.debouncedOnChange.cancel();
    }
  }

  renderEditor(inModal = false) {
    const minLines = inModal ? 40 : this.props.minLines || 12;
    if (this.props.language) {
      const style: React.CSSProperties = {
        border: this.props.theme?.colorBorder
          ? `1px solid ${this.props.theme.colorBorder}`
          : undefined,
        minHeight: `${minLines}em`,
        width: 'auto',
        ...this.props.textAreaStyles,
      };
      if (this.props.resize) {
        style.resize = this.props.resize;
      }
      if (this.props.readOnly) {
        style.backgroundColor = this.props.theme?.colorBgMask;
      }
      const onEditorLoad = (editor: { commands: { addCommand: (cmd: { name: string; bindKey: { win: string; mac: string }; exec: () => void }) => void } }) => {
        this.props.hotkeys?.forEach(keyConfig => {
          editor.commands.addCommand({
            name: keyConfig.name,
            bindKey: { win: keyConfig.key, mac: keyConfig.key },
            exec: keyConfig.func,
          });
        });
      };
      const codeEditor = (
        <div>
          <TextAreaEditor
            mode={this.props.language}
            style={style}
            minLines={minLines}
            maxLines={inModal ? 1000 : this.props.maxLines}
            editorProps={{ $blockScrolling: true }}
            onLoad={onEditorLoad}
            defaultValue={this.props.initialValue}
            readOnly={this.props.readOnly}
            key={this.props.name}
            {...this.props}
            onChange={this.handleChange.bind(this)}
          />
        </div>
      );

      if (this.props.tooltipOptions) {
        return <Tooltip {...this.props.tooltipOptions}>{codeEditor}</Tooltip>;
      }
      return codeEditor;
    }

    const textArea = (
      <div>
        <Input.TextArea
          placeholder={t('textarea')}
          onChange={this.handleChange.bind(this)}
          defaultValue={this.props.initialValue}
          disabled={this.props.readOnly}
          style={{ height: this.props.height }}
          aria-required={this.props['aria-required']}
        />
      </div>
    );
    if (this.props.tooltipOptions) {
      return <Tooltip {...this.props.tooltipOptions}>{textArea}</Tooltip>;
    }
    return textArea;
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            modalTitle={controlHeader as any}
            triggerNode={
              <Button
                buttonSize="small"
                style={{ marginTop: this.props.theme?.sizeUnit ?? 4 }}
              >
                {t('Edit %s in modal', this.props.language)}
              </Button>
            }
            modalBody={this.renderModalBody()}
            responsive
          />
        )}
      </div>
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default withTheme(TextAreaControl as any);
