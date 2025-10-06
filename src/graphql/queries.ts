import { gql } from '@apollo/client'

// GraphQL query for getting a Knative service
export const GET_KNATIVE_SERVICE = gql`
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
          volumes {
            name
            persistentVolumeClaim {
              claimName
              readOnly
            }
            configMap {
              name
              optional
              defaultMode
            }
            secret {
              secretName
              optional
              defaultMode
            }
          }
          containers {
            image
            ports {
              containerPort
              name
            }
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
            env {
              name
              value
            }
            volumeMounts {
              mountPath
              name
              readOnly
            }
            securityContext {
              allowPrivilegeEscalation
              capabilities {
                add
                drop
              }
              runAsNonRoot
              seccompProfile {
                type
                localhostProfile
              }
              runAsUser
              runAsGroup
              readOnlyRootFilesystem
              privileged
            }
          }
        }
      }
      annotations {
        key
        value
      }
      creationTimestamp
      status {
        latestReadyRevisionName
        lastUpdated
        lastUpdatedTimestamp
        url
      }
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
    }
  }
`
