import * as path from 'path';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as actionsToolkit from '@docker/actions-toolkit';

import {BakeDefinition} from '@docker/actions-toolkit/lib/types/buildx/bake.js';
import {Util} from '@docker/actions-toolkit/lib/util.js';

import {baseCommit, getBaseBakeDefinitionFiles, isFirstPush} from './github-helper.js';
import {getChangedFiles} from './git-helper.js';

actionsToolkit.run(
  // main
  async () => {
    const workdir = core.getInput('workdir');
    const files = Util.getInputList('files');

    const currentDefinition = await getBakeDefinition(workdir, files);

    if (isFirstPush) {
      core.info('First push');
      const targets = Object.keys(currentDefinition.target);
      core.info(JSON.stringify(targets, null, 2));
      core.setOutput('targets', JSON.stringify(targets, null, 2));
      return;
    }

    const previousFiles = await getBaseBakeDefinitionFiles(workdir, files);
    const previousDefinition = await getBakeDefinition(workdir, previousFiles);
    const changedFiles = await getChangedFiles(workdir, baseCommit);
    const targetPaths = getTargetPathPatterns(currentDefinition);

    let changedTargets = new Set<string>();
    // Check files for changes
    for (const changedFile of changedFiles) {
      for (const targetName in targetPaths) {
        if (targetPaths[targetName].some(pattern => path.matchesGlob(changedFile, pattern))) {
          changedTargets.add(targetName);
          break;
        }
      }
    }
    // Add changed bake target definitions
    changedTargets = changedTargets.union(getChangedTargetDefinitions(previousDefinition, currentDefinition));

    const output = JSON.stringify([...changedTargets], null, 2);
    core.info(output);
    core.setOutput('targets', output);
  }
);

async function getBakeDefinition(workdir: string, files: Array<string>): Promise<BakeDefinition> {
  const args = ['buildx', 'bake'];
  for (const file of files) {
    args.push('--file', file);
  }
  args.push('--print');
  const res = await exec.getExecOutput('docker', args, {
    ignoreReturnCode: true,
    silent: true,
    cwd: workdir
  });
  if (res.stderr.length > 0 && res.exitCode != 0) {
    throw new Error(res.stderr);
  }
  return JSON.parse(res.stdout.trim());
}

function getTargetPathPatterns(definition: BakeDefinition): Record<string, Array<string>> {
  const result: Record<string, Array<string>> = {};
  for (const targetName in definition.target) {
    const target = definition.target[targetName];
    result[targetName] = [path.join(target.context, '**'), path.join(target.context, target.dockerfile)];
  }
  return result;
}

function getChangedTargetDefinitions(first: BakeDefinition, second: BakeDefinition): Set<string> {
  const result = new Set<string>();
  for (const targetName in second.target) {
    // Check whether the target is new
    if (!Object.hasOwn(first.target, targetName)) {
      result.add(targetName);
      continue;
    }
    const firstTarget = first.target[targetName];
    const secondTarget = second.target[targetName];
    if (!isDeepEqual(firstTarget, secondTarget)) {
      result.add(targetName);
    }
  }
  return result;
}

function isDeepEqual(first: object, second: object): boolean {
  // Check whether one object is an array but not the other
  if ((Array.isArray(first) && !Array.isArray(second)) || (!Array.isArray(first) && Array.isArray(second))) {
    return false;
  }
  const firstKeys = new Set<string>(Object.keys(first));
  const secondKeys = new Set<string>(Object.keys(second));
  // Check whether both objects contain the same keys
  if (firstKeys.symmetricDifference(secondKeys).size > 0) {
    return false;
  }
  // Compare every value
  // NOTE: The elements of arrays must be in the same order
  for (const key of Object.keys(first)) {
    if (typeof first[key] !== typeof second[key]) {
      return false;
    }
    switch (typeof first[key]) {
      case 'object':
        if (!isDeepEqual(first[key], second[key])) {
          return false;
        }
        break;
      default:
        // Strict equality check for simple types
        if (first[key] !== second[key]) {
          return false;
        }
    }
  }
  return true;
}
