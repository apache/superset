// this test must be commented out because ChartContainer is now importing files
// from visualizations/*.js which are also importing css files which breaks in the testing env.

// import React from 'react';
// import { expect } from 'chai';
// import { describe, it } from 'mocha';
// import { shallow } from 'enzyme';

// import ExploreViewContainer
//   from '../../../../javascripts/explore/components/ExploreViewContainer';
// import QueryAndSaveBtns
//   from '../../../../javascripts/explore/components/QueryAndSaveBtns';
// import ControlPanelsContainer
//   from '../../../../javascripts/explore/components/ControlPanelsContainer';
// import ChartContainer
//   from '../../../../javascripts/explore/components/ChartContainer';

// describe('ExploreViewContainer', () => {
//   it('renders', () => {
//     expect(
//       React.isValidElement(<ExploreViewContainer />)
//     ).to.equal(true);
//   });

//   it('renders QueryAndSaveButtons', () => {
//     const wrapper = shallow(<ExploreViewContainer />);
//     expect(wrapper.find(QueryAndSaveBtns)).to.have.length(1);
//   });

//   it('renders ControlPanelsContainer', () => {
//     const wrapper = shallow(<ExploreViewContainer />);
//     expect(wrapper.find(ControlPanelsContainer)).to.have.length(1);
//   });

//   it('renders ChartContainer', () => {
//     const wrapper = shallow(<ExploreViewContainer />);
//     expect(wrapper.find(ChartContainer)).to.have.length(1);
//   });
// });
