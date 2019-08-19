/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { t } from '@superset-ui/translation';
import TooltipWrapper from './TooltipWrapper';

const propTypes = {
  title: PropTypes.string,
  canEdit: PropTypes.bool,
  multiLine: PropTypes.bool,
  onSaveTitle: PropTypes.func,
  noPermitTooltip: PropTypes.string,
  showTooltip: PropTypes.bool,
  emptyText: PropTypes.node,
  style: PropTypes.object,
  extraClasses: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.string), PropTypes.string]),
};
const defaultProps = {
  title: t('Title'),
  canEdit: false,
  multiLine: false,
  showTooltip: true,
  onSaveTitle: () => {},
  emptyText: '<empty>',
  style: null,
  extraClasses: null,
};

export default class EditableTitle extends React.PureComponent {
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

    // Used so we can access the DOM element if a user clicks on this component.
    this.contentRef = React.createRef();
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.title !== this.state.title) {
      this.setState({
        lastTitle: this.state.title,
        title: nextProps.title,
      });
    }
  }

  handleClick() {
    if (!this.props.canEdit || this.state.isEditing) {
      return;
    }

    // For multi-line values, save the actual rendered size of the displayed text.
    // Later, if a textarea is constructed for editing the value, we'll need this.
    const contentBoundingRect = (this.contentRef.current) ?
      this.contentRef.current.getBoundingClientRect() : null;

    this.setState({ isEditing: true, contentBoundingRect });
  }

  handleBlur() {
    const title = this.state.title.trim();

    if (!this.props.canEdit) {
      return;
    }

    this.setState({
      isEditing: false,
    });

    if (!title.length) {
      this.setState({
        title: this.state.lastTitle,
      });

      return;
    }

    if (this.state.lastTitle !== title) {
      this.setState({
        lastTitle: title,
      });
    }

    if (this.props.title !== title) {
      this.props.onSaveTitle(title);
    }
  }

  // this entire method exists to support using EditableTitle as the title of a
  // react-bootstrap Tab, as a workaround for this line in react-bootstrap https://goo.gl/ZVLmv4
  //
  // tl;dr when a Tab EditableTitle is being edited, typically the Tab it's within has been
  // clicked and is focused/active. for accessibility, when focused the Tab <a /> intercepts
  // the ' ' key (among others, including all arrows) and onChange() doesn't fire. somehow
  // keydown is still called so we can detect this and manually add a ' ' to the current title
  handleKeyDown(event) {
    if (event.key === ' ') {
      event.stopPropagation();
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
    const { isEditing, title, contentBoundingRect } = this.state;
    const { emptyText, multiLine, showTooltip, canEdit,
      noPermitTooltip, style, extraClasses } = this.props;

    let value;
    if (title) {
      value = title;
    } else if (!isEditing) {
      value = emptyText;
    }

    // Construct an inline style based on previously-saved height of the rendered label. Only
    // used in multi-line contexts.
    const editStyle = (isEditing && contentBoundingRect) ? { height: `${contentBoundingRect.height}px` } : null;

    // Create a textarea when we're editing a multi-line value, otherwise create an input (which may
    // be text or a button).
    let input = multiLine && isEditing ? (
      <textarea
        ref={this.contentRef}
        required
        value={value}
        className={!title ? 'text-muted' : null}
        onKeyDown={this.handleKeyDown}
        onChange={this.handleChange}
        onBlur={this.handleBlur}
        onClick={this.handleClick}
        onKeyPress={this.handleKeyPress}
        style={editStyle}
      />
    ) : (
      <input
        ref={this.contentRef}
        required
        type={isEditing ? 'text' : 'button'}
        value={value}
        className={!title ? 'text-muted' : null}
        onKeyDown={this.handleKeyDown}
        onChange={this.handleChange}
        onBlur={this.handleBlur}
        onClick={this.handleClick}
        onKeyPress={this.handleKeyPress}
      />
    );
    if (showTooltip && !isEditing) {
      input = (
        <TooltipWrapper
          label="title"
          tooltip={canEdit ? t('click to edit') :
            noPermitTooltip || t('You don\'t have the rights to alter this title.')}
        >
          {input}
        </TooltipWrapper>
      );
    }
    return (
      <span
        className={cx(
          'editable-title',
          extraClasses,
          canEdit && 'editable-title--editable',
          isEditing && 'editable-title--editing',
        )}
        style={style}
      >
        {input}
      </span>
    );
  }
}
EditableTitle.propTypes = propTypes;
EditableTitle.defaultProps = defaultProps;
