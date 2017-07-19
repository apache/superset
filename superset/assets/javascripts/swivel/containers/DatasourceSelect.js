import { connect } from 'react-redux';
import { setDatasource } from '../actions/querySettingsActions';
import LabeledSelect from '../components/LabeledSelect';

const mapStateToProps = state => ({
  title: 'Datasource',
  options: state.refData.datasources.map(({ name, uid }) => ({ value: uid, label: name })),
  value: state.settings.present.query.datasource,
});

const mapDispatchToProps = dispatch => ({
  onChange: (datasource) => {
    dispatch(setDatasource(datasource.value));
  },
});

const DatasourceSelect = connect(
    mapStateToProps,
    mapDispatchToProps,
)(LabeledSelect);

export default DatasourceSelect;
