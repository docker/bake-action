import * as semver from 'semver';
import * as buildx from '../src/buildx';
import * as exec from '@actions/exec';

describe('isAvailable', () => {
  const execSpy: jest.SpyInstance = jest.spyOn(exec, 'getExecOutput');
  execSpy.mockImplementation(() =>
    Promise.resolve({
      exitCode: expect.any(Number),
      stdout: expect.any(Function),
      stderr: expect.any(Function)
    })
  );

  buildx.isAvailable();

  expect(execSpy).toHaveBeenCalledWith(`docker`, ['buildx'], {
    silent: true,
    ignoreReturnCode: true
  });
});

describe('getVersion', () => {
  it('valid', async () => {
    const version = await buildx.getVersion();
    console.log(`version: ${version}`);
    expect(semver.valid(version)).not.toBeNull();
  }, 100000);
});

describe('parseVersion', () => {
  test.each([
    ['github.com/docker/buildx 0.4.1+azure bda4882a65349ca359216b135896bddc1d92461c', '0.4.1'],
    ['github.com/docker/buildx v0.4.1 bda4882a65349ca359216b135896bddc1d92461c', '0.4.1'],
    ['github.com/docker/buildx v0.4.2 fb7b670b764764dc4716df3eba07ffdae4cc47b2', '0.4.2']
  ])('given %p', async (stdout, expected) => {
    expect(await buildx.parseVersion(stdout)).toEqual(expected);
  });
});
