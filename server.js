require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { KiteTicker } = require("kiteconnect");

const app = express();
app.use(cors({ origin: "http://localhost:4200" })); // allow Angular

// ---------------------
// 1. YOUR INDEX TOKENS
// ---------------------
// Replace these using instruments.csv
// (filter: instrument_type = INDX)
const INDEX_TOKENS = {
  NIFTY50: 256265,    // NSE:NIFTY 50 index token
  BANKNIFTY: 260105,  // NSE:BANKNIFTY index token
  SENSEX: 265,        // BSE:SENSEX index token
};

// Store latest LTPs
const latest = {
  NIFTY50: null,
  BANKNIFTY: null,
  SENSEX: null,
};

// ---------------------
// 2. Connect Kite Ticker
// ---------------------
const apiKey = process.env.KITE_API_KEY;
const accessToken = process.env.KITE_ACCESS_TOKEN;

const ticker = new KiteTicker({
  api_key: apiKey,
  access_token: accessToken,
});

// Connect websocket
ticker.connect();

ticker.on("connect", () => {
  console.log("Kite Ticker connected.");

  const tokens = Object.values(INDEX_TOKENS);

  console.log("Subscribing to:", tokens);
  ticker.subscribe(tokens);
  ticker.setMode(ticker.modeFull, tokens);
});

// Receive ticks
ticker.on("ticks", (ticks) => {
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

// Log events
ticker.on("error", (err) => console.error("Ticker error:", err));
ticker.on("close", () => console.log("Ticker closed"));
ticker.on("noreconnect", () => console.log("No reconnect will happen"));
ticker.on("reconnecting", (interval, count) => {
  console.log(`Reconnecting... Attempt ${count}, Interval ${interval}`);
});

// ---------------------
// 3. REST API for Angular
// ---------------------
app.get("/api/index-ltp", (req, res) => {
  res.json({
    NIFTY50: latest.NIFTY50,
    BANKNIFTY: latest.BANKNIFTY,
    SENSEX: latest.SENSEX,
  });
});

// ---------------------
// 4. Start Server
// ---------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
