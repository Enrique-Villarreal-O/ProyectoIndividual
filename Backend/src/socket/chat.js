const socketIO = require('socket.io');
const Message = require('../models/Chat');

module.exports = (server) => {
  const io = socketIO(server);

  io.on('connection', (socket) => {
    socket.on('join', (userId) => {
      socket.join(userId);
    });

    socket.on('sendMessage', async (data) => {
      try {
        const { sender, receiver, message } = data;
        const newMessage = await Message.create({
          sender,
          receiver,
          message
        });

        io.to(receiver).emit('newMessage', newMessage);
      } catch (error) {
        console.error('Error sending message:', error);
      }
    });
  });
};
