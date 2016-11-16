import React from 'react';
import { Table, Tr, Td } from 'reactable';
import $ from 'jquery';

const propTypes = {
  dataEndpoint: React.PropTypes.string.isRequired,
  loadingNode: React.PropTypes.node,
  mutator: React.PropTypes.func,
  columns: React.PropTypes.arrayOf(React.PropTypes.string).isRequired,
};
const defaultProps = {
  loadingNode: <img alt="loading" width="25" src="/static/assets/images/loading.gif" />,
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
    $.get(this.props.dataEndpoint, (data) => {
      let actualData = data;
      if (this.props.mutator) {
        actualData = this.props.mutator(data);
      }
      this.setState({ data: actualData, isLoading: false });
    });
  }
  render() {
    const tableProps = Object.assign({}, this.props);
    delete tableProps.loadingNode;
    delete tableProps.dataEndpoint;
    delete tableProps.columns;
    return (
      <div>
        {this.state.isLoading && this.props.loadingNode}
        {!this.state.isLoading &&
          <Table {...tableProps}>
            {this.state.data.map((row, i) => (
              <Tr key={i}>
                {this.props.columns.map(col => {
                  if (row.hasOwnProperty('_' + col)) {
                    return (
                      <Td key={col} column={col} value={row['_' + col]}>
                        {row[col]}
                      </Td>);
                  }
                  return <Td column={col}>{row[col]}</Td>;
                })}
              </Tr>
            ))}
          </Table>
        }
      </div>
    );
  }
}
TableLoader.propTypes = propTypes;
TableLoader.defaultProps = defaultProps;

export default TableLoader;
