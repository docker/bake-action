import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as actionsToolkit from '@docker/actions-toolkit';

import {Buildx} from '@docker/actions-toolkit/lib/buildx/buildx.js';
import {Util} from '@docker/actions-toolkit/lib/util.js';

import {BakeDefinition, Target} from '@docker/actions-toolkit/lib/types/buildx/bake.js';

actionsToolkit.run(
  // main
  async () => {
    const workdir = core.getInput('workdir');
    const files = Util.getInputList('files');
    const target = core.getInput('target');
    const fields = Util.getInputList('fields');

    const def = await core.group(`Parsing definition`, async () => {
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
      const def: BakeDefinition = JSON.parse(res.stdout.trim());
      core.info(JSON.stringify(def, null, 2));
      return def;
    });

    await core.group(`Generating matrix`, async () => {
      const result: Array<MatrixConfigEntry> = [];
      for (const [targetName, target] of Object.entries(def.target)) {
        const entry: MatrixConfigEntry = {target: targetName};
        if (fields.length === 0) {
          result.push(entry);
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
          result.push(entry);
        }
      }
      core.info(JSON.stringify(result, null, 2));
      core.setOutput('matrix', JSON.stringify(result));
    });
  }
);

type ArrayToSingleEntry<Type> = {
  [Property in keyof Type]: Type[Property] extends Array<infer Entry> ? Entry : Type[Property];
};

type MatrixConfigEntry = Partial<ArrayToSingleEntry<Target>> & {
  target: string;
};
