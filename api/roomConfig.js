module.exports = (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Room configuration
  const roomConfig = {
    junior: {
      name: 'Junior Suite',
      price: 300,
      maxAdults: 2,
      maxChildren: 1
    },
    standard: {
      name: 'Standard Room',
      price: 350,
      maxAdults: 2,
      maxChildren: 1
    },
    master: {
      name: 'Master Room',
      price: 385,
      maxAdults: 3,
      maxChildren: 1
    }
  };

  res.json(roomConfig);
};
