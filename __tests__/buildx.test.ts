import {describe, expect, it, jest, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import * as exec from '@actions/exec';
import * as buildx from '../src/buildx';
import * as context from '../src/context';

const tmpNameSync = path.join('/tmp/.docker-bake-jest', '.tmpname-jest').split(path.sep).join(path.posix.sep);
const metadata = `{
  "containerimage.config.digest": "sha256:059b68a595b22564a1cbc167af369349fdc2ecc1f7bc092c2235cbf601a795fd",
  "containerimage.digest": "sha256:b09b9482c72371486bb2c1d2c2a2633ed1d0b8389e12c8d52b9e052725c0c83c"
}`;

jest.spyOn(context, 'tmpDir').mockImplementation((): string => {
  const tmpDir = path.join('/tmp/.docker-bake-jest').split(path.sep).join(path.posix.sep);
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, {recursive: true});
  }
  return tmpDir;
});

jest.spyOn(context, 'tmpNameSync').mockImplementation((): string => {
  return tmpNameSync;
});

describe('getMetadata', () => {
  it('matches', async () => {
    const metadataFile = await buildx.getMetadataFile();
    await fs.writeFileSync(metadataFile, metadata);
    const expected = await buildx.getMetadata();
    expect(expected).toEqual(metadata);
  });
});

describe('isAvailable', () => {
  const execSpy = jest.spyOn(exec, 'getExecOutput');
  buildx.isAvailable();

  // eslint-disable-next-line jest/no-standalone-expect
  expect(execSpy).toHaveBeenCalledWith(`docker`, ['buildx'], {
    silent: true,
    ignoreReturnCode: true
  });
});

describe('getVersion', () => {
  it('valid', async () => {
    const version = await buildx.getVersion();
    expect(semver.valid(version)).not.toBeNull();
  }, 100000);
});

describe('parseVersion', () => {
  test.each([
    ['github.com/docker/buildx 0.4.1+azure bda4882a65349ca359216b135896bddc1d92461c', '0.4.1'],
    ['github.com/docker/buildx v0.4.1 bda4882a65349ca359216b135896bddc1d92461c', '0.4.1'],
    ['github.com/docker/buildx v0.4.2 fb7b670b764764dc4716df3eba07ffdae4cc47b2', '0.4.2'],
    ['github.com/docker/buildx f117971 f11797113e5a9b86bd976329c5dbb8a8bfdfadfa', 'f117971']
  ])('given %p', async (stdout, expected) => {
    expect(buildx.parseVersion(stdout)).toEqual(expected);
  });
});
