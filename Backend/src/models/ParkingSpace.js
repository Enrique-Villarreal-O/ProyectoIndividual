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
