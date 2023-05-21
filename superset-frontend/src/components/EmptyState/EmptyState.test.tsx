import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyStateSmall, EmptyStateMedium, EmptyStateBig } from '.';
import React from 'react';

describe('<EmptyStateSmall />', () => {
  it('renders without crashing', () => {
    const props = { title: "No data", description: "Please try again later", image: "empty.svg" };
    render(<EmptyStateSmall {...props} />);
    expect(screen.getByText(props.title)).toBeInTheDocument();
    expect(screen.getByText(props.description)).toBeInTheDocument();
  });
});

describe('<EmptyStateMedium />', () => {
  it('renders without crashing', () => {
    const props = { title: "No data", description: "Please try again later", image: "empty.svg", buttonText: "Retry", buttonAction: jest.fn() };
    render(<EmptyStateMedium {...props} />);
    expect(screen.getByText(props.title)).toBeInTheDocument();
    expect(screen.getByText(props.description)).toBeInTheDocument();
    fireEvent.click(screen.getByText(props.buttonText));
    expect(props.buttonAction).toHaveBeenCalledTimes(1);
  });
});

describe('<EmptyStateBig />', () => {
  it('renders without crashing', () => {
    const props = { title: "No data", description: "Please try again later", image: "empty.svg", buttonText: "Retry", buttonAction: jest.fn() };
    render(<EmptyStateBig {...props} />);
    expect(screen.getByText(props.title)).toBeInTheDocument();
    expect(screen.getByText(props.description)).toBeInTheDocument();
    fireEvent.click(screen.getByText(props.buttonText));
    expect(props.buttonAction).toHaveBeenCalledTimes(1);
  });
});
