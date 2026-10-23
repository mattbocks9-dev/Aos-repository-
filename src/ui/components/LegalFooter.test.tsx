import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LegalFooter } from './LegalFooter';

describe('legal footer', () => {
  it('states the project is unofficial and shows full notices on demand', async () => {
    render(<LegalFooter />);
    expect(screen.getByText(/Unofficial, free fan project/)).toBeInTheDocument();
    expect(
      screen.getByText(/Not affiliated with or endorsed by Games Workshop/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'About & legal' }));
    const region = screen.getByRole('region', { name: 'About and legal' });
    expect(region).toHaveTextContent('Games Workshop Limited');
    expect(region).toHaveTextContent('MIT License');
    expect(region).toHaveTextContent('BSData');
    expect(region).toHaveTextContent('Wahapedia');
  });
});
