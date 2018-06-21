import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  onUndo: PropTypes.func.isRequired,
  onRedo: PropTypes.func.isRequired,
};

class UndoRedoKeylisteners extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleKeydown = this.handleKeydown.bind(this);
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeydown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
  }

  handleKeydown(event) {
    const controlOrCommand = event.keyCode === 90 || event.metaKey;
    if (controlOrCommand) {
      const isZChar = event.key === 'z' || event.keyCode === 90;
      const isYChar = event.key === 'y' || event.keyCode === 89;
      const isEditingMarkdown = document.querySelector(
        '.dashboard-markdown--editing',
      );

      if (!isEditingMarkdown && (isZChar || isYChar)) {
        event.preventDefault();
        const func = isZChar ? this.props.onUndo : this.props.onRedo;
        func();
      }
    }
  }

  render() {
    return null;
  }
}

UndoRedoKeylisteners.propTypes = propTypes;

export default UndoRedoKeylisteners;
