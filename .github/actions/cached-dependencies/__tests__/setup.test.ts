/**
 * Test default runner.
 */
import { setInputs } from '../src/utils/inputs';
import { InputName, DefaultInputs } from '../src/constants';
import * as setup from '../src/setup';
import path from 'path';

const extraBashlib = path.resolve(__dirname, './fixtures/bashlib.sh');

describe('setup runner', () => {
  // don't actually run the bash script
  const runCommandMock = jest.spyOn(setup, 'runCommand');

  it('should allow custom bashlib', async () => {
    setInputs({
      [InputName.Bashlib]: extraBashlib,
    });
    await setup.run();
    expect(runCommandMock).toHaveBeenCalledTimes(1);
    expect(runCommandMock).toHaveBeenCalledWith(
      DefaultInputs[InputName.Run],
      extraBashlib,
    );
  });

  it('should allow inline bash overrides', async () => {
    const processExitMock = jest
      .spyOn(process, 'exit')
      // @ts-ignore
      .mockImplementation(() => {});

    setInputs({
      [InputName.Bashlib]: '',
      [InputName.Parallel]: 'false',
      [InputName.Run]: `
        ${DefaultInputs[InputName.Run]}() {
          echo "It works!"
          exit 202
        }
        ${DefaultInputs[InputName.Run]}
      `,
    });
    // allow the bash script to run for one test, but override the default
    await setup.run();
    expect(runCommandMock).toHaveBeenCalledTimes(1);
    expect(processExitMock).toHaveBeenCalledTimes(1);
    expect(processExitMock).toHaveBeenCalledWith(1);
  });

  it('should use run commands', async () => {
    // don't run the commands when there is no overrides
    runCommandMock.mockImplementation(async () => {});

    setInputs({
      [InputName.Bashlib]: 'non-existent',
      [InputName.Run]: 'print-cachescript-path',
    });

    await setup.run();

    expect(runCommandMock).toHaveBeenCalledTimes(1);
    expect(runCommandMock).toHaveBeenCalledWith('print-cachescript-path', '');
  });

  it('should handle single-new-line parallel commands', async () => {
    setInputs({
      [InputName.Run]: `
        test-command-1
        test-command-2
      `,
      [InputName.Parallel]: 'true',
    });

    await setup.run();

    expect(runCommandMock).toHaveBeenNthCalledWith(1, 'test-command-1', '');
    expect(runCommandMock).toHaveBeenNthCalledWith(2, 'test-command-2', '');
  });

  it('should handle multi-new-line parallel commands', async () => {
    setInputs({
      [InputName.Run]: `
        test-1-1
        test-1-2

        test-2
      `,
      [InputName.Parallel]: 'true',
    });

    await setup.run();

    expect(runCommandMock).toHaveBeenNthCalledWith(
      1,
      'test-1-1\n        test-1-2',
      '',
    );
    expect(runCommandMock).toHaveBeenNthCalledWith(2, 'test-2', '');
  });
});
