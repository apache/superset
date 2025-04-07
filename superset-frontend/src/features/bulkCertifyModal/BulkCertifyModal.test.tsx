/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { Chart } from 'src/types/Chart';
import { Dashboard } from 'src/pages/DashboardList';
import BulkCertifyModal from './BulkCertifyModal';

const mockedChartProps = {
  onHide: jest.fn(),
  refreshData: jest.fn(),
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  show: true,
  selected: [
    {
      id: 1,
      slice_name: 'Chart 1',
      url: '/chart/1',
      viz_type: 'table',
      creator: 'user',
      changed_on: 'now',
    },
    {
      id: 2,
      slice_name: 'Chart 2',
      url: '/chart/2',
      viz_type: 'line',
      creator: 'another_user',
      changed_on: 'then',
    },
  ] as Chart[],
  resourceName: 'chart' as 'chart' | 'dashboard',
  resourceLabel: 'chart',
};

const mockedDashboardProps = {
  onHide: jest.fn(),
  refreshData: jest.fn(),
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  show: true,
  selected: [
    {
      id: 1,
      dashboard_title: 'Dashboard 1',
      url: '/dashboard/1',
      published: true,
      changed_by_name: 'user',
      changed_on_delta_humanized: 'a while ago',
      changed_by: 'user',
    },
    {
      id: 2,
      dashboard_title: 'Dashboard 2',
      url: '/dashboard/2',
      published: false,
      changed_by_name: 'admin',
      changed_on_delta_humanized: 'recently',
      changed_by: 'admin',
    },
  ] as Dashboard[],
  resourceName: 'dashboard' as 'chart' | 'dashboard',
  resourceLabel: 'dashboard',
};

describe('BulkCertifyModal', () => {
  afterEach(() => {
    fetchMock.reset();
    jest.clearAllMocks();
  });

  describe('when resourceName is chart', () => {
    test('should render', () => {
      const { container } = render(<BulkCertifyModal {...mockedChartProps} />);
      expect(container).toBeInTheDocument();
    });

    test('renders the correct title and message for charts', () => {
      render(<BulkCertifyModal {...mockedChartProps} />);
      expect(
        screen.getByText(content =>
          content.startsWith('You are certifying 2 chart'),
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/bulk certify chart\|charts/i),
      ).toBeInTheDocument();
    });
  });

  describe('when resourceName is dashboard', () => {
    test('should render', () => {
      const { container } = render(
        <BulkCertifyModal {...mockedDashboardProps} />,
      );
      expect(container).toBeInTheDocument();
    });

    test('renders the correct title and message for dashboards', () => {
      render(<BulkCertifyModal {...mockedDashboardProps} />);
      expect(
        screen.getByText(content =>
          content.startsWith('You are certifying 2 dashboard'),
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/bulk certify dashboard\|dashboards/i),
      ).toBeInTheDocument();
    });
  });

  test('calls onHide when the Cancel button is clicked', () => {
    render(<BulkCertifyModal {...mockedChartProps} />);
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(mockedChartProps.onHide).toHaveBeenCalled();
  });

  describe('rendering', () => {
    describe('when resourceName is chart', () => {
      test('should render', () => {
        const { container } = render(
          <BulkCertifyModal {...mockedChartProps} />,
        );
        expect(container).toBeInTheDocument();
      });

      test('renders the correct title and message for charts', () => {
        render(<BulkCertifyModal {...mockedChartProps} />);
        expect(
          screen.getByText(content =>
            content.startsWith('You are certifying 2 chart'),
          ),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/bulk certify chart\|charts/i),
        ).toBeInTheDocument();
      });
    });

    describe('when resourceName is dashboard', () => {
      test('should render', () => {
        const { container } = render(
          <BulkCertifyModal {...mockedDashboardProps} />,
        );
        expect(container).toBeInTheDocument();
      });

      test('renders the correct title and message for dashboards', () => {
        render(<BulkCertifyModal {...mockedDashboardProps} />);
        expect(
          screen.getByText(content =>
            content.startsWith('You are certifying 2 dashboard'),
          ),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/bulk certify dashboard\|dashboards/i),
        ).toBeInTheDocument();
      });
    });
  });
});
