import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mediasoup from 'mediasoup';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

const app = express();
const server = createServer(app);

app.use(compression());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});
app.use(limiter);

const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 15000
});

// ==================== MEDIASOUP SETUP ====================
let worker;
let router;

const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000
    }
  },
  {
    kind: 'video',
    mimeType: 'video/VP9',
    clockRate: 90000,
    parameters: {
      'profile-id': 2,
      'x-google-start-bitrate': 1000
    }
  },
  {
    kind: 'video',
    mimeType: 'video/h264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '4d0032',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate': 1000
    }
  }
];

// ==================== STATE MANAGEMENT ====================
const rooms = new Map();
const peers = new Map();
const roomProducers = new Map();
const chatHistory = new Map();
const roomStartTime = new Map();

class RoomManager {
  static addUser(roomId, socketId, name) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
      chatHistory.set(roomId, []);
      roomStartTime.set(roomId, Date.now());
      roomProducers.set(roomId, new Map());
    }
    rooms.get(roomId).add(socketId);
    
    peers.set(socketId, {
      name,
      roomId,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map()
    });
  }

  static removeUser(socketId) {
    const peer = peers.get(socketId);
    if (peer) {
      if (roomProducers.has(peer.roomId)) {
        const roomProds = roomProducers.get(peer.roomId);
        peer.producers.forEach((producer, producerId) => {
          roomProds.delete(producerId);
        });
      }

      peer.producers.forEach(producer => producer.close());
      peer.transports.forEach(transport => transport.close());
      
      if (rooms.has(peer.roomId)) {
        rooms.get(peer.roomId).delete(socketId);
        if (rooms.get(peer.roomId).size === 0) {
          rooms.delete(peer.roomId);
          chatHistory.delete(peer.roomId);
          roomStartTime.delete(peer.roomId);
          roomProducers.delete(peer.roomId);
        }
      }
      peers.delete(socketId);
    }
  }

  static addProducer(roomId, producerId, producerInfo) {
    if (!roomProducers.has(roomId)) {
      roomProducers.set(roomId, new Map());
    }
    roomProducers.get(roomId).set(producerId, producerInfo);
  }

  static removeProducer(roomId, producerId) {
    if (roomProducers.has(roomId)) {
      roomProducers.get(roomId).delete(producerId);
    }
  }

  static getRoomProducers(roomId) {
    return roomProducers.get(roomId) || new Map();
  }

  static getRoomUsers(roomId) {
    if (!rooms.has(roomId)) return [];
    return Array.from(rooms.get(roomId)).map(socketId => ({
      id: socketId,
      name: peers.get(socketId)?.name || 'Unknown'
    }));
  }

  static addChatMessage(roomId, message) {
    if (!chatHistory.has(roomId)) {
      chatHistory.set(roomId, []);
    }
    const history = chatHistory.get(roomId);
    history.push(message);
    if (history.length > 100) {
      history.shift();
    }
    return history;
  }

  static getChatHistory(roomId) {
    return chatHistory.get(roomId) || [];
  }

  static getRoomStartTime(roomId) {
    return roomStartTime.get(roomId) || Date.now();
  }
}

async function initMediasoup() {
  try {
    worker = await mediasoup.createWorker({
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp']
    });

    worker.on('died', () => {
      console.error('Mediasoup worker died');
      process.exit(1);
    });

    router = await worker.createRouter({ mediaCodecs });
    console.log('✅ Mediasoup router created');
  } catch (error) {
    console.error('Failed to initialize Mediasoup:', error);
    process.exit(1);
  }
}

