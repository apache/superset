import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, ButtonGroup, OverlayTrigger, Popover } from 'react-bootstrap';
import { DragSource } from 'react-dnd';

import ItemTypes from '../ItemTypes';
import ColumnTypes from '../ColumnTypes';

const style = {
  cursor: 'move',
  display: 'flex',
  flexWrap: 'nowrap',
  justifyContent: 'space-between',
};

const boxSource = {
  beginDrag(props) {
    return {
      name: props.name,
      id: props.id,
      columnType: props.columnType,
      groupable: props.groupable,
    };
  },
};

function collect(connect, monitor) {
  return {
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging(),
  };
}

const propTypes = {
  connectDragSource: PropTypes.func.isRequired,
  isDragging: PropTypes.bool.isRequired,
  name: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  columnType: PropTypes.string.isRequired,
  groupable: PropTypes.bool.isRequired,

  handleAddFilter: PropTypes.func.isRequired,
  handleAddSplit: PropTypes.func.isRequired,
};

class Column extends Component {
  constructor(props) {
    super(props);
    this.popoverRight.bind(this);
  }

  popoverRight() {
    const { handleAddFilter, handleAddSplit } = this.props;
    return (
      <Popover id="popover-positioned-right">
        <ButtonGroup vertical>
          <Button
            bsSize="xsmall"
            onClick={() => {
              this.refs.overlay.hide();
              handleAddFilter(boxSource.beginDrag(this.props));
            }}
          >Add as Filter</Button>
          <Button
            bsSize="xsmall"
            onClick={() => {
              this.refs.overlay.hide();
              handleAddSplit(boxSource.beginDrag(this.props));
            }}
          >Add as Group By</Button>
        </ButtonGroup>
      </Popover>
    );
  }

  render() {
    const { name, isDragging, connectDragSource, columnType } = this.props;
    const opacity = isDragging ? 0.4 : 1;
    let icon = '';
    if (columnType === ColumnTypes.TIMESTAMP) {
      icon = 'fa-clock-o';
    } else if (columnType === ColumnTypes.NUMERIC) {
      icon = 'fa-hashtag';
    } else if (columnType === ColumnTypes.STRING) {
      icon = 'fa-language';
    }

    return connectDragSource(
      <div data-toggle="toggle" title={name}>
        <OverlayTrigger
          placement="right"
          ref="overlay"
          overlay={this.popoverRight()}
          trigger="click"
          rootClose
        >
          <div style={{ ...style, opacity }} >
            <div style={{ flexGrow: 1,
              overflowX: 'hidden',
              textOverflow: 'ellipsis',
              marginRight: '0.5rem',
              whiteSpace: 'nowrap' }}
            >
              {name}
            </div>
            <i style={{ flexGrow: 0 }} className={`fa ${icon} fa-fw`} aria-hidden="true" />
            <div className="clearfix" />
          </div>
        </OverlayTrigger>
      </div>,
        );
  }
}
Column.propTypes = propTypes;

export default DragSource(ItemTypes.DIMENSION, boxSource, collect)(Column);
