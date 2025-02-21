const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000;

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
app.get('/api/roomConfig', (req, res) => {
  try {
    const roomConfig = JSON.parse(fs.readFileSync('room-config.json', 'utf8'));
    res.json(roomConfig);
  } catch (error) {
    console.error('Error reading room config:', error);
    res.status(500).json({ error: 'Failed to read room configuration' });
  }
});

app.post('/api/updateRoom', (req, res) => {
  try {
    const { roomName, description, price } = req.body;
    
    // Update room-config.json
    const roomConfig = JSON.parse(fs.readFileSync('room-config.json', 'utf8'));
    const roomKey = Object.keys(roomConfig).find(key => 
      roomConfig[key].name.toLowerCase() === roomName.toLowerCase()
    );
    
    if (roomKey && price) {
      roomConfig[roomKey].price = parseInt(price);
      fs.writeFileSync('room-config.json', JSON.stringify(roomConfig, null, 2));
    }

    // Update HTML files
    ['index.html', 'rooms.html'].forEach(filename => {
      if (fs.existsSync(filename)) {
        let content = fs.readFileSync(filename, 'utf8');
        const $ = cheerio.load(content);

        // Find the room section
        $('h2').each(function() {
          if ($(this).text().trim() === roomName) {
            // Update price
            if (price) {
              $(this).next('.text-uppercase').text(`GH₵${price} / per night`);
            }
            
            // Update description
            if (description) {
              const amenitiesDiv = $(this).parent().find('.room-amenities');
              const icons = amenitiesDiv.find('span').clone(); // Save icons
              amenitiesDiv.empty().append(icons); // Clear and restore icons
              amenitiesDiv.append(`<p class="mt-3">${description}</p>`);
            }
          }
        });

        // Save the file
        fs.writeFileSync(filename, $.html());
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ error: 'Failed to update room' });
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
