import * as core from '@actions/core'
import { ApolloClient, InMemoryCache, HttpLink, gql } from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import fetch from 'cross-fetch'
import {
  CREATE_KNATIVE_SERVICE,
  UPDATE_KNATIVE_SERVICE
} from './graphql/mutations.js'
import { GET_KNATIVE_SERVICE } from './graphql/queries.js'

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
 * Remove __typename fields recursively from an object
 */
function removeTypenames<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(removeTypenames) as unknown as T
  }

  const result = { ...obj } as Record<string, unknown>

  // Remove __typename field if it exists
  if ('__typename' in result) {
    delete result.__typename
  }

  // Process all properties recursively
  for (const key in result) {
    if (result[key] && typeof result[key] === 'object') {
      result[key] = removeTypenames(result[key])
    }
  }

  return result as T
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

    // Validate and clean image name
    const cleanImage = image.trim()
    if (!cleanImage) {
      throw new Error('Image name cannot be empty')
    }

    // Validate image format
    if (cleanImage.endsWith(':')) {
      throw new Error(
        'Image name cannot end with a colon. Please provide a valid image tag.'
      )
    }

    // Check if image has a valid format
    if (!cleanImage.includes('/') && !cleanImage.includes(':')) {
      core.warning(
        'Image name does not include a registry or tag. Consider using a full image reference.'
      )
    }

    // Log input parameters for debugging
    core.info(`Service name: ${serviceName}`)
    core.info(`Image: ${cleanImage}`)
    core.info(`Container port: ${containerPort}`)
    core.info(
      `Resource limits - CPU: ${resourceLimitsCpu}, Memory: ${resourceLimitsMemory}`
    )
    core.info(
      `Resource requests - CPU: ${resourceRequestsCpu}, Memory: ${resourceRequestsMemory}`
    )
    core.info(`Image pull secret: ${imagePullSecretName}`)

    // Validate resource limits format
    if (
      resourceLimitsCpu &&
      !resourceLimitsCpu.match(/^\d+m$|^\d+\.\d+$|^\d+$/)
    ) {
      throw new Error(
        'Resource limits CPU must be in format like "500m", "0.5", or "1"'
      )
    }
    if (
      resourceLimitsMemory &&
      !resourceLimitsMemory.match(/^\d+[KMGTPEZYkmgtpezy]i?$/)
    ) {
      throw new Error(
        'Resource limits Memory must be in format like "512Mi", "1Gi", etc.'
      )
    }
    if (
      resourceRequestsCpu &&
      !resourceRequestsCpu.match(/^\d+m$|^\d+\.\d+$|^\d+$/)
    ) {
      throw new Error(
        'Resource requests CPU must be in format like "100m", "0.1", or "1"'
      )
    }
    if (
      resourceRequestsMemory &&
      !resourceRequestsMemory.match(/^\d+[KMGTPEZYkmgtpezy]i?$/)
    ) {
      throw new Error(
        'Resource requests Memory must be in format like "128Mi", "1Gi", etc.'
      )
    }

    // Get environment variables
    const apiUrl =
      process.env.RSO_API_URL || 'https://gateway.cloud.rso.dev/graphql'
    const apiToken = process.env.RSO_DEV_ACCESS_TOKEN
    const cloudTenant = process.env.RSO_CLOUD_TENANT
    const clusterId = 'toc-cluster-prod-o4'

    core.info(`Using API URL: ${apiUrl}`)
    core.info(`Cloud tenant: ${cloudTenant}`)
    core.info(`Cluster ID: ${clusterId}`)

    if (!cloudTenant) {
      throw new Error('RSO_CLOUD_TENANT environment variable is required')
    }

    if (!apiToken) {
      throw new Error('RSO_DEV_ACCESS_TOKEN environment variable is required')
    }

    // Validate API URL
    try {
      new URL(apiUrl)
    } catch (error) {
      core.error(
        `Invalid API URL: ${apiUrl} - ${error instanceof Error ? error.message : String(error)}`
      )
      throw new Error(`Invalid API URL: ${apiUrl}`)
    }

    // Parse JSON inputs
    const envVars = parseJsonInput(envVarsJson)
    core.debug(
      `Parsed environment variables: ${JSON.stringify(envVars, null, 2)}`
    )

    // Validate environment variables format
    if (envVars.length > 0) {
      for (const envVar of envVars) {
        if (!envVar.name || typeof envVar.name !== 'string') {
          throw new Error('Environment variables must have a "name" field')
        }
        if (!envVar.value || typeof envVar.value !== 'string') {
          throw new Error('Environment variables must have a "value" field')
        }
      }
    }

    // Create Apollo client
    const client = createApolloClient(apiUrl, apiToken, cloudTenant)

    // Test the connection
    core.info('Testing GraphQL connection...')
    try {
      // Simple introspection query to test connection
      const testQuery = gql`
        query {
          __schema {
            queryType {
              name
            }
          }
        }
      `
      await client.query({ query: testQuery })
      core.info('GraphQL connection successful')
    } catch (error) {
      core.error(
        `GraphQL connection test failed: ${error instanceof Error ? error.message : String(error)}`
      )
      throw new Error(
        `Failed to connect to GraphQL API: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    // Prepare the new input based on provided parameters
    const newInput = {
      name: serviceName,
      template: {
        spec: {
          containers: [
            {
              image: cleanImage,
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
      }
    }

    // First try to get the existing service
    try {
      core.info(`Fetching existing Knative service: ${serviceName}`)
      core.debug(
        `Query variables: clusterId=${clusterId}, name=${serviceName}, namespace=${cloudTenant}`
      )

      const { data } = await client.query({
        query: GET_KNATIVE_SERVICE,
        variables: {
          clusterId,
          name: serviceName,
          namespace: cloudTenant
        }
      })

      const existingService = data.knativeServiceByCluster

      if (existingService) {
        core.info(`Found existing Knative service, merging configurations`)

        // Convert the existing service to input format
        const existingInput = {
          name: existingService.name,
          template: existingService.template
        }

        // Remove __typename fields from the existing service data
        const cleanExistingInput = removeTypenames(existingInput)

        // Merge the existing service with the new input, giving preference to new values
        const mergedInput = deepMerge(cleanExistingInput, newInput)

        core.debug(
          `Updating Knative service with merged input: ${JSON.stringify(mergedInput, null, 2)}`
        )

        // Update the service with merged configuration
        core.debug(
          `Updating service with variables: clusterId=${clusterId}, input=${JSON.stringify(mergedInput, null, 2)}`
        )

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
      core.error(
        `GraphQL query error: ${error instanceof Error ? error.message : String(error)}`
      )
      core.debug(`Full error details: ${JSON.stringify(error, null, 2)}`)

      // If the GraphQL query returned an error related to service not existing
      if (
        error instanceof Error &&
        (error.message.includes('not found') ||
          error.message === 'Service not found') &&
        !error.message.includes('already exists')
      ) {
        core.info(
          `Service not found, creating new Knative service: ${serviceName}`
        )

        try {
          core.debug(
            `Creating service with variables: clusterId=${clusterId}, input=${JSON.stringify(newInput, null, 2)}`
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
        } catch (createError) {
          core.error(
            `Create mutation error: ${createError instanceof Error ? createError.message : String(createError)}`
          )
          core.debug(
            `Full create error details: ${JSON.stringify(createError, null, 2)}`
          )

          // If creation fails with "already exists" error, try updating instead
          if (
            createError instanceof Error &&
            createError.message.includes('already exists')
          ) {
            core.info(
              `Service appears to already exist despite query failure. Trying to update instead.`
            )

            // Since we couldn't get the existing service data, we'll just use the new input
            const { data } = await client.mutate({
              mutation: UPDATE_KNATIVE_SERVICE,
              variables: {
                clusterId,
                input: newInput
              }
            })

            const result = data.updateKnativeService
            core.setOutput('service_url', result.status.url)
            core.setOutput(
              'revision_name',
              result.status.latestReadyRevisionName
            )
            core.info(`Successfully updated Knative service: ${serviceName}`)
            core.info(`Service URL: ${result.status.url}`)
          } else {
            // Some other error occurred during creation
            core.error(
              `Unexpected error during service creation: ${createError instanceof Error ? createError.message : String(createError)}`
            )
            throw createError
          }
        }
      } else {
        // If a service-exists error occurred during the initial query
        if (
          error instanceof Error &&
          error.message.includes('already exists')
        ) {
          core.info(
            `Service appears to already exist despite query failure. Trying to update instead.`
          )

          // Since we couldn't get the existing service data, we'll just use the new input
          const { data } = await client.mutate({
            mutation: UPDATE_KNATIVE_SERVICE,
            variables: {
              clusterId,
              input: newInput
            }
          })

          const result = data.updateKnativeService
          core.setOutput('service_url', result.status.url)
          core.setOutput('revision_name', result.status.latestReadyRevisionName)
          core.info(`Successfully updated Knative service: ${serviceName}`)
          core.info(`Service URL: ${result.status.url}`)
        } else {
          // Some other error occurred
          core.error(
            `Unexpected error during service query: ${error instanceof Error ? error.message : String(error)}`
          )
          throw error
        }
      }
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
    else core.setFailed('An unknown error occurred')
  }
}
