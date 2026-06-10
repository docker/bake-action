import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as actionsToolkit from '@docker/actions-toolkit';

import {BakeDefinition, Target} from '@docker/actions-toolkit/lib/types/buildx/bake.js';

actionsToolkit.run(
  // main
  async () => {
    const workdir = core.getInput('workdir');
    const files = getInputList('files');
    const target = core.getInput('target');
    const fields = getInputList('fields');

    let def: BakeDefinition;
    await core.group(`Parsing definition`, async () => {
      def = await getBakeDefinition(workdir, files, target);
      core.info(JSON.stringify(def, null, 2));
    });

    await core.group(`Generating matrix`, async () => {
      const matrix: Array<MatrixConfigEntry> = generateDefaultMatrix(def, fields);
      core.info(JSON.stringify(matrix, null, 2));
      core.setOutput('matrix', JSON.stringify(matrix));
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

function generateDefaultMatrix(definition: BakeDefinition, fields: Array<string>) {
  const result: Array<MatrixConfigEntry> = [];
  for (const targetName of Object.keys(definition.target)) {
    const target = definition.target[targetName];
    const entry: MatrixConfigEntry = {target: targetName};
    if (fields.length === 0) {
      result.push({...entry});
      continue;
    }
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
