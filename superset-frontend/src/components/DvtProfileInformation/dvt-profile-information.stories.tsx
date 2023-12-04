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
import { SupersetTheme } from '@superset-ui/core';
import DvtProfileInformation, { DvtProfileInformationProps } from '.';

export default {
  title: 'Dvt-Components/DvtProfileInformation',
  component: DvtProfileInformation,
};

export const Default = (args: DvtProfileInformationProps) => (
  <div
    css={(theme: SupersetTheme) => ({
      backgroundColor: theme.colors.dvt.grayscale.light2,
      padding: '100px',
    })}
  >
    <DvtProfileInformation {...args} />
  </div>
);

Default.argTypes = {
  image: {
    control: { type: 'text' },
    defaultValue:
      'https://s3-alpha-sig.figma.com/img/b367/a97e/b3452351a5be6194229715c7cb6da622?Expires=1702252800&Signature=KEpNfEpqoD1WcoinBiGaLTMNU0ZYjlHnJmCgOakjRhMMWwn8iHVMw~CNAEDGCcTfl8lmn9dFKq5DFeqEPisgIGSGo02ykcyI5HZ4D35kqJK7HayItECqzKDtHyu~Fp~U0E06kwiG00xzWlvgsvN5n4Kosq~5i3IZLIQe7D7vRWU0MLKlVgTCaDeq6kvZSRFAUXPpYJ37TiM6s83rjJpFRO1A1yHO7MIn7CvZrh4WwdKbhBoqDu5WPjJ~jx45GMMQYCi6XjVdA3LZMzTIPeLIr206h7nQzQM0giDm5q6B8GvvNpxeITuQkvZARsyLVVvU4RY3n1-CemXBVPbFotFT8g__&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4',
  },
  header: {
    control: { type: 'text' },
    defaultValue: 'AppName Admin',
  },
  location: {
    control: { type: 'text' },
    defaultValue: 'Istanbul',
  },
  joinedDate: {
    control: { type: 'date' },
    defaultValue: new Date('2023-11-30T00:34:23Z'),
  },
  title: {
    control: { type: 'text' },
    defaultValue: 'Frontend developer',
  },
  test: {
    control: { type: 'text' },
    defaultValue: 'Lorem Ipsum Lorem',
  },
};
