import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';
import getClientErrorObject from '../utils/getClientErrorObject';

const propTypes = {
  dataEndpoint: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  mutator: PropTypes.func.isRequired,
  onAsyncError: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.number),
  ]),
  placeholder: PropTypes.string,
  autoSelect: PropTypes.bool,
};

const defaultProps = {
  placeholder: t('Select ...'),
  onAsyncError: () => {},
};

class AsyncSelect extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      options: [],
    };

    this.onChange = this.onChange.bind(this);
  }

  componentDidMount() {
    this.fetchOptions();
  }

  onChange(option) {
    this.props.onChange(option);
  }

  fetchOptions() {
    this.setState({ isLoading: true });
    const { mutator, dataEndpoint } = this.props;

    return SupersetClient.get({ endpoint: dataEndpoint })
      .then(({ json }) => {
        const options = mutator ? mutator(json) : json;

        this.setState({ options, isLoading: false });

        if (!this.props.value && this.props.autoSelect && options.length > 0) {
          this.onChange(options[0]);
        }
      })
      .catch(response => getClientErrorObject(response).then((error) => {
        this.props.onAsyncError(error.error || error.statusText || error);
        this.setState({ isLoading: false });
      }),
    );
  }

  render() {
    return (
      <div>
        <Select
          placeholder={this.props.placeholder}
          options={this.state.options}
          value={this.props.value}
          isLoading={this.state.isLoading}
          onChange={this.onChange}
          valueRenderer={this.props.valueRenderer}
          {...this.props}
        />
      </div>
    );
  }
}

AsyncSelect.propTypes = propTypes;
AsyncSelect.defaultProps = defaultProps;

export default AsyncSelect;
