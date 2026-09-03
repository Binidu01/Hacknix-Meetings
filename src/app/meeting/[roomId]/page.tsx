'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import * as mediasoupClient from 'mediasoup-client';
import { 
  Mic, MicOff, Video, VideoOff, MessageSquare, Copy, 
  PhoneOff, Monitor, MonitorOff, Clock, Users, X,
  Shield, Wifi, WifiOff, Maximize2, Minimize2,
  ChevronLeft, ChevronRight
} from 'lucide-react';

const SOCKET_SERVER_URL = 'http://localhost:3001';

let socketInstance: any = null;
let deviceInstance: any = null;
let sendTransportInstance: any = null;
let recvTransportInstance: any = null;
let producersInstance: Map<string, any> = new Map();
let consumersInstance: Map<string, any> = new Map();
let isInitialized = false;
let socketReady = false;

interface ChatMessage {
  name: string;
  message: string;
  timestamp: number;
}

interface Participant {
  id: string;
  name: string;
  cameraStream?: MediaStream;
  screenStream?: MediaStream;
  screenAudioStream?: MediaStream;
  cameraOn: boolean;
  audioOn: boolean;
  screenShareOn: boolean;
}

const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hrs > 0
    ? `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 45%)`;
};

// Zoom/Meet-style adaptive tile grid: picks a column/row count that keeps
// tiles legible instead of shrinking indefinitely as people join.
const getGridDimensions = (count: number): { cols: number; rows: number } => {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  if (count <= 12) return { cols: 4, rows: 3 };
  return { cols: 4, rows: 4 };
};

