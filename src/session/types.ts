export interface HostMeta {
  version: string
  os: NodeJS.Platform
}

export interface ParticipantPermission {
  canEdit: boolean
}

export interface JoinRequest {
  name: string
}

export interface JoinResponse {
  accepted: boolean
  reason?: string
}
