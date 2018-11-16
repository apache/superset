export default {
  default: null,
  mapStateToProps: state => ({
    choices: (state.datasource) ?
      state.datasource.time_grain_sqla.filter(o => o[0] !== null) :
      null,
  }),
};
