import type { ConnectionConfig } from '../sync/share'
import type { HostMeta, JoinRequest, JoinResponse } from './types'
import process from 'node:process'
import { effectScope, watch } from 'reactive-vscode'
import { window } from 'vscode'
import * as Y from 'yjs'
import { configs } from '../configs'
import { useHostDiagnostics } from '../diagnostics/host'
import { useHostFs } from '../fs/host'
import { useHostLs } from '../ls/host'
import { useHostRpc } from '../rpc/host'
import { useHostScm } from '../scm/host'
import { useConnection } from '../sync/connection'
import { useDocSync } from '../sync/doc'
import { useHostTerminals } from '../terminal/host'
import { useTunnels } from '../tunnel'
import { useUsers } from '../ui/users'
import { useWebview } from '../webview'
import { ProtocolVersion } from './index'

export async function createHostSession(config: ConnectionConfig) {
  const scope = effectScope(true)
  const connection = scope.run(() => useConnection(config))!
  await connection.ready

  const doc = new Y.Doc()

  return scope.run(() => {
    useDocSync(connection, doc)

    const hostMeta: HostMeta = {
      version: ProtocolVersion,
      os: process.platform,
    }
    const [sendInit] = connection.makeAction<Uint8Array, HostMeta>('init')
    const [sendJoinResponse, recvJoinRequest] = connection.makeAction<JoinResponse | JoinRequest>('joinCtl')
    const approvedPeers = new Set<string>()
    const pendingPeers = new Set<string>()
    const bannedNames = doc.getMap<boolean>('bans')
    const permissions = doc.getMap<{ canEdit: boolean }>('permissions')

    recvJoinRequest(async (request, peerId) => {
      const { name } = request as JoinRequest
      if (pendingPeers.has(peerId) || approvedPeers.has(peerId)) {
        return
      }

      pendingPeers.add(peerId)
      try {
        if (bannedNames.get(name)) {
          await sendJoinResponse({
            accepted: false,
            reason: 'The host has removed this user from the session.',
          }, peerId)
          return
        }

        let accepted = true
        if (configs.approveGuests !== false) {
          const response = await window.showInformationMessage(
            `${name} wants to join your CodeTogether session.`,
            { modal: false },
            'Allow',
            'Allow View-Only',
            'Deny',
          )
          accepted = response === 'Allow' || response === 'Allow View-Only'
          if (response === 'Allow View-Only') {
            permissions.set(peerId, { canEdit: false })
          }
        }

        if (!accepted) {
          await sendJoinResponse({
            accepted: false,
            reason: 'The host denied your request to join.',
          }, peerId)
          return
        }

        if (!permissions.has(peerId)) {
          permissions.set(peerId, { canEdit: configs.defaultGuestCanEdit !== false })
        }
        approvedPeers.add(peerId)
        await sendJoinResponse({ accepted: true }, peerId)
        await sendInit(Y.encodeStateAsUpdateV2(doc), peerId, hostMeta)
      }
      finally {
        pendingPeers.delete(peerId)
      }
    })

    watch(connection.peers, (newPeers, oldPeers) => {
      for (const peerId of oldPeers || []) {
        if (!newPeers.includes(peerId)) {
          approvedPeers.delete(peerId)
          pendingPeers.delete(peerId)
        }
      }
    }, { immediate: true })

    const fs = useHostFs(connection, doc)
    const terminals = useHostTerminals(connection, doc)
    const scm = useHostScm(connection, doc)
    useHostRpc(connection, {
      ...fs,
      ...terminals,
      ...scm,
    })
    useHostLs(connection)
    useHostDiagnostics(connection, doc)
    const tunnels = useTunnels(connection, doc)
    useWebview().useChat(connection)
    useUsers().useCurrentUser(connection, doc)

    return {
      role: 'host' as const,
      hostId: connection.selfId,
      hostMeta,
      connection,
      doc,
      scope,
      shadowTerminals: terminals.shadowTerminals,
      tunnels,
    }
  })!
}
