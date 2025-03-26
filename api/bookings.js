const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(bodyParser.json());

// Main booking handler
const handleBooking = (req, res) => {
  try {
    const bookingData = req.body;
    console.log('Received booking data:', bookingData);

    if (!bookingData) {
      return res.status(400).json({
        success: false,
        message: 'No booking data provided'
      });
    }

    // Validate required fields
    const requiredFields = [
      'bookingNumber',
      'firstName',
      'lastName',
      'email',
      'phone',
      'checkinDate',
      'checkoutDate',
      'adults',
      'children',
      'roomType',
      'nights',
      'numberOfRooms',
      'totalAmount'
    ];

    const missingFields = requiredFields.filter(field => !bookingData[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missingFields
      });
    }

    // Prepare email parameters
    const emailParams = {
      booking_number: bookingData.bookingNumber,
      guest_name: `${bookingData.firstName} ${bookingData.lastName}`,
      check_in: bookingData.checkinDate,
      check_out: bookingData.checkoutDate,
      room_type: bookingData.roomType,
      num_rooms: bookingData.numberOfRooms,
      total_amount: `GH₵${bookingData.totalAmount}`,
      email: bookingData.email,
      phone: bookingData.phone
    };

    console.log('Sending response with email params:', emailParams);

    res.status(200).json({
      success: true,
      message: 'Booking received successfully',
      bookingNumber: bookingData.bookingNumber,
      emailParams
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing booking',
      error: error.message
    });
  }
};

// Handle both POST and OPTIONS
app.options('/api/bookings', cors());
app.post('/api/bookings', handleBooking);

// Export the Express app
module.exports = app;
