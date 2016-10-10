import React from 'react';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { Checkbox } from 'react-bootstrap';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  checkBoxArray: React.PropTypes.arrayOf(
    React.PropTypes.shape({
      key: React.PropTypes.string.isRequired,
      label: React.PropTypes.string.isRequired,
      checked: React.PropTypes.bool.isRequired,
    })
  ).isRequired,
};

const defaultProps = {
  checkBoxArray: [],
};

class CheckBoxArray extends React.Component {
  onToggle(checkBoxKey, checked) {
    this.props.actions.setFormData(checkBoxKey, checked);
  }
  render() {
    const checkBoxes = this.props.checkBoxArray.map((obj) => (
      <div
        className="col-sm-6"
        key={obj.key}
      >
        <Checkbox
          inline
          onChange={this.onToggle.bind(this, obj.key, !obj.checked)}
          checked={obj.checked}
        >
          {obj.label}
        </Checkbox>
      </div>
    ));
    return (
      <div className="panel space-1">
        {checkBoxes}
      </div>
    );
  }
}

CheckBoxArray.propTypes = propTypes;
CheckBoxArray.defaultProps = defaultProps;

function mapStateToProps() {
  return {};
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(CheckBoxArray);
