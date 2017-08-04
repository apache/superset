import React from 'react';
import AceEditorWrapper from './AceEditorWrapper';
import { getTopOffset } from '../../../utils/common';

class ResizableAceEditor extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      editorHeight: 200,
      dragging: false,
    };

    this.handleResizeStart = this.handleResizeStart.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);

    window.addEventListener('mouseup', this.handleMouseUp, false);
  }

  handleResizeStart() {
    this.setState({ ...this.state, dragging: true });
    window.addEventListener('mousemove', this.handleMouseMove, false);
  }

  handleMouseMove(e) {
    const offset = getTopOffset(this.refs.resizableAceEditor);
    const height = e.pageY - offset;
    this.setState({ ...this.state, editorHeight: height });
  }

  handleMouseUp() {
    if (this.state.dragging) {
      this.setState({ ...this.state, dragging: false });
      window.removeEventListener('mousemove', this.handleMouseMove, false);
    }
  }

  render() {
    return (
      <div ref="resizableAceEditor" className="ResizableAceEditor">
        <AceEditorWrapper
          {...this.props}
          height={this.state.editorHeight + 'px'}
        />
        <div
          className="DragBar"
          onMouseDown={this.handleResizeStart}
        />
      </div>
    );
  }
}

export default ResizableAceEditor;
