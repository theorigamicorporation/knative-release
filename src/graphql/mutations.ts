import { gql } from '@apollo/client'

// GraphQL mutation for creating a Knative service
export const CREATE_KNATIVE_SERVICE = gql`
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

// GraphQL mutation for updating a Knative service
export const UPDATE_KNATIVE_SERVICE = gql`
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