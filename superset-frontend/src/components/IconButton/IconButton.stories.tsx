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
import IconButton, { IconButtonProps } from '.';

export default {
  title: 'IconButton',
  component: IconButton,
};

export const InteractiveIconButton = (args: IconButtonProps) => (
  <IconButton
    buttonText={args.buttonText}
    altText={args.altText}
    icon={args.icon}
    href={args.href}
    target={args.target}
    htmlType={args.htmlType}
  />
);

InteractiveIconButton.args = {
  buttonText: 'This is the IconButton text',
  altText: 'This is an example of non-default alt text',
  href: 'https://preset.io/',
  target: '_blank',
};

InteractiveIconButton.argTypes = {
  icon: {
    defaultValue: '/images/icons/sql.svg',
    control: {
      type: 'select',
    },
    options: [
      '/images/icons/sql.svg',
      '/images/icons/server.svg',
      '/images/icons/image.svg',
      'Click to see example alt text',
    ],
  },
};
