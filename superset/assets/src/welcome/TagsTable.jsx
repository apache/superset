import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { Table, unsafe } from 'reactable';
import 'whatwg-fetch';
import { t } from '@superset-ui/translation';

import { fetchObjects } from '../tags';
import Loading from '../components/Loading';
import '../../stylesheets/reactable-pagination.css';

const propTypes = {
  search: PropTypes.string,
};

const defaultProps = {
  search: '',
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
    fetchObjects({ tags: search, types: null }, (data) => {
      const objects = { dashboard: [], chart: [], query: [] };
      data.forEach((object) => {
        objects[object.type].push(object);
      });
      this.setState({ objects });
    });
  }
  renderTable(type) {
    const data = this.state.objects[type].map(o => ({
      [type]: <a href={o.url}>{o.name}</a>,
      creator: unsafe(o.creator),
      modified: unsafe(moment.utc(o.changed_on).fromNow()),
    }));
    return (
      <Table
        className="table"
        data={data}
        sortable={[type, 'creator', 'modified']}
        itemsPerPage={50}
        hideFilterInput
        columns={[
          { key: type, label: type.charAt(0).toUpperCase() + type.slice(1) },
          { key: 'creator', label: 'Creator' },
          { key: 'modified', label: 'Modified' },
        ]}
        defaultSort={{ column: 'modified', direction: 'desc' }}
      />
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
TagsTable.defaultProps = defaultProps;
