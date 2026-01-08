# CV Automation Service

Automatischer Service zum Herunterladen von CVs und Upload zu Airtable.

## Features

- 📥 Automatischer PDF-Download von verschiedenen URLs
- ✅ PDF-Validierung
- 📤 Upload zu Airtable via direkte URL (kein Größenlimit)
- 🔄 Webhook-Support für Airtable Automations
- 📊 Detailliertes Logging

## Deployment auf Railway

### 1. Repository zu Railway verbinden

1. Gehe zu [railway.app](https://railway.app)
2. Klicke auf "New Project"
3. Wähle "Deploy from GitHub repo"
4. Wähle `harmonymwirigi/downloadcv`

### 2. Environment Variables setzen

In Railway Dashboard → Variables (optional, NODE_ENV is already set in Dockerfile):

```env
NODE_ENV=production
```

**Note:** Puppeteer will automatically use its bundled Chromium. No need to set `PUPPETEER_EXECUTABLE_PATH` unless you want to use a system Chrome installation.

### 3. Deploy starten

Railway deployed automatisch. Nach dem Deploy bekommst du eine URL wie:
```
https://cv-automation-production.up.railway.app
```

### 4. Webhook in Airtable einrichten

Siehe [WEBHOOK-SETUP.md](./WEBHOOK-SETUP.md) für detaillierte Anleitung.

## API Endpoints

### POST /process-cv

Lädt eine PDF herunter und uploaded sie zu Airtable.

**Request:**
```json
{
  "candidate_id": "123456",
  "cv_link": "https://example.com/cv.pdf",
  "airtable_base_id": "appXXXXXXXXXXXXXX",
  "airtable_table_name": "Table Name",
  "airtable_token": "patXXXXXXXXXXXXXXXX"
}
```

**Response:**
```json
{
  "success": true,
  "candidate_id": "123456",
  "record_id": "recXXXXXXXXXXXXXX",
  "file_size": 1234567,
  "message": "CV successfully uploaded to Airtable"
}
```

### POST /download-cv

Nur Download (ohne Airtable Upload) - für Testing.

**Request:**
```json
{
  "candidate_id": "123456",
  "cv_link": "https://example.com/cv.pdf"
}
```

## Lokale Entwicklung

```bash
# Installation
npm install

# Server starten
npm start

# Test
curl -X POST http://localhost:3000/process-cv \
  -H "Content-Type: application/json" \
  -d '{"candidate_id":"test","cv_link":"URL",...}'
```

## Technologie Stack

- Node.js + Express
- Puppeteer (Chrome Automation)
- Axios (HTTP Requests)
- Airtable API

## Troubleshooting

### PDF Download schlägt fehl

- Prüfe ob die CV-URL korrekt ist
- Sieh dir die Browser-Logs an (headless: false für lokales Debugging)

### Airtable Upload schlägt fehl

- Prüfe Token-Berechtigungen
- Prüfe Base ID und Table Name
- Prüfe ob das `cv` Feld ein Attachment-Feld ist

### Railway Deployment Probleme

- Prüfe Environment Variables
- Sieh dir die Railway Logs an
- Stelle sicher dass das Dockerfile korrekt ist
