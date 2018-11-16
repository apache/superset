import React from 'react';
import PropTypes from 'prop-types';
import { Table, Tr, Td } from 'reactable';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import withToasts from '../messageToasts/enhancers/withToasts';
import Loading from '../components/Loading';
import '../../stylesheets/reactable-pagination.css';

const propTypes = {
  dataEndpoint: PropTypes.string.isRequired,
  mutator: PropTypes.func,
  columns: PropTypes.arrayOf(PropTypes.string),
  addDangerToast: PropTypes.func.isRequired,
};

class TableLoader extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      data: [],
    };
  }

  componentWillMount() {
    const { dataEndpoint, mutator } = this.props;

    SupersetClient.get({ endpoint: dataEndpoint })
      .then(({ json }) => {
        const data = mutator ? mutator(json) : json;
        this.setState({ data, isLoading: false });
      })
      .catch(() => {
        this.setState({ isLoading: false });
        this.props.addDangerToast(t('An error occurred'));
      });
  }

  render() {
    if (this.state.isLoading) {
      return <Loading />;
    }

    const {
      addDangerToast,
      addInfoToast,
      addSuccessToast,
      addWarningToast,
      ...tableProps
    } = this.props;

    let { columns } = this.props;
    if (!columns && this.state.data.length > 0) {
      columns = Object.keys(this.state.data[0]).filter(col => col[0] !== '_');
    }
    delete tableProps.dataEndpoint;
    delete tableProps.mutator;
    delete tableProps.columns;

    return (
      <Table
        {...tableProps}
        className="table"
        itemsPerPage={50}
        style={{ textTransform: 'capitalize' }}
      >
        {this.state.data.map((row, i) => (
          <Tr key={i}>
            {columns.map((col) => {
              if (row.hasOwnProperty('_' + col)) {
                return (
                  <Td key={col} column={col} value={row['_' + col]}>
                    {row[col]}
                  </Td>
                );
              }
              return (
                <Td key={col} column={col}>
                  {row[col]}
                </Td>
              );
            })}
          </Tr>
        ))}
      </Table>
    );
  }
}

TableLoader.propTypes = propTypes;

export default withToasts(TableLoader);
