import express from "express";
import path from "path";
import fs from "fs";

const app = express();

// Helper to fetch data from Google Sheets
async function fetchGoogleSheetsData(range: string, overrideSheetId?: string) {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const sheetId = overrideSheetId || process.env.GOOGLE_SHEET_ID;

  if (!apiKey || !sheetId) {
    throw new Error("Missing GOOGLE_SHEETS_API_KEY or GOOGLE_SHEET_ID in environment variables.");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || `Google Sheets API returned ${response.status}`);
    }
    
    return data.values || [];
  } catch (err: any) {
    console.error("[Sheets Error]", err.message);
    throw err;
  }
}

// --- API ROUTES ---

app.get("/api/sheets", async (req, res) => {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const zaimId = process.env.ZAIM_SHEET_ID;
  const mainId = process.env.GOOGLE_SHEET_ID;
  const sheetId = req.query.type === 'zaim' ? zaimId : mainId;

  if (!apiKey || !sheetId) {
    return res.status(500).json({ error: "Missing API Key or Sheet ID" });
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || `Google Sheets API returned ${response.status}`);
    }
    
    const sheetNames = data.sheets.map((s: any) => s.properties.title);
    res.json({
      id: sheetId,
      type: req.query.type || 'main',
      sheets: sheetNames
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  const sheetId = process.env.GOOGLE_SHEET_ID || "";
  const zaimId = process.env.ZAIM_SHEET_ID || "";
  res.json({ 
    status: "ok", 
    env: process.env.NODE_ENV,
    mainSheetId: sheetId ? `${sheetId.substring(0, 5)}...` : "not set",
    zaimSheetId: zaimId ? `${zaimId.substring(0, 5)}...` : "not set",
    hasApiKey: !!process.env.GOOGLE_SHEETS_API_KEY
  });
});

app.get("/api/data", async (req, res) => {
  const month = req.query.month as string || 'Jan26';
  console.log(`[API] Requesting data for: ${month}`);
  
  try {
    const range = `${month}!A2:AK1000`;
    const values = await fetchGoogleSheetsData(range);
    res.json(values);
  } catch (error: any) {
    res.status(500).json({ 
      error: "Failed to fetch data", 
      details: error.message 
    });
  }
});

app.get("/api/zaim", async (req, res) => {
  const zaimSheetId = process.env.ZAIM_SHEET_ID || process.env.GOOGLE_SHEET_ID;
  console.log(`[API] Requesting zaim data from: ${zaimSheetId}`);
  
  try {
    const range = `'Zaim'!A2:I1000`;
    const values = await fetchGoogleSheetsData(range, zaimSheetId);
    res.json(values);
  } catch (error: any) {
    res.status(500).json({ 
      error: "Failed to fetch zaim data", 
      details: `${error.message} (ID: ${zaimSheetId ? zaimSheetId.substring(0, 5) + '...' : 'none'})` 
    });
  }
});

app.get("/api/majlis-names", async (req, res) => {
  console.log(`[API] Requesting majlis names data`);
  
  try {
    const range = `'Majlis-Names'!A2:C1000`;
    const values = await fetchGoogleSheetsData(range);
    res.json(values);
  } catch (error: any) {
    res.status(500).json({ 
      error: "Failed to fetch majlis names data", 
      details: error.message 
    });
  }
});

// --- SERVER LOGIC ---

async function startServer() {
  const isVercel = !!process.env.VERCEL;
  const isProd = process.env.NODE_ENV === "production" || isVercel;

  if (!isProd) {
    // Only load Vite in local development
    console.log("Starting in DEVELOPMENT mode...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    // Production mode: Serve static files
    console.log("Starting in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Frontend build not found. Please run 'npm run build'.");
      }
    });
  }

  // Only start the listener if NOT on Vercel
  if (!isVercel) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  }
}

// Global error handler to prevent "A server error occurred" HTML
app.use((err: any, req: any, res: any, next: any) => {
  console.error("[Global Error]", err);
  res.status(500).json({ 
    error: "Internal Server Error", 
    message: err.message 
  });
});

startServer().catch(err => {
  console.error("Failed to start server:", err);
});

export default app;
