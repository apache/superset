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
import { render, screen } from 'spec/helpers/testing-library';
import RecipientIcon from './RecipientIcon';
import { NotificationMethodOption } from '../types';

describe('RecipientIcon', () => {
  it('should render the email icon when type is Email', () => {
    render(<RecipientIcon type={NotificationMethodOption.Email} />);
    const regexPattern = new RegExp(NotificationMethodOption.Email, 'i');
    const emailIcon = screen.getByLabelText(regexPattern);
    expect(emailIcon).toBeInTheDocument();
  });

  it('should render the Slack icon when type is Slack', () => {
    render(<RecipientIcon type={NotificationMethodOption.Slack} />);
    const regexPattern = new RegExp(NotificationMethodOption.Slack, 'i');
    const slackIcon = screen.getByLabelText(regexPattern);
    expect(slackIcon).toBeInTheDocument();
  });

  it('should render the Slack icon when type is SlackV2', () => {
    render(<RecipientIcon type={NotificationMethodOption.SlackV2} />);
    const regexPattern = new RegExp(NotificationMethodOption.Slack, 'i');
    const slackIcon = screen.getByLabelText(regexPattern);
    expect(slackIcon).toBeInTheDocument();
  });

  it('should not render any icon when type is not recognized', () => {
    render(<RecipientIcon type="unknown" />);
    const icons = screen.queryByLabelText(/.*/);
    expect(icons).not.toBeInTheDocument();
  });
});
