import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import * as actionsToolkit from '@docker/actions-toolkit';

import {Bake} from '@docker/actions-toolkit/lib/buildx/bake';
import {Context} from '@docker/actions-toolkit/lib/context';
import {Docker} from '@docker/actions-toolkit/lib/docker/docker';
import {Exec} from '@docker/actions-toolkit/lib/exec';
import {GitHub} from '@docker/actions-toolkit/lib/github';
import {Toolkit} from '@docker/actions-toolkit/lib/toolkit';

import {BakeDefinition} from '@docker/actions-toolkit/lib/types/bake';
import {ConfigFile} from '@docker/actions-toolkit/lib/types/docker';

import * as context from './context';
import * as stateHelper from './state-helper';

actionsToolkit.run(
  // main
  async () => {
    const inputs: context.Inputs = await context.getInputs();
    const toolkit = new Toolkit();
    const gitAuthToken = process.env.BUILDX_BAKE_GIT_AUTH_TOKEN ?? inputs.githubToken;

    await core.group(`GitHub Actions runtime token ACs`, async () => {
      try {
        await GitHub.printActionsRuntimeTokenACs();
      } catch (e) {
        core.warning(e.message);
      }
    });

    await core.group(`Docker info`, async () => {
      try {
        await Docker.printVersion();
        await Docker.printInfo();
      } catch (e) {
        core.info(e.message);
      }
    });

    await core.group(`Proxy configuration`, async () => {
      let dockerConfig: ConfigFile | undefined;
      let dockerConfigMalformed = false;
      try {
        dockerConfig = await Docker.configFile();
      } catch (e) {
        dockerConfigMalformed = true;
        core.warning(`Unable to parse config file ${path.join(Docker.configDir, 'config.json')}: ${e}`);
      }
      if (dockerConfig && dockerConfig.proxies) {
        for (const host in dockerConfig.proxies) {
          let prefix = '';
          if (Object.keys(dockerConfig.proxies).length > 1) {
            prefix = '  ';
            core.info(host);
          }
          for (const key in dockerConfig.proxies[host]) {
            core.info(`${prefix}${key}: ${dockerConfig.proxies[host][key]}`);
          }
        }
      } else if (!dockerConfigMalformed) {
        core.info('No proxy configuration found');
      }
    });

    if (!(await toolkit.buildx.isAvailable())) {
      core.setFailed(`Docker buildx is required. See https://github.com/docker/setup-buildx-action to set up buildx.`);
      return;
    }

    stateHelper.setTmpDir(Context.tmpDir());

    await core.group(`Buildx version`, async () => {
      await toolkit.buildx.printVersion();
    });

    let definition: BakeDefinition | undefined;
    await core.group(`Parsing raw definition`, async () => {
      definition = await toolkit.bake.getDefinition(
        {
          files: inputs.files,
          load: inputs.load,
          noCache: inputs.noCache,
          overrides: inputs.set,
          provenance: inputs.provenance,
          push: inputs.push,
          sbom: inputs.sbom,
          source: inputs.source,
          targets: inputs.targets,
          githubToken: gitAuthToken
        },
        {
          cwd: inputs.workdir
        }
      );
    });
    if (!definition) {
      throw new Error('Bake definition not set');
    }

    const args: string[] = await context.getArgs(inputs, definition, toolkit);
    const buildCmd = await toolkit.buildx.getCommand(args);
    const buildEnv = Object.assign({}, process.env, {
      BUILDX_BAKE_GIT_AUTH_TOKEN: gitAuthToken
    }) as {
      [key: string]: string;
    };

    await core.group(`Bake definition`, async () => {
      await Exec.exec(buildCmd.command, [...buildCmd.args, '--print'], {
        cwd: inputs.workdir,
        env: buildEnv
      });
    });

    await Exec.getExecOutput(buildCmd.command, buildCmd.args, {
      cwd: inputs.workdir,
      env: buildEnv,
      ignoreReturnCode: true
    }).then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(`buildx bake failed with: ${res.stderr.match(/(.*)\s*$/)?.[0]?.trim() ?? 'unknown error'}`);
      }
    });

    const metadata = Bake.resolveMetadata();
    if (metadata) {
      await core.group(`Metadata`, async () => {
        const metadatadt = JSON.stringify(metadata, null, 2);
        core.info(metadatadt);
        core.setOutput('metadata', metadatadt);
      });
    }
  },
  // post
  async () => {
    if (stateHelper.tmpDir.length > 0) {
      await core.group(`Removing temp folder ${stateHelper.tmpDir}`, async () => {
        fs.rmSync(stateHelper.tmpDir, {recursive: true});
      });
    }
  }
);
