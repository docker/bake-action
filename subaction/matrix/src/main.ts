import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as actionsToolkit from '@docker/actions-toolkit';

import {BakeDefinition, Target} from '@docker/actions-toolkit/lib/types/buildx/bake.js';

import {DependencyGraph} from './dependency-graph.js';

actionsToolkit.run(
  // main
  async () => {
    const workdir = core.getInput('workdir');
    const files = getInputList('files');
    const target = core.getInput('target');
    const fields = getInputList('fields');
    const changedTargets: Array<string> = JSON.parse(core.getInput('changed-targets'));

    let def: BakeDefinition;
    await core.group(`Parsing definition`, async () => {
      def = await getBakeDefinition(workdir, files, target);
      core.info(JSON.stringify(def, null, 2));
    });

    await core.group(`Generating matrix`, async () => {
      const matrix = generateDefaultMatrix(def, fields, changedTargets);
      core.info(JSON.stringify(matrix, null, 2));
      core.setOutput('matrix', JSON.stringify(matrix));
    });

    await core.group(`Generating layered matrix`, async () => {
      const graph = new DependencyGraph(def);
      core.info(`Max amount of layers: ${graph.maxDepth}`);
      core.setOutput('max-layers', graph.maxDepth);
      const layeredMatrix = generateLayeredMatrix(graph, fields, changedTargets);
      core.info(JSON.stringify(layeredMatrix, null, 2));
      core.setOutput('layered-matrix', JSON.stringify(layeredMatrix));
      core.setOutput('layers', layeredMatrix.length);
    });
  }
);

function getInputList(name: string) {
  return core.getInput(name)
    ? core
        .getInput(name)
        .split(/[\r?\n,]+/)
        .filter(x => x !== '')
    : [];
}

async function getBakeDefinition(workdir: string, files: Array<string>, target: string): Promise<BakeDefinition> {
  const args = ['buildx', 'bake'];
  for (const file of files) {
    args.push('--file', file);
  }
  if (target) {
    args.push(target);
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

function getTargetsWithFields(definition: BakeDefinition, targetName: string, fields: Array<string>): Array<MatrixConfigEntry> {
  const entry: MatrixConfigEntry = {target: targetName};
  if (fields.length === 0) {
    return [{...entry}];
  }
  const result: Array<MatrixConfigEntry> = [];
  const target = definition.target[targetName];
  let fieldFound = false;
  Object.keys(target).forEach(field => {
    if (fields.includes(field)) {
      fieldFound = true;
      const value = target[field];
      if (Array.isArray(value)) {
        value.forEach(v => {
          entry[field] = v;
          result.push({...entry});
        });
      } else {
        entry[field] = value;
        result.push({...entry});
      }
    }
  });
  if (!fieldFound) {
    result.push({...entry});
  }
  return result;
}

function generateDefaultMatrix(definition: BakeDefinition, fields: Array<string>, changedTargets: Array<string>): Array<MatrixConfigEntry> {
  const result: Array<MatrixConfigEntry> = [];
  let targets: Array<string>;
  if (changedTargets.length > 0) {
    targets = changedTargets;
  } else {
    targets = Object.keys(definition.target);
  }
  for (const targetName of targets) {
    result.push(...getTargetsWithFields(definition, targetName, fields));
  }
  return result;
}

function generateLayeredMatrix(graph: DependencyGraph, fields: Array<string>, changedTargets: Array<string>): Array<Array<MatrixConfigEntry>> {
  let layeredMatrix: Array<Array<string>>;
  if (changedTargets.length > 0) {
    layeredMatrix = graph.getLayeredMatrixForChanges(changedTargets);
  } else {
    layeredMatrix = graph.getLayeredMatrix();
  }
  const result: Array<Array<MatrixConfigEntry>> = [];
  for (const layerMatrix of layeredMatrix) {
    const layerResult: Array<MatrixConfigEntry> = [];
    for (const targetName of layerMatrix.sort()) {
      layerResult.push(...getTargetsWithFields(graph.definition, targetName, fields));
    }
    result.push(layerResult);
  }
  return result;
}

type Optional<Type> = {
  [Property in keyof Type]?: Type[Property];
};

type ArrayToSingleEntry<Type> = {
  [Property in keyof Type]: Type[Property] extends Array<infer Entry> ? Entry : Type[Property];
};

type MatrixConfigEntry = Optional<ArrayToSingleEntry<Target>> & {
  target: string;
};
