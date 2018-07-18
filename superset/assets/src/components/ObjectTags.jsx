import React from 'react';
import PropTypes from 'prop-types';
import ReactTags from 'react-tag-autocomplete';
import { Label } from 'react-bootstrap';

import './ObjectTags.css';

import { t } from '../locales';

const CSRF_TOKEN = (document.getElementById('csrf_token') || {}).value;

const propTypes = {
  object_type: PropTypes.string.isRequired,
  object_id: PropTypes.number.isRequired,
  editable: PropTypes.bool,
  includeTypes: PropTypes.bool,
};

const defaultProps = {
  editable: true,
  includeTypes: false,
};

export default class ObjectTags extends React.Component {

  constructor(props) {
    super(props);

    this.url = `/tagview/tags/${this.props.object_type}/${this.props.object_id}/`;
    this.state = {
      tags: [],
      suggestions: [],
    };
  }

  componentDidMount() {
    fetch(this.url)
      .then(response => response.json())
      .then(json => this.setState({
        tags: json.filter(tag => tag.name.indexOf(':') === -1 || this.props.includeTypes),
      }));

    fetch('/tagview/tags/suggestions/')
      .then(response => response.json())
      .then(json => this.setState({
        suggestions: json.filter(tag => tag.name.indexOf(':') === -1 || this.props.includeTypes),
      }));
  }

  handleDelete(i) {
    const tags = this.state.tags.slice(0);
    const tag = tags.splice(i, 1)[0].name;
    fetch(
      this.url, {
        body: JSON.stringify([tag]),
        headers: {
          'content-type': 'application/json',
          'X-CSRFToken': CSRF_TOKEN,
        },
        credentials: 'same-origin',
        method: 'DELETE',
      })
      .then((response) => {
        if (response.ok) {
          this.setState({ tags });
        }
      });
  }

  handleAddition(tag) {
    if (tag.name.indexOf(':') !== -1 && !this.props.includeTypes) {
      return;
    }

    const tags = [].concat(this.state.tags, tag);
    fetch(
      this.url, {
        body: JSON.stringify([tag.name]),
        headers: {
          'content-type': 'application/json',
          'X-CSRFToken': CSRF_TOKEN,
        },
        credentials: 'same-origin',
        method: 'POST',
      })
      .then((response) => {
        if (response.ok) {
          this.setState({ tags });
        }
      });
  }

  renderEditableTags() {
    return (
      <ReactTags
        tags={this.state.tags}
        suggestions={this.state.suggestions}
        handleDelete={this.handleDelete.bind(this)}
        handleAddition={this.handleAddition.bind(this)}
        allowNew
        placeHolder={t('Add new tag')}
      />
    );
  }

  renderReadOnlyTags() {
    return (
      <div className="react-tags-rw">
        {this.state.tags.map(tag => <Label bsStyle="primary">{tag.name}</Label>)}
      </div>
    );
  }

  render() {
    if (this.props.editable) {
      return this.renderEditableTags();
    }
    return this.renderReadOnlyTags();
  }
}

ObjectTags.propTypes = propTypes;
ObjectTags.defaultProps = defaultProps;
