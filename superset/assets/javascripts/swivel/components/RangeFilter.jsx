import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Checkbox, FormControl, Label } from 'react-bootstrap';


const propTypes = {
  intervalStart: PropTypes.any,
  intervalEnd: PropTypes.any,
  leftOpen: PropTypes.bool,
  rightOpen: PropTypes.bool,
  onChange: PropTypes.func,
  onSubmit: PropTypes.func,
};

class RangeFilter extends PureComponent {

  formFormatter(e) {
    return { [e.target.name]: e.target.value };
  }

  render() {
    const { intervalStart, intervalEnd,
      leftOpen, rightOpen, onChange, onSubmit } = this.props;
    return (
      <div>
        <Label>Start</Label>
        <FormControl
          name="intervalStart"
          value={intervalStart}
          onChange={e => onChange(this.formFormatter(e))}
          onKeyPress={onSubmit}
          bsSize="small"
        />
        <Label>End</Label>
        <FormControl
          name="intervalEnd"
          value={intervalEnd}
          onChange={e => onChange(this.formFormatter(e))}
          onKeyPress={onSubmit}
          bsSize="small"
        />
        <div>
          <Checkbox
            checked={leftOpen}
            onChange={() => onChange({ leftOpen: !leftOpen })}
          >Left Open</Checkbox>
          <Checkbox
            checked={rightOpen}
            onChange={() => onChange({ rightOpen: !rightOpen })}
          >Right Open</Checkbox>
        </div>
      </div>
    );
  }
}

RangeFilter.propTypes = propTypes;
export default RangeFilter;
