import React from 'react';
import PropTypes from 'prop-types';
import $ from 'jquery';
import { List } from 'immutable';
import { Table } from 'reactable';
import { withTableAutoSizer } from '@data-ui/data-table';
import { color, font } from '@data-ui/theme';
import { getExploreUrlAndPayload, getURIDirectory } from '../exploreUtils';

const browserUsage = [
  {
    date: '2015 Jun 15',
    'Google Chrome': '48.09',
    'Internet Explorer': '24.14',
    Firefox: '18.82',
    Safari: '7.46',
    'Microsoft Edge': '0.03',
    Opera: '1.32',
    Mozilla: '0.12',
    'Other/Unknown': '0.01',
  },
  {
    date: '2015 Jun 16',
    'Google Chrome': '48',
    'Internet Explorer': '24.19',
    Firefox: '18.96',
    Safari: '7.36',
    'Microsoft Edge': '0.03',
    Opera: '1.32',
    Mozilla: '0.12',
    'Other/Unknown': '0.01',
  },
];

const tableStyles = {
  table: {
    ...font.regular,
  },

  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    ...font.regular,
    ...font.bold,
  },

  row: ({ index }) => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    ...font.regular,
    ...font.light,
    background: index % 2 === 0 ? color.lightGray : null,
  }),
};

// const AutoSizedTable = withTableAutoSizer(Table);
const allColumns = Object.keys(browserUsage[0]);
const dataList = List(browserUsage);

const propTypes = {
  form_data: PropTypes.object.isRequired,
  data: PropTypes.object,
  columns: PropTypes.array,
};

export default class PreviewChartPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: dataList,
      columns: allColumns,
    };
  }

  componentWillMount() {
    // TODO: Build custom formData to be read into table
    const { payload } = getExploreUrlAndPayload({ formData: this.props.form_data });
    payload.viz_type = 'table';
    const dir = getURIDirectory(this.props.form_data, 'json');
    const params = encodeURIComponent(JSON.stringify(payload));
    const fetchURL = window.location.origin + dir + '?form_data=' + params;
    console.log('fetchURL', fetchURL);
    $.get(fetchURL, (res) => {
      this.setState({
        data: res.data.records,
        columns: Object.keys(res.data.records[0]),
      });
    });
  }

  render() {
    return (
      <Table
        columns={this.state.columns}
        className="table table-condensed"
        data={this.state.data}
        itemsPerPage={50}
      />
    );
  }
}

PreviewChartPanel.propTypes = propTypes;
