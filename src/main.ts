import * as buildx from './buildx';
import * as context from './context';
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

    const buildxVersion = await buildx.getVersion();
    core.info(`Using buildx ${buildxVersion}`);

    let inputs: context.Inputs = await context.getInputs();
    const args: string[] = await context.getArgs(inputs, buildxVersion);

    core.startGroup(`Bake definition`);
    await exec.exec('docker', [...args, '--print']);
    core.endGroup();

    core.info(`Building...`);
    await exec.exec('docker', args);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
