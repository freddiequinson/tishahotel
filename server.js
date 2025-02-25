const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// MongoDB Connection URI (you'll get this from MongoDB Atlas)
const MONGODB_URI = process.env.MONGODB_URI || 'your_mongodb_uri_here';
let db;

// Connect to MongoDB
async function connectToMongo() {
  try {
    console.log('Attempting to connect to MongoDB...');
    const client = await MongoClient.connect(MONGODB_URI);
    db = client.db('tishahotel');
    console.log('Successfully connected to MongoDB');
    
    // Test the connection by listing collections
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    // Initialize rooms collection if it doesn't exist
    const roomsExist = collections.some(c => c.name === 'rooms');
    if (!roomsExist) {
      console.log('Initializing rooms collection...');
      await db.createCollection('rooms');
      await db.collection('rooms').insertMany([
        {
          name: 'Junior Suite',
          price: 250,
          description: 'Our cozy Junior Suite offers comfort and convenience.'
        },
        {
          name: 'Standard Room',
          price: 280,
          description: 'Our comfortable Standard Room offers all essential amenities.'
        },
        {
          name: 'Master Room',
          price: 300,
          description: 'Our luxurious Master Room provides extra space and comfort.'
        }
      ]);
      console.log('Rooms collection initialized');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Connect to MongoDB when server starts
connectToMongo().catch(console.error);

// CORS middleware
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5500',
    'https://tishahotel.onrender.com'
    // Add your custom domain here when you have it
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Security middleware
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

// Middleware
app.use(bodyParser.json());
app.use(express.static('.'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'assets/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
});

const upload = multer({ storage: storage });

// Helper function to update HTML file
function updateHtmlFile(filePath, roomUpdates) {
  try {
    console.log(`Updating file: ${filePath}`);
    console.log('Room updates:', JSON.stringify(roomUpdates, null, 2));

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(content, { decodeEntities: false });

    Object.keys(roomUpdates).forEach(roomType => {
      const room = roomUpdates[roomType];
      console.log(`Processing room: ${roomType}`);

      // Find the room section using a more specific selector
      const roomSection = $(`.room:has(.room-info h2:contains("${roomType}"))`);
      
      if (!roomSection.length) {
        console.log(`Warning: Room section not found for ${roomType}`);
        return;
      }

      if (room.description) {
        // Create the icons HTML
        const iconsHtml = `
          <span><i class="fa fa-wifi" title="Free WiFi"></i></span>
          <span><i class="fa fa-tv" title="DStv"></i></span>
          <span><i class="fa fa-glass" title="Minibar"></i></span>
          ${roomType.toLowerCase().includes('junior') ? '<span><i class="fa fa-users" title="2 Adults + 1 Child"></i></span>' : ''}
        `;

        const amenitiesDiv = roomSection.find('.room-amenities');
        if (amenitiesDiv.length) {
          amenitiesDiv.html(`
            ${iconsHtml}
            <p class="mt-3">${room.description}</p>
          `);
          console.log(`Updated description for ${roomType}`);
        } else {
          console.log(`Warning: .room-amenities not found for ${roomType}`);
        }
      }

      if (room.price) {
        const priceElement = roomSection.find('.letter-spacing-1');
        if (priceElement.length) {
          priceElement.text(`GH₵${room.price} / per night`);
          console.log(`Updated price for ${roomType}`);
        } else {
          console.log(`Warning: Price element not found for ${roomType}`);
        }
      }
    });

    // Write the updated content back to the file
    const updatedHtml = $.html();
    fs.writeFileSync(filePath, updatedHtml);
    console.log(`Successfully updated ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error in updateHtmlFile:', error);
    throw error;
  }
}

// API Endpoints
app.get('/api/roomConfig', async (req, res) => {
  try {
    const rooms = await db.collection('rooms').find({}).toArray();
    const formattedRooms = rooms.map(room => ({
      ...room,
      formattedPrice: `GH₵${room.price} / per night`
    }));
    res.json(formattedRooms);
  } catch (error) {
    console.error('Error reading room config:', error);
    res.status(500).json({ error: 'Failed to read room configuration' });
  }
});

app.post('/api/updateRoom', async (req, res) => {
  try {
    console.log('Received update request:', req.body);
    const { roomName, price } = req.body;
    
    if (!roomName || !price) {
      console.log('Missing required fields:', { roomName, price });
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Both roomName and price are required'
      });
    }

    const result = await db.collection('rooms').updateOne(
      { name: roomName },
      { 
        $set: { 
          price: parseInt(price)
        }
      }
    );

    console.log('Update result:', result);

    if (result.matchedCount === 0) {
      console.log('No room found with name:', roomName);
      return res.status(404).json({ 
        error: 'Room not found',
        details: `No room found with name: ${roomName}`
      });
    }

    if (result.modifiedCount === 0) {
      console.log('Room found but not modified:', roomName);
      return res.json({ 
        success: true,
        message: 'Room price unchanged'
      });
    }

    console.log('Room updated successfully:', roomName);
    res.json({ 
      success: true,
      message: 'Room price updated successfully'
    });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ 
      error: 'Failed to update room',
      details: error.message
    });
  }
});

app.post('/api/uploadImage', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    res.json({ 
      success: true, 
      message: 'Image uploaded successfully',
      path: `/assets/${req.file.filename}`
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error uploading image',
      error: error.message 
    });
  }
});

// Booking management endpoints
app.post('/api/bookings', async (req, res) => {
  try {
    const bookingData = req.body;
    const bookingsCollection = db.collection('bookings');
    const bookings = await bookingsCollection.find({}).toArray();
    
    // Add timestamp and status
    bookingData.createdAt = new Date().toISOString();
    bookingData.status = 'pending';
    
    bookings.push(bookingData);
    await bookingsCollection.insertMany(bookings);
    
    res.json({ success: true, booking: bookingData });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const bookingsCollection = db.collection('bookings');
    const bookings = await bookingsCollection.find({}).toArray();
    res.json(bookings);
  } catch (error) {
    console.error('Error reading bookings:', error);
    res.status(500).json({ error: 'Failed to read bookings' });
  }
});

app.put('/api/bookings/:bookingNumber', async (req, res) => {
  try {
    const { bookingNumber } = req.params;
    const { status } = req.body;
    const bookingsCollection = db.collection('bookings');
    const booking = await bookingsCollection.findOne({ bookingNumber: bookingNumber });
    if (booking) {
      await bookingsCollection.updateOne(
        { bookingNumber: bookingNumber },
        { 
          $set: { 
            status: status,
            updatedAt: new Date().toISOString()
          }
        }
      );
      res.json({ success: true, booking });
    } else {
      res.status(404).json({ error: 'Booking not found' });
    }
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// Initialize default admin user from environment variables
const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// In-memory store for users (will reset on server restart)
let users = [{
  id: 'admin',
  username: DEFAULT_ADMIN_USERNAME,
  password: DEFAULT_ADMIN_PASSWORD,
  role: 'admin',
  name: 'Administrator',
  email: 'admin@tishahotel.com',
  createdAt: new Date().toISOString()
}];

// User Management Endpoints
app.get('/api/users', async (req, res) => {
  try {
    const usersCollection = db.collection('users');
    const usersData = await usersCollection.find({}).toArray();
    res.json(usersData);
  } catch (error) {
    console.error('Error reading users:', error);
    res.status(500).json({ error: 'Failed to read users' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, role, name, email } = req.body;
    
    // Validate required fields
    if (!username || !password || !role || !name || !email) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if username already exists
    const usersCollection = db.collection('users');
    const existingUser = await usersCollection.findOne({ username: username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create new user
    const newUser = {
      id: Date.now().toString(),
      username,
      password,
      role,
      name,
      email,
      createdAt: new Date().toISOString()
    };

    // Add to users array
    await usersCollection.insertOne(newUser);

    res.json({ success: true, user: newUser });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // Find user index
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ id: userId });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting the default admin user
    if (user.username === DEFAULT_ADMIN_USERNAME) {
      return res.status(400).json({ error: 'Cannot delete the default admin user' });
    }

    // Prevent deleting the last admin user
    const isAdmin = user.role === 'admin';
    const remainingAdmins = await usersCollection.find({ role: 'admin', id: { $ne: userId } }).toArray();
    if (isAdmin && remainingAdmins.length === 0) {
      return res.status(400).json({ error: 'Cannot delete the last admin user' });
    }

    // Remove user
    await usersCollection.deleteOne({ id: userId });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user with matching credentials
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ username: username, password: password });
    
    if (user) {
      // Create safe user object without password
      const safeUser = { ...user };
      delete safeUser.password;
      res.json({ success: true, user: safeUser });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Add a test endpoint to check MongoDB connection
app.get('/api/testdb', async (req, res) => {
  try {
    console.log('Testing database connection...');
    const rooms = await db.collection('rooms').find({}).toArray();
    console.log('Current rooms in database:', rooms);
    res.json({ success: true, rooms });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({ error: 'Database test failed', details: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: err.message 
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
