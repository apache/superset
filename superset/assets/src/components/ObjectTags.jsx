import React from 'react';
import PropTypes from 'prop-types';
import ReactTags from 'react-tag-autocomplete';
import { Glyphicon, Label } from 'react-bootstrap';
import TooltipWrapper from './TooltipWrapper';

import './ObjectTags.css';

import { t } from '../locales';

const propTypes = {
  fetchTags: PropTypes.func,
  fetchSuggestions: PropTypes.func,
  deleteTag: PropTypes.func,
  addTag: PropTypes.func,
  editable: PropTypes.bool,
  onChange: PropTypes.func,
};

const defaultProps = {
  fetchTags: (callback) => { callback([]); },
  fetchSuggestions: (callback) => { callback([]); },
  deleteTag: (tag, callback) => { callback(); },
  addTag: (tag, callback) => { callback(); },
  editable: true,
  onChange: () => {},
};

export default class ObjectTags extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      tags: [],
      suggestions: [],
    };

    this.handleDelete = this.handleDelete.bind(this);
    this.handleAddition = this.handleAddition.bind(this);
  }

  componentDidMount() {
    this.props.fetchTags(tags => this.setState({ tags }));
    this.props.fetchSuggestions(suggestions => this.setState({ suggestions }));
  }

  handleDelete(i) {
    const tags = this.state.tags.slice(0);
    const tag = tags.splice(i, 1)[0].name;
    this.props.deleteTag(tag, () => this.setState({ tags }));
    this.props.onChange(tags);
  }

  handleAddition(tag) {
    const tags = [...this.state.tags, tag];
    this.props.addTag(tag.name, () => this.setState({ tags }));
    this.props.onChange(tags);
  }

  renderEditableTags() {
    const Tag = props => (
      <Label bsStyle="info">
        <a
          href={`/superset/welcome?tags=${props.tag.name}#tags`}
          className="deco-none"
        >
          {props.tag.name}
        </a>
        <TooltipWrapper
          label="remove"
          tooltip={t('Click to remove tag')}
        >
          <Glyphicon onClick={props.onDelete} glyph="remove" />
        </TooltipWrapper>
      </Label>
    );
    const {
      fetchTags,
      fetchSuggestions,
      deleteTag,
      addTag,
      editable,
      onChange,
      ...rest
    } = this.props;
    return (
      <ReactTags
        {...rest}
        tags={this.state.tags}
        suggestions={this.state.suggestions}
        handleDelete={this.handleDelete}
        handleAddition={this.handleAddition}
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
          <Label bsStyle="info">
            <a
              href={`/superset/welcome?tags=${tag.name}#tags`}
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
