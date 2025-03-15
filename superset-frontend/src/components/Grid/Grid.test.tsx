import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Col, Row } from './index';

describe('Grid Component', () => {
  it('should render the grid with rows and columns', async () => {
    render(
      <Row>
        <Col span={8}>Column 1</Col>
        <Col span={8}>Column 2</Col>
        <Col span={8}>Column 3</Col>
      </Row>,
    );
    expect(screen.getByText('Column 1')).toBeInTheDocument();
    expect(screen.getByText('Column 2')).toBeInTheDocument();
    expect(screen.getByText('Column 3')).toBeInTheDocument();
  });
});
