# DH ATLAS - web application

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.15482298.svg)](https://doi.org/10.5281/zenodo.15482298)

The goal of the ATLAS is to create a knowledge graph of the international scholarly research on Italian Cultural Heritage leveraged in a Web portal that fosters users’ interpretation and engagement.
The catalogue is published via [CLEF](https://polifonia-project.github.io/clef/) (*Crowdsourcing Linked Entities via web Form*), a lightweight Linked Open Data native cataloguing system tailored to small-medium crowdsourcing projects.

## Deployment Guide
This documentation provides instructions for deploying the ATLAS application using [Docker](https://www.docker.com/).

### Prerequisites
[Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/) installed on your machine

### Clone the Repository
```bash
git clone https://github.com/dh-atlas/app.git
cd app
```

### Start the Application
To deploy the application in detached mode using the production-optimised Docker Compose configuration:
```bash
docker compose --project-name=atlas -f docker-compose.prod-opt.yml up -d
```
Once the containers are running, you can access the ATLAS web interface at: [http://localhost:8115](http://localhost:8115).

### Stop the Application
To stop the running containers without removing them:
```bash
docker compose --project-name=atlas -f docker-compose.prod-opt.yml stop
```
To stop and remove the containers, networks, and volumes:
```bash
docker compose --project-name=atlas -f docker-compose.prod-opt.yml down
```
To remove Docker images manually (if needed):
```bash
docker rmi web:0.1.2
docker rmi busybox
```



