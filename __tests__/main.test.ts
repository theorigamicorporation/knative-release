/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import { wait } from '../__fixtures__/wait.js'
import * as apolloClient from '../__fixtures__/apollo-client.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/wait.js', () => ({ wait }))
jest.unstable_mockModule('@apollo/client', () => apolloClient)
jest.unstable_mockModule('@apollo/client/link/context', () => ({
  setContext: apolloClient.setContext
}))
jest.unstable_mockModule('cross-fetch', () => ({
  default: jest.fn()
}))

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()

    // Set up default mock implementations for required inputs
    core.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        service_name: 'test-service',
        image: 'test-image:latest',
        env_vars: '{}',
        resource_limits_cpu: '100m',
        resource_limits_memory: '512Mi',
        resource_requests_cpu: '50m',
        resource_requests_memory: '256Mi',
        container_port: '8080',
        port_name: 'http1',
        image_pull_secret_name: 'regcred',
        graphql_endpoint: 'http://localhost:4000/graphql',
        graphql_auth_token: 'test-token'
      }
      return inputs[name] || ''
    })

    // Mock environment variables
    process.env.GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql'
    process.env.GRAPHQL_AUTH_TOKEN = 'test-token'
  })

  afterEach(() => {
    jest.resetAllMocks()
    delete process.env.GRAPHQL_ENDPOINT
    delete process.env.GRAPHQL_AUTH_TOKEN
  })

  it('Validates resource limits memory format', async () => {
    // Set invalid memory format
    core.getInput.mockImplementation((name: string) => {
      if (name === 'service_name') return 'test-service'
      if (name === 'image') return 'test-image:latest'
      if (name === 'resource_limits_memory') return '512' // Invalid format - missing units
      return ''
    })

    await run()

    // Verify that the action failed with the correct error message
    expect(core.setFailed).toHaveBeenCalledWith(
      'Resource limits Memory must be in format like "512Mi", "1Gi", etc.'
    )
  })

  it('Validates resource requests memory format', async () => {
    // Set invalid memory format for requests
    core.getInput.mockImplementation((name: string) => {
      if (name === 'service_name') return 'test-service'
      if (name === 'image') return 'test-image:latest'
      if (name === 'resource_requests_memory') return '256MB' // Invalid format - wrong units
      return ''
    })

    await run()

    // Verify that the action failed with the correct error message
    expect(core.setFailed).toHaveBeenCalledWith(
      'Resource requests Memory must be in format like "128Mi", "1Gi", etc.'
    )
  })

  it('Validates CPU format', async () => {
    // Set invalid CPU format
    core.getInput.mockImplementation((name: string) => {
      if (name === 'service_name') return 'test-service'
      if (name === 'image') return 'test-image:latest'
      if (name === 'resource_limits_cpu') return '100MB' // Invalid format for CPU
      return ''
    })

    await run()

    // Verify that the action failed with the correct error message
    expect(core.setFailed).toHaveBeenCalledWith(
      'Resource limits CPU must be in format like "500m", "0.5", or "1"'
    )
  })

  it('Handles missing required inputs', async () => {
    // Return empty for required inputs
    core.getInput.mockImplementation(() => '')

    await run()

    // Should fail when required inputs are missing
    expect(core.setFailed).toHaveBeenCalled()
  })

  describe('Deploy flow', () => {
    beforeEach(() => {
      process.env.RSO_DEV_ACCESS_TOKEN = 'test-token'
      process.env.RSO_CLOUD_TENANT = 'test-tenant'

      // jest.resetAllMocks() wipes the fixture's setContext implementation,
      // so restore it for tests that reach Apollo client construction.
      apolloClient.setContext.mockImplementation(() => ({
        concat: jest.fn((link: unknown) => link)
      }))

      // Introspection test query has no variables; the service lookup does.
      // Returning no existing service drives the create path.
      apolloClient.mockQuery.mockImplementation(async (options) => {
        const opts = options as { variables?: Record<string, unknown> }
        if (opts?.variables) {
          return { data: { knativeServiceByCluster: null } }
        }
        return { data: { __schema: { queryType: { name: 'Query' } } } }
      })
      apolloClient.mockMutate.mockResolvedValue({
        data: {
          createKnativeService: {
            status: {
              url: 'https://test-service.example.com',
              latestReadyRevisionName: 'test-service-00001'
            }
          }
        }
      })
    })

    afterEach(() => {
      delete process.env.RSO_DEV_ACCESS_TOKEN
      delete process.env.RSO_CLOUD_TENANT
      delete process.env.RSO_CLUSTER_ID
    })

    const getServiceQueryVariables = (): Record<string, unknown> => {
      const call = apolloClient.mockQuery.mock.calls.find(
        (c) => (c[0] as { variables?: unknown })?.variables
      )
      return (call?.[0] as { variables: Record<string, unknown> }).variables
    }

    it('Uses the default cluster ID when RSO_CLUSTER_ID is not set', async () => {
      await run()

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(getServiceQueryVariables()).toMatchObject({
        clusterId: 'toc-cluster-prod-o4'
      })
      expect(apolloClient.mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            clusterId: 'toc-cluster-prod-o4'
          })
        })
      )
      expect(core.setOutput).toHaveBeenCalledWith(
        'service_url',
        'https://test-service.example.com'
      )
    })

    it('Uses RSO_CLUSTER_ID from the environment when set', async () => {
      process.env.RSO_CLUSTER_ID = 'my-custom-cluster'

      await run()

      expect(core.setFailed).not.toHaveBeenCalled()
      expect(getServiceQueryVariables()).toMatchObject({
        clusterId: 'my-custom-cluster'
      })
      expect(apolloClient.mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            clusterId: 'my-custom-cluster'
          })
        })
      )
    })

    it('Wires annotations and labels into the service input', async () => {
      core.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          service_name: 'test-service',
          image: 'test-image:latest',
          annotations:
            '[{"key":"autoscaling.knative.dev/minScale","value":"1"}]',
          labels: '[{"key":"app","value":"my-app"}]'
        }
        return inputs[name] || ''
      })

      await run()

      expect(core.setFailed).not.toHaveBeenCalled()
      const mutateOptions = apolloClient.mockMutate.mock.calls[0][0] as {
        variables: {
          input: {
            metadata?: unknown
            template: { metadata?: unknown }
          }
        }
      }
      expect(mutateOptions.variables.input.template.metadata).toEqual({
        annotations: [{ key: 'autoscaling.knative.dev/minScale', value: '1' }]
      })
      expect(mutateOptions.variables.input.metadata).toEqual({
        labels: [{ key: 'app', value: 'my-app' }]
      })
    })

    it('Omits annotations and labels from the input when not provided', async () => {
      await run()

      expect(core.setFailed).not.toHaveBeenCalled()
      const mutateOptions = apolloClient.mockMutate.mock.calls[0][0] as {
        variables: {
          input: {
            metadata?: unknown
            template: { metadata?: unknown }
          }
        }
      }
      expect(mutateOptions.variables.input.metadata).toBeUndefined()
      expect(mutateOptions.variables.input.template.metadata).toBeUndefined()
    })

    it('Fails when an annotation entry is missing a key', async () => {
      core.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          service_name: 'test-service',
          image: 'test-image:latest',
          annotations: '[{"value":"1"}]'
        }
        return inputs[name] || ''
      })

      await run()

      expect(core.setFailed).toHaveBeenCalledWith(
        'Each annotations entry must have a "key" field'
      )
    })
  })
})
