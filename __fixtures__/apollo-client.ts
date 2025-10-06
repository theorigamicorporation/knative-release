/**
 * Mock implementation of Apollo Client for testing
 */
import { jest } from '@jest/globals'

// Mock gql template literal
export const gql = jest.fn((strings: TemplateStringsArray, ...values: any[]) => {
  // Join the strings and values into a single string
  let result = strings[0]
  for (let i = 0; i < values.length; i++) {
    result += values[i] + strings[i + 1]
  }
  return result
})

// Mock Apollo Client class
export class ApolloClient {
  constructor(options: any) {
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
  constructor(options: any) {}
}

// Mock setContext from link/context
export const setContext = jest.fn((fn: any) => {
  // Return a mock link that can be used in the chain
  return {
    concat: jest.fn((link: any) => link)
  }
})
