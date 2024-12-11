import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Provider } from 'react-redux';
import theme from './theme';
import store from './src/redux/slices/authSlice.js/store';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ParkingSpaces from './pages/ParkingSpaces';
import ParkingDetail from './pages/ParkingDetail';
import Profile from './pages/Profile';
import Chat from './pages/Chat';

const App = () => {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Navigation />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/parking-spaces" element={<ParkingSpaces />} />
            <Route path="/parking/:id" element={<ParkingDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/chat" element={<Chat />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  );
};

export default App;

// src/redux/slices/authSlice.js
import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: localStorage.getItem('token'),
    loading: false,
    error: null,
  },
  reducers: {
    loginStart: (state) => {
      state.loading = true;
    },
    loginSuccess: (state, action) => {
      state.loading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      localStorage.setItem('token', action.payload.token);
    },
    loginFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem('token');
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout } = authSlice.actions;
export default authSlice.reducer;

// src/pages/Login.js
import React from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Container, Typography, Box } from '@mui/material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import api from '../services/api';
import { loginSuccess } from '../redux/slices/authSlice';

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Invalid email address').required('Required'),
      password: Yup.string().required('Required'),
    }),
    onSubmit: async (values) => {
      try {
        const response = await api.post('/auth/login', values);
        dispatch(loginSuccess(response.data));
        navigate('/');
      } catch (error) {
        console.error('Login error:', error);
      }
    },
  });

  return (
    <Container maxWidth="xs">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h5">
          Sign in
        </Typography>
        <Box component="form" onSubmit={formik.handleSubmit} sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            fullWidth
            id="email"
            name="email"
            label="Email Address"
            value={formik.values.email}
            onChange={formik.handleChange}
            error={formik.touched.email && Boolean(formik.errors.email)}
            helperText={formik.touched.email && formik.errors.email}
          />
          <TextField
            margin="normal"
            fullWidth
            id="password"
            name="password"
            label="Password"
            type="password"
            value={formik.values.password}
            onChange={formik.handleChange}
            error={formik.touched.password && Boolean(formik.errors.password)}
            helperText={formik.touched.password && formik.errors.password}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            Sign In
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

// src/pages/ParkingSpaces.js
import React, { useEffect, useState } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { Container, Grid, Card, CardContent, Typography } from '@mui/material';
import api from '../services/api';

const ParkingSpaces = () => {
  const [spaces, setSpaces] = useState([]);
  const [center, setCenter] = useState({ lat: 0, lng: 0 });

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        loadParkingSpaces(position.coords.latitude, position.coords.longitude);
      },
      (error) => console.error(error)
    );
  }, []);

  const loadParkingSpaces = async (lat, lng) => {
    try {
      const response = await api.get(`/parking-spaces/search?latitude=${lat}&longitude=${lng}&radius=5000`);
      setSpaces(response.data);
    } catch (error) {
      console.error('Error loading parking spaces:', error);
    }
  };

  return (
    <Container>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_KEY}>
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '600px' }}
              center={center}
              zoom={14}
            >
              {spaces.map((space) => (
                <Marker
                  key={space.id}
                  position={{ lat: space.latitude, lng: space.longitude }}
                />
              ))}
            </GoogleMap>
          </LoadScript>
        </Grid>
        <Grid item xs={12} md={4}>
          {spaces.map((space) => (
            <Card key={space.id} sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6">{space.address}</Typography>
                <Typography>${space.price}/hour</Typography>
              </CardContent>
            </Card>
          ))}
        </Grid>
      </Grid>
    </Container>
  );
};

// src/pages/Chat.js
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

// src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
