const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const outputDir = path.join(__dirname, '..', 'output');

router.get('/', (req, res) => {
    fs.readdir(outputDir, (err, files) => {
        if (err) {
            console.error('Error reading output directory:', err);
            return res.status(500).json({ error: 'Failed to list observations' });
        }

        const observations = files.filter(file => file.endsWith('.json'));
        res.json(observations);
    });
});

router.get('/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(outputDir, fileName);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(404).json({ error: 'File not found' });
        }
        res.json(JSON.parse(data));
    });
});

module.exports = router;
