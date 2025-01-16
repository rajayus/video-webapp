const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.send('WebSocket Server is running');
});

io.on('connection', socket => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', roomId => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', socket.id);
    console.log(`User ${socket.id} joined room ${roomId}`);

    socket.on('sending-signal', payload => {
      io.to(payload.userToSignal).emit('receive-signal', { signal: payload.signal, callerID: socket.id });
    });

    socket.on('return-signal', payload => {
      io.to(payload.callerID).emit('receiving-returned-signal', { signal: payload.signal, id: socket.id });
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.id} disconnected from room ${roomId}`);
      socket.to(roomId).emit('user-disconnected', socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});