import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as actionsToolkit from '@docker/actions-toolkit';

import {Buildx} from '@docker/actions-toolkit/lib/buildx/buildx.js';
import {Util} from '@docker/actions-toolkit/lib/util.js';

import {BakeDefinition, Target} from '@docker/actions-toolkit/lib/types/buildx/bake.js';

import {DependencyGraph} from './dependency-graph.js';

actionsToolkit.run(
  // main
  async () => {
    const workdir = core.getInput('workdir');
    const files = Util.getInputList('files');
    const target = core.getInput('target');
    const fields = Util.getInputList('fields');

    const def = await core.group(`Parsing definition`, async () => {
      const def: BakeDefinition = await getBakeDefinition(workdir, files, target);
      core.info(JSON.stringify(def, null, 2));
      return def;
    });

    await core.group(`Generating matrix`, async () => {
      const matrix = generateDefaultMatrix(def, fields);
      core.info(JSON.stringify(matrix, null, 2));
      core.setOutput('matrix', JSON.stringify(matrix));
    });

    await core.group(`Generating layered matrix`, async () => {
      const graph = new DependencyGraph(def);
      core.info(`Max amount of layers: ${graph.maxDepth}`);
      core.setOutput('max-layers', graph.maxDepth);
      const layeredMatrix = generateLayeredMatrix(graph, fields);
      core.info(JSON.stringify(layeredMatrix, null, 2));
      core.setOutput('layered-matrix', JSON.stringify(layeredMatrix));
      core.setOutput('layers', layeredMatrix.length);
    });
  }
);

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
  if (res.exitCode !== 0) {
    throw new Error(`buildx bake failed with: ${Buildx.getErrorMessage(res.stderr)}`);
  }
  return JSON.parse(res.stdout.trim());
}

function getTargetsWithFields(targetName: string, target: Target, fields: Array<string>): Array<MatrixConfigEntry> {
  const entry: MatrixConfigEntry = {target: targetName};
  if (fields.length === 0) {
    return [{...entry}];
  }
  const result: Array<MatrixConfigEntry> = [];
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

function generateDefaultMatrix(definition: BakeDefinition, fields: Array<string>): Array<MatrixConfigEntry> {
  const result: Array<MatrixConfigEntry> = [];
  for (const [targetName, target] of Object.entries(definition.target)) {
    result.push(...getTargetsWithFields(targetName, target, fields));
  }
  return result;
}

function generateLayeredMatrix(graph: DependencyGraph, fields: Array<string>): Array<Array<MatrixConfigEntry>> {
  const layeredMatrix = graph.getLayeredMatrix();
  const result: Array<Array<MatrixConfigEntry>> = [];
  for (const layerMatrix of layeredMatrix) {
    const layerResult: Array<MatrixConfigEntry> = [];
    for (const targetName of layerMatrix.sort()) {
      layerResult.push(...getTargetsWithFields(targetName, graph.definition.target[targetName], fields));
    }
    result.push(layerResult);
  }
  return result;
}

type ArrayToSingleEntry<Type> = {
  [Property in keyof Type]: Type[Property] extends Array<infer Entry> ? Entry : Type[Property];
};

type MatrixConfigEntry = Partial<ArrayToSingleEntry<Target>> & {
  target: string;
};
