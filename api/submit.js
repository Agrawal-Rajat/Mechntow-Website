const { google } = require('googleapis');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');

export const config = {
  api: {
    bodyParser: false, // Disable Vercel's default body parser
  },
};

// Parse credentials from GOOGLE_CREDENTIAL environment variable
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIAL);

export default async function handler(req, res) {
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const form = new formidable.IncomingForm({
      multiples: false,
      uploadDir: '/tmp', // Use temporary directory for Vercel compatibility
      keepExtensions: true,
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form parsing error:", err);
        return res.status(500).json({ error: 'Error parsing form data' });
      }

      const { full_name, phone, car_model, car_number, service, issue_description, comment } = fields;
      const carImage = files.car_image;

      if (!full_name || !phone || !car_model || !car_number || !service) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Authenticate with Google
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const drive = google.drive({ version: 'v3', auth });

      let imageUrl = '';

      // Upload to Google Drive
      if (carImage && carImage.filepath) {
        try {
          const imagePath = carImage.filepath || carImage.path;
          const fileMetadata = {
            name: `car_image_${Date.now()}${path.extname(carImage.originalFilename)}`,
            parents: ['1ZdaDr2oGjuO8UpvloTlWKbS5IVRw9WRa'], // Replace with your Drive folder ID
          };
          const media = {
            mimeType: carImage.mimetype,
            body: fs.createReadStream(imagePath),
          };

          const file = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
          });

          const fileId = file.data.id;
          imageUrl = `https://drive.google.com/uc?id=${fileId}`;

          // Make the file publicly accessible
          await drive.permissions.create({
            fileId,
            requestBody: { role: 'reader', type: 'anyone' },
          });
        } catch (uploadError) {
          console.error("Error uploading to Google Drive:", uploadError);
          return res.status(500).json({ error: 'Error uploading image to Google Drive' });
        }
      }

      // Append to Google Sheets
      const spreadsheetId = '1qH38yhn-bRjI17hvTbvF68-KZfWkH9dkKxkH_P6gCTg'; // Replace with your Google Sheets ID
      const range = 'Sheet1!A:H';

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource: {
          values: [[full_name, phone, car_model, car_number, service, issue_description || '', comment || '', imageUrl]],
        },
      });

      res.status(200).json({ message: 'Booking submitted successfully' });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
