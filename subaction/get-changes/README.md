## About

This subaction retrieves all Bake targets which have been changed since the last push
(based on the workflow events `push` and `pull_request`),
so you don't need to rebuild all targets for every change.

A Bake target changed if:

* Its `dockerfile` has been modified
* Files in its `context` directory have been modified
* Its definition has been modified

For push events, the currently checked out commit gets compared to the previous `HEAD` commit of the branch.
For the first push to a branch all targets will be returned.

For pull request events, the currently checkout commit (usually the merge commit) gets compared to the base branch.

___

* [Usage](#usage)
* [Customizing](#customizing)
  * [inputs](#inputs)
  * [outputs](#outputs)

## Usage

### Single layer matrix

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
      matrix: ${{ steps.generate.outputs.matrix }}
    steps:
      -
        name: Checkout
        uses: actions/checkout@v6
      -
        name: Detect changes
        id: changes
        uses: docker/bake-action/subaction/get-changes@v7
      -
        name: Generate matrix
        id: generate
        uses: docker/bake-action/subaction/matrix@v7
        with:
          target: validate
          changed-targets: ${{ steps.changes.outputs.targets }}
  
  validate:
    runs-on: ubuntu-latest
    needs:
      - prepare
    strategy:
      fail-fast: false
      matrix:
        include: ${{ fromJson(needs.prepare.outputs.matrix) }}
    steps:
      -
        name: Validate
        uses: docker/bake-action@v7
        with:
          targets: ${{ matrix.target }}
```

### Multi layered matrix

```hcl
# docker-bake.hcl
group "default" {
  targets = ["apps", "special-app"]
}

target "base" {
  context = "basedir"
  tags = ["base:latest"]
}

target "apps" {
  name = "app_${version}"
  context = "appdir/${version}"
  matrix = {
    version = ["1-0-0", "2-0-0", "2-1-5"]
  }
  tags = ["app:${version}"]
  contexts = {
    base = "target:base"
  }
}

target "special-app" {
    context = "appdir/special"
    tags = ["special-app:latest"]
    contexts = {
      app = "target:app_2-0-0"
    }
}
```

```yaml
jobs:
  prepare:
    runs-on: ubuntu-latest
    env:
      MAX_LAYERS: 3
    outputs:
      layers: ${{ steps.generate.outputs.layers }}
      layered-matrix: ${{ steps.generate.outputs.layered-matrix }}
    steps:
      -
        name: Checkout
        uses: actions/checkout@v6
      -
        name: Detect changes
        id: changes
        uses: docker/bake-action/subaction/get-changes@v7
      -
        name: Generate matrix
        id: generate
        uses: docker/bake-action/subaction/matrix@v7
        with:
          changed-targets: ${{ steps.changes.outputs.targets }}
      -
        name: Verify configured max amount of layers
        run: |
          test "${{ steps.generate.outputs.max-layers }}" -eq "${MAX_LAYERS}"

  layer_1:
    runs-on: ubuntu-latest
    needs:
      - prepare
    if: ${{ fromJson(needs.prepare.outputs.layers) >= 1 }}
    strategy:
      matrix:
        include: ${{ toJson(fromJson(needs.prepare.outputs.layered-matrix)[0]) }}
    steps:
      -
        name: Build
        uses: docker/bake-action@v7
        with:
          targets: ${{ matrix.target }}

  layer_2:
    runs-on: ubuntu-latest
    needs:
      - prepare
      - layer_1
    if: ${{ fromJson(needs.prepare.outputs.layers) >= 2 }}
    strategy:
      matrix:
        include: ${{ toJson(fromJson(needs.prepare.outputs.layered-matrix)[1]) }}
    steps:
      -
        name: Build
        uses: docker/bake-action@v7
        with:
          targets: ${{ matrix.target }}

  layer_3:
    runs-on: ubuntu-latest
    needs:
      - prepare
      - layer_2
    if: ${{ fromJson(needs.prepare.outputs.layers) >= 3 }}
    strategy:
      matrix:
        include: ${{ toJson(fromJson(needs.prepare.outputs.layered-matrix)[2]) }}
    steps:
      -
        name: Build
        uses: docker/bake-action@v7
        with:
          targets: ${{ matrix.target }}
```

Note that you need to implement a way to reuse previous builds to avoid all duplicate work.
An example can be found [here](../matrix/README.md#reuse-previous-builds-with-pushed-image-refs).

## Customizing

### inputs

| Name      | Type     | Description                                                                                    |
|-----------|----------|------------------------------------------------------------------------------------------------|
| `workdir` | String   | Working directory to use (defaults to `.`)                                                     |
| `files`   | List/CSV | List of [bake definition files](https://docs.docker.com/build/customize/bake/file-definition/) |

### outputs

| Name      | Type | Description          |
|-----------|------|----------------------|
| `targets` | JSON | Changed Bake targets |
