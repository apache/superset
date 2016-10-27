import React, { PropTypes } from 'react';
import FieldSet from './FieldSet';
import { fieldSets } from '../controlPanelMappings';

const propTypes = {
  fieldSets: PropTypes.array.isRequired,
}

export default class FieldSetRow extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div>
        {this.props.fieldSets.map((fieldSet) => {
          return (
            <FieldSet {...fieldSets[fieldSet]} />
          );
        })}
      </div>
    );
  }
}
