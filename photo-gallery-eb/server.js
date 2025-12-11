const express = require('express');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const multer = require('multer');
const { v4: uuidv4 } = require('uuid'); 
const AWS = require('aws-sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// DynamoDB config
const client = new DynamoDBClient({ region: "us-east-1" });
const ddbDocClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "Photos";

// S3 config
const BUCKET_NAME = "photogalleryproject";
const s3 = new AWS.S3({ region: "us-east-1" });

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Logic to receive all photos
app.get('/api/photos', async (req, res) => {
    try {
        const data = await ddbDocClient.send(new ScanCommand({ TableName: TABLE_NAME }));
        res.json(data.Items);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch photos' });
    }
});

// Upload photo logic
app.post('/api/upload', upload.single('photo'), async (req, res) => {
    const file = req.file;
    const description = req.body.description || '';

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const imageID = uuidv4();
    const s3Params = {
        Bucket: BUCKET_NAME,
        Key: file.originalname,
        Body: file.buffer,
        ContentType: file.mimetype
    };

    try {
        await s3.putObject(s3Params).promise();
        const s3Url = `https://${BUCKET_NAME}.s3.amazonaws.com/${file.originalname}`;

        const item = {
            imageID,
            description,
            s3Url
        };

        await ddbDocClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: item
        }));

        res.json({ success: true, s3Url });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

// Delete photo logic
app.delete('/api/photos/:imageID', async (req, res) => {
    const { imageID } = req.params;

    try {
        // Find the photo in DynamoDB
        const data = await ddbDocClient.send(new ScanCommand({ 
            TableName: TABLE_NAME,
            FilterExpression: 'imageID = :id',
            ExpressionAttributeValues: { ':id': imageID }
        }));

        if (!data.Items || data.Items.length === 0) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        const photo = data.Items[0];
        const key = photo.s3Url.split('/').pop();

        // Delete from S3
        await s3.deleteObject({ Bucket: BUCKET_NAME, Key: key }).promise();

        // Delete from DynamoDB
        await ddbDocClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { imageID }
        }));

        res.json({ success: true });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: 'Failed to delete photo' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
