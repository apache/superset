import React from 'react';
import PropTypes from 'prop-types';
import ReactTags from 'react-tag-autocomplete';
import { Glyphicon, Label } from 'react-bootstrap';

import './ObjectTags.css';

import { t } from '../locales';

const propTypes = {
  fetchTags: PropTypes.func.isRequired,
  fetchSuggestions: PropTypes.func,
  deleteTag: PropTypes.func,
  addTag: PropTypes.func,
  editable: PropTypes.bool,
};

const defaultProps = {
  fetchSuggestions: () => {},
  deleteTag: () => {},
  addTag: () => {},
  editable: true,
};

export default class ObjectTags extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      tags: [],
      suggestions: [],
    };
  }

  componentDidMount() {
    this.props.fetchTags(tags => this.setState({ tags }));
    this.props.fetchSuggestions(suggestions => this.setState({ suggestions }));
  }

  handleDelete(i) {
    const tags = this.state.tags.slice(0);
    const tag = tags.splice(i, 1)[0].name;
    this.props.deleteTag(tag, () => this.setState({ tags }));
  }

  handleAddition(tag) {
    const tags = [].concat(this.state.tags, tag);
    this.props.addTag(tag.name, () => this.setState({ tags }));
  }

  renderEditableTags() {
    const Tag = props => (
      <Label bsStyle="primary">
        <a
          href={`/superset/welcome?q=${props.tag.name}#tags`}
          className="deco-none"
        >
          {props.tag.name}
        </a>
        <Glyphicon title="Remove tag" onClick={props.onDelete} glyph="remove" />
      </Label>
    );
    return (
      <ReactTags
        tags={this.state.tags}
        suggestions={this.state.suggestions}
        handleDelete={this.handleDelete.bind(this)}
        handleAddition={this.handleAddition.bind(this)}
        allowNew
        placeHolder={t('Add new tag')}
        tagComponent={Tag}
      />
    );
  }

  renderReadOnlyTags() {
    return (
      <div className="react-tags-rw">
        {this.state.tags.map(tag => (
          <Label bsStyle="primary">
            <a
              href={`/superset/welcome?q=${tag.name}#tags`}
              className="deco-none"
            >
              {tag.name}
            </a>
          </Label>
        ))}
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
