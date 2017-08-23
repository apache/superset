import React from 'react';
import PropTypes from 'prop-types';
import delay from 'lodash.delay';
import { getTopOffset } from '../../../utils/common';


const propTypes = {
  north: PropTypes.object.isRequired,
  south: PropTypes.object.isRequired,
  minHeight: PropTypes.number,
  onSizeChange: PropTypes.func,
};

class SplitPane extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      dragging: false,
    };

    this.handleDraggingStart = this.handleDraggingStart.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  componentDidMount() {
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('resize', this.handleResize);

    this.initSize();
  }

  componentWillUnmount() {
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('resize', this.handleResize);
  }

  setSize(northInPercent, southInPercent) {
    const totalHeight = this.refs.splitter.clientHeight - this.refs.dragBar.clientHeight;

    const heightNorthInPixels = northInPercent * totalHeight / 100;
    const heightSouthInPixels = southInPercent * totalHeight / 100;

    if (this.props.onSizeChange) {
      this.props.onSizeChange({
        north: heightNorthInPixels,
        south: heightSouthInPixels,
      });
    }
  }

  initSize() {
    const totalHeight = this.refs.splitter.clientHeight;
    const dragBarHeight = this.refs.dragBar.clientHeight;

    const heightInPixels = (totalHeight - dragBarHeight) / 2;
    const heightInPercent = heightInPixels * 100 / totalHeight;

    this.setState({
      ...this.state,
      heightNorth: heightInPercent,
      heightSouth: heightInPercent,
    });
    this.setSize(heightInPercent, heightInPercent);
  }

  handleMouseMove(e) {
    if (!this.state.dragging) {
      return;
    }

    const minHeight = this.props.minHeight || 0;

    const offset = getTopOffset(this.refs.splitter);
    const totalHeight = this.refs.splitter.clientHeight;
    const dragBarHeight = this.refs.dragBar.clientHeight;

    const heightNorthInPixels = e.pageY - offset;
    const heightSouthInPixels = totalHeight - heightNorthInPixels - dragBarHeight;

    const heightNorthInPercent = 100 * heightNorthInPixels / totalHeight;
    const heightSouthInPercent = 100 * heightSouthInPixels / totalHeight;

    if (heightNorthInPercent >= minHeight
      && heightSouthInPercent >= minHeight) {
      this.setState({
        ...this.state,
        heightNorth: heightNorthInPercent,
        heightSouth: heightSouthInPercent,
      });

      this.setSize(heightNorthInPercent, heightSouthInPercent);
    }
  }

  handleDraggingStart() {
    this.setState({ ...this.state, dragging: true });
  }

  handleResize() {
    const { heightNorth, heightSouth } = this.state;
    /*
    The `delay` is needed since some events like 'onresize' happen before rendering.
    That means that we can't calculate the sizes right.
     */
    delay(() => {
      this.setSize(heightNorth, heightSouth);
    }, 100);
  }

  handleMouseUp() {
    if (this.state.dragging) {
      this.setState({ ...this.state, dragging: false });
    }
  }

  render() {
    return (
      <div ref="splitter" className="Splitter">
        <div
          style={{ height: this.state.heightNorth + '%' }}
        >
          {this.props.north}
        </div>
        <div
          ref="dragBar"
          className="DragBar"
          onMouseDown={this.handleDraggingStart}
        >
          <div className="DragBarVisible" />
        </div>
        <div
          style={{ height: this.state.heightSouth + '%' }}
        >
          {this.props.south}
        </div>
      </div>
    );
  }
}
SplitPane.propTypes = propTypes;

export default SplitPane;
