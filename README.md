# P2P File Cloud

Seedr-style web application for authorized HTTP/HTTPS URL downloads and magnet-link queueing.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Notes

HTTP/HTTPS transfers are implemented with SSRF protections. Magnet links are accepted by the UI/API and represented as queued jobs; connect a real BitTorrent engine through `server/providers` for persistent P2P transfers. Only download content you are authorized to access.
