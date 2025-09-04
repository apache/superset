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
import { AntdDropdown } from 'src/components';
import { Menu } from 'src/components/Menu';
import Button from 'src/components/Button';
import { t, styled, SupersetClient } from '@superset-ui/core';
import Modal from 'src/components/Modal';
import { CssEditor as AceCssEditor } from 'src/components/AsyncAceEditor';

export interface CssEditorProps {
  initialCss: string;
  triggerNode: ReactNode;
  onChange: (css: string) => void;
  addDangerToast: (msg: string) => void;
}

export type CssEditorState = {
  css: string;
  templates?: Array<{
    css: string;
    label: string;
  }>;
  showModal: boolean;
  isFullscreen: boolean;
};
const StyledWrapper = styled.div`
  ${({ theme }) => `
    .css-editor-header {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      margin-bottom: ${theme.gridUnit * 2}px;

      h5 {
        margin-top: ${theme.gridUnit}px;
      }
    }
    .css-editor {
      border: 1px solid ${theme.colors.grayscale.light1};
    }
    .load-css-template-btn {
      font-size: 10px !important;
      border-radius: 8px !important;
      height: 26px !important;
      background-color: ${theme.colors.grayscale.light4} !important;
    }
  `}
`;

const MacOSTitleBar = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(180deg, #f0f0f0 0%, #e8e8e8 100%);
    border-bottom: 1px solid #d0d0d0;
    padding: ${theme.gridUnit}px ${theme.gridUnit * 2}px;
    height: 28px;
    position: relative;
    
    .traffic-lights {
      display: flex;
      gap: ${theme.gridUnit}px;
      
      .traffic-light {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        position: relative;
        
        &.close {
          background: #ff5f56;
          &:hover {
            background: #ff3b30;
          }
          &::before {
            content: '×';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #8b0000;
            font-size: 10px;
            font-weight: bold;
            line-height: 1;
          }
        }
        
        &.fullscreen {
          background: #28ca42;
          padding: 0 !important;
          &:hover {
            background: #1fb835;
          }
          &::before {
            content: '⤢';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #006400;
            font-size: 8px;
            font-weight: bold;
            line-height: 1;
          }
        }
      }
    }
    
    .title {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      font-size: 13px;
      font-weight: 500;
      color: #333;
      margin: 0;
    }
  `}
`;

const StyledModal = styled(Modal)<{ isFullscreen?: boolean }>`
  ${({ isFullscreen }) =>
    isFullscreen &&
    `
    .ant-modal {
      max-width: 75vw !important;
      width: 75vw !important;
      height: 75vh !important;
      top: 15vh !important;
      padding-bottom: 0 !important;
    }
    
    .ant-modal-content {
      height: 100% !important;
      display: flex !important;
      flex-direction: column !important;
    }
    
    .ant-modal-body {
      flex: 1 !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
    }
  `}

  .ant-modal-header {
    display: none !important;
  }

  .ant-modal-close {
    display: none !important;
  }

  .ant-modal-footer {
    display: none !important;
  }
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
      showModal: false,
      isFullscreen: false,
    };
    this.changeCss = this.changeCss.bind(this);
    this.changeCssTemplate = this.changeCssTemplate.bind(this);
    this.openModal = this.openModal.bind(this);
    this.closeModal = this.closeModal.bind(this);
    this.toggleFullscreen = this.toggleFullscreen.bind(this);
  }

  componentDidMount() {
    AceCssEditor.preload();

    SupersetClient.get({ endpoint: '/csstemplateasyncmodelview/api/read' })
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
  }

  changeCss(css: string) {
    this.setState({ css }, () => {
      this.props.onChange(css);
    });
  }

  changeCssTemplate(info: { key: Key }) {
    const keyAsString = String(info.key);
    this.changeCss(keyAsString);
  }

  openModal() {
    this.setState({ showModal: true });
  }

  closeModal() {
    this.setState({ showModal: false, isFullscreen: false });
  }

  toggleFullscreen() {
    this.setState(prevState => ({ isFullscreen: !prevState.isFullscreen }));
  }

  renderTemplateSelector() {
    if (this.state.templates) {
      const menu = (
        <Menu onClick={this.changeCssTemplate}>
          {this.state.templates.map(template => (
            <Menu.Item key={template.css}>{template.label}</Menu.Item>
          ))}
        </Menu>
      );
      return (
        <AntdDropdown overlay={menu} placement="bottomRight">
          <Button className="load-css-template-btn">
            {t('Load a CSS template')}
          </Button>
        </AntdDropdown>
      );
    }
    return null;
  }

  render() {
    return (
      <>
        <span
          onClick={this.openModal}
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
        >
          {this.props.triggerNode}
        </span>
        <StyledModal
          show={this.state.showModal}
          onHide={this.closeModal}
          title=""
          isFullscreen={this.state.isFullscreen}
          width={this.state.isFullscreen ? '70vw' : '600px'}
          height={this.state.isFullscreen ? '70vh' : 'auto'}
          destroyOnClose={false}
          maskClosable={false}
        >
          <MacOSTitleBar>
            <div className="traffic-lights">
              <button
                className="traffic-light close"
                onClick={this.closeModal}
                aria-label="Close"
              />
              <button
                className="traffic-light fullscreen"
                onClick={this.toggleFullscreen}
                aria-label={
                  this.state.isFullscreen
                    ? 'Exit fullscreen'
                    : 'Enter fullscreen'
                }
              />
            </div>
            <h4 className="title">{t('CSS Editor')}</h4>
            {this.renderTemplateSelector()}
          </MacOSTitleBar>
          <StyledWrapper
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <div className="css-editor-header">
              <h5>{t('Live CSS editor')}</h5>
            </div>
            <AceCssEditor
              className="css-editor"
              minLines={this.state.isFullscreen ? 25 : 12}
              maxLines={this.state.isFullscreen ? 50 : 30}
              onChange={this.changeCss}
              height={this.state.isFullscreen ? 'calc(100% - 60px)' : '200px'}
              width="100%"
              editorProps={{ $blockScrolling: true }}
              enableLiveAutocompletion
              value={this.state.css || ''}
            />
          </StyledWrapper>
        </StyledModal>
      </>
    );
  }
}

export default CssEditor;
