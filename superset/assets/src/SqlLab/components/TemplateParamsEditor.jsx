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
import { Badge } from 'react-bootstrap';
import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/mode/json';
import 'brace/mode/html';
import 'brace/mode/markdown';
import 'brace/theme/textmate';

import { t } from '@superset-ui/translation';

import ModalTrigger from '../../components/ModalTrigger';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';
import Button from '../../components/Button';

const propTypes = {
  onChange: PropTypes.func,
  code: PropTypes.string,
  language: PropTypes.oneOf(['yaml', 'json']),
};

const defaultProps = {
  label: null,
  description: null,
  onChange: () => {},
  code: '{}',
};

export default class TemplateParamsEditor extends React.Component {
  constructor(props) {
    super(props);
    const codeText = props.code || '{}';
    this.state = {
      codeText,
      parsedJSON: null,
      isValid: true,
    };
    this.onChange = this.onChange.bind(this);
  }
  componentDidMount() {
    this.onChange(this.state.codeText);
  }
  onChange(value) {
    const codeText = value;
    let isValid;
    let parsedJSON = {};
    try {
      parsedJSON = JSON.parse(value);
      isValid = true;
    } catch (e) {
      isValid = false;
    }
    this.setState({ parsedJSON, isValid, codeText });
    if (isValid) {
      this.props.onChange(codeText);
    } else {
      this.props.onChange('{}');
    }
  }
  renderDoc() {
    return (
      <p>
        Assign a set of parameters as <code>JSON</code> below
        (example: <code>{'{"my_table": "foo"}'}</code>),
        and they become available
        in your SQL (example: <code>SELECT * FROM {'{{ my_table }}'} </code>)
        by using&nbsp;
        <a
          href="http://superset.apache.org/sqllab.html#templating-with-jinja"
          target="_blank"
          rel="noopener noreferrer"
        >
          Jinja templating
        </a> syntax.
      </p>
    );
  }
  renderModalBody() {
    return (
      <div>
        {this.renderDoc()}
        <AceEditor
          mode={this.props.language}
          theme="textmate"
          style={{ border: '1px solid #CCC' }}
          minLines={25}
          maxLines={50}
          onChange={this.onChange}
          width="100%"
          editorProps={{ $blockScrolling: true }}
          enableLiveAutocompletion
          value={this.state.codeText}
        />
      </div>
    );
  }
  render() {
    const paramCount = this.state.parsedJSON ? Object.keys(this.state.parsedJSON).length : 0;
    return (
      <ModalTrigger
        modalTitle={t('Template Parameters')}
        triggerNode={
          <Button
            className="m-r-5"
            tooltip={t('Edit template parameters')}
          >
            {`${t('parameters')} `}
            {paramCount > 0 &&
              <Badge>{paramCount}</Badge>
            }
            {!this.state.isValid &&
              <InfoTooltipWithTrigger
                icon="exclamation-triangle"
                bsStyle="danger"
                tooltip={t('Invalid JSON')}
                label="invalid-json"
              />
            }
          </Button>
        }
        modalBody={this.renderModalBody(true)}
      />
    );
  }
}

TemplateParamsEditor.propTypes = propTypes;
TemplateParamsEditor.defaultProps = defaultProps;
