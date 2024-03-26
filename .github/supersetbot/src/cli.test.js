import { spawnSync } from 'child_process';

describe('CLI Test', () => {
  test.each([
    ['./src/supersetbot', ['docker', '--preset', 'dev', '--dry-run'], '--target dev'],
    ['./src/supersetbot', ['docker', '--dry-run'], '--target lean'],
  ])('returns %s for release %s', (command, arg, contains) => {
    const result = spawnSync(command, arg);
    const output = result.stdout.toString();
    expect(result.stdout.toString()).toContain(contains);
  });
});
