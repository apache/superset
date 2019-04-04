import React from 'react';
import ReactDOM from 'react-dom';

export class FiltererInput extends React.Component {
    onChange() {
        this.props.onFilter(ReactDOM.findDOMNode(this).value);
    }

    render() {
        return (
            <input type="text"
                className={this.props.className}
                placeholder={this.props.placeholder}
                value={this.props.value}
                onKeyUp={this.onChange.bind(this)}
                onChange={this.onChange.bind(this)} />
        );
    }
};

export class Filterer extends React.Component {
    render() {
        if (typeof this.props.colSpan === 'undefined') {
            throw new TypeError('Must pass a colSpan argument to Filterer');
        }

        return (
            <tr className="reactable-filterer">
                <td colSpan={this.props.colSpan}>
                    <FiltererInput onFilter={this.props.onFilter}
                        value={this.props.value}
                        placeholder={this.props.placeholder}
                        className={this.props.className ? 'reactable-filter-input ' + this.props.className : 'reactable-filter-input'} />
                </td>
            </tr>
        );
    }
};

