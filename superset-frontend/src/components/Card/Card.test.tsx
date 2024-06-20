import { render } from 'spec/helpers/testing-library';
import Card from '.';

test('should render', () => {
  const { container } = render(<Card />);
  expect(container).toBeInTheDocument();
});
