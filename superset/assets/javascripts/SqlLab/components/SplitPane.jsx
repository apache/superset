import React from 'react';
import PropTypes from 'prop-types';
import { getTopOffset } from '../../../utils/common';


const propTypes = {
};

class ResizableAceEditor extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      heightNorth: 50,
      heightSouth: 50,
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

    const { heightNorth, heightSouth } = this.state;
    this.setSize(heightNorth, heightSouth);
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

  handleMouseMove(e) {
    if (!this.state.dragging) {
      return;
    }

    const upperBoundary = 100;
    const lowerBoundary = 0;

    const offset = getTopOffset(this.refs.splitter);
    const totalHeight = this.refs.splitter.clientHeight;
    const dragBarHeight = this.refs.dragBar.clientHeight;
    const heightNorthInPixels = e.pageY - offset;
    const heightSouthInPixels = totalHeight - heightNorthInPixels - dragBarHeight;
    const heightNorthInPercent = 100 * heightNorthInPixels / totalHeight;
    const heightSouthInPercent = 100 * heightSouthInPixels / totalHeight;

    if (heightNorthInPercent <= upperBoundary
      && heightNorthInPercent >= lowerBoundary) {
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
    this.setSize(heightNorth, heightSouth);
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
          {this.props.children[0]}
        </div>
        <div
          ref="dragBar"
          className="DragBar"
          onMouseDown={this.handleDraggingStart}
        />
        <div
          style={{ height: this.state.heightSouth + '%' }}
        >
          {this.props.children[1]}
        </div>
      </div>
    );
  }
}
ResizableAceEditor.propTypes = propTypes;

export default ResizableAceEditor;
