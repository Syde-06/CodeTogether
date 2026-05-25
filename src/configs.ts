import { defineConfig } from 'reactive-vscode'

export const configs = defineConfig<{
  servers: string[]
  userName: string
  approveGuests: boolean
  defaultGuestCanEdit: boolean
  trystero: object
  terminal: {
    dimensionsSource: 'host' | 'creator' | 'minimum' | 'maximum'
  }
}>('codetogether')
