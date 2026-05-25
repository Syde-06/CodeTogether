import type { TreeViewNode } from 'reactive-vscode'
import { computed, defineService, ref, useTreeView } from 'reactive-vscode'
import { ThemeIcon } from 'vscode'
import { useActiveSession } from '../session'

export const useStatusTree = defineService(() => {
  const { role, peers, connection, hostId, hostMeta } = useActiveSession()
  const lastUpdated = ref(new Date())

  setInterval(() => {
    lastUpdated.value = new Date()
  }, 5000)

  useTreeView(
    'codetogether.status',
    computed<TreeViewNode[]>(() => {
      if (!connection.value) {
        return [{
          treeItem: {
            label: 'No active session',
            iconPath: new ThemeIcon('circle-slash'),
          },
        }]
      }

      const config = connection.value.config
      return [
        {
          treeItem: {
            label: `Role: ${role.value === 'host' ? 'Host' : 'Guest'}`,
            iconPath: new ThemeIcon(role.value === 'host' ? 'broadcast' : 'person'),
          },
        },
        {
          treeItem: {
            label: `Transport: ${config.type}`,
            description: config.domain,
            iconPath: new ThemeIcon('radio-tower'),
          },
        },
        {
          treeItem: {
            label: `Room: ${config.roomId}`,
            iconPath: new ThemeIcon('key'),
          },
        },
        {
          treeItem: {
            label: `Connected peers: ${peers.value?.length ?? 0}`,
            description: hostId.value ? `Host ${hostId.value.slice(0, 6)}` : undefined,
            iconPath: new ThemeIcon('organization'),
          },
        },
        {
          treeItem: {
            label: `Protocol: ${hostMeta.value?.version ?? 'local'}`,
            iconPath: new ThemeIcon('versions'),
          },
        },
        {
          treeItem: {
            label: `Updated: ${lastUpdated.value.toLocaleTimeString()}`,
            iconPath: new ThemeIcon('clock'),
          },
        },
      ]
    }),
  )
})
