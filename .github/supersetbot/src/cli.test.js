import { spawnSync } from 'child_process';

describe('CLI Test', () => {
  it('should contain "--target dev" in the output when calling "supersetbot docker --preset dev --dry-run"', () => {
    // Run the CLI command
    const result = spawnSync('./src/supersetbot', ['docker', '--preset', 'dev', '--dry-run']);

    if (result.error) {
      // Handle the error, for example, by failing the test
      throw new Error(result.error.message);
    }

    // Convert the stdout buffer to a string
    const output = result.stdout.toString();

    // Check if the output contains "--target dev"
    expect(output).toContain('--target dev');
  });
});
