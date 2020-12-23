[![GitHub release](https://img.shields.io/github/release/crazy-max/ghaction-docker-buildx-bake.svg?style=flat-square)](https://github.com/crazy-max/ghaction-docker-buildx-bake/releases/latest)
[![GitHub marketplace](https://img.shields.io/badge/marketplace-docker--buildx--bake-blue?logo=github&style=flat-square)](https://github.com/marketplace/actions/docker-buildx-bake)
[![Test workflow](https://img.shields.io/github/workflow/status/crazy-max/ghaction-docker-buildx-bake/test?label=test&logo=github&style=flat-square)](https://github.com/crazy-max/ghaction-docker-buildx-bake/actions?workflow=test)
[![Codecov](https://img.shields.io/codecov/c/github/crazy-max/ghaction-docker-buildx-bake?logo=codecov&style=flat-square)](https://codecov.io/gh/crazy-max/ghaction-docker-buildx-bake)
[![Become a sponsor](https://img.shields.io/badge/sponsor-crazy--max-181717.svg?logo=github&style=flat-square)](https://github.com/sponsors/crazy-max)
[![Paypal Donate](https://img.shields.io/badge/donate-paypal-00457c.svg?logo=paypal&style=flat-square)](https://www.paypal.me/crazyws)

## About

GitHub Action to use Docker [Buildx Bake](https://github.com/docker/buildx#buildx-bake-options-target) as a high-level build command.

If you are interested, [check out](https://git.io/Je09Y) my other :octocat: GitHub Actions!

___

* [Usage](#usage)
* [Customizing](#customizing)
  * [inputs](#inputs)
* [Keep up-to-date with GitHub Dependabot](#keep-up-to-date-with-github-dependabot)
* [Limitation](#limitation)
* [How can I help?](#how-can-i-help)
* [License](#license)

## Usage

```yaml
name: ci
on:
  pull_request:
    branches: master
  push:
    branches: master
    tags:

jobs:
  bake:
    runs-on: ubuntu-latest
    steps:
      -
        name: Checkout
        uses: actions/checkout@v2
      -
        name: Set up QEMU
        uses: docker/setup-qemu-action@v1
      -
        name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v1
      -
        name: Login to DockerHub
        uses: docker/login-action@v1 
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      -
        name: Build and push
        uses: crazy-max/ghaction-docker-buildx-bake@v1
        with:
          files: |
            ./config.hcl
          targets: |
            release
          push: true
```

## Customizing

### inputs

Following inputs can be used as `step.with` keys

| Name             | Type    | Description                        |
|------------------|---------|------------------------------------|
| `builder`        | String  | Builder instance (see [setup-buildx](https://github.com/docker/setup-buildx-action) action) |
| `files`          | List    | List of [bake definition files](https://github.com/docker/buildx#file-definition) |
| `targets`        | List    | List of bake targets |
| `no-cache`       | Bool    | Do not use cache when building the image (default `false`) |
| `pull`           | Bool    | Always attempt to pull a newer version of the image (default `false`) |
| `load`           | Bool    | Load is a shorthand for `--set=*.output=type=docker` (default `false`) |
| `push`           | Bool    | Push is a shorthand for `--set=*.output=type=registry` (default `false`) |
| `set`            | CSV     | List of [targets values to override](https://github.com/docker/buildx#--set-targetpatternkeysubkeyvalue) (eg: `targetpattern.key=value`) |

> `List` type can be a comma or newline-delimited string
> ```yaml
> targets: default,release
> ```
> ```yaml
> targets: |
>   default
>   release
> ```

> `CSV` type must be a newline-delimited string
> ```yaml
> set: target.args.mybuildarg=value
> ```
> ```yaml
> set: |
>   target.args.mybuildarg=value
>   foo*.args.mybuildarg=value
> ```

## Keep up-to-date with GitHub Dependabot

Since [Dependabot](https://docs.github.com/en/github/administering-a-repository/keeping-your-actions-up-to-date-with-github-dependabot)
has [native GitHub Actions support](https://docs.github.com/en/github/administering-a-repository/configuration-options-for-dependency-updates#package-ecosystem),
to enable it on your GitHub repo all you need to do is add the `.github/dependabot.yml` file:

```yaml
version: 2
updates:
  # Maintain dependencies for GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "daily"
```

## Limitation

This action is only available for Linux [virtual environments](https://help.github.com/en/articles/virtual-environments-for-github-actions#supported-virtual-environments-and-hardware-resources).

## How can I help?

All kinds of contributions are welcome :raised_hands:! The most basic way to show your support is to star :star2:
the project, or to raise issues :speech_balloon: You can also support this project by
[**becoming a sponsor on GitHub**](https://github.com/sponsors/crazy-max) :clap: or by making a
[Paypal donation](https://www.paypal.me/crazyws) to ensure this journey continues indefinitely! :rocket:

Thanks again for your support, it is much appreciated! :pray:

## License

MIT. See `LICENSE` for more details.
