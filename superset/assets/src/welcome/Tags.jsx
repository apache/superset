/* eslint no-unused-vars: 0 */
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import moment from 'moment';
import { Table, Tr, Td, Thead, Th, unsafe } from 'reactable';

import Loading from '../components/Loading';
import '../../stylesheets/reactable-pagination.css';

const $ = window.$ = require('jquery');

const propTypes = {
  search: PropTypes.string,
};

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
          {this.renderTable('dashboard')}
          <hr />
          {this.renderTable('chart')}
          <hr />
          {this.renderTable('query')}
        </div>
      );
    }
    return <Loading />;
  }
}

Tags.propTypes = propTypes;
