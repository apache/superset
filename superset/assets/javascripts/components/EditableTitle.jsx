import React from 'react';
import PropTypes from 'prop-types';
import TooltipWrapper from './TooltipWrapper';

const propTypes = {
  title: PropTypes.string,
  canEdit: PropTypes.bool,
  onSaveTitle: PropTypes.func.isRequired,
};
const defaultProps = {
  title: 'Title',
  canEdit: false,
};

class EditableTitle extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isEditing: false,
      title: this.props.title,
      lastTitle: this.props.title,
    };
    this.handleClick = this.handleClick.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }
  handleClick() {
    if (!this.props.canEdit) {
      return;
    }

    this.setState({
      isEditing: true,
    });
  }
  handleBlur() {
    if (!this.props.canEdit) {
      return;
    }

    this.setState({
      isEditing: false,
    });

    if (this.state.lastTitle !== this.state.title) {
      this.setState({
        lastTitle: this.state.title,
      });
      this.props.onSaveTitle(this.state.title);
    }
  }
  handleChange(ev) {
    if (!this.props.canEdit) {
      return;
    }

    this.setState({
      title: ev.target.value,
    });
  }
  handleKeyPress(ev) {
    if (ev.key === 'Enter') {
      ev.preventDefault();

      this.handleBlur();
    }
  }
  render() {
    return (
      <span className="editable-title">
        <TooltipWrapper
          label="title"
          tooltip={this.props.canEdit ? 'click to edit title' : 'You don\'t have the rights to alter this title.'}
        >
          <input
            required
            type={this.state.isEditing ? 'text' : 'button'}
            value={this.state.title}
            onChange={this.handleChange}
            onBlur={this.handleBlur}
            onClick={this.handleClick}
            onKeyPress={this.handleKeyPress}
          />
        </TooltipWrapper>
      </span>
    );
  }
}
EditableTitle.propTypes = propTypes;
EditableTitle.defaultProps = defaultProps;

export default EditableTitle;
