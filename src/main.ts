import * as fs from 'fs';
import * as buildx from './buildx';
import * as context from './context';
import * as docker from './docker';
import * as stateHelper from './state-helper';
import * as core from '@actions/core';
import * as exec from '@actions/exec';

async function run(): Promise<void> {
  try {
    const inputs: context.Inputs = await context.getInputs();

    // standalone if docker cli not available
    const standalone = !(await docker.isAvailable());

    core.startGroup(`Docker info`);
    if (standalone) {
      core.info(`Docker info skipped in standalone mode`);
    } else {
      await exec.exec('docker', ['version'], {
        failOnStdErr: false
      });
      await exec.exec('docker', ['info'], {
        failOnStdErr: false
      });
    }
    core.endGroup();

    if (!(await buildx.isAvailable(standalone))) {
      core.setFailed(`Docker buildx is required. See https://github.com/docker/setup-buildx-action to set up buildx.`);
      return;
    }
    stateHelper.setTmpDir(context.tmpDir());

    const buildxVersion = await buildx.getVersion(standalone);
    await core.group(`Buildx version`, async () => {
      const versionCmd = buildx.getCommand(['version'], standalone);
      await exec.exec(versionCmd.command, versionCmd.args, {
        failOnStdErr: false
      });
    });

    const args: string[] = await context.getArgs(inputs, buildxVersion);
    const buildCmd = buildx.getCommand(args, standalone);

    core.startGroup(`Bake definition`);
    await exec.exec(buildCmd.command, [...buildCmd.args, '--print'], {
      cwd: inputs.workdir
    });
    core.endGroup();

    await exec
      .getExecOutput(buildCmd.command, buildCmd.args, {
        cwd: inputs.workdir,
        ignoreReturnCode: true
      })
      .then(res => {
        if (res.stderr.length > 0 && res.exitCode != 0) {
          throw new Error(`buildx bake failed with: ${res.stderr.match(/(.*)\s*$/)?.[0]?.trim() ?? 'unknown error'}`);
        }
      });

    const metadata = await buildx.getMetadata();
    if (metadata) {
      await core.group(`Metadata output`, async () => {
        core.info(metadata);
        context.setOutput('metadata', metadata);
      });
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function cleanup(): Promise<void> {
  if (stateHelper.tmpDir.length > 0) {
    core.startGroup(`Removing temp folder ${stateHelper.tmpDir}`);
    fs.rmdirSync(stateHelper.tmpDir, {recursive: true});
    core.endGroup();
  }
}

if (!stateHelper.IsPost) {
  run();
} else {
  cleanup();
}
