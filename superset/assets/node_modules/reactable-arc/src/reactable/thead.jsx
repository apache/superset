import React from 'react';
import { Th } from './th';
import { Filterer } from './filterer';
import { filterPropsFrom } from './lib/filter_props_from';

export class Thead extends React.Component {
    static getColumns(component) {
        // Can't use React.Children.map since that doesn't return a proper array
        let columns = [];
        React.Children.forEach(component.props.children, th => {
            var column = {};
            if (!th) return;
            if (typeof th.props !== 'undefined') {
                column.props = filterPropsFrom(th.props);

                // use the content as the label & key
                if (typeof th.props.children !== 'undefined') {
                    column.label = th.props.children;
                    column.key = column.label;
                }

                // the key in the column attribute supersedes the one defined previously
                if (typeof th.props.column === 'string') {
                    column.key = th.props.column;

                    // in case we don't have a label yet
                    if (typeof column.label === 'undefined') {
                        column.label = column.key;
                    }
                }
            }

            if (typeof column.key === 'undefined') {
                throw new TypeError(
                    '<th> must have either a "column" property or a string ' +
                    'child');
            } else {
                columns.push(column);
            }
        });

        return columns;
    }

    handleClickTh(column) {
        this.props.onSort(column.key);
    }

    handleKeyDownTh(column, event) {
      if (event.keyCode === 13) {
        this.props.onSort(column.key);
      }
    }

    render() {
        // Declare the list of Ths
        var Ths = [];
        for (var index = 0; index < this.props.columns.length; index++) {
            var column = this.props.columns[index];
            var thClass = `reactable-th-${column.key.replace(/\s+/g, '-').toLowerCase()}`;
            var sortClass = '';
            var thRole = null;

            if (this.props.sortableColumns[column.key]) {
                sortClass += 'reactable-header-sortable ';
                thRole = 'button';
            }

            if (this.props.sort.column === column.key) {
                sortClass += 'reactable-header-sort';
                if (this.props.sort.direction === 1) {
                    sortClass += '-asc';
                }
                else {
                    sortClass += '-desc';
                }
            }

            if (sortClass.length > 0) {
              thClass += ` ${sortClass}`;
            }

            if (
                typeof(column.props) === 'object' &&
                typeof(column.props.className) === 'string'
            ) {
                thClass += ` ${column.props.className}`;
            }

            Ths.push(
                <Th {...column.props}
                    className={thClass}
                    key={index}
                    onClick={this.handleClickTh.bind(this, column)}
                    onKeyDown={this.handleKeyDownTh.bind(this, column)}
                    role={thRole}
                    tabIndex="0">
                    {column.label}
                </Th>
            );
        }

        // Manually transfer props
        var props = filterPropsFrom(this.props);

        return (
            <thead {...props}>
                {this.props.filtering === true ?
                    <Filterer
                        colSpan={this.props.columns.length}
                        onFilter={this.props.onFilter}
                        placeholder={this.props.filterPlaceholder}
                        value={this.props.currentFilter}
                        className={this.props.filterClassName}
                    /> : null}
                <tr className="reactable-column-header">{Ths}</tr>
            </thead>
        );
    }
};
