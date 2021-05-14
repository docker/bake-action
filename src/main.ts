import * as buildx from './buildx';
import * as context from './context';
import * as mexec from './exec';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

async function run(): Promise<void> {
  try {
    core.startGroup(`Docker info`);
    await exec.exec('docker', ['version']);
    await exec.exec('docker', ['info']);
    core.endGroup();

    if (!(await buildx.isAvailable())) {
      core.setFailed(`Docker buildx is required. See https://github.com/docker/setup-buildx-action to set up buildx.`);
      return;
    }

    const bxVersion = await buildx.getVersion();
    core.debug(`buildx version: ${bxVersion}`);

    const inputs: context.Inputs = await context.getInputs();
    const args: string[] = await context.getArgs(inputs, bxVersion);

    core.startGroup(`Bake definition`);
    await exec.exec('docker', [...args, '--print']);
    core.endGroup();

    await mexec.exec('docker', args).then(res => {
      if (res.stderr.length > 0 && !res.success) {
        throw new Error(`buildx bake failed with: ${res.stderr.match(/(.*)\s*$/)![0]}`);
      }
    });
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
