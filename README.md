[![GitHub release](https://img.shields.io/github/release/docker/bake-action.svg?style=flat-square)](https://github.com/docker/bake-action/releases/latest)
[![GitHub marketplace](https://img.shields.io/badge/marketplace-docker--buildx--bake-blue?logo=github&style=flat-square)](https://github.com/marketplace/actions/docker-buildx-bake)
[![CI workflow](https://img.shields.io/github/actions/workflow/status/docker/bake-action/ci.yml?branch=master&label=ci&logo=github&style=flat-square)](https://github.com/docker/bake-action/actions?workflow=ci)
[![Test workflow](https://img.shields.io/github/actions/workflow/status/docker/bake-action/test.yml?branch=master&label=test&logo=github&style=flat-square)](https://github.com/docker/bake-action/actions?workflow=test)
[![Codecov](https://img.shields.io/codecov/c/github/docker/bake-action?logo=codecov&style=flat-square)](https://codecov.io/gh/docker/bake-action)

## :test_tube: Experimental

This repository is considered **EXPERIMENTAL** and under active development
until further notice. It is subject to non-backward compatible changes or
removal in any future version, so you should [pin to a specific tag/commit](https://docs.github.com/en/actions/creating-actions/about-actions#using-tags-for-release-management)
of this action in your workflow (i.e `docker/bake-action@v1.1.3`).

## About

GitHub Action to use Docker [Buildx Bake](https://docs.docker.com/build/customize/bake/)
as a high-level build command.

![Screenshot](.github/bake-action.png)

___

* [Usage](#usage)
* [Customizing](#customizing)
  * [inputs](#inputs)
  * [outputs](#outputs)
* [Contributing](#contributing)

## Usage

```yaml
name: ci

on:
  push:
    branches:
      - 'master'

jobs:
  bake:
    runs-on: ubuntu-latest
    steps:
      -
        name: Checkout
        uses: actions/checkout@v3
      -
        name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      -
        name: Login to DockerHub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      -
        name: Build and push
        uses: docker/bake-action@v3
        with:
          push: true
```

## Customizing

### inputs

Following inputs can be used as `step.with` keys

> `List` type is a newline-delimited string
> ```yaml
> set: target.args.mybuildarg=value
> ```
> ```yaml
> set: |
>   target.args.mybuildarg=value
>   foo*.args.mybuildarg=value
> ```

> `CSV` type is a comma-delimited string
> ```yaml
> targets: default,release
> ```

| Name         | Type        | Description                                                                                                                                 |
|--------------|-------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `builder`    | String      | Builder instance (see [setup-buildx](https://github.com/docker/setup-buildx-action) action)                                                 |
| `files`      | List/CSV    | List of [bake definition files](https://docs.docker.com/build/customize/bake/file-definition/)                                              |
| `workdir`    | String      | Working directory of execution                                                                                                              |
| `targets`    | List/CSV    | List of bake targets (`default` target used if empty)                                                                                       |
| `no-cache`   | Bool        | Do not use cache when building the image (default `false`)                                                                                  |
| `pull`       | Bool        | Always attempt to pull a newer version of the image (default `false`)                                                                       |
| `load`       | Bool        | Load is a shorthand for `--set=*.output=type=docker` (default `false`)                                                                      |
| `provenance` | Bool/String | [Provenance](https://docs.docker.com/build/attestations/slsa-provenance/) is a shorthand for `--set=*.attest=type=provenance`                    |
| `push`       | Bool        | Push is a shorthand for `--set=*.output=type=registry` (default `false`)                                                                    |
| `sbom`       | Bool/String | [SBOM](https://docs.docker.com/build/attestations/sbom/) is a shorthand for `--set=*.attest=type=sbom`                                      |
| `set`        | List        | List of [targets values to override](https://docs.docker.com/engine/reference/commandline/buildx_bake/#set) (eg: `targetpattern.key=value`) |
| `source`     | String      | [Remote bake definition](https://docs.docker.com/build/customize/bake/file-definition/#remote-definition) to build from                     |

### outputs

Following outputs are available

| Name       | Type   | Description           |
|------------|--------|-----------------------|
| `metadata` | JSON   | Build result metadata |
| `stderr`   | String | Build stderr          |

## Contributing

Want to contribute? Awesome! You can find information about contributing to
this project in the [CONTRIBUTING.md](/.github/CONTRIBUTING.md)
