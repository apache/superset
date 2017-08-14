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

    this.handleResizeStart = this.handleResizeStart.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);

    window.addEventListener('mouseup', this.handleMouseUp, false);
    window.addEventListener('mousemove', this.handleMouseMove, false);
  }

  handleResizeStart() {
    this.setState({ ...this.state, dragging: true });
  }

  handleMouseMove(e) {
    if (!this.state.dragging) {
      return;
    }

    const upperBoundary = 100;
    const lowerBoundary = 0;

    const offset = getTopOffset(this.refs.splitter);
    const height = this.refs.splitter.clientHeight;
    const dragBarHeight = this.refs.dragBar.clientHeight;
    const heightNorthInPixels = e.pageY - offset;
    const heightSouthInPixels = height - heightNorthInPixels - dragBarHeight;
    const heightNorthInPercent = 100 * heightNorthInPixels / height;
    const heightSouthInPercent = 100 * heightSouthInPixels / height;

    if (heightNorthInPercent <= upperBoundary
     && heightNorthInPercent >= lowerBoundary) {
      this.setState({
        ...this.state,
        heightNorth: heightNorthInPercent,
        heightSouth: heightSouthInPercent,
      });

      if (this.props.onSizeChange) {
        this.props.onSizeChange({
          south: heightSouthInPixels,
          north: heightNorthInPixels,
        });
      }
    }
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
          onMouseDown={this.handleResizeStart}
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
