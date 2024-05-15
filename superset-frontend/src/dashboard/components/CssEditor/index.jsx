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
import { AntdDropdown } from 'src/components';
import { Menu } from 'src/components/Menu';
import Button from 'src/components/Button';
import { t, styled } from '@superset-ui/core';
import ModalTrigger from 'src/components/ModalTrigger';
import { CssEditor as AceCssEditor } from 'src/components/AsyncAceEditor';

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
  `}
`;

const propTypes = {
  initialCss: PropTypes.string,
  triggerNode: PropTypes.node.isRequired,
  onChange: PropTypes.func,
  templates: PropTypes.array,
};

const defaultProps = {
  initialCss: '',
  onChange: () => {},
};

class CssEditor extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      css: props.initialCss,
    };
    this.changeCss = this.changeCss.bind(this);
    this.changeCssTemplate = this.changeCssTemplate.bind(this);
  }

  componentDidMount() {
    AceCssEditor.preload();
  }

  changeCss(css) {
    this.setState({ css }, () => {
      this.props.onChange(css);
    });
  }

  changeCssTemplate({ key }) {
    this.changeCss(key);
  }

  renderTemplateSelector() {
    if (this.props.templates) {
      const menu = (
        <Menu onClick={this.changeCssTemplate}>
          {this.props.templates.map(template => (
            <Menu.Item key={template.css}>{template.label}</Menu.Item>
          ))}
        </Menu>
      );

      return (
        <AntdDropdown overlay={menu} placement="bottomRight">
          <Button>{t('Load a CSS template')}</Button>
        </AntdDropdown>
      );
    }
    return null;
  }

  render() {
    return (
      <ModalTrigger
        triggerNode={this.props.triggerNode}
        modalTitle={t('CSS')}
        modalBody={
          <StyledWrapper>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
              }}
            >
              <div className="css-editor-header">
                <h5>{t('Live CSS editor')}</h5>
                {this.renderTemplateSelector()}
              </div>
              <button
                type="button"
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  // eslint-disable-next-line theme-colors/no-literal-colors
                  color: 'rgb(89, 89, 112)',
                  // eslint-disable-next-line theme-colors/no-literal-colors
                  backgroundColor: 'rgb(240, 240, 240)',
                  marginLeft: 'auto',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  padding: '4px 8px',
                  transition: 'all 0.2s',
                  fontWeight: 'bold',
                }}
                onClick={() =>
                  this.changeCss(`
/* Top level  */
.dashboard {
  margin-left: 0 !important;
}

.dashboard--editing .grid-container {
  margin: 0 0 0 32px !important;
}

/* Dashboard grid */
.grid-container {
  padding: 0 !important;
  margin: 0 !important;
  max-width: 100% !important;
  background-color: #f5f7f8;
}

/* Dashboard rows */
.grid-row {}

/* All dashboard components */
.dashboard-component.dashboard-component {
  box-shadow: none !important;
}

/* Dashboard components */
.dragdroppable:first-of-type .resizable-container {
  padding-left: 24px;
}
.dragdroppable:last-of-type .resizable-container {
  padding-right: 24px;
}

/* Dynamic markdown components */
.dashboard-component-ikirunpipeline {
  border-radius: 0 !important;
  box-shadow: none !important;
}

/* Charts & chart headers */
.chart-header {
  display: none !important;
}

/* Big number chart */
.header-line {
  font-size: 46px !important;
  font-weight: bold;
}
                `)
                }
              >
                Load default template
              </button>
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
              value={this.state.css || ''}
            />
          </StyledWrapper>
        }
      />
    );
  }
}

CssEditor.propTypes = propTypes;
CssEditor.defaultProps = defaultProps;

export default CssEditor;