export default function MeetingPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meetingTime, setMeetingTime] = useState(0);
  const [meetingStartTime, setMeetingStartTime] = useState<number | null>(null);
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('Guest');
  const [isReady, setIsReady] = useState(false);
  const [notification, setNotification] = useState<{name: string, message: string} | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [galleryPage, setGalleryPage] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initRef = useRef(false);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check scroll position for arrows
  const checkScrollPosition = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 4);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 4);
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition);
      // Check after render
      setTimeout(checkScrollPosition, 100);
      return () => container.removeEventListener('scroll', checkScrollPosition);
    }
  }, [participants, checkScrollPosition]);

  // Auto-hide controls after 5 seconds of inactivity
  const resetInactivityTimer = useCallback(() => {
    setControlsVisible(true);
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }
    inactivityTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 5000);
  }, []);

  const handleUserInteraction = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  useEffect(() => {
    resetInactivityTimer();
    return () => {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [resetInactivityTimer]);

  // Show notification when chat message received
  useEffect(() => {
    if (chat.length > 0) {
      const lastMessage = chat[chat.length - 1];
      if (lastMessage.name !== name) {
        setNotification({
          name: lastMessage.name,
          message: lastMessage.message
        });
        resetInactivityTimer();

        if (notificationTimeoutRef.current) {
          clearTimeout(notificationTimeoutRef.current);
        }
        notificationTimeoutRef.current = setTimeout(() => {
          setNotification(null);
        }, 5000);
      }
    }
  }, [chat, name, resetInactivityTimer]);

  // Timer
  useEffect(() => {
    if (meetingStartTime) {
      const updateTimer = () => {
        setMeetingTime(Math.floor((Date.now() - meetingStartTime) / 1000));
      };
      updateTimer();
      timerIntervalRef.current = setInterval(updateTimer, 1000);
      return () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      };
    }
  }, [meetingStartTime]);

  const safePlay = async (element: HTMLMediaElement) => {
    try {
      if (element && element.srcObject) {
        await element.play();
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        console.log('Play interrupted');
      } else {
        console.warn('Play error:', err);
      }
    }
  };

  const consumeProducer = useCallback(async (producerId: string, userId: string, appData: any) => {
    if (!recvTransportInstance || !deviceInstance) return;

    socketInstance.emit('consume', {
      transportId: recvTransportInstance.id,
      producerId,
      rtpCapabilities: deviceInstance.rtpCapabilities
    }, async (consumeRes: any) => {
      if (consumeRes?.error) {
        console.error('Consume error:', consumeRes.error);
        return;
      }

      try {
        const consumer = await recvTransportInstance.consume({
          id: consumeRes.consumerId,
          producerId: consumeRes.producerId,
          kind: consumeRes.kind,
          rtpParameters: consumeRes.rtpParameters
        });

        consumersInstance.set(consumeRes.consumerId, {
          consumer,
          producerId,
          userId,
          isScreenShare: appData?.isScreenShare || false,
          isAudio: appData?.isAudio || false,
          kind: consumeRes.kind
        });

        const stream = new MediaStream([consumer.track]);

        setParticipants(prev => {
          const updated = prev.map(p => {
            if (p.id === userId) {
              if (appData?.isScreenShare && appData?.isAudio) {
                return { ...p, screenAudioStream: stream };
              } else if (appData?.isScreenShare && !appData?.isAudio) {
                return { ...p, screenStream: stream, screenShareOn: true };
              } else if (!appData?.isScreenShare && consumer.kind === 'video') {
                return { ...p, cameraStream: stream, cameraOn: true };
              } else if (!appData?.isScreenShare && consumer.kind === 'audio') {
                return { ...p, cameraStream: stream, audioOn: true };
              }
            }
            return p;
          });
          return updated;
        });

        socketInstance.emit('resume-consumer', { consumerId: consumeRes.consumerId });
      } catch (err) {
        console.error('Error consuming:', err);
      }
    });
  }, []);

  useEffect(() => {
    if (initRef.current || isInitialized) return;
    initRef.current = true;

    const pathSegments = window.location.pathname.split('/');
    const currentRoomId = pathSegments[pathSegments.length - 1] || 'room1';
    const currentName = new URLSearchParams(window.location.search).get('name') || 'Guest';
    
    setRoomId(currentRoomId);
    setName(currentName);

    const initializeMeeting = async () => {
      try {
        socketInstance = io(SOCKET_SERVER_URL, {
          transports: ['websocket', 'polling']
        });

        socketInstance.on('connect', () => {
          console.log('Connected to server');
          socketReady = true;
          
          socketInstance.emit('join-room', 
            { roomId: currentRoomId, name: currentName },
            async (response: any) => {
              if (response?.error) {
                setError(response.error);
                return;
              }

              try {
                deviceInstance = new mediasoupClient.Device();
                await deviceInstance.load({ routerRtpCapabilities: response.rtpCapabilities });

                socketInstance.emit('create-transport', async (transportRes: any) => {
                  if (transportRes?.error) return;

                  recvTransportInstance = deviceInstance.createRecvTransport({
                    id: transportRes.transportId,
                    iceParameters: transportRes.iceParameters,
                    iceCandidates: transportRes.iceCandidates,
                    dtlsParameters: transportRes.dtlsParameters
                  });

                  recvTransportInstance.on('connect', ({ dtlsParameters }, callback, errback) => {
                    socketInstance.emit('connect-transport',
                      { transportId: transportRes.transportId, dtlsParameters },
                      (res: any) => res?.error ? errback(new Error(res.error)) : callback()
                    );
                  });

                  console.log('Receive transport ready');
                  setIsReady(true);

                  if (response.existingUsers) {
                    setParticipants(response.existingUsers.map((u: any) => ({
                      id: u.id,
                      name: u.name,
                      cameraOn: false,
                      audioOn: false,
                      screenShareOn: false
                    })));
                  }

                  if (response.existingProducers && response.existingProducers.length > 0) {
                    console.log('Consuming existing producers:', response.existingProducers.length);
                    
                    setTimeout(async () => {
                      for (const producerInfo of response.existingProducers) {
                        await consumeProducer(
                          producerInfo.producerId,
                          producerInfo.userId,
                          producerInfo.appData
                        );
                      }
                    }, 100);
                  }
                });

                isInitialized = true;
              } catch (err) {
                console.error('Device init error:', err);
              }
            }
          );
        });

        socketInstance.on('meeting-start-time', (time: number) => setMeetingStartTime(time));
        socketInstance.on('chat-message', (msg: ChatMessage) => setChat(prev => [...prev, msg]));
        socketInstance.on('chat-history', (history: ChatMessage[]) => setChat(history));

        socketInstance.on('user-joined', ({ userId, name: userName }) => {
          setParticipants(prev => {
            if (prev.find(p => p.id === userId)) return prev;
            return [...prev, {
              id: userId,
              name: userName,
              cameraOn: false,
              audioOn: false,
              screenShareOn: false
            }];
          });
        });

        socketInstance.on('user-left', (userId: string) => {
          setParticipants(prev => prev.filter(p => p.id !== userId));
        });

        socketInstance.on('new-producer', async ({ producerId, userId, appData }) => {
          console.log('New producer:', producerId, 'from:', userId);
          await consumeProducer(producerId, userId, appData);
        });

        socketInstance.on('producer-closed', ({ producerId, userId }) => {
          let closedIsScreenShare = false;
          let closedIsAudio = false;
          
          for (const [consumerId, data] of consumersInstance) {
            if (data.producerId === producerId) {
              closedIsScreenShare = data.isScreenShare;
              closedIsAudio = data.isAudio;
              data.consumer.close();
              consumersInstance.delete(consumerId);
              break;
            }
          }

          setParticipants(prev => prev.map(p => {
            if (p.id === userId) {
              if (closedIsScreenShare && closedIsAudio) {
                return { ...p, screenAudioStream: undefined };
              } else if (closedIsScreenShare && !closedIsAudio) {
                return { ...p, screenShareOn: false, screenStream: undefined };
              } else if (!closedIsScreenShare && !closedIsAudio) {
                return { ...p, cameraOn: false, cameraStream: undefined };
              }
            }
            return p;
          }));
        });

        socketInstance.on('user-started-screen-share', ({ userId }) => {
          setParticipants(prev => prev.map(p => 
            p.id === userId ? { ...p, screenShareOn: true } : p
          ));
        });

        socketInstance.on('user-stopped-screen-share', ({ userId }) => {
          setParticipants(prev => prev.map(p => 
            p.id === userId ? { 
              ...p, 
              screenShareOn: false, 
              screenStream: undefined,
              screenAudioStream: undefined 
            } : p
          ));
        });

        socketInstance.on('error', ({ message }: any) => {
          setError(message);
          setTimeout(() => setError(null), 5000);
        });

        setInterval(() => {
          const start = Date.now();
          socketInstance.emit('ping-from-client');
          socketInstance.once('pong-from-server', () => {
            setLatency(Date.now() - start);
          });
        }, 3000);

      } catch (err) {
        console.error('Initialization error:', err);
      }
    };

    initializeMeeting();

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, [consumeProducer]);

  useEffect(() => {
    participants.forEach(p => {
      if (p.screenAudioStream) {
        const audioEl = audioElementsRef.current[`screen-${p.id}`];
        if (audioEl && audioEl.srcObject !== p.screenAudioStream) {
          audioEl.srcObject = p.screenAudioStream;
          safePlay(audioEl);
        }
      }
      
      if (p.cameraStream && p.audioOn) {
        const audioEl = audioElementsRef.current[`camera-${p.id}`];
        if (audioEl && audioEl.srcObject !== p.cameraStream) {
          audioEl.srcObject = p.cameraStream;
          safePlay(audioEl);
        }
      }
    });
  }, [participants]);

  const createSendTransport = useCallback(async () => {
    if (!socketReady || !socketInstance) {
      throw new Error('Connection not ready. Please wait.');
    }

    if (!deviceInstance) {
      throw new Error('Device not ready. Please wait.');
    }

    if (sendTransportInstance) return sendTransportInstance;

    return new Promise((resolve, reject) => {
      socketInstance.emit('create-transport', async (response: any) => {
        if (response?.error) {
          reject(response.error);
          return;
        }

        const transport = deviceInstance.createSendTransport({
          id: response.transportId,
          iceParameters: response.iceParameters,
          iceCandidates: response.iceCandidates,
          dtlsParameters: response.dtlsParameters
        });

        transport.on('connect', ({ dtlsParameters }, callback, errback) => {
          socketInstance.emit('connect-transport',
            { transportId: response.transportId, dtlsParameters },
            (res: any) => res?.error ? errback(new Error(res.error)) : callback()
          );
        });

        transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
          socketInstance.emit('produce', {
            transportId: response.transportId,
            kind,
            rtpParameters,
            appData
          }, (res: any) => {
            if (res?.error) errback(new Error(res.error));
            else callback({ id: res.producerId });
          });
        });

        sendTransportInstance = transport;
        resolve(transport);
      });
    });
  }, []);

  const toggleCamera = useCallback(async () => {
    if (!isReady || !socketReady) {
      setError('Please wait for connection...');
      return;
    }

    resetInactivityTimer();

    try {
      if (cameraOn) {
        const producer = producersInstance.get('camera');
        if (producer) {
          socketInstance.emit('close-producer', { producerId: producer.id });
          producer.close();
          producersInstance.delete('camera');
        }
        setCameraOn(false);
        setLocalCameraStream(null);
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user', 
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          },
          audio: false
        });

        setLocalCameraStream(stream);
        await createSendTransport();
        const track = stream.getVideoTracks()[0];
        const producer = await sendTransportInstance.produce({
          track,
          appData: { isScreenShare: false, isVideo: true },
          encodings: [
            { maxBitrate: 1500000 },
            { maxBitrate: 500000 },
            { maxBitrate: 150000 }
          ]
        });
        producersInstance.set('camera', producer);
        setCameraOn(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Failed to access camera. Please try again.');
      setCameraOn(false);
    }
  }, [cameraOn, createSendTransport, isReady, resetInactivityTimer]);

  const toggleAudio = useCallback(async () => {
    if (!isReady || !socketReady) {
      setError('Please wait for connection...');
      return;
    }

    resetInactivityTimer();

    try {
      if (audioOn) {
        const producer = producersInstance.get('audio');
        if (producer) {
          socketInstance.emit('close-producer', { producerId: producer.id });
          producer.close();
          producersInstance.delete('audio');
        }
        setAudioOn(false);
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 2
          }, 
          video: false 
        });
        await createSendTransport();
        const track = stream.getAudioTracks()[0];
        const producer = await sendTransportInstance.produce({
          track,
          appData: { isScreenShare: false, isAudio: true }
        });
        producersInstance.set('audio', producer);
        setAudioOn(true);
      }
    } catch (err) {
      console.error('Audio error:', err);
      setError('Failed to access microphone');
      setAudioOn(false);
    }
  }, [audioOn, createSendTransport, isReady, resetInactivityTimer]);

  const toggleScreenShare = useCallback(async () => {
    if (!isReady || !socketReady) {
      setError('Please wait for connection...');
      return;
    }

    resetInactivityTimer();

    try {
      if (screenShareOn) {
        const producer = producersInstance.get('screen');
        if (producer) {
          socketInstance.emit('close-producer', { producerId: producer.id });
          producer.close();
          producersInstance.delete('screen');
        }
        
        const audioProducer = producersInstance.get('screenAudio');
        if (audioProducer) {
          socketInstance.emit('close-producer', { producerId: audioProducer.id });
          audioProducer.close();
          producersInstance.delete('screenAudio');
        }
        
        setScreenShareOn(false);
        setLocalScreenStream(null);
        socketInstance.emit('stop-screen-share');
      } else {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: {
            frameRate: { ideal: 30, max: 60 },
            width: { ideal: 1920, max: 3840 },
            height: { ideal: 1080, max: 2160 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 48000,
            channelCount: 2
          }
        });
        
        setLocalScreenStream(stream);
        await createSendTransport();
        
        if (!sendTransportInstance) {
          throw new Error('Send transport not available');
        }
        
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const videoProducer = await sendTransportInstance.produce({
            track: videoTrack,
            appData: { isScreenShare: true, isVideo: true },
            encodings: [
              { maxBitrate: 4000000 },
              { maxBitrate: 1500000 },
              { maxBitrate: 500000 }
            ]
          });
          producersInstance.set('screen', videoProducer);
        }
        
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          try {
            const audioProducer = await sendTransportInstance.produce({
              track: audioTrack,
              appData: { isScreenShare: true, isAudio: true }
            });
            producersInstance.set('screenAudio', audioProducer);
            console.log('Screen share audio added');
          } catch (audioErr) {
            console.warn('Failed to add screen share audio:', audioErr);
          }
        }
        
        setScreenShareOn(true);
        socketInstance.emit('start-screen-share');

        videoTrack.onended = () => {
          ['screen', 'screenAudio'].forEach(key => {
            const p = producersInstance.get(key);
            if (p) {
              socketInstance.emit('close-producer', { producerId: p.id });
              p.close();
              producersInstance.delete(key);
            }
          });
          
          setScreenShareOn(false);
          setLocalScreenStream(null);
          socketInstance.emit('stop-screen-share');
        };
      }
    } catch (err) {
      console.error('Screen share error:', err);
      if ((err as Error)?.message?.includes('not ready')) {
        setError('Connection is still loading. Please wait a moment and try again.');
      } else {
        setError('Failed to share screen. Check "Share audio" option.');
      }
      setScreenShareOn(false);
    }
  }, [screenShareOn, createSendTransport, isReady, resetInactivityTimer]);

  const sendMessage = useCallback(() => {
    if (!message.trim() || !socketInstance) return;
    socketInstance.emit('chat-message', { roomId, message, name });
    setMessage('');
    resetInactivityTimer();
  }, [message, roomId, name, resetInactivityTimer]);

  const leaveMeeting = useCallback(() => {
    producersInstance.forEach(p => p.close());
    if (sendTransportInstance) sendTransportInstance.close();
    if (recvTransportInstance) recvTransportInstance.close();
    if (socketInstance) socketInstance.disconnect();
    window.location.href = '/';
  }, []);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
    resetInactivityTimer();
  }, [roomId, resetInactivityTimer]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const scrollParticipants = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const tiles = Array.from(container.children) as HTMLElement[];
    if (tiles.length === 0) return;

    // Find the tile currently sitting at (or just past) the left edge, then
    // target the next/previous tile's real offsetLeft directly — scrolling
    // to an actual tile position (not an accumulated delta) means there's
    // nothing for rounding drift to build up on.
    const currentIndex = tiles.findIndex(t => t.offsetLeft + t.offsetWidth > container.scrollLeft + 2);
    const fromIndex = currentIndex === -1 ? tiles.length - 1 : currentIndex;
    const targetIndex = direction === 'left'
      ? Math.max(0, fromIndex - 1)
      : Math.min(tiles.length - 1, fromIndex + 1);

    container.scrollTo({ left: tiles[targetIndex].offsetLeft, behavior: 'smooth' });
  };

  const isAnyoneScreenSharing = participants.some(p => p.screenShareOn);
  const screenSharer = participants.find(p => p.screenShareOn);

  const renderVideo = (stream: MediaStream | undefined, participantName: string, isScreen: boolean = false, size: 'small' | 'large' = 'large') => {
    const avatarSize = size === 'large' ? 'w-16 h-16 text-2xl' : 'w-10 h-10 text-base';
    const nameSize = size === 'large' ? 'text-sm' : 'text-[10px]';
    const maxWidth = size === 'large' ? 'max-w-[100px]' : 'max-w-[60px]';

    if (!stream) {
      return (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: `linear-gradient(145deg, ${stringToColor(participantName)}, #1a1a2e)` }}
        >
          <div className="text-center px-3">
            <div className={`${avatarSize} mx-auto rounded-full bg-white/5 backdrop-blur-sm flex items-center justify-center font-semibold text-white border border-white/10`}>
              {participantName[0].toUpperCase()}
            </div>
            <div className={`${nameSize} text-gray-300 font-medium truncate ${maxWidth} mt-0.5`}>
              {participantName}
            </div>
          </div>
        </div>
      );
    }

    return (
      <video
        autoPlay
        playsInline
        muted={participantName === name}
        className={`w-full h-full ${isScreen ? 'object-contain bg-[#0a0a0f]' : 'object-cover'}`}
        ref={(el) => {
          if (el && el.srcObject !== stream) {
            el.srcObject = stream;
          }
        }}
      />
    );
  };

  // Get all participants including self for the scrollable bar
  const allVideoFeeds = [
    { id: 'self', name, stream: localCameraStream, isSelf: true },
    ...participants.map(p => ({ 
      id: p.id, 
      name: p.name, 
      stream: p.cameraStream, 
      isSelf: false 
    }))
  ];

  // Adaptive gallery pagination: cap tiles-per-page so tiles never shrink
  // past a legible size — beyond that, page through with arrows (Zoom/Meet style).
  const TILES_PER_PAGE = isMobile ? 4 : 12;
  const totalPages = Math.max(1, Math.ceil(allVideoFeeds.length / TILES_PER_PAGE));
  const activePage = Math.min(galleryPage, totalPages - 1);
  const pageFeeds = allVideoFeeds.slice(
    activePage * TILES_PER_PAGE,
    activePage * TILES_PER_PAGE + TILES_PER_PAGE
  );
  const { cols: galleryCols, rows: galleryRows } = getGridDimensions(pageFeeds.length);

  const goToGalleryPage = (delta: number) => {
    setGalleryPage(prev => Math.max(0, Math.min(prev + delta, totalPages - 1)));
    resetInactivityTimer();
  };

  return (
    <div 
      className="flex flex-col h-screen bg-[#0a0a0f] text-white overflow-hidden"
      onMouseMove={handleUserInteraction}
      onTouchStart={handleUserInteraction}
      onClick={handleUserInteraction}
    >
      {/* Hidden audio elements */}
      <div className="hidden">
        {participants.map((p) => (
          <div key={`audio-${p.id}`}>
            {p.screenAudioStream && (
              <audio
                ref={(el) => {
                  if (el) {
                    audioElementsRef.current[`screen-${p.id}`] = el;
                    if (el.srcObject !== p.screenAudioStream) {
                      el.srcObject = p.screenAudioStream;
                    }
                  }
                }}
                autoPlay
                playsInline
              />
            )}
            {p.cameraStream && p.audioOn && (
              <audio
                ref={(el) => {
                  if (el) {
                    audioElementsRef.current[`camera-${p.id}`] = el;
                    if (el.srcObject !== p.cameraStream) {
                      el.srcObject = p.cameraStream;
                    }
                  }
                }}
                autoPlay
                playsInline
              />
            )}
          </div>
        ))}
      </div>

      {/* Message Notification */}
      {notification && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm animate-slide-up">
          <div className="bg-[#1e1e2f]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 border border-white/10"
                  style={{ background: `linear-gradient(145deg, ${stringToColor(notification.name)}, rgba(0,0,0,0.3))` }}
                >
                  {notification.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-xs text-indigo-300 truncate">{notification.name}</div>
                  <div className="text-xs text-gray-200 mt-0.5 break-words line-clamp-2">{notification.message}</div>
                </div>
              </div>
              <button 
                onClick={() => setNotification(null)}
                className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
            <button 
              onClick={() => {
                setShowChat(true);
                setNotification(null);
              }}
              className="mt-2 w-full text-center text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View in chat
            </button>
          </div>
        </div>
      )}

      {/* Premium Header */}
      <div className={`flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 bg-[#0a0a0f]/60 backdrop-blur-2xl border-b border-white/5 transition-all duration-300 ${!controlsVisible && isMobile ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex items-center space-x-2 min-w-0">
          <div className="flex items-center space-x-1.5">
            <Clock className="text-indigo-400 w-3.5 h-3.5" />
            <span className="font-mono text-xs font-medium text-gray-300 whitespace-nowrap">{formatTime(meetingTime)}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Users className="text-blue-400 w-3.5 h-3.5" />
            <span className="text-xs text-gray-400 whitespace-nowrap">{participants.length + 1}</span>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 min-w-0">
          <div className="hidden sm:block px-2 py-0.5 bg-white/5 rounded-lg border border-white/5">
            <span className="text-[10px] text-gray-500 font-mono truncate">{roomId}</span>
          </div>
          {latency !== null && (
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-medium ${
              latency < 50 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
              latency < 100 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 
              'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {latency < 100 ? <Wifi size={10} /> : <WifiOff size={10} />}
              <span className="hidden sm:inline">{latency}ms</span>
            </div>
          )}
          <button 
            onClick={toggleFullscreen}
            className="hidden sm:flex p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative" ref={mainContentRef}>
        {isAnyoneScreenSharing ? (
          isMobile ? (
            // Mobile screen share - camera feeds at top, screen share below
            <div className="w-full h-full flex flex-col bg-black">
              {/* Top bar with camera feeds - larger and scrollable */}
              <div className={`flex-shrink-0 bg-[#0a0a0f]/80 backdrop-blur-xl border-b overflow-hidden transition-all duration-300 ${!controlsVisible ? 'max-h-0 opacity-0 border-b-0' : 'max-h-28 opacity-100 border-white/5'}`}>
                <div className="relative px-2 py-2">
                  {/* Scrollable container — arrows below overlay this, they never resize it */}
                  <div 
                    ref={scrollContainerRef}
                    className="overflow-x-auto scrollbar-hide flex gap-2 py-1 snap-x snap-mandatory"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {allVideoFeeds.map((feed) => (
                      <div 
                        key={feed.id}
                        className={`flex-shrink-0 w-24 h-20 rounded-xl overflow-hidden bg-[#12121f] border-2 transition-all snap-start ${
                          feed.isSelf ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/20' : 'border-white/10'
                        }`}
                      >
                        {renderVideo(feed.stream, feed.name, false, 'small')}
                      </div>
                    ))}
                  </div>

                  {/* Left arrow - overlays the strip, shows only when needed */}
                  {showLeftArrow && (
                    <button 
                      onClick={() => scrollParticipants('left')}
                      className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-black/90 transition-all active:scale-95 z-10 shadow-lg"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  )}

                  {/* Right arrow - overlays the strip, shows only when needed */}
                  {showRightArrow && (
                    <button 
                      onClick={() => scrollParticipants('right')}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/70 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-black/90 transition-all active:scale-95 z-10 shadow-lg"
                    >
                      <ChevronRight size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Screen share - takes remaining space */}
              <div className="flex-1 bg-black overflow-hidden">
                {screenSharer && renderVideo(screenSharer.screenStream, screenSharer.name, true, 'large')}
              </div>
            </div>
          ) : (
            // Desktop screen share
            <div className="flex w-full h-full gap-2 p-2">
              <div className="w-1/5 lg:w-1/6 flex flex-col gap-1.5 min-w-[80px]">
                <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
                  {participants.map((p) => (
                    <div key={p.id} className="aspect-video rounded-lg overflow-hidden bg-[#12121f] border border-white/5 hover:border-indigo-500/30 transition-all">
                      {renderVideo(p.cameraStream, p.name, false, 'small')}
                    </div>
                  ))}
                </div>
                <div className="aspect-video rounded-lg overflow-hidden bg-[#12121f] border border-indigo-500/20">
                  {renderVideo(localCameraStream || undefined, name, false, 'small')}
                </div>
              </div>
              <div className="flex-1 bg-black rounded-xl overflow-hidden border border-white/5 shadow-2xl">
                {screenSharer && renderVideo(screenSharer.screenStream, screenSharer.name, true, 'large')}
              </div>
            </div>
          )
        ) : isMobile && allVideoFeeds.length === 2 ? (
          // 1:1 call on mobile — WhatsApp-style: the other person fills the
          // screen, your own camera sits in a small corner box.
          (() => {
            const other = allVideoFeeds.find(f => !f.isSelf)!;
            const otherParticipant = participants.find(p => p.id === other.id);
            const otherMicOff = !otherParticipant?.audioOn;

            return (
              <div className="w-full h-full relative bg-black">
                <div className="w-full h-full">
                  {renderVideo(other.stream, other.name, false, 'large')}
                </div>

                {/* Legibility gradient + name pill for the full-screen feed */}
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-4 flex items-center gap-1.5">
                  <span className="text-sm font-medium bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                    {other.name}
                  </span>
                  {otherMicOff && (
                    <div className="p-1 rounded-full bg-red-500/80 backdrop-blur-sm">
                      <MicOff size={12} />
                    </div>
                  )}
                </div>

                {/* Self PiP box */}
                <div className="absolute bottom-24 right-4 w-24 h-32 sm:w-28 sm:h-36 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-[#12121f]">
                  {renderVideo(localCameraStream || undefined, name, false, 'small')}
                  {!audioOn && (
                    <div className="absolute bottom-1 right-1 p-1 rounded-full bg-red-500/80">
                      <MicOff size={8} />
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          // Adaptive gallery grid — column/row count tracks participant count
          // (like Zoom/Meet) and pages through with arrows once tiles would
          // otherwise get too small to be useful.
          <div className="w-full h-full flex flex-col p-1.5 sm:p-4 gap-2 relative">
            <div
              className="flex-1 grid gap-1.5 sm:gap-3 min-h-0"
              style={{
                gridTemplateColumns: `repeat(${galleryCols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${galleryRows}, minmax(0, 1fr))`,
              }}
            >
              {pageFeeds.map((feed) => {
                const remoteParticipant = feed.isSelf
                  ? undefined
                  : participants.find(p => p.id === feed.id);
                const isActive = activeSpeakerId === feed.id;
                const isMicOff = feed.isSelf ? !audioOn : remoteParticipant ? !remoteParticipant.audioOn : true;
                const isSharing = remoteParticipant?.screenShareOn;

                return (
                  <div
                    key={feed.id}
                    className={`group relative rounded-xl sm:rounded-2xl overflow-hidden bg-[#12121f] border shadow-lg transition-all duration-300 ${
                      isActive
                        ? 'border-indigo-400/60 ring-2 ring-indigo-400/30 shadow-indigo-500/20'
                        : feed.isSelf
                        ? 'border-indigo-500/25 shadow-indigo-500/5'
                        : 'border-white/5 hover:border-white/10'
                    }`}
                  >
                    {renderVideo(feed.stream, feed.name, false, galleryCols >= 4 ? 'small' : 'large')}

                    {/* Legibility gradient for the name pill */}
                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 max-w-[85%]">
                      <span className="text-[10px] sm:text-xs font-medium bg-black/50 backdrop-blur-md px-2 py-0.5 sm:py-1 rounded-full border border-white/10 truncate">
                        {feed.name}{feed.isSelf ? <span className="text-gray-400"> (You)</span> : ''}
                      </span>
                    </div>

                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                      {isSharing && (
                        <span className="bg-emerald-500/20 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-[8px] font-medium text-emerald-400 border border-emerald-500/20">
                          Sharing
                        </span>
                      )}
                      {isMicOff && (
                        <div className="p-1 rounded-full bg-red-500/80 backdrop-blur-sm">
                          <MicOff size={10} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination arrows + page dots, shown only when tiles overflow one page */}
            {totalPages > 1 && (
              <>
                {activePage > 0 && (
                  <button
                    onClick={() => goToGalleryPage(-1)}
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white hover:bg-black/80 active:scale-95 transition-all z-10 shadow-xl"
                    title="Previous participants"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}
                {activePage < totalPages - 1 && (
                  <button
                    onClick={() => goToGalleryPage(1)}
                    className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white hover:bg-black/80 active:scale-95 transition-all z-10 shadow-xl"
                    title="Next participants"
                  >
                    <ChevronRight size={20} />
                  </button>
                )}
                <div className="flex justify-center gap-1.5 flex-shrink-0">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setGalleryPage(i); resetInactivityTimer(); }}
                      className={`h-1.5 rounded-full transition-all ${
                        i === activePage ? 'w-5 bg-indigo-400' : 'w-1.5 bg-white/20 hover:bg-white/30'
                      }`}
                      title={`Page ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Premium Controls */}
      <div className={`bg-[#0a0a0f]/70 backdrop-blur-2xl border-t border-white/5 px-2 sm:px-6 py-2 sm:py-3 flex justify-center items-center space-x-1 sm:space-x-2 transition-all duration-300 ${!controlsVisible && isMobile ? 'translate-y-full' : 'translate-y-0'}`}>
        <button 
          onClick={toggleAudio} 
          disabled={!isReady}
          className={`p-2.5 sm:p-3 rounded-full transition-all duration-200 ${
            audioOn 
              ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10' 
              : 'bg-red-500/80 hover:bg-red-500 text-white border border-red-500/30'
          } ${!isReady ? 'opacity-50 cursor-not-allowed' : ''} active:scale-95`}
          title={audioOn ? 'Mute' : 'Unmute'}
        >
          {audioOn ? <Mic size={isMobile ? 16 : 18} className="sm:w-5 sm:h-5" /> : <MicOff size={isMobile ? 16 : 18} className="sm:w-5 sm:h-5" />}
        </button>

        <button 
          onClick={toggleCamera} 
          disabled={!isReady}
          className={`p-2.5 sm:p-3 rounded-full transition-all duration-200 ${
            cameraOn 
              ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10' 
              : 'bg-red-500/80 hover:bg-red-500 text-white border border-red-500/30'
          } ${!isReady ? 'opacity-50 cursor-not-allowed' : ''} active:scale-95`}
          title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
        >
          {cameraOn ? <Video size={isMobile ? 16 : 18} className="sm:w-5 sm:h-5" /> : <VideoOff size={isMobile ? 16 : 18} className="sm:w-5 sm:h-5" />}
        </button>

        <button 
          onClick={toggleScreenShare} 
          disabled={!isReady}
          className={`p-2.5 sm:p-3 rounded-full transition-all duration-200 ${
            screenShareOn 
              ? 'bg-emerald-500/80 hover:bg-emerald-500 text-white border border-emerald-500/30' 
              : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
          } ${!isReady ? 'opacity-50 cursor-not-allowed' : ''} active:scale-95`}
          title={screenShareOn ? 'Stop screen share' : 'Share screen'}
        >
          {screenShareOn ? <MonitorOff size={isMobile ? 16 : 18} className="sm:w-5 sm:h-5" /> : <Monitor size={isMobile ? 16 : 18} className="sm:w-5 sm:h-5" />}
        </button>

        <div className="w-px h-6 bg-white/10"></div>

        <button 
          onClick={() => setShowChat(prev => !prev)} 
          className="p-2.5 sm:p-3 rounded-full bg-white/5 hover:bg-white/10 transition-all duration-200 relative border border-white/5 active:scale-95"
          title="Toggle chat"
        >
          <MessageSquare size={isMobile ? 16 : 18} className="sm:w-5 sm:h-5" />
          {!showChat && notification && (
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a0a0f]"></span>
          )}
        </button>

        <button 
          onClick={copyLink} 
          className="flex p-2.5 sm:p-3 rounded-full bg-white/5 hover:bg-white/10 transition-all duration-200 border border-white/5 active:scale-95"
          title="Copy meeting link"
        >
          <Copy size={isMobile ? 16 : 18} className="sm:w-5 sm:h-5" />
        </button>

        <div className="w-px h-6 bg-white/10"></div>

        <button 
          onClick={leaveMeeting} 
          className="px-3 sm:px-6 py-2 sm:py-3 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center gap-1 transition-all duration-200 font-medium text-xs sm:text-sm border border-red-500/30 active:scale-95"
        >
          <PhoneOff size={isMobile ? 14 : 16} className="sm:w-[18px] sm:h-[18px]" /> 
          <span className="hidden sm:inline">Leave</span>
          <span className="sm:hidden">Leave</span>
        </button>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-500/90 backdrop-blur-sm px-4 py-2.5 rounded-2xl shadow-2xl z-50 w-[92%] max-w-md border border-red-400/20">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-xs underline hover:no-underline flex-shrink-0 opacity-70 hover:opacity-100">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Chat Sidebar */}
      {showChat && (
        <div className="fixed top-0 right-0 h-full w-full sm:w-96 bg-[#0a0a0f]/95 backdrop-blur-2xl border-l border-white/5 z-50 shadow-2xl">
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/5">
              <h2 className="text-base font-semibold text-gray-100">Chat</h2>
              <button 
                onClick={() => setShowChat(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
              {chat.length === 0 ? (
                <div className="text-center text-gray-500 mt-8 text-sm">
                  No messages yet
                </div>
              ) : (
                chat.map((c, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 border border-white/10"
                      style={{ background: `linear-gradient(145deg, ${stringToColor(c.name)}, rgba(0,0,0,0.3))` }}
                    >
                      {c.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-xs text-indigo-300 truncate">{c.name}</span>
                        <span className="text-[10px] text-gray-500 flex-shrink-0">
                          {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs text-gray-200 mt-0.5 break-words">{c.message}</div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="px-3 py-3 border-t border-white/5">
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 rounded-full bg-white/5 border border-white/10 focus:outline-none focus:border-indigo-500/50 text-xs transition-all"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                />
                <button 
                  onClick={sendMessage} 
                  disabled={!message.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-full text-xs font-medium transition-all active:scale-95"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy Success */}
      {copySuccess && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-emerald-500/90 backdrop-blur-sm px-4 py-2.5 rounded-2xl shadow-2xl z-50 w-[92%] max-w-sm border border-emerald-400/20">
          <div className="flex items-center gap-2">
            <Copy size={14} />
            <span className="text-xs">Link copied to clipboard</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}