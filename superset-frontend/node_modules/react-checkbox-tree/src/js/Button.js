import PropTypes from 'prop-types';
import React from 'react';

class Button extends React.PureComponent {
    static propTypes = {
        children: PropTypes.node.isRequired,
        title: PropTypes.string,
    };

    static defaultProps = {
        title: null,
    };

    render() {
        const { children, title, ...props } = this.props;

        return (
            <button
                aria-label={title}
                title={title}
                type="button"
                {...props}
            >
                {children}
            </button>
        );
    }
}

export default Button;
