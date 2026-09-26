# P2P File Cloud

A Seedr-style personal file cloud for authorized HTTP/HTTPS downloads and BitTorrent magnet downloads.

## Features

- HTTP/HTTPS URL ingestion
- Real server-side BitTorrent downloads through WebTorrent
- Magnet URI support
- Persistent job state in `data/jobs.json`
- Torrent data persisted under `data/torrents`
- Downloaded HTTP files stored under `data/files`
- Live progress, download speed and peer count
- Pause / resume / remove torrent controls
- Completed file download endpoints
- Responsive dark dashboard
- SSRF protection for HTTP/HTTPS ingestion

WebTorrent 3.x supports magnet URIs, DHT/tracker/peer discovery and Node.js TCP/UDP peer communication. citeturn0search0turn1search0

## Run locally

```bash
npm install
npm start
```

Open:

```
http://localhost:3000
```

For development:

```bash
npm run dev
```

## Important production work

This is now a functioning P2P backend, but it is not a finished multi-user SaaS. Before exposing it publicly, add:

- user authentication and authorization
- per-user storage quotas
- persistent database instead of the JSON state file
- job ownership/isolation
- rate limits and concurrency limits
- HTTPS/reverse proxy
- stronger abuse controls and logging
- storage cleanup policies
- upload/seeding policy controls
- operational monitoring

Only download or store material you are authorized to access. A torrent client automatically participates in the swarm and can seed downloaded content; WebTorrent documents that completed downloads are automatically seeded. citeturn1search0
