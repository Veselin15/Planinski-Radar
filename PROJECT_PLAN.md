# PROJECT PLAN: Planinski Radar (Планински Радар)

## Project Overview
Planinski Radar is a new Progressive Web App (PWA) for mountaineers in Bulgaria.  
The platform provides an interactive topographic map that combines:
- Crowdsourced user hazard reports
- Automatically scraped official mountain alerts
- Live webcam context for mountain huts

The goal is to improve mountain safety, situational awareness, and decision-making in real time.

## Core Project Rules

### Localization
- All frontend UI text must be in Bulgarian.
- All user-facing messages, labels, and errors must be in Bulgarian.

### Codebase Language
- Backend logic must be in English.
- Variable names must be in English.
- Database models must be in English.
- API endpoints must be in English.

### Comments
- All comments inside code must be written in English.

### Design Principles
- Mobile-first UX as primary target.
- Tailwind CSS for styling.
- Large tap targets and clear interaction states.
- Accessible and high-contrast hazard color system.
- Modular, clean, and DRY code organization.

## Technology Stack

### Frontend
- Next.js (App Router)
- React-Leaflet
- Tailwind CSS
- PWA setup (including offline support)

### Backend
- Python
- Django
- Django REST Framework (DRF)

### Background Processing
- Celery + Redis
- Scheduled scraping and caching jobs

### Database
- PostgreSQL
- PostGIS extension for spatial queries

### Repository Architecture
- Monorepo structure at root:
  - `/frontend`
  - `/backend`

## Core Features

### 1) Interactive Topographic Map
- Map layers based on OpenStreetMap/OpenTopoMap.
- Center map on user GPS location.
- Support offline map caching through Service Workers.

### 2) Marker System (Pins)

#### Red Markers: User-Reported Hazards
- Hazard examples: avalanches, ice, fallen trees.
- Report payload includes:
  - Photo
  - Category
  - Description
  - Auto-GPS coordinates
- Community moderation via upvote/downvote.

#### Blue Markers: Official Alerts
- Automatically scraped alerts from Bulgarian Mountain Rescue Services (ПСС).

### 3) Huts and Webcams
- Static markers for mountain huts (хижи).
- Marker click opens a modal with:
  - Latest cached webcam frame
  - Current weather data

### 4) Live Feed
- Chronological unified feed that mixes:
  - User hazard reports
  - Official alerts

### 5) Scraping and Caching Engine
- Celery workers scheduled as follows:
  - Every 15 minutes: scrape official alerts
  - Every 5 minutes: fetch and cache latest webcam images
- Image caching target: local storage and/or S3-compatible object storage.

## Initial Architectural Intent
- Build incrementally in clearly defined steps.
- Keep frontend and backend concerns separated but integrated through clear APIs.
- Optimize for reliability of geospatial data and freshness of safety-critical information.
- Treat this document as the single source of architectural context for the upcoming implementation steps.
