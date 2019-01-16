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
  onSaveTitle: PropTypes.func,
  noPermitTooltip: PropTypes.string,
  showTooltip: PropTypes.bool,
  emptyText: PropTypes.node,
  style: PropTypes.object,
};
const defaultProps = {
  title: t('Title'),
  canEdit: false,
  showTooltip: true,
  onSaveTitle: () => {},
  emptyText: '<empty>',
  style: null,
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
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
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
    this.setState({ isEditing: true });
  }

  handleBlur() {
    if (!this.props.canEdit) {
      return;
    }

    this.setState({
      isEditing: false,
    });

    if (!this.state.title.length) {
      this.setState({
        title: this.state.lastTitle,
      });

      return;
    }

    if (this.state.lastTitle !== this.state.title) {
      this.setState({
        lastTitle: this.state.title,
      });
    }

    if (this.props.title !== this.state.title) {
      this.props.onSaveTitle(this.state.title);
    }
  }

  handleKeyUp(ev) {
    // this entire method exists to support using EditableTitle as the title of a
    // react-bootstrap Tab, as a workaround for this line in react-bootstrap https://goo.gl/ZVLmv4
    //
    // tl;dr when a Tab EditableTitle is being edited, typically the Tab it's within has been
    // clicked and is focused/active. for accessibility, when focused the Tab <a /> intercepts
    // the ' ' key (among others, including all arrows) and onChange() doesn't fire. somehow
    // keydown is still called so we can detect this and manually add a ' ' to the current title
    if (ev.key === ' ') {
      let title = ev.target.value;
      const titleLength = (title || '').length;
      if (title && title[titleLength - 1] !== ' ') {
        title = `${title} `;
        this.setState(() => ({ title }));
      }
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
    let value;
    if (this.state.title) {
      value = this.state.title;
    } else if (!this.state.isEditing) {
      value = this.props.emptyText;
    }
    let input = (
      <input
        required
        type={this.state.isEditing ? 'text' : 'button'}
        value={value}
        className={!this.state.title ? 'text-muted' : null}
        onKeyUp={this.handleKeyUp}
        onChange={this.handleChange}
        onBlur={this.handleBlur}
        onClick={this.handleClick}
        onKeyPress={this.handleKeyPress}
      />
    );
    if (this.props.showTooltip && !this.state.isEditing) {
      input = (
        <TooltipWrapper
          label="title"
          tooltip={this.props.canEdit ? t('click to edit') :
              this.props.noPermitTooltip || t('You don\'t have the rights to alter this title.')}
        >
          {input}
        </TooltipWrapper>
      );
    }
    return (
      <span
        className={cx(
          'editable-title',
          this.props.canEdit && 'editable-title--editable',
          this.state.isEditing && 'editable-title--editing',
        )}
        style={this.props.style}
      >
        {input}
      </span>
    );
  }
}
EditableTitle.propTypes = propTypes;
EditableTitle.defaultProps = defaultProps;
