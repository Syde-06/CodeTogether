import type { ConnectionConfig } from '../sync/share'
import type { HostMeta, JoinRequest, JoinResponse } from './types'
import { effectScope, watchEffect } from 'reactive-vscode'
import { ProgressLocation, window } from 'vscode'
import * as Y from 'yjs'
import { useGuestDiagnostics } from '../diagnostics/guest'
import { useGuestFs } from '../fs/guest'
import { useGuestLs } from '../ls/guest'
import { useGuestRpc } from '../rpc/guest'
import { useGuestScm } from '../scm/guest'
import { useConnection } from '../sync/connection'
import { useDocSync } from '../sync/doc'
import { useGuestTerminals } from '../terminal/guest'
import { useTunnels } from '../tunnel'
import { useUsers } from '../ui/users'
import { useWebview } from '../webview'
import { onSessionClosed, ProtocolVersion } from './index'

export async function createGuestSession(config: ConnectionConfig) {
  const scope = effectScope(true)
  const connection = scope.run(() => useConnection(config))!
  await connection.ready

  const [_, recvInit] = connection.makeAction<Uint8Array, HostMeta>('init')
  const { userName } = useUsers()
  const [sendJoinRequest, recvJoinResponse] = connection.makeAction<JoinRequest | JoinResponse>('joinCtl')
  const joinResponse = await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: 'CodeTogether: Waiting for host approval...',
      cancellable: true,
    },
    (_progress, token) => new Promise<JoinResponse | null>((resolve) => {
      token.onCancellationRequested(() => resolve(null))
      const timeoutId = setTimeout(() => {
        resolve({
          accepted: false,
          reason: 'The host did not respond to your join request.',
        })
      }, 60000)
      recvJoinResponse((message) => {
        const response = message as JoinResponse
        if (typeof response.accepted === 'boolean') {
          clearTimeout(timeoutId)
          resolve(response)
        }
      })
      sendJoinRequest({
        name: userName.value || 'Guest',
      })
    }),
  )
  if (!joinResponse?.accepted) {
    if (joinResponse?.reason) {
      await window.showErrorMessage('CodeTogether: Join request denied.', {
        modal: true,
        detail: joinResponse.reason,
      })
    }
    return null
  }

  const initResult = await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: 'CodeTogether: Joining session...',
      cancellable: true,
    },
    (_progress, token) => new Promise<null | [Uint8Array, string, HostMeta]>((resolve) => {
      token.onCancellationRequested(() => resolve(null))
      const timeoutId = setTimeout(async () => {
        const res = await window.showErrorMessage(
          'CodeTogether: No host found at 15 seconds.',
          {
            modal: true,
            detail: 'Please make sure the host is online and you have the correct connection link.',
          },
          'Continue Waiting',
        )
        if (!res) {
          resolve(null)
        }
      }, 15000)
      recvInit((data, hostId, hostMeta) => {
        resolve([data, hostId, hostMeta!])
        clearTimeout(timeoutId)
      })
    }),
  )
  if (!initResult) {
    return null
  }
  const [initUpdate, hostId, hostMeta] = initResult

  if (!ProtocolVersion.includes(hostMeta.version)) {
    await window.showErrorMessage(
      'CodeTogether: Incompatible host version.',
      {
        modal: true,
        detail: `Host version: ${hostMeta.version}.\nLocal version: ${ProtocolVersion}.`,
      },
    )
    return null
  }

  return scope.run(() => {
    const doc = new Y.Doc()
    useDocSync(connection, doc)
    Y.applyUpdateV2(doc, initUpdate)

    const permissions = doc.getMap<{ canEdit: boolean }>('permissions')
    const canEdit = () => permissions.get(connection.selfId)?.canEdit !== false
    const [_, recvSessionControl] = connection.makeAction<{ type: 'kick', reason?: string }>('sessionCtl')
    recvSessionControl((message, peerId) => {
      if (peerId !== hostId || message.type !== 'kick') {
        return
      }
      onSessionClosed({
        title: 'CodeTogether: You were removed from the session.',
        detail: message.reason || 'The host removed you from this collaboration session.',
      }, false)
    })

    const rpc = useGuestRpc(connection, hostId)
    useGuestFs(connection, rpc, hostId, canEdit)
    const { shadowTerminals } = useGuestTerminals(connection, doc, rpc, hostId)
    useGuestLs(connection, hostId)
    useGuestDiagnostics(doc)
    useGuestScm(doc, rpc)
    const tunnels = useTunnels(connection, doc)
    useWebview().useChat(connection)
    useUsers().useCurrentUser(connection, doc)

    watchEffect(() => {
      if (!connection.peers.value.includes(hostId)) {
        setTimeout(() => {
          onSessionClosed({
            title: 'CodeTogether: Host has disconnected.',
            detail: 'This may be due to network issues, or the host may have closed the session.',
          })
        })
      }
    })

    return {
      role: 'guest' as const,
      hostId,
      hostMeta,
      connection,
      doc,
      scope,
      shadowTerminals,
      tunnels,
    }
  })!
}
