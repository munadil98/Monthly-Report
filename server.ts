import express from "express";
import path from "path";
import fs from "fs";

const app = express();

// Helper to fetch data from Google Sheets
async function fetchGoogleSheetsData(month: string) {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!apiKey || !sheetId) {
    throw new Error("Missing GOOGLE_SHEETS_API_KEY or GOOGLE_SHEET_ID in environment variables.");
  }

  const range = `${month}!A2:AK100`;
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

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    env: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL 
  });
});

app.get("/api/data", async (req, res) => {
  const month = req.query.month as string || 'Jan26';
  console.log(`[API] Requesting data for: ${month}`);
  
  try {
    const values = await fetchGoogleSheetsData(month);
    res.json(values);
  } catch (error: any) {
    res.status(500).json({ 
      error: "Failed to fetch data", 
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
