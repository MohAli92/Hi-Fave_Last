const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const multer = require('multer');
const cors = require('cors');
const WebSocket = require('ws');

// إعداد Multer لتخزين الملفات المرفوعة
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'data')); // مسار تخزين الملفات
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    },
});

const upload = multer({ storage });
const app = express();
const PORT = process.env.PORT || 3000;

// تفعيل CORS
app.use(cors());

// تقديم ملفات الفرونت إند
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// إعداد WebSocket
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');

    const jsonFilePath = path.join(__dirname, '..', 'output', 'fhir_observations.json');
    let data;

    try {
        const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
        data = JSON.parse(fileContent);
    } catch (err) {
        console.error('Error reading JSON file:', err);
        ws.send(JSON.stringify({ error: 'Failed to load ECG data' }));
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

// API لرفع الملفات ومعالجتها
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

// تشغيل الخادم
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// دعم WebSocket عند ترقية الطلبات
server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});
