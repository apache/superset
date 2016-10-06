import React from 'react';
import Select from 'react-select';
import { bindActionCreators } from 'redux';
import * as actions from '../actions/exploreActions';
import { connect } from 'react-redux';
import { domainOptions, subdomainOptions } from '../constants';

const propTypes = {
  actions: React.PropTypes.object,
};

const defaultProps = {
  domain: null,
  subdomain: null,
};

class DomainOptions extends React.Component {
  render() {
    domainArray = [];
    domainArray.push({
      title: 'Domain'
      key: 'domain',
      options: domainOptions,
      value: {this.props.domain},
    });
    domainArray.push({
      title: 'Sub Domain'
      key: 'subdomain',
      options: subdomainOptions,
      value: {this.props.subdomain},
    });
    return (
      <SelectArray
        selectArray={domainArray}
      />
    );
  }
}

DomainOptions.propTypes = propTypes;
DomainOptions.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    domain: state.domain,
    subdomain: state.subdomain,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(DomainOptions);
