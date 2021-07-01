import * as semver from 'semver';
import * as exec from '@actions/exec';

export async function isAvailable(): Promise<Boolean> {
  return await exec
    .getExecOutput('docker', ['buildx'], {
      ignoreReturnCode: true,
      silent: true
    })
    .then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        return false;
      }
      return res.exitCode == 0;
    });
}

export async function getVersion(): Promise<string> {
  return await exec
    .getExecOutput('docker', ['buildx', 'version'], {
      ignoreReturnCode: true,
      silent: true
    })
    .then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr);
      }
      return parseVersion(res.stdout);
    });
}

export function parseVersion(stdout: string): string {
  const matches = /\sv?([0-9a-f]{7}|[0-9.]+)/.exec(stdout);
  if (!matches) {
    throw new Error(`Cannot parse buildx version`);
  }
  return matches[1];
}
