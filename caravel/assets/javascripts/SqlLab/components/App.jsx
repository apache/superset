import * as Actions from '../actions';
import React from 'react';

import TabbedSqlEditors from './TabbedSqlEditors';
import QueryAutoRefresh from './QueryAutoRefresh';
import QuerySearch from './QuerySearch';
import Alerts from './Alerts';
import DataPreviewModal from './DataPreviewModal';

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
    let content;
    if (this.state.hash) {
      content = (
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-12">
              <QuerySearch />
            </div>
          </div>
        </div>
      );
    } else {
      content = (
        <div>
          <QueryAutoRefresh />
          <TabbedSqlEditors />
        </div>
      );
    }
    return (
      <div className="App SqlLab">
        <Alerts alerts={this.props.alerts} actions={this.props.actions} />
        <DataPreviewModal />
        <div className="container-fluid">
          {content}
        </div>
      </div>
    );
  }
}

App.propTypes = {
  alerts: React.PropTypes.array,
  actions: React.PropTypes.object,
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

export { App };
export default connect(mapStateToProps, mapDispatchToProps)(App);
