import * as os from 'os';
import * as buildx from './buildx';
import * as context from './context';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

async function run(): Promise<void> {
  try {
    if (os.platform() !== 'linux') {
      core.setFailed('Only supported on linux platform');
      return;
    }

    if (!(await buildx.isAvailable())) {
      core.setFailed(`Buildx is required. See https://github.com/docker/setup-buildx-action to set up buildx.`);
      return;
    }

    const buildxVersion = await buildx.getVersion();
    core.info(`📣 Buildx version: ${buildxVersion}`);

    let inputs: context.Inputs = await context.getInputs();
    const args: string[] = await context.getArgs(inputs, buildxVersion);

    core.startGroup(`💡 Bake definition`);
    await exec.exec('docker', [...args, '--print']);
    core.endGroup();

    core.info(`🏃 Building...`);
    await exec.exec('docker', args);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
