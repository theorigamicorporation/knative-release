import * as core from '@actions/core'
import { ApolloClient, InMemoryCache, HttpLink, gql } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import fetch from 'cross-fetch'

// GraphQL mutation for creating a Knative service
const CREATE_KNATIVE_SERVICE = gql`
  mutation CreateKnativeService($clusterId: ID!, $input: KnativeServiceInput!) {
    createKnativeService(clusterId: $clusterId, input: $input) {
      name
      namespace
      template {
        metadata {
          annotations {
            key
            value
          }
        }
        spec {
          imagePullSecrets {
            name
          }
          containers {
            image
            resources {
              limits {
                cpu
                memory
              }
              requests {
                cpu
                memory
              }
            }
            ports {
              containerPort
              name
            }
            env {
              name
              value
            }
          }
        }
      }
      annotations {
        key
        value
      }
      creationTimestamp
      metadata {
        annotations {
          key
          value
        }
        labels {
          key
          value
        }
      }
      status {
        latestReadyRevisionName
        url
      }
    }
  }
`

// GraphQL mutation for updating a Knative service
const UPDATE_KNATIVE_SERVICE = gql`
  mutation UpdateKnativeService($clusterId: ID!, $input: KnativeServiceInput!) {
    updateKnativeService(clusterId: $clusterId, input: $input) {
      name
      namespace
      template {
        metadata {
          annotations {
            key
            value
          }
        }
        spec {
          imagePullSecrets {
            name
          }
          containers {
            image
            resources {
              limits {
                cpu
                memory
              }
              requests {
                cpu
                memory
              }
            }
            ports {
              containerPort
              name
            }
            env {
              name
              value
            }
          }
        }
      }
      annotations {
        key
        value
      }
      creationTimestamp
      metadata {
        annotations {
          key
          value
        }
        labels {
          key
          value
        }
      }
      status {
        latestReadyRevisionName
        url
      }
    }
  }
`

/**
 * Create Apollo client for GraphQL requests
 */
function createApolloClient(apiUrl: string, token: string, cloudTenant: string): ApolloClient<any> {
  const httpLink = new HttpLink({
    uri: apiUrl,
    fetch
  })

  const authLink = setContext(
    (_: unknown, { headers }: { headers?: Record<string, string> }) => {
      return {
        headers: {
          ...headers,
          authorization: token ? `Bearer ${token}` : '',
          'x-tenant': cloudTenant,
        }
      }
    }
  )

  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache()
  })
}

/**
 * Parse JSON input or return empty array if invalid
 */
function parseJsonInput(input: string): any[] {
  try {
    if (!input) return []
    return JSON.parse(input)
  } catch (error) {
    core.warning(
      `Failed to parse JSON input: ${error instanceof Error ? error.message : String(error)}`
    )
    return []
  }
}

/**
 * The main function for the action.
 */
export async function run(): Promise<void> {
  try {
    // Get action inputs
    const serviceName = core.getInput('service_name', { required: true })
    const image = core.getInput('image', { required: true })
    const envVarsJson = core.getInput('env_vars')
    const annotationsJson = core.getInput('annotations')
    const labelsJson = core.getInput('labels')
    const resourceLimitsCpu = core.getInput('resource_limits_cpu')
    const resourceLimitsMemory = core.getInput('resource_limits_memory')
    const resourceRequestsCpu = core.getInput('resource_requests_cpu')
    const resourceRequestsMemory = core.getInput('resource_requests_memory')
    const containerPort = parseInt(
      core.getInput('container_port') || '8080',
      10
    )
    const portName = core.getInput('port_name')
    const imagePullSecretName =
      core.getInput('image_pull_secret_name') || 'regcred'

    // Get environment variables
    const apiUrl = process.env.RSO_API_URL || 'https://gateway.cloud.rso.dev/graphql'
    const apiToken = process.env.RSO_DEV_ACCESS_TOKEN
    const cloudTenant = process.env.RSO_CLOUD_TENANT
    const clusterId = 'toc-cluster-prod-o4'

    if (!cloudTenant) {
      throw new Error('RSO_CLOUD_TENANT environment variable is required')
    }

    if (!apiToken) {
      throw new Error('RSO_API_TOKEN environment variable is required')
    }

    if (!clusterId) {
      throw new Error('RSO_CLUSTER_ID environment variable is required')
    }

    // Parse JSON inputs
    const envVars = parseJsonInput(envVarsJson)
    const annotations = parseJsonInput(annotationsJson)
    const labels = parseJsonInput(labelsJson)

    // Prepare the input for the GraphQL mutation
    const input = {
      name: serviceName,
      template: {
        metadata: {
          annotations: []
        },
        spec: {
          containers: [
            {
              image,
              env: envVars,
              resources: {
                limits: {
                  cpu: resourceLimitsCpu || undefined,
                  memory: resourceLimitsMemory || undefined
                },
                requests: {
                  cpu: resourceRequestsCpu || undefined,
                  memory: resourceRequestsMemory || undefined
                }
              },
              ports: [
                {
                  containerPort,
                  name: portName || undefined
                }
              ]
            }
          ],
          imagePullSecrets: [
            {
              name: imagePullSecretName
            }
          ]
        }
      },
      annotations,
      metadata: {
        labels
      }
    }

    core.debug(
      `Creating/updating Knative service with input: ${JSON.stringify(input, null, 2)}`
    )

    // Create Apollo client
    const client = createApolloClient(apiUrl, apiToken, cloudTenant)

    // First try to update - if it fails with NotFound, try to create instead
    try {
      core.info(`Attempting to update existing Knative service: ${serviceName}`)
      const { data } = await client.mutate({
        mutation: UPDATE_KNATIVE_SERVICE,
        variables: {
          clusterId,
          input
        }
      })

      const result = data.updateKnativeService
      core.setOutput('service_url', result.status.url)
      core.setOutput('revision_name', result.status.latestReadyRevisionName)
      core.info(`Successfully updated Knative service: ${serviceName}`)
      core.info(`Service URL: ${result.status.url}`)
    } catch (error) {
      // If service doesn't exist, create it
      if (error instanceof Error && error.message.includes('not found')) {
        core.info(
          `Service not found, creating new Knative service: ${serviceName}`
        )

        const { data } = await client.mutate({
          mutation: CREATE_KNATIVE_SERVICE,
          variables: {
            clusterId,
            input
          }
        })

        const result = data.createKnativeService
        core.setOutput('service_url', result.status.url)
        core.setOutput('revision_name', result.status.latestReadyRevisionName)
        core.info(`Successfully created Knative service: ${serviceName}`)
        core.info(`Service URL: ${result.status.url}`)
      } else {
        // Some other error occurred
        throw error
      }
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
    else core.setFailed('An unknown error occurred')
  }
}
