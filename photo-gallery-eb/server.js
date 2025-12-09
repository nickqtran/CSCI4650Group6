const express = require('express');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json()); // parse JSON POST requests

// DynamoDB config
const client = new DynamoDBClient({ region: "us-east-1" });
const ddbDocClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "Photos";

// API to get all photos
app.get('/api/photos', async (req, res) => {
    try {
        const data = await ddbDocClient.send(new ScanCommand({ TableName: TABLE_NAME }));
        res.json(data.Items);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch photos' });
    }
});

// API to add a photo
app.post('/api/photos', async (req, res) => {
    const photo = req.body;
    try {
        await ddbDocClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: photo
        }));
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add photo' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
