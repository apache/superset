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
import 'brace/theme/textmate';

import { t } from '@superset-ui/translation';

import Link from './Link';
import ModalTrigger from '../../components/ModalTrigger';

const propTypes = {
  tooltipText: PropTypes.string,
  title: PropTypes.string,
  sql: PropTypes.string,
};

const defaultProps = {
  tooltipText: t('Show CREATE VIEW statement'),
  title: t('CREATE VIEW statement'),
  sql: '',
};

export default class ShowCreateView extends React.Component {
  renderModalBody() {
    return (
      <div>
        <AceEditor
          mode="sql"
          theme="textmate"
          style={{ border: '1px solid #CCC' }}
          minLines={25}
          maxLines={50}
          width="100%"
          editorProps={{ $blockScrolling: true }}
          value={this.props.sql}
        />
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

ShowCreateView.propTypes = propTypes;
ShowCreateView.defaultProps = defaultProps;
