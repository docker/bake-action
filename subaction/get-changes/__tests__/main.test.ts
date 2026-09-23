import {beforeEach, describe, expect, test, vi} from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import {BakeDefinition} from '@docker/actions-toolkit/lib/types/buildx/bake.js';

import {getChangedTargetsFromDefinitions, getChangedTargetsFromPaths} from '../src/main.js';

const fixturesDir = path.join(__dirname, 'fixtures');

vi.mock(import('../src/github-helper.js'), () => {
  return {
    baseCommit: ''
  };
});

describe('getChangedTargetsFromDefinitions', () => {
  let originalBakeDefinition: BakeDefinition;

  beforeEach(() => {
    originalBakeDefinition = getBakeDefinitionFixture('bake-def.json');
  });

  test.for([
    {fixture: 'bake-def.json', changeText: 'Bake definitions are identical', expectedTargets: 0, expected: new Set<string>()},
    {fixture: 'target-removed.json', changeText: 'a target was removed', expectedTargets: 0, expected: new Set<string>()},
    {fixture: 'target-added.json', changeText: 'a target was added', expectedTargets: 1, expected: new Set<string>(['new-target'])},
    {fixture: 'target-modified-simple.json', changeText: 'a target was modified', expectedTargets: 1, expected: new Set<string>(['t3'])},
    {fixture: 'target-modified-nested.json', changeText: 'a target was modified', expectedTargets: 1, expected: new Set<string>(['t3'])},
    {fixture: 'targets-modified-simple.json', changeText: 'targets were modified', expectedTargets: 3, expected: new Set<string>(['t3', 't6', 'base'])},
    {fixture: 'targets-modified-nested.json', changeText: 'targets were modified', expectedTargets: 3, expected: new Set<string>(['t2_darwin-amd64', 't6', 't4'])}
  ])('[$fixture] returns $expectedTargets target(s) when $changeText', ({fixture, expected}: {fixture: string; expected: Set<string>}) => {
    // Arrange
    const newBakeDefinition = getBakeDefinitionFixture(fixture);
    // Act
    const changes = getChangedTargetsFromDefinitions(originalBakeDefinition, newBakeDefinition);
    // Assert
    expect(changes).toBeInstanceOf(Set);
    expect(changes).toStrictEqual(expected);
  });
});

describe('getChangedTargetsFromPaths', () => {
  let originalBakeDefinition: BakeDefinition;

  beforeEach(() => {
    originalBakeDefinition = getBakeDefinitionFixture('bake-def.json');
  });

  test.for([
    {fixture: null, changedFiles: [], changeText: 'no files were modified', expectedTargets: 0, expected: new Set<string>()},
    {fixture: null, changedFiles: ['README.md', 'targets/README.md'], changeText: 'unrelated files were modified', expectedTargets: 0, expected: new Set<string>()},
    {fixture: null, changedFiles: ['special/example.py', 'base/Dockerfile'], changeText: 'files in context directories were modified (base, special)', expectedTargets: 3, expected: new Set<string>(['base', 't5', 't6'])},
    {fixture: 'shared-Dockerfile.json', changedFiles: ['targets/t2/README.md'], changeText: 'unrelated files were modified (directory of shared Dockerfile)', expectedTargets: 0, expected: new Set<string>()},
    {
      fixture: 'shared-Dockerfile.json',
      changedFiles: ['README.md', 'targets/t2/Dockerfile'],
      changeText: 'a shared Dockerfile was modified (t2)',
      expectedTargets: 9,
      expected: new Set<string>(['t2_darwin-amd64', 't2_darwin-arm64', 't2_linux-amd64', 't2_linux-arm64', 't2_linux-s390x', 't2_linux-ppc64le', 't2_linux-riscv64', 't2_windows-amd64', 't2_windows-arm64'])
    }
  ])('returns $expectedTargets target(s) when $changeText', ({fixture, changedFiles, expected}: {fixture: string | null; changedFiles: Array<string>; expected: Set<string>}) => {
    // Arrange
    const bakeDefinition = fixture == null ? originalBakeDefinition : getBakeDefinitionFixture(fixture);
    // Act
    const changes = getChangedTargetsFromPaths(bakeDefinition, changedFiles);
    // Assert
    expect(changes).toBeInstanceOf(Set);
    expect(changes).toStrictEqual(expected);
  });
});

function getBakeDefinitionFixture(filename: string): BakeDefinition {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, filename), {encoding: 'utf-8'}));
}
