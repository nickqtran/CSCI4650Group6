const express = require('express');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const AWS = require('aws-sdk');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// DynamoDB config
const client = new DynamoDBClient({ region: "us-east-1" });
const ddbDocClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "Photos";

// S3 config
const s3 = new AWS.S3({ region: "us-east-1" });
const BUCKET_NAME = "photogalleryproject"; 

// Multer config for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// API to get all photos
app.get('/api/photos', async (req, res) => {
    try {
        const data = await ddbDocClient.send(new ScanCommand({ TableName: TABLE_NAME }));
        res.json(data.Items);
    } catch (err) {
        console.error('DynamoDB error:', err);
        res.status(500).json({ error: 'Failed to fetch photos' });
    }
});

// API to upload a photo
app.post('/api/upload', upload.single('photo'), async (req, res) => {
    const file = req.file;
    const description = req.body.description || '';

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const params = {
        Bucket: BUCKET_NAME,
        Key: file.originalname,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read'
    };

    try {
        const s3Data = await s3.upload(params).promise();

        const photoItem = {
            fileName: file.originalname,
            s3Url: s3Data.Location,
            description: description
        };

        await ddbDocClient.send(new PutCommand({ TableName: TABLE_NAME, Item: photoItem }));

        res.json({ success: true, photo: photoItem });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
