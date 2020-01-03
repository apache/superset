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
import SyntaxHighlighter, {
  registerLanguage,
} from 'react-syntax-highlighter/dist/light';
import sql from 'react-syntax-highlighter/dist/languages/hljs/sql';
import github from 'react-syntax-highlighter/dist/styles/hljs/github';

import { t } from '@superset-ui/translation';

import Link from './Link';
import ModalTrigger from '../../components/ModalTrigger';

registerLanguage('sql', sql);

const propTypes = {
  tooltipText: PropTypes.string,
  title: PropTypes.string,
  sql: PropTypes.string,
};

const defaultProps = {
  tooltipText: t('Show SQL'),
  title: t('SQL statement'),
  sql: '',
};

export default class ShowSQL extends React.PureComponent {
  renderModalBody() {
    return (
      <div>
        <SyntaxHighlighter language="sql" style={github}>
          {this.props.sql}
        </SyntaxHighlighter>
      </div>
    );
  }
  render() {
    return (
      <ModalTrigger
        modalTitle={this.props.title}
        triggerNode={
          <Link
            className="fa fa-eye pull-left m-l-2"
            tooltip={this.props.tooltipText}
            href="#"
          />
        }
        modalBody={this.renderModalBody()}
      />
    );
  }
}

ShowSQL.propTypes = propTypes;
ShowSQL.defaultProps = defaultProps;
