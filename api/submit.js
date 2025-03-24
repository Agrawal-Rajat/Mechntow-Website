const { google } = require('googleapis');
const formidable = require('formidable');
const fs = require('fs');

// Use environment variables for credentials
const credentials = {
  client_email: process.env.CLIENT_EMAIL,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
};

module.exports = async (req, res) => {
  // List of allowed origins (your domains)
  const allowedOrigins = [
    'https://mechntow.com',
    'https://www.mechntow.com',
    'https://mechntow.vercel.app',
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://mechntow.vercel.app'); // Default to Vercel
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(500).json({ error: 'Error parsing form data' });
      }

      const { 'bb-name': name, 'bb-phone': phone, 'bb-branch': service, 'bb-message': issue, 'bb-message': comment } = fields;
      const carModel = fields['bb-name'];
      const carNumber = fields['bb-name'];
      const image = files['bb-name'];

      // Validate required fields
      if (!name || !phone || !service || !carModel || !carNumber) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Authenticate with Google Sheets API
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const spreadsheetId = '1HrMJesfv9gGMmC1eV92-gvrOgviSLpdclXKC8K0tXP4'; // Replace with your Google Sheets ID
      const range = 'Bookings!A:G'; // Adjust based on your sheet

      // Append form data to Google Sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: {
          values: [[name, phone, carModel, carNumber, service, issue, comment || '']],
        },
      });

      res.status(200).json({ message: 'Booking submitted successfully' });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
