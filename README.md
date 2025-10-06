# Knative Release Action

[![GitHub Super-Linter](https://github.com/actions/typescript-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/actions/typescript-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/codeql-analysis.yml)

This GitHub Action allows you to easily deploy applications to
[Knative](https://knative.dev) without dealing with Kubernetes complexity.

**Author**: The Origami Corporation

## Features

- Simple interface for deploying Knative services
- Handles both creation and updates automatically
- Abstracts away all Kubernetes/Knative YAML complexity
- Only requires a container image and basic configuration
- Outputs the service URL and revision name

## Usage

```yaml
- name: Deploy to Knative
  uses: rso/knative-release@v1
  with:
    service_name: my-service
    image: reg.rso.dev/my-project/image:tag
    env_vars: |
      [
        {"name":"API_URL", "value":"https://api.example.com"},
        {"name":"NODE_ENV", "value":"production"}
      ]
    resource_limits_cpu: '1000m'
    resource_limits_memory: '512Mi'
    resource_requests_cpu: '500m'
    resource_requests_memory: '256Mi'
  env:
    RSO_API_TOKEN: ${{ secrets.RSO_API_TOKEN }}
    RSO_CLUSTER_ID: ${{ secrets.RSO_CLUSTER_ID }}
```

## Inputs

| Input                      | Description                                              | Required | Default   |
| -------------------------- | -------------------------------------------------------- | -------- | --------- |
| `service_name`             | Name of the Knative service to deploy                    | Yes      | -         |
| `image`                    | Container image to deploy                                | Yes      | -         |
| `env_vars`                 | Environment variables in JSON format                     | No       | `[]`      |
| `annotations`              | Service annotations in JSON format                       | No       | `[]`      |
| `labels`                   | Service labels in JSON format                            | No       | `[]`      |
| `resource_limits_cpu`      | CPU resource limit (e.g., "500m")                        | No       | -         |
| `resource_limits_memory`   | Memory resource limit (e.g., "512Mi")                    | No       | -         |
| `resource_requests_cpu`    | CPU resource request (e.g., "100m")                      | No       | -         |
| `resource_requests_memory` | Memory resource request (e.g., "128Mi")                  | No       | -         |
| `container_port`           | Container port to expose                                 | No       | `8080`    |
| `port_name`                | Name of the port (must be "h2c" or "http1" if specified) | No       | -         |
| `image_pull_secret_name`   | Image pull secret name                                   | No       | `regcred` |

## Environment Variables

| Variable         | Description                                       | Required |
| ---------------- | ------------------------------------------------- | -------- |
| `RSO_API_TOKEN`  | Authentication token for the RSO API              | Yes      |
| `RSO_CLUSTER_ID` | ID of the Kubernetes cluster to deploy to         | Yes      |
| `RSO_API_URL`    | API URL (defaults to <https://api.rso.dev/GraphQL>) | No       |

## Outputs

| Output          | Description                             |
| --------------- | --------------------------------------- |
| `service_url`   | The URL of the deployed Knative service |
| `revision_name` | The name of the created revision        |

## Example with Annotations and Labels

```yaml
- name: Deploy to Knative with Annotations and Labels
  uses: rso/knative-release@v1
  with:
    service_name: my-service
    image: reg.rso.dev/my-project/image:tag
    annotations: |
      [
        {"key":"autoscaling.knative.dev/minScale", "value":"1"},
        {"key":"autoscaling.knative.dev/maxScale", "value":"5"}
      ]
    labels: |
      [
        {"key":"app", "value":"my-app"},
        {"key":"environment", "value":"production"}
      ]
  env:
    RSO_API_TOKEN: ${{ secrets.RSO_API_TOKEN }}
    RSO_CLUSTER_ID: ${{ secrets.RSO_CLUSTER_ID }}
```

## How It Works

This action:

1. Takes your inputs and constructs a Knative service definition
1. First attempts to update an existing service with the same name
1. If the service doesn't exist, creates a new one
1. Returns the service URL and revision name as outputs

## Behind the Scenes

This action uses the RSO GraphQL API to deploy your service to Knative. It
handles all the complexity of Kubernetes manifests, letting you focus on your
application.

All Kubernetes/Knative complexity is completely abstracted away. You only need
to provide your container image and basic configuration.

## License

This project is licensed under the [MIT License](LICENSE).
