const Booking = require('../models/Booking');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.createBooking = async (req, res) => {
  try {
    const { parkingSpaceId, startTime, endTime, paymentMethodId } = req.body;

  

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
