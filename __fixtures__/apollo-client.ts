/**
 * Mock implementation of Apollo Client for testing
 */
import { jest } from '@jest/globals'

// Type definitions for Apollo Client mocks
interface ApolloClientOptions {
  cache?: unknown
  link?: unknown
  defaultOptions?: unknown
}

interface HttpLinkOptions {
  uri?: string
  fetch?: unknown
  headers?: Record<string, string>
}

type SetContextFunction = (
  request: unknown,
  previousContext: unknown
) => Record<string, unknown>

interface ApolloLink {
  concat: (link: unknown) => unknown
}

// Mock gql template literal
export const gql = jest.fn(
  (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Join the strings and values into a single string
    let result = strings[0]
    for (let i = 0; i < values.length; i++) {
      result += String(values[i]) + strings[i + 1]
    }
    return result
  }
)

// Mock Apollo Client class
export class ApolloClient {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_options: ApolloClientOptions) {
    // Store options for testing purposes if needed
  }

  query = jest.fn().mockResolvedValue({
    data: {
      knativeServiceByNameAndNamespace: {
        id: 'test-id',
        name: 'test-service',
        namespace: 'test-namespace'
      }
    }
  })

  mutate = jest.fn().mockResolvedValue({
    data: {
      triggerReleaseKnativeService: {
        success: true,
        release: {
          id: 'release-id',
          version: '1.0.0'
        }
      }
    }
  })
}

// Mock InMemoryCache
export class InMemoryCache {
  constructor() {}
}

// Mock HttpLink
export class HttpLink {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_options: HttpLinkOptions) {}
}

// Mock setContext from link/context
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const setContext = jest.fn((_fn: SetContextFunction): ApolloLink => {
  // Return a mock link that can be used in the chain
  return {
    concat: jest.fn((link: unknown) => link)
  }
})
