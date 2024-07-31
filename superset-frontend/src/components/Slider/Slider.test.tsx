import { render, screen } from 'spec/helpers/testing-library';
import Slider from '.';

const mockedProps = {
  defaultValue: 90,
  tooltip: {
    open: true,
  },
};

test('should render', () => {
  const { container } = render(<Slider {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render with default value on tooltip', () => {
  render(<Slider {...mockedProps} />);
  expect(
    screen.getAllByText(`${mockedProps.defaultValue}`)[0],
  ).toBeInTheDocument();
});
