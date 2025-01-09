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
