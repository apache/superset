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
import { render } from 'spec/helpers/testing-library';
import { Alert } from '@apache-superset/core/components';
import { limitAlertIcon } from './limitAlertIcon';

type AlertType = Parameters<typeof limitAlertIcon>[0];

const TYPES: AlertType[] = ['success', 'info', 'warning', 'error'];

function alertIcon(type: AlertType, description: boolean, hidden: boolean) {
  const { container, unmount } = render(
    <Alert
      type={type}
      closable={false}
      description={description ? 'Details' : undefined}
      icon={hidden ? limitAlertIcon(type) : undefined}
    >
      Message
    </Alert>,
  );
  const wrapper = container.querySelector('.ant-alert-icon') as HTMLElement;
  const icon = wrapper.querySelector('.anticon') as HTMLElement;
  const result = {
    wrapperClassName: wrapper.getAttribute('class'),
    className: icon.getAttribute('class'),
    ariaHidden: icon.getAttribute('aria-hidden'),
    inlineStyle: icon.getAttribute('style'),
    color: window.getComputedStyle(icon).color,
  };
  unmount();
  return result;
}

test.each(TYPES)('the %s icon looks like antd default and is hidden', type => {
  [false, true].forEach(description => {
    const shown = alertIcon(type, description, false);
    const hidden = alertIcon(type, description, true);

    expect(shown.ariaHidden).toBeNull();
    expect(hidden.ariaHidden).toBe('true');
    expect(hidden.wrapperClassName).toBe(shown.wrapperClassName);
    expect(hidden.className).toBe(shown.className);
    expect(hidden.inlineStyle).toBeNull();
    expect(hidden.inlineStyle).toBe(shown.inlineStyle);
    expect(hidden.color).toBe(shown.color);
  });
});
