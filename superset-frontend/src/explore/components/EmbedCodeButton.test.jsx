/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import { shallow } from 'enzyme';
import { styledMount as mount } from 'spec/helpers/theming';
import Popover from 'src/components/Popover';
import EmbedCodeButton from 'src/explore/components/EmbedCodeButton';
import { DashboardStandaloneMode } from 'src/dashboard/util/constants';

describe('EmbedCodeButton', () => {
  it('renders', () => {
    expect(React.isValidElement(<EmbedCodeButton />)).toBe(true);
  });

  it('renders overlay trigger', () => {
    const wrapper = shallow(<EmbedCodeButton />);
    expect(wrapper.find(Popover)).toExist();
  });

  it('returns correct embed code', () => {
    const wrapper = mount(
      <EmbedCodeButton formData={{}} addDangerToast={() => {}} />,
    );
    const url = 'http://localhost/explore/p/100';
    wrapper.find(EmbedCodeButton).setState({
      height: '1000',
      width: '2000',
      url,
    });
    const embedHTML =
      `${
        '<iframe\n' +
        '  width="2000"\n' +
        '  height="1000"\n' +
        '  seamless\n' +
        '  frameBorder="0"\n' +
        '  scrolling="no"\n' +
        `  src="${url}?standalone=`
      }${DashboardStandaloneMode.HIDE_NAV}&height=1000"\n` +
      `>\n` +
      `</iframe>`;
    expect(wrapper.find(EmbedCodeButton).instance().generateEmbedHTML()).toBe(
      embedHTML,
    );
  });
});
