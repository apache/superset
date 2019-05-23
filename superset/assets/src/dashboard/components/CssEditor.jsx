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
import Select from 'react-select';
import AceEditor from 'react-ace';
import 'brace/mode/css';
import 'brace/theme/github';
import { t } from '@superset-ui/translation';

import ModalTrigger from '../../components/ModalTrigger';

const propTypes = {
  initialCss: PropTypes.string,
  triggerNode: PropTypes.node.isRequired,
  onChange: PropTypes.func,
  templates: PropTypes.array,
};

const defaultProps = {
  initialCss: '',
  onChange: () => {},
  templates: [],
};

class CssEditor extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      css: props.initialCss,
      cssTemplateOptions: [],
    };
    this.changeCss = this.changeCss.bind(this);
    this.changeCssTemplate = this.changeCssTemplate.bind(this);
  }

  changeCss(css) {
    this.setState({ css }, () => {
      this.props.onChange(css);
    });
  }

  changeCssTemplate(opt) {
    this.changeCss(opt.css);
  }

  renderTemplateSelector() {
    if (this.props.templates) {
      return (
        <div style={{ zIndex: 10 }}>
          <h5>{t('Load a template')}</h5>
          <Select
            options={this.props.templates}
            placeholder={t('Load a CSS template')}
            onChange={this.changeCssTemplate}
          />
        </div>
      );
    }
    return null;
  }

  render() {
    return (
      <ModalTrigger
        triggerNode={this.props.triggerNode}
        modalTitle={t('CSS')}
        isMenuItem
        modalBody={
          <div>
            {this.renderTemplateSelector()}
            <div style={{ zIndex: 1 }}>
              <h5>{t('Live CSS Editor')}</h5>
              <div style={{ border: 'solid 1px grey' }}>
                <AceEditor
                  mode="css"
                  theme="github"
                  minLines={8}
                  maxLines={30}
                  onChange={this.changeCss}
                  height="200px"
                  width="100%"
                  editorProps={{ $blockScrolling: true }}
                  enableLiveAutocompletion
                  value={this.state.css || ''}
                />
              </div>
            </div>
          </div>
        }
      />
    );
  }
}

CssEditor.propTypes = propTypes;
CssEditor.defaultProps = defaultProps;

export default CssEditor;
