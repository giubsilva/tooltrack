// ToolTrack — Google Apps Script
// Paste this entire file into your Apps Script editor, then deploy as a Web App.
//
// Sheet tabs expected:
//   "ToolInventory"  → columns: Name | Notes | Location
//   "MoveLog"        → columns: ToolName | FromLocation | ToLocation | MovedBy | MoveTime
//   "JobSites"       → columns: SiteName | AddedBy | AddedAt
//
// Row 1 in every tab = header row. Data starts at row 2.

function doGet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── Read tools ──────────────────────────────────
    const toolsSheet = ss.getSheetByName('ToolInventory');
    const toolsRows  = toolsSheet.getDataRange().getValues();
    const tools = toolsRows.slice(1)
      .filter(r => r[0])
      .map(r => ({
        name:  String(r[0] || ''),
        notes: String(r[1] || ''),
        loc:   String(r[2] || ''),
      }));

    // ── Read move log (most recent first) ────────────
    const logSheet = ss.getSheetByName('MoveLog');
    const logRows  = logSheet.getDataRange().getValues();
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

    // ── Read job sites ────────────────────────────────
    const sitesSheet = ss.getSheetByName('JobSites');
    const sitesRows  = sitesSheet.getDataRange().getValues();
    const sites = sitesRows.slice(1)
      .filter(r => r[0])
      .map(r => ({
        name:     String(r[0] || ''),
        addedBy:  String(r[1] || ''),
        addedAt:  String(r[2] || ''),
      }));

    return json({ tools, log, sites });

  } catch(e) {
    return json({ error: e.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── Move tool ─────────────────────────────────────
    if (payload.action === 'move') {
      const toolsSheet = ss.getSheetByName('ToolInventory');
      const toolsRows  = toolsSheet.getDataRange().getValues();

      let updated = false;
      for (let i = 1; i < toolsRows.length; i++) {
        if (String(toolsRows[i][0]) === payload.toolName) {
          toolsSheet.getRange(i + 1, 3).setValue(payload.newLoc);
          updated = true;
          break;
        }
      }

      if (!updated) return json({ error: 'Tool not found: ' + payload.toolName });

      const logSheet = ss.getSheetByName('MoveLog');
      logSheet.appendRow([
        payload.toolName,
        payload.fromLoc,
        payload.newLoc,
        payload.movedBy,
        timestamp(),
      ]);

      return json({ success: true });
    }

    // ── Add site ──────────────────────────────────────
    if (payload.action === 'addSite') {
      const sitesSheet = ss.getSheetByName('JobSites');
      sitesSheet.appendRow([payload.siteName, payload.addedBy, timestamp()]);
      return json({ success: true });
    }

    // ── Remove site ───────────────────────────────────
    if (payload.action === 'removeSite') {
      const sitesSheet = ss.getSheetByName('JobSites');
      const sitesRows  = sitesSheet.getDataRange().getValues();

      for (let i = 1; i < sitesRows.length; i++) {
        if (String(sitesRows[i][0]) === payload.siteName) {
          sitesSheet.deleteRow(i + 1);
          return json({ success: true });
        }
      }

      return json({ error: 'Site not found: ' + payload.siteName });
    }

    return json({ error: 'Unknown action' });

  } catch(e) {
    return json({ error: e.message });
  }
}

function timestamp() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'MMM d, yyyy HH:mm'
  );
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
