import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const SOCKET_SERVER = 'https://video-chat-websocket-server.onrender.com';

function VideoRoom() {
  const [peers, setPeers] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [stream, setStream] = useState(null);
  const [roomLink, setRoomLink] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  
  const socketRef = useRef();
  const userVideo = useRef();
  const peersRef = useRef([]);
  const { roomId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER);
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(currentStream => {
        setStream(currentStream);
        userVideo.current.srcObject = currentStream;
        setRoomLink(window.location.href);
        
        socketRef.current.emit('join-room', roomId);
        
        socketRef.current.on('user-connected', userId => {
          const peer = createPeer(userId, socketRef.current.id, currentStream);
          peersRef.current.push({
            peerId: userId,
            peer,
          });
          setPeers(users => [...users, { peerId: userId, peer }]);
        });

        socketRef.current.on('receive-signal', payload => {
          const item = peersRef.current.find(p => p.peerId === payload.callerID);
          if (item) {
            item.peer.signal(payload.signal);
          }
        });

        socketRef.current.on('receiving-returned-signal', payload => {
          const item = peersRef.current.find(p => p.peerId === payload.id);
          if (item) {
            item.peer.signal(payload.signal);
          }
        });

        socketRef.current.on('user-disconnected', userId => {
          const peerObj = peersRef.current.find(p => p.peerId === userId);
          if (peerObj) {
            peerObj.peer.destroy();
            peersRef.current = peersRef.current.filter(p => p.peerId !== userId);
            setPeers(peers => peers.filter(p => p.peerId !== userId));
          }
        });
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      socketRef.current.disconnect();
      peersRef.current.forEach(({ peer }) => {
        peer.destroy();
      });
    };
  }, [roomId]);

  function createPeer(userToSignal, callerID, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on('signal', signal => {
      socketRef.current.emit('sending-signal', { userToSignal, callerID, signal });
    });

    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on('signal', signal => {
      socketRef.current.emit('return-signal', { signal, callerID });
    });

    peer.signal(incomingSignal);

    return peer;
  }

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(roomLink);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const endCall = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    socketRef.current.disconnect();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={copyRoomLink}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              {showCopied ? 'Copied!' : 'Copy Room Link'}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <video
              ref={userVideo}
              autoPlay
              playsInline
              muted
              className="w-full bg-black rounded"
            />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
              <button
                onClick={toggleMute}
                className={`${
                  isMuted ? 'bg-red-500' : 'bg-gray-700'
                } text-white px-4 py-2 rounded hover:bg-red-600`}
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                onClick={toggleVideo}
                className={`${
                  isVideoOff ? 'bg-red-500' : 'bg-gray-700'
                } text-white px-4 py-2 rounded hover:bg-red-600`}
              >
                {isVideoOff ? 'Start Video' : 'Stop Video'}
              </button>
              <button
                onClick={endCall}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                End Call
              </button>
            </div>
          </div>
          {peers.map((peer) => (
            <Video key={peer.peerId} peer={peer.peer} />
          ))}
        </div>
      </div>
    </div>
  );
}

const Video = ({ peer }) => {
  const ref = useRef();

  useEffect(() => {
    peer.on('stream', stream => {
      ref.current.srcObject = stream;
    });
  }, [peer]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      className="w-full bg-black rounded"
    />
  );
};

export default VideoRoom;