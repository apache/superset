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

import { screen, fireEvent, render } from 'spec/helpers/testing-library';
import ErrorAlert from './ErrorAlert';

describe('ErrorAlert', () => {
  it('renders the error message correctly', () => {
    render(
      <ErrorAlert
        errorType="Error"
        message="Something went wrong"
        type="error"
      />,
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    const description = 'This is a detailed description';
    render(
      <ErrorAlert
        errorType="Error"
        message="Something went wrong"
        type="error"
        description={description}
      />,
    );

    expect(screen.getByText(description)).toBeInTheDocument();
  });

  it('toggles description details visibility when show more/less is clicked', () => {
    const descriptionDetails = 'Additional details about the error.';
    render(
      <ErrorAlert
        errorType="Error"
        message="Something went wrong"
        type="error"
        descriptionDetails={descriptionDetails}
        descriptionDetailsCollapsed
      />,
    );

    const showMoreButton = screen.getByText('See more');
    expect(showMoreButton).toBeInTheDocument();

    fireEvent.click(showMoreButton);
    expect(screen.getByText(descriptionDetails)).toBeInTheDocument();

    const showLessButton = screen.getByText('See less');
    fireEvent.click(showLessButton);
    expect(screen.queryByText(descriptionDetails)).not.toBeInTheDocument();
  });

  it('renders compact mode with a tooltip and modal', () => {
    render(
      <ErrorAlert
        errorType="Error"
        message="Compact mode example"
        type="error"
        compact
        descriptionDetails="Detailed description in compact mode."
      />,
    );

    const iconTrigger = screen.getByText('Error');
    expect(iconTrigger).toBeInTheDocument();

    fireEvent.click(iconTrigger);
    expect(screen.getByText('Compact mode example')).toBeInTheDocument();
  });
});
