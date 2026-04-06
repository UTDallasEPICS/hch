import type { ClientStatus } from '../../prisma/generated/client'

export type ClientStatusLabel = 'Prospective' | 'Waitlist' | 'Active' | 'Archived'

const LABEL_TO_DB: Record<ClientStatusLabel, ClientStatus> = {
  Prospective: 'INCOMPLETE',
  Waitlist: 'WAITLIST',
  Active: 'ACTIVE',
  Archived: 'ARCHIVED',
}

const DB_TO_LABEL: Record<ClientStatus, ClientStatusLabel> = {
  INCOMPLETE: 'Prospective',
  WAITLIST: 'Waitlist',
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
}

export function isClientStatusLabel(value: string): value is ClientStatusLabel {
  return (
    value === 'Prospective' || value === 'Waitlist' || value === 'Active' || value === 'Archived'
  )
}

export function toDbClientStatus(value: string | null | undefined): ClientStatus {
  if (!value) return 'INCOMPLETE'

  if (
    value === 'INCOMPLETE' ||
    value === 'WAITLIST' ||
    value === 'ACTIVE' ||
    value === 'ARCHIVED'
  ) {
    return value
  }

  if (isClientStatusLabel(value)) {
    return LABEL_TO_DB[value]
  }

  return 'INCOMPLETE'
}

export function toClientStatusLabel(value: string | null | undefined): ClientStatusLabel {
  return DB_TO_LABEL[toDbClientStatus(value)]
}
