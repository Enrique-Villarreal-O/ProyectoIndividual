const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const parkingController = require('../controllers/parkingController');
const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/auth');

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

router.post('/parking-spaces', auth, parkingController.createParkingSpace);
router.get('/parking-spaces/search', parkingController.searchParkingSpaces);

router.post('/bookings', auth, bookingController.createBooking);

module.exports = router;
