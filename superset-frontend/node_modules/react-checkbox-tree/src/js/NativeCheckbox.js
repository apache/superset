import PropTypes from 'prop-types';
import React from 'react';

class NativeCheckbox extends React.PureComponent {
    static propTypes = {
        indeterminate: PropTypes.bool,
    };

    static defaultProps = {
        indeterminate: false,
    };

    componentDidMount() {
        this.updateDeterminateProperty();
    }

    componentDidUpdate() {
        this.updateDeterminateProperty();
    }

    updateDeterminateProperty() {
        const { indeterminate } = this.props;

        this.checkbox.indeterminate = indeterminate;
    }

    render() {
        const props = { ...this.props };

        // Remove property that does not exist in HTML
        delete props.indeterminate;

        return <input {...props} ref={(c) => { this.checkbox = c; }} type="checkbox" />;
    }
}

export default NativeCheckbox;
