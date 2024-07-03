## About

This subaction generates a list of Bake targets that can be used in a [GitHub matrix](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix),
so you can distribute your builds across multiple runners.

![Screenshot](../../.github/bake-action.png)

___

* [Usage](#usage)
* [Customizing](#customizing)
  * [inputs](#inputs)
  * [outputs](#outputs)

## Usage

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
        uses: docker/bake-action@v5
        with:
          targets: ${{ matrix.target }}
```

## Customizing

### inputs

| Name         | Type        | Description                                                                                                                                 |
|--------------|-------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `workdir`    | String      | Working directory to use (defaults to `.`)                                                                                                  |
| `files`      | List/CSV    | List of [bake definition files](https://docs.docker.com/build/customize/bake/file-definition/)                                              |
| `target`     | String      | The target to use within the bake file                                                                                                      |

### outputs

The following outputs are available

| Name       | Type     | Description                |
|------------|----------|----------------------------|
| `targets`  | List/CSV | List of extracted targest  |
