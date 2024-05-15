[![GitHub release](https://img.shields.io/github/release/docker/bake-action.svg?style=flat-square)](https://github.com/docker/bake-action/releases/latest)
[![GitHub marketplace](https://img.shields.io/badge/marketplace-docker--buildx--bake-blue?logo=github&style=flat-square)](https://github.com/marketplace/actions/docker-buildx-bake)
[![CI workflow](https://img.shields.io/github/actions/workflow/status/docker/bake-action/ci.yml?branch=master&label=ci&logo=github&style=flat-square)](https://github.com/docker/bake-action/actions?workflow=ci)
[![Test workflow](https://img.shields.io/github/actions/workflow/status/docker/bake-action/test.yml?branch=master&label=test&logo=github&style=flat-square)](https://github.com/docker/bake-action/actions?workflow=test)
[![Codecov](https://img.shields.io/codecov/c/github/docker/bake-action?logo=codecov&style=flat-square)](https://codecov.io/gh/docker/bake-action)

## About

GitHub Action to use Docker [Buildx Bake](https://docs.docker.com/build/customize/bake/)
as a high-level build command.

![Screenshot](.github/bake-action.png)

___

* [Usage](#usage)
  * [Path context](#path-context)
  * [Git context](#git-context)
* [Customizing](#customizing)
  * [inputs](#inputs)
  * [outputs](#outputs)
  * [environment variables](#environment-variables)
* [Subactions](#subactions)
  * [`list-targets`](#list-targets)
* [Contributing](#contributing)

## Usage

### Path context

By default, this action will use the local bake definition (`source: .`), so
you need to use the [`actions/checkout`](https://github.com/actions/checkout/)
action to check out the repository.

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
        uses: actions/checkout@v4
      -
        name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      -
        name: Login to DockerHub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      -
        name: Build and push
        uses: docker/bake-action@v4
        with:
          push: true
```

### Git context

Git context can be provided using the [`source` input](#inputs). This means
that you don't need to use the [`actions/checkout`](https://github.com/actions/checkout/)
action to check out the repository as [BuildKit](https://docs.docker.com/build/buildkit/)
will do this directly.

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
        name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      -
        name: Login to DockerHub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      -
        name: Build and push
        uses: docker/bake-action@v4
        with:
          source: "${{ github.server_url }}/${{ github.repository }}.git#${{ github.ref }}"
          push: true
```

Be careful because **any file mutation in the steps that precede the build step
will be ignored, including processing of the `.dockerignore` file** since
the context is based on the Git reference. However, you can use the
[Path context](#path-context) alongside the [`actions/checkout`](https://github.com/actions/checkout/)
action to remove this restriction.

Default Git context can also be provided using the [Handlebars template](https://handlebarsjs.com/guide/)
expression `{{defaultContext}}`. Here we can use it to provide a subdirectory
to the default Git context:

```yaml
      -
        name: Build and push
        uses: docker/bake-action@v4
        with:
          source: "{{defaultContext}}:mysubdir"
          push: true
```

Building from the current repository automatically uses the `GITHUB_TOKEN`
secret that GitHub [automatically creates for workflows](https://docs.github.com/en/actions/security-guides/automatic-token-authentication),
so you don't need to pass that manually. If you want to authenticate against
another private repository for remote definitions, you can set the
[`BUILDX_BAKE_GIT_AUTH_TOKEN` environment variable](https://docs.docker.com/build/building/variables/#buildx_bake_git_auth_token).

> [!NOTE]
> Supported since Buildx 0.14.0

```yaml
      -
        name: Build and push
        uses: docker/bake-action@v4
        with:
          source: "${{ github.server_url }}/${{ github.repository }}.git#${{ github.ref }}"
          push: true
        env:
          BUILDX_BAKE_GIT_AUTH_TOKEN: ${{ secrets.MYTOKEN }}
```

## Customizing

### inputs

The following inputs can be used as `step.with` keys

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

| Name           | Type        | Description                                                                                                                                                        |
|----------------|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `builder`      | String      | Builder instance (see [setup-buildx](https://github.com/docker/setup-buildx-action) action)                                                                        |
| `source`       | String      | Context to build from. Can be either local (`.`) or a [remote bake definition](https://docs.docker.com/build/customize/bake/file-definition/#remote-definition)    |
| `files`        | List/CSV    | List of [bake definition files](https://docs.docker.com/build/customize/bake/file-definition/)                                                                     |
| `workdir`      | String      | Working directory of execution                                                                                                                                     |
| `targets`      | List/CSV    | List of bake targets (`default` target used if empty)                                                                                                              |
| `no-cache`     | Bool        | Do not use cache when building the image (default `false`)                                                                                                         |
| `pull`         | Bool        | Always attempt to pull a newer version of the image (default `false`)                                                                                              |
| `load`         | Bool        | Load is a shorthand for `--set=*.output=type=docker` (default `false`)                                                                                             |
| `provenance`   | Bool/String | [Provenance](https://docs.docker.com/build/attestations/slsa-provenance/) is a shorthand for `--set=*.attest=type=provenance`                                      |
| `push`         | Bool        | Push is a shorthand for `--set=*.output=type=registry` (default `false`)                                                                                           |
| `sbom`         | Bool/String | [SBOM](https://docs.docker.com/build/attestations/sbom/) is a shorthand for `--set=*.attest=type=sbom`                                                             |
| `set`          | List        | List of [targets values to override](https://docs.docker.com/engine/reference/commandline/buildx_bake/#set) (eg: `targetpattern.key=value`)                        |
| `github-token` | String      | API token used to authenticate to a Git repository for [remote definitions](https://docs.docker.com/build/bake/remote-definition/) (default `${{ github.token }}`) |

### outputs

The following outputs are available

| Name       | Type | Description           |
|------------|------|-----------------------|
| `metadata` | JSON | Build result metadata |

## Subactions

### `list-targets`

This subaction generates a list of Bake targets that can be used in a [GitHub matrix](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix),
so you can distribute your builds across multiple runners.

```hcl
# docker-bake.hcl
group "validate" {
  targets = ["lint", "doctoc"]
}

target "lint" {
  target = "lint"
}

target "doctoc" {
  target = "doctoc"
}
```

```yaml
jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      targets: ${{ steps.generate.outputs.targets }}
    steps:
      -
        name: Checkout
        uses: actions/checkout@v4
      -
        name: List targets
        id: generate
        uses: docker/bake-action/subaction/list-targets@v4
        with:
          target: validate

  validate:
    runs-on: ubuntu-latest
    needs:
      - prepare
    strategy:
      fail-fast: false
      matrix:
        target: ${{ fromJson(needs.prepare.outputs.targets) }}
    steps:
      -
        name: Checkout
        uses: actions/checkout@v4
      -
        name: Validate
        uses: docker/bake-action@v4
        with:
          targets: ${{ matrix.target }}
```
#### inputs

| Name         | Type        | Description                                                                                                                                 |
|--------------|-------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `workdir`    | String      | Working directory to use (defaults to `.`)                                                                                                  |
| `files`      | List/CSV    | List of [bake definition files](https://docs.docker.com/build/customize/bake/file-definition/)                                              |
| `target`     | String      | The target to use within the bake file                                                                                                      |

#### outputs

The following outputs are available

| Name       | Type     | Description                |
|------------|----------|----------------------------|
| `targets`  | List/CSV | List of extracted targest  |

### environment variables

| Name                      | Type | Description                                                                                                       |
|---------------------------|------|-------------------------------------------------------------------------------------------------------------------|
| `DOCKER_BUILD_NO_SUMMARY` | Bool | If `true`, [build summary](https://docs.docker.com/build/ci/github-actions/build-summary/) generation is disabled |

## Contributing

Want to contribute? Awesome! You can find information about contributing to
this project in the [CONTRIBUTING.md](/.github/CONTRIBUTING.md)
