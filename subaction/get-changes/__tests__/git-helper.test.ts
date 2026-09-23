import {afterAll, beforeAll, describe, expect, test} from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as exec from '@actions/exec';

import {getChangedFiles, getFileFromCommit, removeCreatedFiles} from '../src/git-helper';

const tmpDir = fs.mkdtempSync(path.join(process.env.TEMP || os.tmpdir(), 'get-changes-'));
const gitDir = path.join(tmpDir, 'git-helper');

const initialReadmeContents = '# Testing get-changes\n';
const initialReadmeContentsModified = '# Last test for get-changes\n';
const aDirReadmeContents = '## Description for a\n';
const bDirReadmeContents = '## Different description for b\n';

beforeAll(async () => {
  // Setup git repository
  fs.mkdirSync(gitDir);
  await exec.getExecOutput('git', ['init'], {
    cwd: gitDir,
    silent: true
  });
  await exec.getExecOutput('git', ['config', 'user.name', 'get-changes'], {
    cwd: gitDir,
    silent: true
  });
  await exec.getExecOutput('git', ['config', 'user.email', 'get-changes@example.com'], {
    cwd: gitDir,
    silent: true
  });
  // Make a few commits
  let writeFiles: Record<string, string> = {};
  writeFiles[path.join(gitDir, 'README.md')] = initialReadmeContents;
  writeFiles[path.join(gitDir, 'a', 'README.md')] = aDirReadmeContents;
  await changeAndCommitFiles('Initial commit', writeFiles, []);
  writeFiles = {};
  writeFiles[path.join(gitDir, 'b', 'README.md')] = bDirReadmeContents;
  await changeAndCommitFiles('Remove a/README.md & Add b/README.md', writeFiles, [path.join(gitDir, 'a', 'README.md')]);
  writeFiles = {};
  writeFiles[path.join(gitDir, 'README.md')] = initialReadmeContentsModified;
  writeFiles[path.join(gitDir, 'b', 'some-file')] = 'some text';
  await changeAndCommitFiles('Modify README.md & Add b/some-file', writeFiles, []);
});

afterAll(() => {
  fs.rmSync(gitDir, {recursive: true, force: true});
});

describe('getFileFromCommit', () => {
  afterAll(async () => {
    await removeCreatedFiles();
  });

  test.for([
    {returnText: 'null', commit: 'HEAD~2', file: 'b/README.md', expected: null},
    {returnText: 'path to file', commit: 'HEAD~1', file: 'b/README.md', expected: bDirReadmeContents},
    {returnText: 'path to file', commit: 'HEAD~2', file: 'README.md', expected: initialReadmeContents}
  ])('returns $returnText for $file from commit $commit', async ({commit, file, expected}: {commit: string; file: string; expected: string | null}) => {
    // Arrange
    let fileContents: string | null = null;
    // Act
    const filePath = await getFileFromCommit(gitDir, file, commit);
    if (filePath !== null) {
      fileContents = fs.readFileSync(filePath, {encoding: 'utf-8'});
    }
    // Assert
    if (expected == null) {
      expect(filePath).toBeNull();
      return;
    }
    expect(filePath).toBeTypeOf('string');
    expect(fileContents).toStrictEqual(expected);
  });
});

describe('getChangedFiles', () => {
  test.for([
    {commit: 'HEAD', expectedPaths: 0, expected: []},
    {commit: 'HEAD~1', expectedPaths: 2, expected: ['README.md', 'b/some-file']},
    {commit: 'HEAD~2', expectedPaths: 4, expected: ['README.md', 'a/README.md', 'b/README.md', 'b/some-file']}
  ])('returns $expectedPaths file paths when comparing to $commit', async ({commit, expected}: {commit: string; expected: Array<string>}) => {
    // Act
    const changedFiles = await getChangedFiles(gitDir, commit);
    // Assert
    expect(changedFiles).toStrictEqual(expected);
  });
});

async function changeAndCommitFiles(message: string, writeFiles: Record<string, string>, deleteFiles: Array<string>) {
  for (const filePath in writeFiles) {
    const contents = writeFiles[filePath];
    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), {recursive: true});
    }
    fs.writeFileSync(filePath, contents);
  }
  for (const filePath of deleteFiles) {
    fs.rmSync(filePath, {recursive: true});
  }
  await exec.getExecOutput('git', ['add', '.'], {
    cwd: gitDir,
    silent: true
  });
  await exec.getExecOutput('git', ['commit', '--no-gpg-sign', '-m', message], {
    cwd: gitDir,
    silent: true
  });
}
