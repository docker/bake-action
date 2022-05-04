import fs from 'fs';
import path from 'path';
import * as semver from 'semver';
import * as exec from '@actions/exec';

import * as context from './context';

export async function getMetadataFile(): Promise<string> {
  return path.join(context.tmpDir(), 'metadata-file').split(path.sep).join(path.posix.sep);
}

export async function getMetadata(): Promise<string | undefined> {
  const metadataFile = await getMetadataFile();
  if (!fs.existsSync(metadataFile)) {
    return undefined;
  }
  const content = fs.readFileSync(metadataFile, {encoding: 'utf-8'}).trim();
  if (content === 'null') {
    return undefined;
  }
  return content;
}

export async function isAvailable(standalone?: boolean): Promise<boolean> {
  const cmd = getCommand([], standalone);
  return await exec
    .getExecOutput(cmd.command, cmd.args, {
      ignoreReturnCode: true,
      silent: true
    })
    .then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        return false;
      }
      return res.exitCode == 0;
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .catch(error => {
      return false;
    });
}

export async function getVersion(standalone?: boolean): Promise<string> {
  const cmd = getCommand(['version'], standalone);
  return await exec
    .getExecOutput(cmd.command, cmd.args, {
      ignoreReturnCode: true,
      silent: true
    })
    .then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      return parseVersion(res.stdout.trim());
    });
}

export function parseVersion(stdout: string): string {
  const matches = /\sv?([0-9a-f]{7}|[0-9.]+)/.exec(stdout);
  if (!matches) {
    throw new Error(`Cannot parse buildx version`);
  }
  return matches[1];
}

export function satisfies(version: string, range: string): boolean {
  return semver.satisfies(version, range) || /^[0-9a-f]{7}$/.exec(version) !== null;
}

export function getCommand(args: Array<string>, standalone?: boolean) {
  return {
    command: standalone ? 'buildx' : 'docker',
    args: standalone ? args : ['buildx', ...args]
  };
}
