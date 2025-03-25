module.exports = (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse request body
  let bookingData;
  try {
    if (typeof req.body === 'string') {
      bookingData = JSON.parse(req.body);
    } else {
      bookingData = req.body;
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

    // Here you would typically save the booking data to a database
    // For now, we'll send an email notification and return success
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
