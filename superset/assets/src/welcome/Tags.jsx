/* eslint no-unused-vars: 0 */
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import moment from 'moment';
import { Table, Tr, Td, Thead, Th, unsafe } from 'reactable';

import Loading from '../components/Loading';
import '../../stylesheets/reactable-pagination.css';
import { t } from '../locales';

const $ = window.$ = require('jquery');

const propTypes = {
  search: PropTypes.string,
};

export function fetchTags(objectType, objectId, includeTypes, callback) {
  const url = `/tagview/tags/${objectType}/${objectId}/`;
  fetch(url)
    .then(response => response.json())
    .then(json => callback(
      json.filter(tag => tag.name.indexOf(':') === -1 || includeTypes)));
}

export function fetchSuggestions(includeTypes, callback) {
  fetch('/tagview/tags/suggestions/')
    .then(response => response.json())
    .then(json => callback(
      json.filter(tag => tag.name.indexOf(':') === -1 || includeTypes)));
}

export function deleteTag(CSRF_TOKEN, objectType, objectId, tag, callback, error) {
  const url = `/tagview/tags/${objectType}/${objectId}/`;
  fetch(url, {
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
      callback(response);
    } else {
      error(response);
    }
  });
}

export function addTag(CSRF_TOKEN, objectType, objectId, includeTypes, tag, callback, error) {
  if (tag.indexOf(':') !== -1 && !includeTypes) {
    return;
  }
  const url = `/tagview/tags/${objectType}/${objectId}/`;
  fetch(url, {
    body: JSON.stringify([tag]),
    headers: {
      'content-type': 'application/json',
      'X-CSRFToken': CSRF_TOKEN,
    },
    credentials: 'same-origin',
    method: 'POST',
  })
  .then((response) => {
    if (response.ok) {
      callback(response);
    } else {
      error(response);
    }
  });
}

export default class Tags extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      objects: false,
    };
    this.fetchResults = this.fetchResults.bind(this);
  }
  componentDidMount() {
    this.fetchResults(this.props.search);
  }
  componentWillReceiveProps(newProps) {
    if (this.props.search !== newProps.search) {
      this.fetchResults(newProps.search);
    }
  }
  fetchResults(search) {
    const url = `/tagview/tagged_objects/?tags=${search}`;
    $.getJSON(url, (data) => {
      const objects = { dashboard: [], chart: [], query: [] };
      data.forEach((object) => {
        objects[object.type].push(object);
      });
      this.setState({ objects });
    });
  }
  renderTable(type) {
      return (
        <Table
          className="table"
          sortable={[type, 'creator', 'modified']}
          itemsPerPage={50}
          hideFilterInput
          columns={[
            { key: type, label: type.charAt(0).toUpperCase() + type.slice(1) },
            { key: 'creator', label: 'Creator' },
            { key: 'modified', label: 'Modified' },
          ]}
          defaultSort={{ column: 'modified', direction: 'desc' }}
        >
          {this.state.objects[type].map(o => (
            <Tr key={o.id}>
              <Td column={type} value={o.name}>
                <a href={o.url}>{o.name}</a>
              </Td>
              <Td column="creator" value={o.created_by}>
                {unsafe(o.creator)}
              </Td>
              <Td column="modified" value={o.changed_on} className="text-muted">
                {unsafe(moment.utc(o.changed_on).fromNow())}
              </Td>
            </Tr>))}
        </Table>
    );
  }
  render() {
    if (this.state.objects) {
      return (
        <div>
          <h3>{t('Dashboards')}</h3>
          {this.renderTable('dashboard')}
          <hr />
          <h3>{t('Charts')}</h3>
          {this.renderTable('chart')}
          <hr />
          <h3>{t('Queries')}</h3>
          {this.renderTable('query')}
        </div>
      );
    }
    return <Loading />;
  }
}

Tags.propTypes = propTypes;
