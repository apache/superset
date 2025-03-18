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
import { MainNav as Menu } from 'src/components/Menu'; // Ensure correct import path
import LanguagePicker from './LanguagePicker'; // Ensure correct import path

export default {
  title: 'Components/LanguagePicker',
  component: LanguagePicker,
  parameters: {
    docs: {
      description: {
        component:
          'The LanguagePicker component allows users to select a language from a dropdown.',
      },
    },
  },
};

const mockedProps = {
  locale: 'en',
  languages: {
    en: {
      flag: 'us',
      name: 'English',
      url: '/lang/en',
    },
    it: {
      flag: 'it',
      name: 'Italian',
      url: '/lang/it',
    },
  },
};

const Template = (args: any) => (
  <Menu disabledOverflow>
    <LanguagePicker {...args} />
  </Menu>
);

export const Default = Template.bind({});
Default.args = mockedProps;
