import React, { PropTypes } from 'react';
import FieldSet from './FieldSet';

const NUM_COLUMNS = 12;

const propTypes = {
  fields: PropTypes.object.isRequired,
  fieldSets: PropTypes.array.isRequired,
  fieldOverrides: PropTypes.object,
  onChange: PropTypes.func,
};

const defaultProps = {
  fieldOverrides: {},
  onChange: () => {},
};

export default class FieldSetRow extends React.Component {
  getFieldData(fs) {
    const { fields, fieldOverrides } = this.props;
    let fieldData = fields[fs];
    if (fieldOverrides.hasOwnProperty(fs)) {
      const overrideData = fieldOverrides[fs];
      fieldData = Object.assign({}, fieldData, overrideData);
    }
    return fieldData;
  }

  render() {
    const colSize = NUM_COLUMNS / this.props.fieldSets.length;
    const { onChange } = this.props;
    return (
      <div className="row">
        {this.props.fieldSets.map((fs) => {
          const fieldData = this.getFieldData(fs);
          return (
            <div className={`col-lg-${colSize} col-xs-12`} key={fs}>
              <FieldSet name={fs} onChange={onChange} {...fieldData} />
            </div>
          );
        })}
      </div>
    );
  }
}

FieldSetRow.propTypes = propTypes;
FieldSetRow.defaultProps = defaultProps;
