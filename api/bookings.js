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

  try {
    const bookingData = req.body;
    
    // Here you would typically save the booking data to a database
    // For now, we'll just return success
    res.status(200).json({
      success: true,
      message: 'Booking received successfully',
      bookingNumber: bookingData.bookingNumber
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing booking',
      error: error.message
    });
  }
};
