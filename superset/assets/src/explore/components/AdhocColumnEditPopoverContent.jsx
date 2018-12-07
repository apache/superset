import React from 'react';
import PropTypes from 'prop-types';
import AceEditor from 'react-ace';
import { CompactPicker } from 'react-color';
import TextControl from './controls/TextControl';
import { ALL_COLOR_SCHEMES }  from '../../modules/colors'
import 'brace/mode/sql';
import 'brace/theme/github';
import 'brace/ext/language_tools';
import { FormGroup } from 'react-bootstrap';
import VirtualizedSelect from 'react-virtualized-select';

import { sqlWords } from '../../SqlLab/components/AceEditorWrapper';
import AdhocFilter, { EXPRESSION_TYPES, CLAUSES } from '../AdhocFilter';
import adhocMetricType from '../propTypes/adhocMetricType';
import columnType from '../propTypes/columnType';


const propTypes = {
  adhocFilter: PropTypes.instanceOf(AdhocFilter).isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.oneOfType([
    columnType,
    PropTypes.shape({ saved_metric_name: PropTypes.string.isRequired }),
    adhocMetricType,
  ])).isRequired,
  height: PropTypes.number,
};

const langTools = ace.acequire('ace/ext/language_tools');

// todo: refactor remaining use AdhocColumn instead AdhocFilter
//it's copy of AdhocFilterEditPopoverContent,so most of code is same and may be unwanted
export default class AdhocColumnEditPopoverContent extends React.Component {
  constructor(props) {
    super(props);
    console.log(this.props);
    if(this.props.adhocFilter.expressionType == EXPRESSION_TYPES.SIMPLE){
      this.props.onChange(this.props.adhocFilter.duplicateWith({
        comparator: '',
        clause:'',
        operator:'',
        sqlExpression:'',
        expressionType: EXPRESSION_TYPES.OPTIONS,
      }));
    }
    this.onSqlExpressionChange = this.onSqlExpressionChange.bind(this);
    this.onSqlExpressionClauseChange = this.onSqlExpressionClauseChange.bind(this);

    this.handleAceEditorRef = this.handleAceEditorRef.bind(this);
    this.onOperatorChange = this.onOperatorChange.bind(this);
    this.onComparatorChange = this.onComparatorChange.bind(this);
    
  }

  onSqlExpressionClauseChange(clause) {
    this.props.onChange(this.props.adhocFilter.duplicateWith({
      clause: clause.rgb,
      expressionType: EXPRESSION_TYPES.OPTIONS,
    }));
  }

  onSqlExpressionChange(sqlExpression) {
    
    this.props.onChange(this.props.adhocFilter.duplicateWith({
      sqlExpression:sqlExpression,
      expressionType: EXPRESSION_TYPES.OPTIONS,
    }));
  }

  onOperatorChange(operator) {
  
    this.props.onChange(this.props.adhocFilter.duplicateWith({
      operator: operator ,
      expressionType: EXPRESSION_TYPES.OPTIONS,
    }));
  }

  onComparatorChange(comparator) {
    this.props.onChange(this.props.adhocFilter.duplicateWith({
      comparator: comparator.rgb,
      expressionType: EXPRESSION_TYPES.OPTIONS,
    }));
  }

  handleAceEditorRef(ref) {
    if (ref) {
      this.aceEditorRef = ref;
    }
  }

  render() {
    const { adhocFilter, height } = this.props;


    return (
      <span>
        <table>
        <tbody>
          <tr>
            <td>
              <TextControl
                name="map-color-low-value"
                label="Min Value & Color"
                placeholder=""
                value= {adhocFilter.operator}
                onChange={this.onOperatorChange}
              />
              </td>
            <td>
            <CompactPicker
            color={adhocFilter.comparator}
            colors={ALL_COLOR_SCHEMES['d3Category10']}
            onChangeComplete={this.onComparatorChange}
          />
            </td>
          </tr>
          <tr>
            <td>
              <TextControl
                name="map-color-high-value"
                label="Max Value & Color"
                placeholder=""
                value= {adhocFilter.sqlExpression}
                onChange={this.onSqlExpressionChange}
              />
              </td>
            <td>
            <CompactPicker
            color={adhocFilter.clause}
            colors={ALL_COLOR_SCHEMES['d3Category10']}
            onChangeComplete={this.onSqlExpressionClauseChange}
             />
            </td>
          </tr>
          </tbody>
        </table>
        <span>Min value color is filled for value in range (min - max) </span>
      </span>
    );
  }
}
AdhocColumnEditPopoverContent.propTypes = propTypes;
