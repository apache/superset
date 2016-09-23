import * as Actions from '../actions';
import React from 'react';

import TabbedSqlEditors from './TabbedSqlEditors';
import QueryAutoRefresh from './QueryAutoRefresh';
import QuerySearch from './QuerySearch';
import Alerts from './Alerts';

import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hash: window.location.hash,
    };
  }
  componentDidMount() {
    window.addEventListener('hashchange', this.onHashChanged.bind(this));
  }
  componentWillUnmount() {
    window.removeEventListener('hashchange', this.onHashChanged.bind(this));
  }
  onHashChanged() {
    this.setState({ hash: window.location.hash });
  }
  render() {
    if (this.state.hash) {
      return (
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-12">
              <QuerySearch />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="App SqlLab">
        <div className="container-fluid">
          <QueryAutoRefresh />
          <Alerts alerts={this.props.alerts} />
          <div className="row">
            <div className="col-md-12">
              <TabbedSqlEditors />
            </div>
          </div>
        </div>
      </div>
    );
  }
}

App.propTypes = {
  alerts: React.PropTypes.array,
};

function mapStateToProps(state) {
  return {
    alerts: state.alerts,
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(App);
