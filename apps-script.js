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
// 2. Edit the PIN values in setupPin() and setupAdminPin() below.
// 3. Run setupPin() ONCE, then run setupAdminPin() ONCE.
// 4. Delete both setup functions after running them.
// 5. Deploy as Web App: Execute as "Me", Access "Anyone".
// ─────────────────────────────────────────────────────────────────

// Run ONCE to set the crew PIN, then delete.
function setupPin() {
  PropertiesService.getScriptProperties().setProperty('TOOLTRACK_PIN', 'CHANGE_THIS_PIN');
  Logger.log('Crew PIN set. Delete this function now.');
}

// Run ONCE to set the admin PIN, then delete.
function setupAdminPin() {
  PropertiesService.getScriptProperties().setProperty('TOOLTRACK_ADMIN_PIN', 'CHANGE_THIS_ADMIN_PIN');
  Logger.log('Admin PIN set. Delete this function now.');
}

// ── VALIDATION HELPERS ────────────────────────────────────────────

function requirePin(pin) {
  const stored = PropertiesService.getScriptProperties().getProperty('TOOLTRACK_PIN');
  if (!stored) return;
  if (typeof pin !== 'string' || pin.trim() !== stored) {
    throw new Error('unauthorized');
  }
}

function requireAdminPin(pin) {
  const stored = PropertiesService.getScriptProperties().getProperty('TOOLTRACK_ADMIN_PIN');
  if (!stored) return;
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

// Strips control characters and trims. Applied to all user-supplied strings before writing to sheet.
function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
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
        jobCode: String(r[3] || ''),
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── Crew actions (crew PIN) ──────────────────────────────────

    if (payload.action === 'move') {
      requirePin(payload.pin);
      const toolName = sanitizeText(requireString(payload.toolName, 'toolName', 200));
      const newLoc   = sanitizeText(requireString(payload.newLoc,   'newLoc',   200));
      const fromLoc  = sanitizeText(requireString(payload.fromLoc,  'fromLoc',  200));
      const movedBy  = sanitizeText(requireString(payload.movedBy,  'movedBy',  100));

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

    // ── Admin actions (admin PIN) ────────────────────────────────

    if (payload.action === 'addTool') {
      requireAdminPin(payload.adminPin);
      const name    = sanitizeText(requireString(payload.name,    'name',    200));
      const notes   = sanitizeText(requireString(payload.notes || '', 'notes', 500) || '');
      const loc     = sanitizeText(requireString(payload.loc,     'loc',     200));
      const addedBy = sanitizeText(requireString(payload.addedBy, 'addedBy', 100));

      const toolsSheet = ss.getSheetByName('ToolInventory');
      const existing = toolsSheet.getDataRange().getValues();
      const duplicate = existing.slice(1).some(r => String(r[0]).trim().toLowerCase() === name.toLowerCase());
      if (duplicate) return json({ error: 'A tool with that name already exists' });

      toolsSheet.appendRow([name, notes, loc]);
      ss.getSheetByName('MoveLog').appendRow([name, '', loc, addedBy + ' (added)', timestamp()]);
      return json({ success: true });
    }

    if (payload.action === 'editTool') {
      requireAdminPin(payload.adminPin);
      const originalName = sanitizeText(requireString(payload.originalName, 'originalName', 200));
      const newName      = sanitizeText(requireString(payload.name,         'name',         200));
      const newNotes     = sanitizeText(payload.notes != null ? String(payload.notes) : '');
      const editedBy     = sanitizeText(requireString(payload.editedBy,     'editedBy',     100));

      const toolsSheet = ss.getSheetByName('ToolInventory');
      const rows = toolsSheet.getDataRange().getValues();

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === originalName) {
          toolsSheet.getRange(i + 1, 1).setValue(newName);
          toolsSheet.getRange(i + 1, 2).setValue(newNotes);
          ss.getSheetByName('MoveLog').appendRow([originalName, '', '', editedBy + ' (edited)', timestamp()]);
          return json({ success: true });
        }
      }
      return json({ error: 'Tool not found: ' + originalName });
    }

    if (payload.action === 'decommissionTool') {
      requireAdminPin(payload.adminPin);
      const toolName = sanitizeText(requireString(payload.toolName, 'toolName', 200));
      const movedBy  = sanitizeText(requireString(payload.movedBy,  'movedBy',  100));

      const toolsSheet = ss.getSheetByName('ToolInventory');
      const rows = toolsSheet.getDataRange().getValues();

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === toolName) {
          const fromLoc = String(rows[i][2] || '');
          toolsSheet.getRange(i + 1, 3).setValue('Decommissioned');
          ss.getSheetByName('MoveLog').appendRow([toolName, fromLoc, 'Decommissioned', movedBy, timestamp()]);
          return json({ success: true });
        }
      }
      return json({ error: 'Tool not found: ' + toolName });
    }

    if (payload.action === 'deleteTool') {
      requireAdminPin(payload.adminPin);
      const toolName  = sanitizeText(requireString(payload.toolName,  'toolName',  200));
      const deletedBy = sanitizeText(requireString(payload.deletedBy, 'deletedBy', 100));

      const toolsSheet = ss.getSheetByName('ToolInventory');
      const rows = toolsSheet.getDataRange().getValues();

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === toolName) {
          toolsSheet.deleteRow(i + 1);
          ss.getSheetByName('MoveLog').appendRow([toolName, '', '', deletedBy + ' (deleted)', timestamp()]);
          return json({ success: true });
        }
      }
      return json({ error: 'Tool not found: ' + toolName });
    }

    if (payload.action === 'addSite') {
      requireAdminPin(payload.adminPin);
      const siteName = sanitizeText(requireString(payload.siteName, 'siteName', 200));
      const jobCode  = sanitizeText(payload.jobCode ? String(payload.jobCode) : '');
      const addedBy  = sanitizeText(requireString(payload.addedBy,  'addedBy',  100));

      const sitesSheet = ss.getSheetByName('JobSites');
      const existing   = sitesSheet.getDataRange().getValues();
      const duplicate  = existing.slice(1).some(r => String(r[0]).toLowerCase() === siteName.toLowerCase());
      if (duplicate) return json({ error: 'Site already exists' });

      sitesSheet.appendRow([siteName, addedBy, timestamp(), jobCode]);
      return json({ success: true });
    }

    if (payload.action === 'editSite') {
      requireAdminPin(payload.adminPin);
      const siteName = sanitizeText(requireString(payload.siteName, 'siteName', 200));
      const jobCode  = sanitizeText(payload.jobCode ? String(payload.jobCode) : '');
      const editedBy = sanitizeText(requireString(payload.editedBy, 'editedBy', 100));

      const sitesSheet = ss.getSheetByName('JobSites');
      const rows = sitesSheet.getDataRange().getValues();

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === siteName) {
          sitesSheet.getRange(i + 1, 4).setValue(jobCode);
          return json({ success: true });
        }
      }
      return json({ error: 'Site not found: ' + siteName });
    }

    if (payload.action === 'removeSite') {
      requireAdminPin(payload.adminPin);
      const siteName   = sanitizeText(requireString(payload.siteName, 'siteName', 200));
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

    if (payload.action === 'bulkMove') {
      requireAdminPin(payload.adminPin);
      const fromSite = sanitizeText(requireString(payload.fromSite, 'fromSite', 200));
      const toSite   = sanitizeText(requireString(payload.toSite,   'toSite',   200));
      const movedBy  = sanitizeText(requireString(payload.movedBy,  'movedBy',  100));

      if (fromSite === toSite) return json({ error: 'Source and destination must be different' });

      const toolsSheet = ss.getSheetByName('ToolInventory');
      const logSheet   = ss.getSheetByName('MoveLog');
      const rows = toolsSheet.getDataRange().getValues();
      const ts = timestamp();
      let count = 0;

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][2]).trim() === fromSite) {
          toolsSheet.getRange(i + 1, 3).setValue(toSite);
          logSheet.appendRow([String(rows[i][0]), fromSite, toSite, movedBy, ts]);
          count++;
        }
      }

      return json({ success: true, count });
    }

    return json({ error: 'Unknown action' });

  } catch (e) {
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
