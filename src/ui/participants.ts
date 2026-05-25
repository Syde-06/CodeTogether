import type { TreeViewNode } from 'reactive-vscode'
import { computed, defineService, ref, useCommands, useTreeView } from 'reactive-vscode'
import { ThemeColor, ThemeIcon, Uri, window } from 'vscode'
import { useActiveSession } from '../session'
import { useObserverShallow } from '../sync/doc'
import { useSelections } from './selections'
import { useUsers } from './users'

export const useParticipantsTree = defineService(() => {
  const { peers, getUserInfo } = useUsers()
  const { getSelection, following } = useSelections()
  const { toLocalUri, hostId, connection, doc, role, selfId } = useActiveSession()
  const permissions = computed(() => doc.value?.getMap<{ canEdit: boolean }>('permissions'))
  const permissionsVersion = useObserverShallow(permissions, () => {})

  const pings = ref<Record<string, number>>({})
  setInterval(() => {
    if (!peers.value || !connection.value) {
      pings.value = {}
      return
    }
    for (const peerId of peers.value) {
      connection.value.ping(peerId).then((time) => {
        pings.value[peerId] = time
      })
    }
  }, 5000)

  const orderedPeers = computed(() => {
    return (peers.value || []).slice().sort((a, b) => {
      if (a === hostId.value)
        return -1
      if (b === hostId.value)
        return 1
      return getUserInfo(a).name.localeCompare(getUserInfo(b).name)
    })
  })

  useTreeView(
    'codetogether.participants',
    computed(() => orderedPeers.value.map<TreeViewNode>((peerId) => {
      const user = getUserInfo(peerId)
      const selections = getSelection(peerId)
      void permissionsVersion.value
      const canEdit = permissions.value?.get(peerId)?.canEdit !== false

      let tooltip = user.name
      const isFollowing = following.value === peerId
      if (selections) {
        const path = toLocalUri(Uri.parse(selections.uri)).fsPath
        const line = selections.selections[0]?.[3] + 1
        tooltip += ` • ${path}:${line}`
        if (isFollowing) {
          tooltip += ' (Following)'
        }
      }

      let description = `${pings.value[peerId] ?? '-'}ms `
      if (peerId === hostId.value) {
        description += ' (Host)'
      }
      if (isFollowing) {
        description += ' (Following)'
      }
      if (!canEdit) {
        description += ' (View-only)'
      }

      const contextParts = [
        isFollowing ? 'is-following' : 'not-following',
        canEdit ? 'can-edit' : 'read-only',
      ]
      if (role.value === 'host' && peerId !== selfId.value) {
        contextParts.push('host-controls')
      }

      return {
        treeItem: {
          iconPath: new ThemeIcon(isFollowing ? 'circle-filled' : 'circle', new ThemeColor(user.color.id)),
          label: user?.name ?? 'Unknown',
          description,
          tooltip,
          contextValue: contextParts.join(' '),
          peerId,
        },
      }
    })),
  )

  useCommands({
    'codetogether.kickParticipant': async (item: any) => {
      const peerId = item?.treeItem?.peerId
      if (!peerId || role.value !== 'host' || !connection.value) {
        return
      }
      const user = getUserInfo(peerId)
      const result = await window.showWarningMessage(
        `Remove ${user.name} from the session?`,
        { modal: true },
        'Remove',
      )
      if (result !== 'Remove') {
        return
      }
      const [sendSessionControl] = connection.value.makeAction<{ type: 'kick', reason?: string }>('sessionCtl')
      await sendSessionControl({
        type: 'kick',
        reason: 'The host removed you from the session.',
      }, peerId)
      doc.value?.getMap<boolean>('bans').set(user.name, true)
      permissions.value?.delete(peerId)
      window.showInformationMessage(`${user.name} was removed from the session.`)
    },
    'codetogether.revokeEditPermission': async (item: any) => {
      const peerId = item?.treeItem?.peerId
      if (!peerId || role.value !== 'host') {
        return
      }
      permissions.value?.set(peerId, { canEdit: false })
      window.showInformationMessage(`${getUserInfo(peerId).name} now has view-only access.`)
    },
    'codetogether.grantEditPermission': async (item: any) => {
      const peerId = item?.treeItem?.peerId
      if (!peerId || role.value !== 'host') {
        return
      }
      permissions.value?.set(peerId, { canEdit: true })
      window.showInformationMessage(`${getUserInfo(peerId).name} can edit again.`)
    },
  })
})
