// src/config/database.js
const { Sequelize } = require('sequelize');
const mongoose = require('mongoose');

const sequelize = new Sequelize(process.env.POSTGRES_URI, {
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

module.exports = { sequelize, mongoose };

// src/models/User.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('owner', 'driver'),
    allowNull: false
  },
  name: DataTypes.STRING,
  phone: DataTypes.STRING
});

User.beforeCreate(async (user) => {
  user.password = await bcrypt.hash(user.password, 10);
});

module.exports = User;

// src/models/ParkingSpace.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ParkingSpace = sequelize.define('ParkingSpace', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  ownerId: {
    type: DataTypes.UUID,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  latitude: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  images: DataTypes.ARRAY(DataTypes.STRING),
  description: DataTypes.TEXT,
  availability: DataTypes.JSONB
});

module.exports = ParkingSpace;

// src/models/Booking.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  parkingSpaceId: {
    type: DataTypes.UUID,
    references: {
      model: 'ParkingSpaces',
      key: 'id'
    }
  },
  driverId: {
    type: DataTypes.UUID,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled'),
    defaultValue: 'pending'
  },
  totalPrice: DataTypes.DECIMAL(10, 2),
  isRecurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  recurringPattern: DataTypes.JSONB
});

module.exports = Booking;

// src/models/Chat.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true
  },
  receiver: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;

// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      throw new Error();
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

module.exports = auth;

// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

exports.register = async (req, res) => {
  try {
    const user = await User.create(req.body);
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
    res.json({ user, token });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

// src/controllers/parkingController.js
const ParkingSpace = require('../models/ParkingSpace');

exports.createParkingSpace = async (req, res) => {
  try {
    const parkingSpace = await ParkingSpace.create({
      ...req.body,
      ownerId: req.user.id
    });
    res.status(201).json(parkingSpace);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.searchParkingSpaces = async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.query;
    const spaces = await ParkingSpace.findAll({
      where: sequelize.literal(`
        ST_DWithin(
          ST_MakePoint(longitude, latitude)::geography,
          ST_MakePoint(${longitude}, ${latitude})::geography,
          ${radius}
        )
      `)
    });
    res.json(spaces);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// src/controllers/bookingController.js
const Booking = require('../models/Booking');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.createBooking = async (req, res) => {
  try {
    const { parkingSpaceId, startTime, endTime, paymentMethodId } = req.body;

    // Verificar disponibilidad
    const existingBooking = await Booking.findOne({
      where: {
        parkingSpaceId,
        status: 'confirmed',
        [Op.or]: [{
          startTime: { [Op.between]: [startTime, endTime] },
          endTime: { [Op.between]: [startTime, endTime] }
        }]
      }
    });

    if (existingBooking) {
      throw new Error('Space not available for selected time');
    }

    // Crear pago con Stripe
    const payment = await stripe.paymentIntents.create({
      amount: totalPrice * 100,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true
    });

    const booking = await Booking.create({
      ...req.body,
      driverId: req.user.id,
      status: 'confirmed'
    });

    res.status(201).json(booking);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// src/socket/chat.js
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

// src/routes/index.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const parkingController = require('../controllers/parkingController');
const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/auth');

// Rutas de autenticación
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// Rutas de espacios de estacionamiento
router.post('/parking-spaces', auth, parkingController.createParkingSpace);
router.get('/parking-spaces/search', parkingController.searchParkingSpaces);

// Rutas de reservas
router.post('/bookings', auth, bookingController.createBooking);

module.exports = router;

// src/app.js
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { sequelize } = require('./config/database');
const setupSocket = require('./socket/chat');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', routes);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected!');
    console.log(`Server is running on port ${PORT}`);
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
});

setupSocket(server);

module.exports = app;
