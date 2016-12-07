import React from 'react';
import { Table, Tr, Td } from 'reactable';
import { Collapse } from 'react-bootstrap';
import $ from 'jquery';

const propTypes = {
  dataEndpoint: React.PropTypes.string.isRequired,
  mutator: React.PropTypes.func,
  columns: React.PropTypes.arrayOf(React.PropTypes.string),
};

export default class TableLoader extends React.PureComponent {
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
    let columns = this.props.columns;
    if (!columns && this.state.data.length > 0) {
      columns = Object.keys(this.state.data[0]).filter(col => col[0] !== '_');
    }
    delete tableProps.dataEndpoint;
    delete tableProps.mutator;
    delete tableProps.columns;
    if (this.state.isLoading) {
      return <img alt="loading" width="25" src="/static/assets/images/loading.gif" />;
    }
    return (
      <Collapse in transitionAppear >
        <div>
          <Table {...tableProps}>
            {this.state.data.map((row, i) => (
              <Tr key={i}>
                {columns.map(col => {
                  if (row.hasOwnProperty('_' + col)) {
                    return (
                      <Td key={col} column={col} value={row['_' + col]}>
                        {row[col]}
                      </Td>);
                  }
                  return <Td key={col} column={col}>{row[col]}</Td>;
                })}
              </Tr>
            ))}
          </Table>
        </div>
      </Collapse>
    );
  }
}
TableLoader.propTypes = propTypes;
