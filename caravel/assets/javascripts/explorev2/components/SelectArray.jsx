import React from 'react';
import Select from 'react-select';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';

const propTypes = {
  actions: React.PropTypes.object,
  selectArray: React.PropTypes.arrayOf(
    React.PropTypes.shape({
      key: React.PropTypes.string.isRequired,
      title: React.PropTypes.string.isRequired,
      options: React.PropTypes.array.isRequired,
      value: React.PropTypes.oneOfType([
        React.PropTypes.string,
        React.PropTypes.array,
      ]),
      width: React.PropTypes.string,
      multi: React.PropTypes.bool,
    })
  ).isRequired,
};

const defaultProps = {
  selectArray: [],
};

class SelectArray extends React.Component {
  changeSelectData(key, multi, opt) {
    if (multi) this.props.actions.setFormData(key, opt);
    else {
      const val = opt ? opt.value : null;
      this.props.actions.setFormData(key, val);
    }
  }
  render() {
    const selects = this.props.selectArray.map((obj) => (
      <div
        className={(obj.width) ? `col-sm-${obj.width}` : 'col-sm-6'}
        key={obj.key}
      >
        <h5 className="section-heading">{obj.title}</h5>
        <Select
          multi={obj.multi}
          name={`select-${obj.key}`}
          options={obj.options}
          value={obj.value}
          autosize={false}
          onChange={this.changeSelectData.bind(this, obj.key, obj.multi)}
        />
      </div>
    ));
    return (
      <div>
        {selects}
      </div>
    );
  }
}

SelectArray.propTypes = propTypes;
SelectArray.defaultProps = defaultProps;

function mapStateToProps() {
  return {};
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(SelectArray);
