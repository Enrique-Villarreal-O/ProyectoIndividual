import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Container, Paper, TextField, Button, Box, Typography } from '@mui/material';
import io from 'socket.io-client';
import api from '../services/api';

const Chat = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_API_URL);
    setSocket(newSocket);

    newSocket.emit('join', user.id);

    newSocket.on('newMessage', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => newSocket.close();
  }, [user.id]);

  const handleSendMessage = () => {
    if (newMessage.trim() && socket) {
      const messageData = {
        sender: user.id,
        receiver: 'RECEIVER_ID', // Debe ser dinámico según el chat actual
        message: newMessage,
      };

      socket.emit('sendMessage', messageData);
      setNewMessage('');
    }
  };

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 2, height: '70vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flexGrow: 1, overflow: 'auto', mb: 2 }}>
          {messages.map((message, index) => (
            <Box
              key={index}
              sx={{
                mb: 1,
                display: 'flex',
                justifyContent: message.sender === user.id ? 'flex-end' : 'flex-start',
              }}
            >
              <Paper
                sx={{
                  p: 1,
                  backgroundColor: message.sender === user.id ? 'primary.light' : 'grey.200',
                }}
              >
                <Typography>{message.message}</Typography>
              </Paper>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message"
          />
          <Button variant="contained" onClick={handleSendMessage}>
            Send
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};
