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

// GraphQL query for getting a Knative service
const GET_KNATIVE_SERVICE = gql`
  query KnativeServiceByCluster(
    $clusterId: ID!
    $name: String!
    $namespace: String
  ) {
    knativeServiceByCluster(
      clusterId: $clusterId
      name: $name
      namespace: $namespace
    ) {
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
function createApolloClient(
  apiUrl: string,
  token: string,
  cloudTenant: string
): ApolloClient<unknown> {
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
          'x-tenant': cloudTenant
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
function parseJsonInput(input: string): Record<string, string>[] {
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
 * Deep merge two objects
 * @param target The target object to merge into
 * @param source The source object to merge from
 * @returns The merged object
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>
): T {
  const output = { ...target } as T

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      const targetValue = target[key]
      const sourceValue = source[key]

      if (isObject(sourceValue)) {
        if (!(key in target)) {
          Object.assign(output, { [key]: sourceValue })
        } else {
          output[key as keyof T] = deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>
          ) as unknown as T[keyof T]
        }
      } else if (Array.isArray(sourceValue)) {
        // For arrays, we'll replace the entire array
        // (this is appropriate for env vars, annotations, etc.)
        output[key as keyof T] = sourceValue as unknown as T[keyof T]
      } else {
        Object.assign(output, { [key]: sourceValue })
      }
    })
  }

  return output
}

/**
 * Check if value is an object
 */
function isObject(item: unknown): item is Record<string, unknown> {
  return Boolean(item && typeof item === 'object' && !Array.isArray(item))
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
    const apiUrl =
      process.env.RSO_API_URL || 'https://gateway.cloud.rso.dev/graphql'
    const apiToken = process.env.RSO_DEV_ACCESS_TOKEN
    const cloudTenant = process.env.RSO_CLOUD_TENANT
    const clusterId = 'toc-cluster-prod-o4'

    if (!cloudTenant) {
      throw new Error('RSO_CLOUD_TENANT environment variable is required')
    }

    if (!apiToken) {
      throw new Error('RSO_API_TOKEN environment variable is required')
    }

    // Parse JSON inputs
    const envVars = parseJsonInput(envVarsJson)
    const annotations = parseJsonInput(annotationsJson)
    const labels = parseJsonInput(labelsJson)

    // Create Apollo client
    const client = createApolloClient(apiUrl, apiToken, cloudTenant)

    // Prepare the new input based on provided parameters
    const newInput = {
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

    // First try to get the existing service
    try {
      core.info(`Fetching existing Knative service: ${serviceName}`)
      const { data } = await client.query({
        query: GET_KNATIVE_SERVICE,
        variables: {
          clusterId,
          name: serviceName,
          namespace: undefined // Use default namespace
        }
      })

      const existingService = data.knativeServiceByCluster

      if (existingService) {
        core.info(`Found existing Knative service, merging configurations`)

        // Convert the existing service to input format
        const existingInput = {
          name: existingService.name,
          template: existingService.template,
          annotations: existingService.annotations,
          metadata: existingService.metadata
        }

        // Merge the existing service with the new input, giving preference to new values
        const mergedInput = deepMerge(existingInput, newInput)

        core.debug(
          `Updating Knative service with merged input: ${JSON.stringify(mergedInput, null, 2)}`
        )

        // Update the service with merged configuration
        const updateResult = await client.mutate({
          mutation: UPDATE_KNATIVE_SERVICE,
          variables: {
            clusterId,
            input: mergedInput
          }
        })

        const result = updateResult.data.updateKnativeService
        core.setOutput('service_url', result.status.url)
        core.setOutput('revision_name', result.status.latestReadyRevisionName)
        core.info(`Successfully updated Knative service: ${serviceName}`)
        core.info(`Service URL: ${result.status.url}`)
      } else {
        throw new Error('Service not found')
      }
    } catch (error) {
      // If service doesn't exist or query failed, create it
      if (
        error instanceof Error &&
        (error.message.includes('not found') ||
          error.message === 'Service not found')
      ) {
        core.info(
          `Service not found, creating new Knative service: ${serviceName}`
        )

        const { data } = await client.mutate({
          mutation: CREATE_KNATIVE_SERVICE,
          variables: {
            clusterId,
            input: newInput
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
