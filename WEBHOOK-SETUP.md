# Webhook Setup Anleitung

## Schritt 1: Service deployen

1. Pushe den Code zu GitHub/Railway
2. Warte auf Deployment
3. Kopiere die Railway URL (z.B. `https://your-app.up.railway.app`)

## Schritt 2: Airtable Automation erstellen

### In deiner Airtable Base:

1. **Gehe zu Automations** (oben rechts)

2. **Create Automation**

3. **Trigger konfigurieren:**
   - Wähle: "When record matches conditions"
   - Table: "REC Funnel Perspective Lead List"
   - Conditions:
     - `cv link` is not empty
     - OPTIONAL: `cv` (Attachment field) is empty (damit nicht doppelt hochgeladen wird)

4. **Action hinzufügen:**
   - Wähle: "Send webhook request"

   **Webhook Settings:**
   ```
   Method: POST
   URL: https://YOUR-RAILWAY-URL.up.railway.app/process-cv
   Content-Type: application/json
   ```

   **Body (JSON):**
   ```json
   {
     "candidate_id": "{id}",
     "cv_link": "{cv link}",
     "airtable_base_id": "appoLE58UsWeHM7Tk",
     "airtable_table_name": "REC Funnel Perspective Lead List",
     "airtable_token": "YOUR_AIRTABLE_TOKEN_HERE"
   }
   ```

   **WICHTIG:**
   - `{id}` und `{cv link}` werden automatisch von Airtable ersetzt
   - Passe `airtable_token` an wenn nötig

5. **Teste die Automation:**
   - Klicke auf "Test automation"
   - Wähle einen bestehenden Record mit CV-Link
   - Prüfe ob die PDF hochgeladen wird

6. **Aktiviere die Automation**

## Schritt 3: Testen

1. Füge einen neuen Lead in Perspective ein
2. Der Lead sollte in Airtable landen
3. Die Automation sollte automatisch triggern
4. Die PDF sollte ins `cv` Feld hochgeladen werden

## Troubleshooting

Wenn es nicht funktioniert:

1. **Prüfe Railway Logs:**
   - Gehe zu Railway Dashboard
   - Klicke auf dein Deployment
   - Sieh dir die Logs an

2. **Prüfe Airtable Automation Runs:**
   - Gehe zu Automations
   - Klicke auf "Run history"
   - Sieh dir fehlgeschlagene Runs an

3. **Teste manuell mit curl:**
   ```bash
   curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/process-cv \
     -H "Content-Type: application/json" \
     -d '{
       "candidate_id":"TEST_ID",
       "cv_link":"PDF_LINK",
       "airtable_base_id":"appoLE58UsWeHM7Tk",
       "airtable_table_name":"REC Funnel Perspective Lead List",
       "airtable_token":"YOUR_TOKEN"
     }'
   ```

## Sicherheitshinweis

⚠️ **WICHTIG:** Dein Airtable Token ist im Webhook Body sichtbar!

**Bessere Lösung:** Token als Environment Variable in Railway:

1. In Railway: Setze `AIRTABLE_TOKEN` als Environment Variable
2. Im Webhook Body: Entferne das `airtable_token` Feld
3. Update `server.js` um den Token aus `process.env.AIRTABLE_TOKEN` zu lesen

Willst du, dass ich das jetzt umsetze?
