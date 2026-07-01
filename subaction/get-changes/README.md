## About

This subaction retrieves all Bake targets which have been changed since the last push
(based on the workflow events `push` and `pull_request`),
so you don't need to rebuild all targets for every change.

___

* [Customizing](#customizing)
  * [inputs](#inputs)
  * [outputs](#outputs)

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