async function createWebRtcTransport() {
  const transport = await router.createWebRtcTransport({
    listenIps: [
      { 
        ip: '0.0.0.0', 
        announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1'
      }
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000
  });

  transport.on('dtlsstatechange', (dtlsState) => {
    if (dtlsState === 'closed') {
      transport.close();
    }
  });

  return transport;
}

io.on('connection', (socket) => {
  console.log(`👤 Connected: ${socket.id}`);

  socket.on('join-room', ({ roomId, name }, callback = () => {}) => {
    try {
      if (!roomId?.trim() || !name?.trim()) {
        callback({ error: 'Invalid room ID or name' });
        return;
      }

      socket.join(roomId);
      RoomManager.addUser(roomId, socket.id, name.trim());

      socket.emit('meeting-start-time', RoomManager.getRoomStartTime(roomId));
      socket.emit('chat-history', RoomManager.getChatHistory(roomId));

      socket.to(roomId).emit('user-joined', {
        userId: socket.id,
        name: name.trim(),
        cameraOn: false,
        audioOn: false,
        screenShareOn: false
      });

      const existingUsers = RoomManager.getRoomUsers(roomId)
        .filter(user => user.id !== socket.id);

      const existingProducers = Array.from(RoomManager.getRoomProducers(roomId).values());

      console.log(`📤 ${name} joining: ${existingUsers.length} users, ${existingProducers.length} producers`);

      callback({
        rtpCapabilities: router.rtpCapabilities,
        existingUsers,
        existingProducers
      });

      console.log(`✅ ${name} joined room ${roomId}`);
    } catch (error) {
      console.error('Error joining room:', error);
      callback({ error: error.message });
    }
  });

  socket.on('chat-message', ({ roomId, message, name }) => {
    const peer = peers.get(socket.id);
    if (!peer || !message?.trim()) return;

    const chatMessage = {
      name: peer.name,
      message: message.trim(),
      timestamp: Date.now()
    };

    RoomManager.addChatMessage(roomId, chatMessage);
    io.to(roomId).emit('chat-message', chatMessage);
  });

  socket.on('media-status-change', ({ cameraOn, audioOn, screenShareOn }) => {
    const peer = peers.get(socket.id);
    if (!peer) return;

    io.to(peer.roomId).emit('media-status-change', {
      userId: socket.id,
      cameraOn,
      audioOn,
      screenShareOn
    });
  });

  socket.on('start-screen-share', () => {
    const peer = peers.get(socket.id);
    if (peer) {
      io.to(peer.roomId).emit('user-started-screen-share', {
        userId: socket.id,
        name: peer.name
      });
    }
  });

  socket.on('stop-screen-share', () => {
    const peer = peers.get(socket.id);
    if (peer) {
      io.to(peer.roomId).emit('user-stopped-screen-share', {
        userId: socket.id,
        name: peer.name
      });
    }
  });

  socket.on('create-transport', async (callback = () => {}) => {
    try {
      const transport = await createWebRtcTransport();
      const peer = peers.get(socket.id);
      if (peer) {
        peer.transports.set(transport.id, transport);
      }

      callback({
        transportId: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      });
    } catch (error) {
      console.error('Error creating transport:', error);
      callback({ error: error.message });
    }
  });

  socket.on('connect-transport', async ({ transportId, dtlsParameters }, callback = () => {}) => {
    try {
      const peer = peers.get(socket.id);
      const transport = peer?.transports.get(transportId);
      
      if (!transport) {
        callback({ error: 'Transport not found' });
        return;
      }

      await transport.connect({ dtlsParameters });
      callback({ success: true });
    } catch (error) {
      console.error('Error connecting transport:', error);
      callback({ error: error.message });
    }
  });

  socket.on('produce', async ({ transportId, kind, rtpParameters, appData }, callback = () => {}) => {
    try {
      const peer = peers.get(socket.id);
      const transport = peer?.transports.get(transportId);
      
      if (!transport) {
        callback({ error: 'Transport not found' });
        return;
      }

      const producer = await transport.produce({
        kind,
        rtpParameters,
        appData: {
          ...appData,
          userId: socket.id,
          name: peer.name
        }
      });

      peer.producers.set(producer.id, producer);

      RoomManager.addProducer(peer.roomId, producer.id, {
        producerId: producer.id,
        userId: socket.id,
        name: peer.name,
        kind,
        appData: producer.appData
      });

      producer.on('transportclose', () => {
        peer.producers.delete(producer.id);
        RoomManager.removeProducer(peer.roomId, producer.id);
      });

      callback({ producerId: producer.id });

      socket.to(peer.roomId).emit('new-producer', {
        producerId: producer.id,
        userId: socket.id,
        name: peer.name,
        kind,
        appData: producer.appData
      });

      console.log(`📤 ${peer.name} producing ${kind} (${appData.isScreenShare ? 'screen' : appData.isAudio ? 'audio' : 'camera'})`);
    } catch (error) {
      console.error('Error producing:', error);
      callback({ error: error.message });
    }
  });

  socket.on('close-producer', ({ producerId }, callback = () => {}) => {
    try {
      const peer = peers.get(socket.id);
      const producer = peer?.producers.get(producerId);
      
      if (producer) {
        producer.close();
        peer.producers.delete(producerId);
        RoomManager.removeProducer(peer.roomId, producerId);
        
        socket.to(peer.roomId).emit('producer-closed', {
          producerId,
          userId: socket.id
        });
      }
      
      callback({ success: true });
    } catch (error) {
      callback({ error: error.message });
    }
  });

  socket.on('consume', async ({ transportId, producerId, rtpCapabilities }, callback = () => {}) => {
    try {
      const peer = peers.get(socket.id);
      const transport = peer?.transports.get(transportId);
      
      if (!transport) {
        callback({ error: 'Transport not found' });
        return;
      }

      let producer = null;
      for (const [peerId, p] of peers) {
        if (p.producers.has(producerId)) {
          producer = p.producers.get(producerId);
          break;
        }
      }

      if (!producer) {
        callback({ error: 'Producer not found' });
        return;
      }

      if (!router.canConsume({ producerId, rtpCapabilities })) {
        callback({ error: 'Cannot consume this producer' });
        return;
      }

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: false
      });

      peer.consumers.set(consumer.id, consumer);

      consumer.on('transportclose', () => {
        peer.consumers.delete(consumer.id);
      });

      callback({
        consumerId: consumer.id,
        producerId: producer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        appData: producer.appData
      });
    } catch (error) {
      console.error('Error consuming:', error);
      callback({ error: error.message });
    }
  });

  socket.on('resume-consumer', async ({ consumerId }, callback = () => {}) => {
    try {
      const peer = peers.get(socket.id);
      const consumer = peer?.consumers.get(consumerId);
      
      if (consumer) {
        await consumer.resume();
      }
      
      callback({ success: true });
    } catch (error) {
      callback({ error: error.message });
    }
  });

  socket.on('ping-from-client', () => {
    socket.emit('pong-from-server', Date.now());
  });

  socket.on('disconnect', () => {
    console.log(`👋 Disconnected: ${socket.id}`);
    
    const peer = peers.get(socket.id);
    if (peer) {
      socket.to(peer.roomId).emit('user-left', socket.id);
      RoomManager.removeUser(socket.id);
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    rooms: rooms.size,
    peers: peers.size,
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  await initMediasoup();
  
  server.listen(PORT, () => {
    console.log(`🚀 Mediasoup server running on port ${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
  });
}

startServer().catch(console.error);