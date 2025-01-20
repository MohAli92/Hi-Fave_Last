// Required imports
const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const multer = require('multer');
const cors = require('cors');
const WebSocket = require('ws');

const CODESPACE_NAME = process.env.CODESPACE_NAME;
const PORT = process.env.PORT || 3000;

const FRONTEND_URL = CODESPACE_NAME
    ? `https://5500-${CODESPACE_NAME}.app.github.dev`
    : 'http://localhost:5500';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'data'));
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    },
});

const upload = multer({ storage });
const app = express();

// Enable CORS
app.use(cors({ origin: FRONTEND_URL }));

// Serve frontend
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// WebSocket server
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');

    const jsonFilePath = path.join(__dirname, '..', 'output', 'fhir_observations.json');
    let data;

    try {
        const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
        data = JSON.parse(fileContent);
        console.log('Loaded data:', data);
    } catch (err) {
        console.error('Error reading JSON file:', err);
        ws.close();
        return;
    }

    let index = 0;
    const intervalId = setInterval(() => {
        if (index < data.length) {
            ws.send(JSON.stringify(data[index]));
            index++;
        } else {
            clearInterval(intervalId);
            ws.close();
        }
    }, 1000);

    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(intervalId);
    });
});

// File upload and processing
app.post('/upload', upload.single('file'), (req, res) => {
    const filePath = req.file.path;

    const scriptPath = path.join(__dirname, '..', 'scripts', 'process_ecg.py');
    const command = `python "${scriptPath}" "${filePath}"`;

    exec(command, { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
        if (error) {
            console.error('Error processing file:', stderr);
            return res.status(500).json({ error: 'Failed to process file' });
        }

        console.log('Python script output:', stdout);

        const outputFilePath = path.join(__dirname, '..', 'output', 'fhir_observations.json');
        fs.readFile(outputFilePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading JSON file:', err);
                return res.status(500).json({ error: 'Failed to read processed data' });
            }
            res.json(JSON.parse(data));
        });
    });
});

// Start the server
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (CODESPACE_NAME) {
        console.log(`Public URL: https://${PORT}-${CODESPACE_NAME}.app.github.dev`);
    }
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});
