import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { Table, Tr, Td, unsafe } from 'reactable';
import 'whatwg-fetch';

import { fetchObjects } from '../tags';
import Loading from '../components/Loading';
import '../../stylesheets/reactable-pagination.css';
import { t } from '../locales';

const propTypes = {
  search: PropTypes.string,
};

export default class TagsTable extends React.PureComponent {
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
    fetchObjects(search, null, (data) => {
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

TagsTable.propTypes = propTypes;
