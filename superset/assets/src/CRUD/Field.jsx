import React from 'react';
import PropTypes from 'prop-types';
import {
  FormGroup, ControlLabel, HelpBlock, FormControl, OverlayTrigger, Tooltip,
} from 'react-bootstrap';

import './styles.less';

const propTypes = {
  value: PropTypes.any.isRequired,
  label: PropTypes.string.isRequired,
  descr: PropTypes.node,
  fieldKey: PropTypes.string.isRequired,
  control: PropTypes.node.isRequired,
  onChange: PropTypes.func,
  compact: PropTypes.bool,
};
const defaultProps = {
  controlProps: {},
  onChange: () => {},
  compact: false,
  desc: null,
};

export default class Field extends React.PureComponent {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
  }
  onChange(newValue) {
    this.props.onChange(this.props.fieldKey, newValue);
  }
  render() {
    const { compact, value, label, control, descr, fieldKey } = this.props;
    const hookedControl = React.cloneElement(control, { value, onChange: this.onChange });
    return (
      <FormGroup
        controlId={fieldKey}
      >
        <ControlLabel className="m-r-5">
          {label || fieldKey}
          {compact && descr &&
            <OverlayTrigger
              placement="right"
              overlay={
                <Tooltip id="field-descr" bsSize="lg">{descr}</Tooltip>
                }
            >
              <i className="fa fa-info-circle m-l-5" />
            </OverlayTrigger>
          }
        </ControlLabel>
        {hookedControl}
        <FormControl.Feedback />
        {!compact && descr &&
          <HelpBlock>{descr}</HelpBlock>
        }
      </FormGroup>
    );
  }
}
Field.propTypes = propTypes;
Field.defaultProps = defaultProps;
