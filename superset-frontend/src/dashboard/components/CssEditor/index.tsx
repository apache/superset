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
import { Key, ReactNode, PureComponent } from 'react';
import {
  Dropdown,
  CssEditor as AceCssEditor,
  Button,
  ModalTrigger,
  Form,
  Select,
} from '@superset-ui/core/components';
import rison from 'rison';
import { Menu } from '@superset-ui/core/components/Menu';
import { t, styled, SupersetClient } from '@superset-ui/core';

export interface CssEditorProps {
  initialCss: string;
  triggerNode: ReactNode;
  onChange: (css: string) => void;
  addDangerToast: (msg: string) => void;
  currentThemeId?: number | null;
  onThemeChange?: (themeId: number | null) => void;
}

export type CssEditorState = {
  css: string;
  templates?: Array<{
    css: string;
    label: string;
  }>;
  themes?: Array<{
    id: number;
    theme_name: string;
    json_data: string;
  }>;
  selectedThemeId?: number | null;
  pendingCss: string;
  pendingThemeId?: number | null;
};
const StyledWrapper = styled.div`
  ${({ theme }) => `
    .css-editor-header {
      margin-bottom: ${theme.sizeUnit * 2}px;
    }
    .css-editor {
      border: 1px solid ${theme.colorBorder};
    }
  `}
`;

class CssEditor extends PureComponent<CssEditorProps, CssEditorState> {
  static defaultProps: Partial<CssEditorProps> = {
    initialCss: '',
    onChange: () => {},
  };

  constructor(props: CssEditorProps) {
    super(props);
    this.state = {
      css: props.initialCss,
      selectedThemeId: props.currentThemeId,
      pendingCss: props.initialCss,
      pendingThemeId: props.currentThemeId,
    };
    this.changeCss = this.changeCss.bind(this);
    this.changeCssTemplate = this.changeCssTemplate.bind(this);
    this.changeTheme = this.changeTheme.bind(this);
    this.applyChanges = this.applyChanges.bind(this);
    this.hasChanges = this.hasChanges.bind(this);
  }

  componentDidMount() {
    AceCssEditor.preload();

    // Fetch CSS templates
    const query = rison.encode({ columns: ['template_name', 'css'] });
    SupersetClient.get({ endpoint: `/api/v1/css_template/?q=${query}` })
      .then(({ json }) => {
        const templates = json.result.map(
          (row: { template_name: string; css: string }) => ({
            value: row.template_name,
            css: row.css,
            label: row.template_name,
          }),
        );

        this.setState({ templates });
      })
      .catch(() => {
        this.props.addDangerToast(
          t('An error occurred while fetching available CSS templates'),
        );
      });

    // Fetch themes
    const themeQuery = rison.encode({
      columns: ['id', 'theme_name', 'json_data'],
    });
    SupersetClient.get({ endpoint: `/api/v1/theme/?q=${themeQuery}` })
      .then(({ json }) => {
        const themes = json.result;
        this.setState({ themes });
      })
      .catch(() => {
        this.props.addDangerToast(
          t('An error occurred while fetching available themes'),
        );
      });
  }

  changeCss(css: string) {
    this.setState({ pendingCss: css });
  }

  changeCssTemplate(info: { key: Key }) {
    const selectedTemplate = this.state.templates?.find(
      template => template.label === info.key,
    );
    if (selectedTemplate) {
      this.setState({ pendingCss: selectedTemplate.css });
    }
  }

  changeTheme(info: { key: Key }) {
    const themeId = info.key === 'none' ? null : Number(info.key);
    this.setState({ pendingThemeId: themeId });
  }

  applyChanges() {
    // Apply CSS changes
    this.setState(
      prevState => ({ css: prevState.pendingCss }),
      () => {
        this.props.onChange(this.state.css);
      },
    );

    // Apply theme changes
    this.setState(prevState => {
      if (prevState.pendingThemeId !== prevState.selectedThemeId) {
        if (this.props.onThemeChange) {
          this.props.onThemeChange(prevState.pendingThemeId ?? null);
        }
        return { selectedThemeId: prevState.pendingThemeId };
      }
      return null;
    });
  }

  hasChanges() {
    return (
      this.state.pendingCss !== this.state.css ||
      this.state.pendingThemeId !== this.state.selectedThemeId
    );
  }

  renderTemplateSelector() {
    if (this.state.templates) {
      const menu = (
        <Menu
          onClick={this.changeCssTemplate}
          items={this.state.templates.map(template => ({
            key: template.label,
            label: template.label,
          }))}
        />
      );
      return (
        <Dropdown popupRender={() => menu} placement="bottomRight">
          <Button>{t('Load CSS template')}</Button>
        </Dropdown>
      );
    }
    return null;
  }

  renderThemeSelector() {
    if (this.state.themes) {
      const options = this.state.themes.map(theme => ({
        value: theme.id,
        label: theme.theme_name,
      }));

      return (
        <Form.Item label={t('Theme')}>
          <Select
            value={this.state.pendingThemeId}
            onChange={value =>
              this.changeTheme({ key: value?.toString() || 'none' })
            }
            options={options}
            allowClear
            placeholder={t('Select a theme')}
            css={{ width: 200 }}
          />
        </Form.Item>
      );
    }
    return null;
  }

  render() {
    return (
      <ModalTrigger
        triggerNode={this.props.triggerNode}
        modalTitle={t('Theme & CSS')}
        modalBody={
          <StyledWrapper>
            <div className="css-editor-header">
              <Form layout="inline">{this.renderThemeSelector()}</Form>
              <h5>{t('CSS editor')}</h5>
              <Form layout="inline">
                <Form.Item>{this.renderTemplateSelector()}</Form.Item>
              </Form>
            </div>
            <AceCssEditor
              className="css-editor"
              minLines={12}
              maxLines={30}
              onChange={this.changeCss}
              height="200px"
              width="100%"
              editorProps={{ $blockScrolling: true }}
              enableLiveAutocompletion
              value={this.state.pendingCss || ''}
            />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button
                type="primary"
                onClick={this.applyChanges}
                disabled={!this.hasChanges()}
              >
                {t('Apply')}
              </Button>
            </div>
          </StyledWrapper>
        }
      />
    );
  }
}

export default CssEditor;
