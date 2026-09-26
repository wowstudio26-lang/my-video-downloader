# P2P File Cloud

A Seedr-style web application for accepting user-supplied HTTP/HTTPS download URLs and BitTorrent magnet links, queuing transfers on a server, storing completed files, and exposing them through authenticated HTTPS download URLs.

## Scope

- HTTP/HTTPS URL ingestion
- Magnet URI ingestion
- Transfer queue with progress/state
- Local object/file storage
- Downloadable HTTPS links
- Responsive dark dashboard
- Provider abstraction so a torrent engine can be swapped in

## Safety and deployment

Only download content the operator and users are authorized to access. The production backend should enforce authentication, storage quotas, rate limits, SSRF protections, and abuse controls. Never allow arbitrary server-side URL fetching without validating destination hosts and blocking private/link-local address ranges.

## Architecture

```
Browser -> API -> Job Queue -> HTTP Downloader / Torrent Provider -> Storage -> HTTPS File API
```

The repository currently provides the frontend and backend scaffold. For production torrenting, connect the provider interface in `server/providers` to a licensed/appropriate BitTorrent engine and persistent job queue.
