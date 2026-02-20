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
import { debounce } from 'lodash';
import {
  Input,
  Tooltip,
  Button,
  TextAreaEditor,
  ModalTrigger,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core';
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
  language?:
    | 'json'
    | 'html'
    | 'sql'
    | 'markdown'
    | 'javascript'
    | 'handlebars'
    | null;
  aboveEditorSection?: React.ReactNode;
  readOnly?: boolean;
  resize?:
    | 'block'
    | 'both'
    | 'horizontal'
    | 'inline'
    | 'none'
    | 'vertical'
    | null;
  textAreaStyles?: React.CSSProperties;
  tooltipOptions?: Record<string, unknown>;
  hotkeys?: HotkeyConfig[];
  debounceDelay?: number | null;
  theme?: ThemeType;
  'aria-required'?: boolean;
  value?: string;
  [key: string]: unknown;
}

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
  static defaultProps = defaultProps;

  debouncedOnChange:
    | ReturnType<typeof debounce<(value: string) => void>>
    | undefined;

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
    // Exclude props that shouldn't be passed to TextAreaEditor:
    // - theme: TextAreaEditor expects theme as a string, not the theme object from withTheme HOC
    // - height: ReactAce expects string, we pass number (height is controlled via minLines/maxLines)
    // - other control-specific props and explicitly-set props to avoid duplicate/conflicting assignments
    const {
      theme,
      height,
      offerEditInModal,
      aboveEditorSection,
      resize,
      textAreaStyles,
      tooltipOptions,
      hotkeys,
      debounceDelay,
      language,
      initialValue,
      readOnly,
      name,
      onChange,
      minLines: minLinesProp,
      maxLines: maxLinesProp,
      ...editorProps
    } = this.props;
    const minLines = inModal ? 40 : minLinesProp || 12;
    if (language) {
      const style: React.CSSProperties = {
        border: theme?.colorBorder
          ? `1px solid ${theme.colorBorder}`
          : undefined,
        minHeight: `${minLines}em`,
        width: 'auto',
        ...textAreaStyles,
      };
      if (resize) {
        style.resize = resize;
      }
      if (readOnly) {
        style.backgroundColor = theme?.colorBgMask;
      }
      const onEditorLoad = (editor: {
        commands: {
          addCommand: (cmd: {
            name: string;
            bindKey: { win: string; mac: string };
            exec: () => void;
          }) => void;
        };
      }) => {
        hotkeys?.forEach(keyConfig => {
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
            mode={language}
            style={style}
            minLines={minLines}
            maxLines={inModal ? 1000 : maxLinesProp}
            editorProps={{ $blockScrolling: true }}
            onLoad={onEditorLoad}
            defaultValue={initialValue}
            readOnly={readOnly}
            key={name}
            {...editorProps}
            onChange={this.handleChange.bind(this)}
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
