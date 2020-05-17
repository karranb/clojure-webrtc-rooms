import { v4 as uuidv4 } from 'uuid'

import { WEBRTC_SERVER, TITLES } from '_constants'

const server = { urls: WEBRTC_SERVER }

const DEFAULT = () => ({
  pc: new RTCPeerConnection({ iceServers: [server] }),
  id: uuidv4(),
  roomId: null,
  sendSocketMessage: null,
  connection: null,
})

const PeerConnection = (config = {}) => {
  let channel = null
  let userId = null

  const constructor = (_config = {}) => {
    const state = {
      ...DEFAULT(),
      ..._config,
    }
    const { pc, id, sendSocketMessage, onMessage, onOpen } = state

    const updateOnOpen = fn => {
      if (channel) {
        channel.onopen = () => {
          console.log('Channel Opened')
          fn()
        }
      }
      return constructor({ ...state, onOpen: fn })
    }

    const updateOnMessage = fn => {
      if (channel) {
        channel.onmessage = e => {
          console.log('Channel message', channel, e.data)
          fn(e)
        }
      }
      return constructor({ ...state, onMessage: fn })
    }

    pc.ondatachannel = ({ channel: _channel }) => {
      channel = _channel
      return constructor({ ...state })
        .updateOnMessage(onMessage)
        .updateOnOpen(onOpen)
    }

    pc.oniceconnectionstatechange = e => {
      if (pc.iceConnectionState === 'disconnected') {
        const data = {
          title: TITLES.CONNECTION_CLOSED,
          connectionId: id,
          roomId,
        }
        sendSocketMessage(data)
      }
    }

    const newChannelRequest = roomId => {
      channel = pc.createDataChannel('chat')

      pc.createOffer()
        .then(d => pc.setLocalDescription(d))
        .catch(console.log)

      pc.onicecandidate = e => {
        if (e.candidate) return
        sendSocketMessage({
          title: 'CONNECTION-REQUEST',
          offer: pc.localDescription.sdp,
          roomId,
          connectionId: id,
        })
      }
      return constructor({ ...state, pc })
        .updateOnMessage(onMessage)
        .updateOnOpen(onOpen)
    }

    const setChannelResponse = answer => {
      const desc = new RTCSessionDescription({ type: 'answer', sdp: answer })
      pc.setRemoteDescription(desc).catch(console.log)
      return constructor({ ...state, pc })
    }

    const newChannelResponse = (offer, _id) => {
      const desc = new RTCSessionDescription({ type: 'offer', sdp: offer })

      pc.setRemoteDescription(desc)
        .then(() => pc.createAnswer())
        .then(d => pc.setLocalDescription(d))
        .catch(console.log)

      pc.onicecandidate = e => {
        if (e.candidate) return
        const data = {
          title: TITLES.CONNECTION_ANSWER,
          answer: pc.localDescription.sdp,
          connectionId: _id,
        }
        sendSocketMessage(data)
      }
      return constructor({ ...state, pc, id: _id })
    }

    const getId = () => id

    const closeChannel = () => {
      pc.close()
    }

    const sendPeerMessage = (title, messageObject = {}) => {
      channel.send(JSON.stringify({ title, ...messageObject }))
    }


    const setUserId = _id => {
      userId = _id
    }

    const getUserId = () => {
      return userId
    }


    return {
      closeChannel,
      getId,
      getUserId,
      newChannelRequest,
      newChannelResponse,
      sendPeerMessage,
      setChannelResponse,
      setUserId,
      updateOnMessage,
      updateOnOpen,
    }
  }
  return constructor({ ...config })
}

export default PeerConnection