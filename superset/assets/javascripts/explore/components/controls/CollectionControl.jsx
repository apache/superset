import React from 'react';
import PropTypes from 'prop-types';
import { ListGroup, ListGroupItem } from 'react-bootstrap';
import shortid from 'shortid';

import InfoTooltipWithTrigger from '../../../components/InfoTooltipWithTrigger';
import ControlHeader from '../ControlHeader';

const propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  placeholder: PropTypes.string,
  addTooltip: PropTypes.string,
  itemGenerator: PropTypes.func,
  keyAccessor: PropTypes.func,
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.array,
  ]),
  isFloat: PropTypes.bool,
  isInt: PropTypes.bool,
  control: PropTypes.func,
};

const defaultProps = {
  label: null,
  description: null,
  onChange: () => {},
  placeholder: 'Empty collection',
  itemGenerator: () => ({ key: shortid.generate() }),
  keyAccessor: o => o.key,
  value: [],
  addTooltip: 'Add an item',
};

export default class CollectionControl extends React.Component {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
    this.onAdd = this.onAdd.bind(this);
  }
  onChange(i, value) {
    this.props.value[i] = value;
    this.props.onChange(this.props.value);
  }
  onAdd() {
    this.props.onChange(this.props.value.concat([this.props.itemGenerator()]));
  }
  removeItem(i) {
    this.props.onChange(this.props.value.filter((o, ix) => i !== ix));
  }
  renderList() {
    if (this.props.value.length === 0) {
      return <div className="text-muted">{this.props.placeholder}</div>;
    }
    return (
      <ListGroup>
        {this.props.value.map((o, i) => (
          <ListGroupItem className="clearfix" key={this.props.keyAccessor(o)}>
            <div className="pull-left">
              <this.props.control
                {...o}
                onChange={this.onChange.bind(this, i)}
              />
            </div>
            <div className="pull-right">
              <InfoTooltipWithTrigger
                icon="times"
                label="remove-item"
                tooltip="remove item"
                bsStyle="primary"
                onClick={this.removeItem.bind(this, i)}
              />
            </div>
          </ListGroupItem>))}
      </ListGroup>
    );
  }
  render() {
    return (
      <div>
        <ControlHeader {...this.props} />
        {this.renderList()}
        <InfoTooltipWithTrigger
          icon="plus-circle"
          label="add-item"
          tooltip={this.props.addTooltip}
          bsStyle="primary"
          className="fa-lg"
          onClick={this.onAdd}
        />
      </div>
    );
  }
}

CollectionControl.propTypes = propTypes;
CollectionControl.defaultProps = defaultProps;
