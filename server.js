const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core'); 
const app = express();

app.use(cors());

app.get('/api/download', async (req, res) => {
    try {
        const videoURL = req.query.url;
        if (!videoURL) return res.status(400).send('URL is required');

        const info = await ytdl.getInfo(videoURL);
        const title = info.videoDetails.title.replace(/[^\x00-\x7F]/g, "") || "video";

        res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
        res.header('Content-Type', 'video/mp4');

        ytdl(videoURL, {
            format: 'mp4',
            quality: 'highest'
        }).pipe(res);

    } catch (err) {
        console.error(err);
        res.status(500).send('Cloud processing failed.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
