require("dotenv").config();
const express = require("express");
const cors = require("cors");
const https = require("https");
const { KiteTicker } = require("kiteconnect");

//node server.js
// /node rewrite-instruments-data.js .env
const app = express();
app.use(cors({ origin: "http://localhost:4200" })); // allow Angular dev
app.use(express.json());

// ---------------------
// 1. INDEX TOKENS (from instruments.csv originally)
// ---------------------
const INDEX_TOKENS = {
  NIFTY50: 256265,    // TODO: replace with real NIFTY 50 token
  BANKNIFTY: 260105,  // TODO: replace with real BANKNIFTY token
  SENSEX: 265,        // TODO: replace with real SENSEX token (BSE)
};

// latest index LTPs
const latest = {
  NIFTY50: null,
  BANKNIFTY: null,
  SENSEX: null,
};

// ---------------------
// 2. KITE TICKER
// ---------------------
const apiKey = process.env.KITE_API_KEY;
const accessToken = process.env.KITE_ACCESS_TOKEN;

if (!apiKey || !accessToken) {
  console.error("KITE_API_KEY or KITE_ACCESS_TOKEN missing in .env");
  process.exit(1);
}

const ticker = new KiteTicker({
  api_key: apiKey,
  access_token: accessToken,
});

ticker.connect();

ticker.on("connect", () => {
  console.log("Kite Ticker connected.");
  const tokens = Object.values(INDEX_TOKENS);
  console.log("Subscribing to:", tokens);
  ticker.subscribe(tokens);
  ticker.setMode(ticker.modeFull, tokens);
});

ticker.on("ticks", (ticks = []) => {
  ticks.forEach((t) => {
    if (t.instrument_token === INDEX_TOKENS.NIFTY50) {
      latest.NIFTY50 = t.last_price;
    } else if (t.instrument_token === INDEX_TOKENS.BANKNIFTY) {
      latest.BANKNIFTY = t.last_price;
    } else if (t.instrument_token === INDEX_TOKENS.SENSEX) {
      latest.SENSEX = t.last_price;
    }
  });
});

ticker.on("error", (err) => console.error("Ticker error:", err));
ticker.on("close", () => console.log("Ticker closed"));

// ---------------------
// 3. INSTRUMENTS CSV DOWNLOAD
// ---------------------
let instrumentsCsv = null;

function downloadInstruments() {
  return new Promise((resolve, reject) => {
    console.log("Downloading instruments from https://api.kite.trade/instruments ...");

    const req = https.request(
      "https://api.kite.trade/instruments",
      {
        method: "GET",
        headers: {
          "X-Kite-Version": "3", // not strictly required but recommended
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          console.error("Failed to download instruments. Status:", res.statusCode);
          res.resume(); // drain
          return reject(new Error("Bad status code " + res.statusCode));
        }

        let data = "";
        res.on("data", (chunk) => {
          data += chunk.toString("utf8");
        });

        res.on("end", () => {
          instrumentsCsv = data;
          console.log("Instruments CSV downloaded. Length:", data.length);
          resolve();
        });
      }
    );

    req.on("error", (err) => {
      console.error("Error downloading instruments:", err);
      reject(err);
    });

    req.end();
  });
}

// download once at startup
downloadInstruments().catch((err) => {
  console.error("Initial instruments download failed:", err);
});

// optional: refresh every 60 minutes
setInterval(() => {
  downloadInstruments().catch((err) =>
    console.error("Periodic instruments download failed:", err)
  );
}, 60 * 60 * 1000);

// ---------------------
// 4. REST API ENDPOINTS
// ---------------------

// Live index LTP for Angular
app.get("/api/index-ltp", (req, res) => {
  res.json({
    NIFTY50: latest.NIFTY50,
    BANKNIFTY: latest.BANKNIFTY,
    SENSEX: latest.SENSEX,
  });
});

// Instruments CSV for Angular
app.get("/api/instruments", (req, res) => {
  if (!instrumentsCsv) {
    return res.status(503).send("Instruments not loaded yet. Try again in a moment.");
  }
  res.type("text/plain").send(instrumentsCsv);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
