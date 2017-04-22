import React from 'react';
import visTypes from '../exploreV2/stores/visTypes';
import $ from 'jquery';

export default class AddSliceContainer extends React.Component {
  saveSlice() {
    const baseUrl = `/superset/explore/table/1/`;
    const formData = {
      viz_type: 'markup',
    };
    const params = {
      slice_name: 'my great slice',
    };
    const exploreUrl = `${baseUrl}?form_data=` +
      `${encodeURIComponent(JSON.stringify(formData))}` +
      `&${$.param(params, true)}`;
    console.log('exploreUrl', exploreUrl)
    window.location.href = exploreUrl;
  }
  render() {
    console.log('this.props', this.props)
    return (
      <div>
        <button onClick={this.saveSlice.bind(this)}>New Slice</button>
      </div>
    );
  }
}
