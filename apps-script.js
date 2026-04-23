// ToolTrack — Google Apps Script
// Paste this entire file into your Apps Script editor, then deploy as a Web App.
//
// Sheet tabs expected:
//   "ToolInventory"  → columns: Name | Notes | Location
//   "MoveLog"        → columns: ToolName | FromLocation | ToLocation | MovedBy | MoveTime
//   "JobSites"       → columns: SiteName | AddedBy | AddedAt
//
// Row 1 in every tab = header row. Data starts at row 2.
//
// ── FIRST-TIME SETUP ─────────────────────────────────────────────
// 1. Open this script in the Apps Script editor.
// 2. Edit the PIN value in setupPin() below.
// 3. Run setupPin() ONCE from the editor (▶ Run button).
// 4. Delete or comment out setupPin() after running it.
// 5. Deploy as Web App: Execute as "Me", Access "Anyone".
// ─────────────────────────────────────────────────────────────────

// Run this ONE TIME from the editor to set your access PIN, then delete it.
function setupPin() {
  PropertiesService.getScriptProperties().setProperty('TOOLTRACK_PIN', 'CHANGE_THIS_PIN');
  Logger.log('PIN set. Delete this function now.');
}

// ── VALIDATION HELPERS ────────────────────────────────────────────

function requirePin(pin) {
  const stored = PropertiesService.getScriptProperties().getProperty('TOOLTRACK_PIN');
  if (!stored) return; // No PIN configured — allow (useful during initial setup)
  if (typeof pin !== 'string' || pin.trim() !== stored) {
    throw new Error('unauthorized');
  }
}

function requireString(value, field, maxLen) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Missing required field: ' + field);
  }
  if (value.trim().length > maxLen) {
    throw new Error(field + ' exceeds maximum length of ' + maxLen + ' characters');
  }
  return value.trim();
}

// ── READ ──────────────────────────────────────────────────────────

function doGet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const toolsRows = ss.getSheetByName('ToolInventory').getDataRange().getValues();
    const tools = toolsRows.slice(1)
      .filter(r => r[0])
      .map(r => ({
        name:  String(r[0] || ''),
        notes: String(r[1] || ''),
        loc:   String(r[2] || ''),
      }));

    const logRows = ss.getSheetByName('MoveLog').getDataRange().getValues();
    const log = logRows.slice(1)
      .filter(r => r[0])
      .reverse()
      .map(r => ({
        name: String(r[0] || ''),
        from: String(r[1] || ''),
        to:   String(r[2] || ''),
        by:   String(r[3] || ''),
        time: String(r[4] || ''),
      }));

    const sitesRows = ss.getSheetByName('JobSites').getDataRange().getValues();
    const sites = sitesRows.slice(1)
      .filter(r => r[0])
      .map(r => ({
        name:    String(r[0] || ''),
        addedBy: String(r[1] || ''),
        addedAt: String(r[2] || ''),
      }));

    return json({ tools, log, sites });

  } catch (e) {
    return json({ error: e.message });
  }
}

// ── WRITE ─────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    // All write operations require a valid PIN
    requirePin(payload.pin);

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── Move tool ───────────────────────────────────────────────
    if (payload.action === 'move') {
      const toolName = requireString(payload.toolName, 'toolName', 200);
      const newLoc   = requireString(payload.newLoc,   'newLoc',   200);
      const fromLoc  = requireString(payload.fromLoc,  'fromLoc',  200);
      const movedBy  = requireString(payload.movedBy || 'Unknown', 'movedBy', 100);

      const toolsSheet = ss.getSheetByName('ToolInventory');
      const rows = toolsSheet.getDataRange().getValues();

      let updated = false;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === toolName) {
          toolsSheet.getRange(i + 1, 3).setValue(newLoc);
          updated = true;
          break;
        }
      }

      if (!updated) return json({ error: 'Tool not found: ' + toolName });

      ss.getSheetByName('MoveLog').appendRow([toolName, fromLoc, newLoc, movedBy, timestamp()]);
      return json({ success: true });
    }

    // ── Add site ────────────────────────────────────────────────
    if (payload.action === 'addSite') {
      const siteName = requireString(payload.siteName, 'siteName', 200);
      const addedBy  = requireString(payload.addedBy,  'addedBy',  100);

      const sitesSheet = ss.getSheetByName('JobSites');
      const existing   = sitesSheet.getDataRange().getValues();
      const duplicate  = existing.slice(1).some(r => String(r[0]).toLowerCase() === siteName.toLowerCase());
      if (duplicate) return json({ error: 'Site already exists' });

      sitesSheet.appendRow([siteName, addedBy, timestamp()]);
      return json({ success: true });
    }

    // ── Remove site ─────────────────────────────────────────────
    if (payload.action === 'removeSite') {
      const siteName   = requireString(payload.siteName, 'siteName', 200);
      const sitesSheet = ss.getSheetByName('JobSites');
      const rows       = sitesSheet.getDataRange().getValues();

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === siteName) {
          sitesSheet.deleteRow(i + 1);
          return json({ success: true });
        }
      }

      return json({ error: 'Site not found: ' + siteName });
    }

    return json({ error: 'Unknown action' });

  } catch (e) {
    // Return generic message for auth failures to avoid leaking info
    if (e.message === 'unauthorized') return json({ error: 'unauthorized' });
    return json({ error: e.message });
  }
}

// ── HELPERS ───────────────────────────────────────────────────────

function timestamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy HH:mm');
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
