# Overlay (Araldo)
An overlay server for streaming Ludosport tournaments.

## Requirements
The app is Dockerized, so no need to install Node on your system. The only requirement is to have Docker installed, with Docker Compose.

## Setup
1. Copy the Google credential file (`auth.json`) in the root directory of the project.
2. Build and run the Dockerized app:
```
docker-compose up -d
```

## Useful commands
- Stop the running container: `docker-compose stop`
- Remove the container: `docker-compose down`
- Start an interactive shell within the container: `docker exec -it overlay_node sh`
- Follow the app logs: `docker logs --follow overlay_node`

## Endpoints
- Controller client: `http://localhost:3000/controller`
- Scorekeeper clients: `http://localhost:3000/scorekeeper?arena=<ARENA>` (with `<ARENA>` an arena identifier, e.g. `A`, `B`, etc.)
- Fight overlay: `http://localhost:3000/fightOverlay?arena=<ARENA>` (with `<ARENA>` an arena identifier, e.g. `A`, `B`, etc.)
- Pools overlay: `http://localhost:3000/pools`
- Bracket overlay: `http://localhost:3000/bracket`
- Wait & intermission overlay: `http://localhost:3000/waitIntermission`