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
import AceEditor from 'react-ace';
import ace from 'brace';
import 'brace/mode/sql';
import 'brace/theme/github';
import 'brace/ext/language_tools';
import { FormGroup } from 'react-bootstrap';
import VirtualizedSelect from 'react-virtualized-select';
import { t } from '@superset-ui/translation';

import sqlKeywords from '../../SqlLab/utils/sqlKeywords';
import AdhocFilter, { EXPRESSION_TYPES, CLAUSES } from '../AdhocFilter';
import adhocMetricType from '../propTypes/adhocMetricType';
import columnType from '../propTypes/columnType';
import OnPasteSelect from '../../components/OnPasteSelect';
import VirtualizedRendererWrap from '../../components/VirtualizedRendererWrap';

const propTypes = {
  adhocFilter: PropTypes.instanceOf(AdhocFilter).isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      columnType,
      PropTypes.shape({ saved_metric_name: PropTypes.string.isRequired }),
      adhocMetricType,
    ]),
  ).isRequired,
  height: PropTypes.number.isRequired,
};

const langTools = ace.acequire('ace/ext/language_tools');

export default class AdhocFilterEditPopoverSqlTabContent extends React.Component {
  constructor(props) {
    super(props);
    this.onSqlExpressionChange = this.onSqlExpressionChange.bind(this);
    this.onSqlExpressionClauseChange = this.onSqlExpressionClauseChange.bind(
      this,
    );
    this.handleAceEditorRef = this.handleAceEditorRef.bind(this);

    this.selectProps = {
      multi: false,
      name: 'select-column',
      labelKey: 'label',
      autosize: false,
      clearable: false,
      selectWrap: VirtualizedSelect,
    };

    if (langTools) {
      const words = sqlKeywords.concat(
        this.props.options.map(option => {
          if (option.column_name) {
            return {
              name: option.column_name,
              value: option.column_name,
              score: 50,
              meta: 'option',
            };
          }
          return null;
        }),
      );
      const completer = {
        getCompletions: (aceEditor, session, pos, prefix, callback) => {
          callback(null, words);
        },
      };
      langTools.setCompleters([completer]);
    }
  }

  componentDidUpdate() {
    this.aceEditorRef.editor.resize();
  }

  onSqlExpressionClauseChange(clause) {
    this.props.onChange(
      this.props.adhocFilter.duplicateWith({
        clause: clause && clause.clause,
        expressionType: EXPRESSION_TYPES.SQL,
      }),
    );
  }

  onSqlExpressionChange(sqlExpression) {
    this.props.onChange(
      this.props.adhocFilter.duplicateWith({
        sqlExpression,
        expressionType: EXPRESSION_TYPES.SQL,
      }),
    );
  }

  handleAceEditorRef(ref) {
    if (ref) {
      this.aceEditorRef = ref;
    }
  }

  render() {
    const { adhocFilter, height } = this.props;

    const clauseSelectProps = {
      placeholder: t('choose WHERE or HAVING...'),
      options: Object.keys(CLAUSES).map(clause => ({ clause })),
      value: adhocFilter.clause,
      onChange: this.onSqlExpressionClauseChange,
      optionRenderer: VirtualizedRendererWrap(clause => clause.clause),
      valueRenderer: clause => <span>{clause.clause}</span>,
      valueKey: 'clause',
    };

    return (
      <span>
        <FormGroup className="filter-edit-clause-section">
          <OnPasteSelect
            {...this.selectProps}
            {...clauseSelectProps}
            className="filter-edit-clause-dropdown"
          />
          <span className="filter-edit-clause-info">
            <strong>Where</strong> filters by columns.
            <br />
            <strong>Having</strong> filters by metrics.
          </span>
        </FormGroup>
        <FormGroup>
          <AceEditor
            ref={this.handleAceEditorRef}
            mode="sql"
            theme="github"
            height={height - 100 + 'px'}
            onChange={this.onSqlExpressionChange}
            width="100%"
            showGutter={false}
            value={adhocFilter.sqlExpression || adhocFilter.translateToSql()}
            editorProps={{ $blockScrolling: true }}
            enableLiveAutocompletion
            className="adhoc-filter-sql-editor"
            wrapEnabled
          />
        </FormGroup>
      </span>
    );
  }
}
AdhocFilterEditPopoverSqlTabContent.propTypes = propTypes;
