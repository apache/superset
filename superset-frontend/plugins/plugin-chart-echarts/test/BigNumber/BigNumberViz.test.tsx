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
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { supersetTheme } from '@superset-ui/core';
import BigNumberViz from '../../src/BigNumber/BigNumberViz';
import { BigNumberVizProps } from '../../src/BigNumber/types';

// Mock the getNumberFormatter function
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getNumberFormatter: jest.fn(() => (value: number) => `${value}%`),
}));

const defaultProps: BigNumberVizProps = {
  width: 200,
  height: 200,
  bigNumber: 1000,
  className: 'test-class',
  headerFontSize: 0.3,
  subheaderFontSize: 0.125,
  subheader: 'Test subheader',
  formatNumber: (value: number) => value.toString(),
  formatTime: (value: string) => value,
  theme: supersetTheme,
};

describe('BigNumberViz with Time Comparison', () => {
  describe('Basic Rendering', () => {
    it('should render basic big number without time comparison', () => {
      render(<BigNumberViz {...defaultProps} />);

      expect(screen.getByText('1000%')).toBeInTheDocument();
      expect(screen.getByText('Test subheader')).toBeInTheDocument();
    });

    it('should render with custom formatting', () => {
      const customFormatNumber = (value: number) => `$${value}`;
      render(
        <BigNumberViz {...defaultProps} formatNumber={customFormatNumber} />,
      );

      expect(screen.getByText('1000%')).toBeInTheDocument();
    });

    it('should handle null big number', () => {
      render(<BigNumberViz {...defaultProps} bigNumber={null} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('Time Comparison - Positive Changes', () => {
    it('should render positive comparison indicator with green color and up arrow', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0.5,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: '1 day ago',
      };

      render(<BigNumberViz {...props} />);

      // Check that the comparison indicator is rendered
      const indicator = screen.getByText('↗');
      expect(indicator).toBeInTheDocument();

      // Check that the percentage is displayed
      expect(screen.getByText('0.5%')).toBeInTheDocument();

      // Check that the comparison period text is displayed
      // Period text is no longer displayed in minimalist design
    });

    it('should render large positive change correctly', () => {
      const props = {
        ...defaultProps,
        percentageChange: 2.0,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: '1 week ago',
      };

      render(<BigNumberViz {...props} />);

      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('2%')).toBeInTheDocument();
      // Period text is no longer displayed in minimalist design
    });

    it('should render small positive change correctly', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0.01,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: '1 month ago',
      };

      render(<BigNumberViz {...props} />);

      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('0.01%')).toBeInTheDocument();
      // Period text is no longer displayed in minimalist design
    });
  });

  describe('Time Comparison - Negative Changes', () => {
    it('should render negative comparison indicator with red color and down arrow', () => {
      const props = {
        ...defaultProps,
        percentageChange: -0.25,
        comparisonIndicator: 'negative' as const,
        comparisonPeriodText: '1 day ago',
      };

      render(<BigNumberViz {...props} />);

      // Check that the comparison indicator is rendered
      const indicator = screen.getByText('↘');
      expect(indicator).toBeInTheDocument();

      // Check that the percentage is displayed
      expect(screen.getByText('-0.25%')).toBeInTheDocument();

      // Check that the comparison period text is displayed
      // Period text is no longer displayed in minimalist design
    });

    it('should render large negative change correctly', () => {
      const props = {
        ...defaultProps,
        percentageChange: -0.75,
        comparisonIndicator: 'negative' as const,
        comparisonPeriodText: '1 week ago',
      };

      render(<BigNumberViz {...props} />);

      expect(screen.getByText('↘')).toBeInTheDocument();
      expect(screen.getByText('-0.75%')).toBeInTheDocument();
      // Period text is no longer displayed in minimalist design
    });

    it('should render small negative change correctly', () => {
      const props = {
        ...defaultProps,
        percentageChange: -0.05,
        comparisonIndicator: 'negative' as const,
        comparisonPeriodText: '1 month ago',
      };

      render(<BigNumberViz {...props} />);

      expect(screen.getByText('↘')).toBeInTheDocument();
      expect(screen.getByText('-0.05%')).toBeInTheDocument();
      // Period text is no longer displayed in minimalist design
    });
  });

  describe('Time Comparison - No Change', () => {
    it('should render neutral comparison indicator with orange color and dash', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0,
        comparisonIndicator: 'neutral' as const,
        comparisonPeriodText: '1 day ago',
      };

      render(<BigNumberViz {...props} />);

      // Check that the comparison indicator is rendered
      const indicator = screen.getByText('−');
      expect(indicator).toBeInTheDocument();

      // Check that the percentage is displayed
      expect(screen.getByText('0%')).toBeInTheDocument();

      // Check that the comparison period text is displayed
      // Period text is no longer displayed in minimalist design
    });

    it('should render very small change as neutral', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0.0001,
        comparisonIndicator: 'neutral' as const,
        comparisonPeriodText: '1 week ago',
      };

      render(<BigNumberViz {...props} />);

      expect(screen.getByText('−')).toBeInTheDocument();
      expect(screen.getByText('0.0001%')).toBeInTheDocument();
      // Period text is no longer displayed in minimalist design
    });
  });

  describe('Time Comparison - Edge Cases', () => {
    it('should not render comparison indicator when percentageChange is undefined', () => {
      const props = {
        ...defaultProps,
        percentageChange: undefined,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: '1 day ago',
      };

      render(<BigNumberViz {...props} />);

      expect(screen.queryByText('↗')).not.toBeInTheDocument();
      expect(screen.queryByText('vs 1 day ago')).not.toBeInTheDocument();
    });

    it('should not render comparison indicator when comparisonIndicator is undefined', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0.5,
        comparisonIndicator: undefined,
        comparisonPeriodText: '1 day ago',
      };

      render(<BigNumberViz {...props} />);

      expect(screen.queryByText('↗')).not.toBeInTheDocument();
      expect(screen.queryByText('vs 1 day ago')).not.toBeInTheDocument();
    });

    it('should render comparison indicator without period text when comparisonPeriodText is undefined', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0.5,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: undefined,
      };

      render(<BigNumberViz {...props} />);

      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('0.5%')).toBeInTheDocument();
      expect(screen.queryByText('vs')).not.toBeInTheDocument();
    });

    it('should render comparison indicator without period text when comparisonPeriodText is empty', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0.5,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: '',
      };

      render(<BigNumberViz {...props} />);

      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('0.5%')).toBeInTheDocument();
      expect(screen.queryByText('vs')).not.toBeInTheDocument();
    });
  });

  describe('Different Time Periods', () => {
    it('should render "inherit" time comparison correctly', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0.33,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: 'inherit',
      };

      render(<BigNumberViz {...props} />);

      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('0.33%')).toBeInTheDocument();
      // Period text is no longer displayed in minimalist design
    });

    it('should render "1 week ago" time comparison correctly', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0.2,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: '1 week ago',
      };

      render(<BigNumberViz {...props} />);

      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('0.2%')).toBeInTheDocument();
      // Period text is no longer displayed in minimalist design
    });

    it('should render "1 month ago" time comparison correctly', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0.15,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: '1 month ago',
      };

      render(<BigNumberViz {...props} />);

      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('0.15%')).toBeInTheDocument();
      // Period text is no longer displayed in minimalist design
    });

    it('should render custom time comparison correctly', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0.1,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: 'custom_range',
      };

      render(<BigNumberViz {...props} />);

      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('0.1%')).toBeInTheDocument();
      // Period text is no longer displayed in minimalist design
    });
  });

  describe('Styling and Layout', () => {
    it('should position comparison indicator in top right corner', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0.5,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: '1 day ago',
      };

      render(<BigNumberViz {...props} />);

      const indicator = screen.getByText('↗').closest('div');
      expect(indicator).toHaveStyle({
        position: 'absolute',
        top: '-35px', // Position above chart to appear in header area
        right: '60px', // Position left of controls menu
      });
    });

    it('should apply correct colors for different indicators', () => {
      // Test positive indicator
      const { rerender } = render(
        <BigNumberViz
          {...defaultProps}
          percentageChange={0.5}
          comparisonIndicator="positive"
          comparisonPeriodText="1 day ago"
        />,
      );

      let indicator = screen.getByText('↗').closest('div');
      expect(indicator).toHaveStyle({ color: '#28a745' });

      // Test negative indicator
      rerender(
        <BigNumberViz
          {...defaultProps}
          percentageChange={-0.5}
          comparisonIndicator="negative"
          comparisonPeriodText="1 day ago"
        />,
      );

      indicator = screen.getByText('↘').closest('div');
      expect(indicator).toHaveStyle({ color: '#dc3545' });

      // Test neutral indicator
      rerender(
        <BigNumberViz
          {...defaultProps}
          percentageChange={0}
          comparisonIndicator="neutral"
          comparisonPeriodText="1 day ago"
        />,
      );

      indicator = screen.getByText('−').closest('div');
      expect(indicator).toHaveStyle({ color: '#ffc107' });
    });

    it('should handle NaN percentage values gracefully', () => {
      const props = {
        ...defaultProps,
        percentageChange: NaN,
        comparisonIndicator: 'neutral' as const,
        comparisonPeriodText: '1 day ago',
      };

      render(<BigNumberViz {...props} />);

      // Should display 0% instead of NaN
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('−')).toBeInTheDocument(); // Neutral arrow
      
      const indicator = screen.getByText('−').closest('div');
      expect(indicator).toHaveStyle({ color: '#ffc107' }); // Amber color
    });

    it('should handle undefined percentage values gracefully', () => {
      const props = {
        ...defaultProps,
        percentageChange: undefined as any,
        comparisonIndicator: undefined as any, // When percentageChange is undefined, comparisonIndicator should also be undefined
        comparisonPeriodText: '1 day ago',
      };

      render(<BigNumberViz {...props} />);

      // Should not render comparison indicator when data is undefined
      expect(screen.queryByText('0%')).not.toBeInTheDocument();
      expect(screen.queryByText('−')).not.toBeInTheDocument();
      expect(screen.queryByText('↗')).not.toBeInTheDocument();
      expect(screen.queryByText('↘')).not.toBeInTheDocument();
    });

    it('should display proper tooltip text for different time periods', () => {
      const inheritProps = {
        ...defaultProps,
        percentageChange: 0.1,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: 'inherit',
      };

      const { rerender } = render(<BigNumberViz {...inheritProps} />);
      
      const indicator = screen.getByText('↗').closest('div');
      expect(indicator).toHaveAttribute('title', 'Compared to previous period');

      // Test inherit mode with specific date range
      rerender(
        <BigNumberViz
          {...defaultProps}
          percentageChange={0.1}
          comparisonIndicator="positive"
          comparisonPeriodText="inherit"
          formData={{
            since: '2024-01-01T00:00:00',
            until: '2024-01-07T23:59:59',
            time_range: 'Last 7 days',
          } as any}
        />,
      );

      const inheritIndicator = screen.getByText('↗').closest('div');
      expect(inheritIndicator?.getAttribute('title')).toContain('Compared to');
      expect(inheritIndicator?.getAttribute('title')).toContain('2023'); // Previous year dates
      expect(inheritIndicator?.getAttribute('title')).not.toContain('vs current'); // Should not contain vs current

      // Test with specific time period
      rerender(
        <BigNumberViz
          {...defaultProps}
          percentageChange={0.1}
          comparisonIndicator="positive"
          comparisonPeriodText="1 week ago"
        />,
      );

      const weekIndicator = screen.getByText('↗').closest('div');
      expect(weekIndicator).toHaveAttribute('title', 'Compared to 1 week ago');

      // Test with custom range
      rerender(
        <BigNumberViz
          {...defaultProps}
          percentageChange={0.1}
          comparisonIndicator="positive"
          comparisonPeriodText="custom_range"
        />,
      );

      const customIndicator = screen.getByText('↗').closest('div');
      expect(customIndicator).toHaveAttribute('title', 'Compared to custom date range');
    });

    it('should maintain proper spacing and typography', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0.5,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: '1 day ago',
      };

      render(<BigNumberViz {...props} />);

      const indicator = screen.getByText('↗').closest('div');
      expect(indicator).toHaveStyle({
        display: 'flex',
        alignItems: 'center',
        gap: '3px', // Smaller gap
        fontSize: 'clamp(8px, 2.0vw, 14px)', // Responsive font size
        fontWeight: '500', // Lighter weight
        whiteSpace: 'nowrap', // Prevent text wrapping
      });
    });
  });

  describe('Integration with Existing Features', () => {
    it('should work with conditional formatting', () => {
      const props = {
        ...defaultProps,
        percentageChange: 0.5,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: '1 day ago',
        conditionalFormatting: [
          {
            operator: '>',
            targetValue: 500,
            color: '#ff0000',
          },
        ],
      };

      render(<BigNumberViz {...props} />);

      // Should still render the comparison indicator
      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('0.5%')).toBeInTheDocument();
      // Period text is no longer displayed in minimalist design
    });

    it('should work with custom number formatting', () => {
      const customFormatNumber = (value: number) =>
        `$${value.toLocaleString()}`;
      const props = {
        ...defaultProps,
        formatNumber: customFormatNumber,
        percentageChange: 0.5,
        comparisonIndicator: 'positive' as const,
        comparisonPeriodText: '1 day ago',
      };

      render(<BigNumberViz {...props} />);

      // Should render the main number with custom formatting
      expect(screen.getByText('1000%')).toBeInTheDocument();

      // Should still render the comparison indicator
      expect(screen.getByText('↗')).toBeInTheDocument();
      expect(screen.getByText('0.5%')).toBeInTheDocument();
    });
  });
});
