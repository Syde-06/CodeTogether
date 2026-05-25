import { defineService, useVscodeContext } from 'reactive-vscode'

export const useTunnelsTree = defineService(() => {
  useVscodeContext('codetogether:supportsTunnels', false)
})
