import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

import {Util} from '@docker/actions-toolkit/lib/util.js';

const createdDirectories: Array<string> = [];

export async function fetchCommit(workdir: string, commit: string) {
  const args = ['fetch', 'origin', commit];
  const result = await exec.getExecOutput('git', args, {
    cwd: workdir,
    ignoreReturnCode: true,
    silent: true
  });
  if (result.stderr.length > 0 && result.exitCode != 0) {
    throw new Error(result.stderr);
  }
}

export async function getFileFromCommit(workdir: string, file: string, commit: string): Promise<string | null> {
  const tmpDir = await fsPromises.mkdtemp(`${os.tmpdir()}${path.sep}bake-changes-`);
  const filename = path.basename(file);
  const outPath = `${tmpDir}${path.sep}${filename}`;
  const fileStream = fs.createWriteStream(outPath);

  const args = ['show', `${commit}:${file}`];
  const result = await exec.getExecOutput('git', args, {
    cwd: workdir,
    ignoreReturnCode: true,
    silent: true,
    outStream: fileStream
  });
  core.info(`TODO: ${fileStream.closed}`);
  // file does not exist in commit
  if (result.exitCode == 128) {
    core.warning(`File '${file}' does not exist in commit: ${commit}`);
    await fsPromises.rm(tmpDir, {recursive: true});
    return null;
  }
  createdDirectories.push(tmpDir);
  if (result.stderr.length > 0 && result.exitCode != 0) {
    throw new Error(result.stderr);
  }
  return outPath;
}

export async function getChangedFiles(workdir: string, compareCommit: string): Promise<Array<string>> {
  const args = ['diff', '--name-only', compareCommit, 'HEAD'];
  const result = await exec.getExecOutput('git', args, {
    cwd: workdir,
    ignoreReturnCode: true,
    silent: true
  });
  if (result.stderr.length > 0 && result.exitCode != 0) {
    throw new Error(result.stderr);
  }
  return Util.getList(result.stdout, {
    trimWhitespace: true
  });
}

export async function removeCreatedFiles() {
  for (const dir of createdDirectories) {
    await fsPromises.rm(dir, {recursive: true});
  }
}
