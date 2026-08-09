const express = require("express");

const app = express();

const PORT = 3000;

// ============================================================
// ONE REFRESH VARIABLE FOR EVERYTHING
// ============================================================

const REFRESH_INTERVAL = 5000; // 5 seconds


// ============================================================
// ROUTER
// ============================================================

const ROUTER_URL =
  "http://192.168.8.1/cgi-bin/http.cgi";


// ============================================================
// AUTHENTICATION
// ============================================================

const USERNAME = "admin";

const PASSWORD_HASH =
  "21232f297a57a5a743894a0e4a801fc3";

let sessionId =
  "a6083050f28651c60b4ec9a6e74d7b62d0028e83c9f30bd4175622505c3520ab";

let sessionCookie =
  "DekAifiYqaou1BeBRHCMdt+5lHTJJBsW5PC8rF1aJcH08s7pA2nT0YdtGGMTmi6pe0bOmxCE2FpmZKVVhJ4YreTJbhQAsu1RDz79IP8ttfJCWRUzdaUe55n2FRi6hacx";

const MAX_AUTH_RETRIES = 100;

const AUTH_RETRY_DELAY = 5000;


// ============================================================
// STATE
// ============================================================

let authenticating = false;

let authenticationPromise = null;

let authAttempt = 0;

let routerStatus = "connecting";

let previousCounters = null;

let currentSpeed = {
  downloadKB: 0,
  downloadMbps: 0,
  uploadKB: 0,
  uploadMbps: 0
};

let routerInfo = {

  rssi: "--",

  connectStatus: "--",

  wanIP: "--",

  wanIPv6: "--",

  wanGateway: "--",

  wanDNS: "--",

  wanDNS2: "--",

  wanMask: "--",

  wanMac: "--",

  wanRxBytes: 0,

  wanTxBytes: 0,

  wanRxPackets: 0,

  wanTxPackets: 0,

  uptime: "--",

  imei: "--",

  plmn: "--",

  lanIP: "--",

  lanIPv6: "--",

  lanMask: "--",

  lanMac: "--",

  dhcpServer: "--",

  netDevStatus: "--"
};


// ============================================================
// SLEEP
// ============================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================================
// ROUTER REQUEST
// ============================================================

async function routerRequest(payload, referer) {

  const response = await fetch(
    ROUTER_URL,
    {
      method: "POST",

      headers: {

        "Accept":
          "text/plain, */*; q=0.01",

        "Accept-Language":
          "en-US,en;q=0.9,tr;q=0.8",

        "Connection":
          "keep-alive",

        "Content-Type":
          "application/json; charset=UTF-8",

        "Cookie":
          `SessionID=${sessionCookie}; sessionId=${sessionId}`,

        "DNT":
          "1",

        "Origin":
          "http://192.168.8.1",

        "Referer":
          referer,

        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/151.0.0.0 Safari/537.36",

        "X-Requested-With":
          "XMLHttpRequest"
      },

      body:
        JSON.stringify(payload)
    }
  );


  // Capture cookies returned by router

  const setCookie =
    response.headers.get("set-cookie");


  if (setCookie) {

    const sessionMatch =
      setCookie.match(
        /SessionID=([^;]+)/i
      );

    if (sessionMatch) {
      sessionCookie =
        sessionMatch[1];
    }


    const sessionIdMatch =
      setCookie.match(
        /sessionId=([^;]+)/i
      );

    if (sessionIdMatch) {
      sessionId =
        sessionIdMatch[1];
    }
  }


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `HTTP ${response.status}`
    );
  }


  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    data =
      text;
  }


  return {
    data,
    text
  };
}


// ============================================================
// INVALID SESSION DETECTION
// ============================================================

function isInvalidSession(data, text = "") {

  const responseText =
    (
      JSON.stringify(data) +
      " " +
      text
    ).toLowerCase();


  const invalidWords = [

    "invalid session",

    "session invalid",

    "invalid_session",

    "session_invalid",

    "session expired",

    "session_expired",

    "session timeout",

    "session_timeout",

    "login required",

    "unauthorized",

    "authentication failed",

    "auth failed",

    "invalid token",

    "invalid_token"
  ];


  return invalidWords.some(
    word =>
      responseText.includes(word)
  );
}


// ============================================================
// FIND SESSION ID
// ============================================================

function findSessionId(data) {

  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }


  const possibleKeys = [

    "sessionId",

    "sessionID",

    "session_id",

    "sid"
  ];


  for (
    const key of possibleKeys
  ) {

    if (
      data[key] &&
      String(data[key]).length > 10
    ) {

      return String(
        data[key]
      );
    }
  }


  return null;
}


// ============================================================
// CMD 0
// ============================================================

async function getRouterInfo() {

  const payload = {

    cmd: 0,

    method: "GET",

    language: "EN",

    sessionId
  };


  return routerRequest(

    payload,

    "http://192.168.8.1/mindex.html?t=203419"
  );
}


// ============================================================
// UPDATE ROUTER INFORMATION
// ============================================================

function updateRouterInfo(data) {

  if (
    !data ||
    typeof data !== "object"
  ) {
    return;
  }


  routerInfo = {

    ...routerInfo,

    rssi:
      data.rssi ??
      routerInfo.rssi,

    connectStatus:
      data.connectStatus ??
      routerInfo.connectStatus,

    wanIP:
      data.wanIP ??
      routerInfo.wanIP,

    wanIPv6:
      data.wanIPV6 ??
      routerInfo.wanIPv6,

    wanGateway:
      data.wanGateway ??
      routerInfo.wanGateway,

    wanDNS:
      data.wanDNS ??
      routerInfo.wanDNS,

    wanDNS2:
      data.wanDNS_2 ??
      routerInfo.wanDNS2,

    wanMask:
      data.wanMaskIp ??
      routerInfo.wanMask,

    wanMac:
      data.wanMac ??
      routerInfo.wanMac,

    wanRxBytes:
      Number(
        data.wanRxBytes ??
        routerInfo.wanRxBytes
      ),

    wanTxBytes:
      Number(
        data.wanTxBytes ??
        routerInfo.wanTxBytes
      ),

    wanRxPackets:
      Number(
        data.wanRxPackets ??
        routerInfo.wanRxPackets
      ),

    wanTxPackets:
      Number(
        data.wanTxPackets ??
        routerInfo.wanTxPackets
      ),

    uptime:
      data.uptime ??
      routerInfo.uptime,

    imei:
      data.imei ??
      routerInfo.imei,

    plmn:
      data.plmn ??
      routerInfo.plmn,

    lanIP:
      data.lanIP ??
      routerInfo.lanIP,

    lanIPv6:
      data.lanIPV6 ??
      routerInfo.lanIPv6,

    lanMask:
      data.lanMaskIp ??
      routerInfo.lanMask,

    lanMac:
      data.lanMac ??
      routerInfo.lanMac,

    dhcpServer:
      data.dhcpServer ??
      routerInfo.dhcpServer,

    netDevStatus:
      data.netDevStatus ??
      routerInfo.netDevStatus
  };
}


// ============================================================
// SPEED CALCULATION
// ============================================================

function calculateSpeed(
  previous,
  current
) {

  if (!previous) {

    return {

      downloadKB: 0,

      downloadMbps: 0,

      uploadKB: 0,

      uploadMbps: 0
    };
  }


  const seconds =
    (
      current.timestamp -
      previous.timestamp
    ) / 1000;


  if (seconds <= 0) {

    return {

      downloadKB: 0,

      downloadMbps: 0,

      uploadKB: 0,

      uploadMbps: 0
    };
  }


  let rxBytes =
    current.rxBytes -
    previous.rxBytes;


  let txBytes =
    current.txBytes -
    previous.txBytes;


  // Counter reset protection

  if (rxBytes < 0) {
    rxBytes = 0;
  }


  if (txBytes < 0) {
    txBytes = 0;
  }


  const rxBytesPerSecond =
    rxBytes / seconds;


  const txBytesPerSecond =
    txBytes / seconds;


  const downloadKB =
    rxBytesPerSecond / 1024;


  const uploadKB =
    txBytesPerSecond / 1024;


  const downloadMbps =
    (
      rxBytesPerSecond * 8
    ) / 1000000;


  const uploadMbps =
    (
      txBytesPerSecond * 8
    ) / 1000000;


  return {

    downloadKB,

    downloadMbps,

    uploadKB,

    uploadMbps
  };
}


// ============================================================
// AUTHENTICATION
// ============================================================

async function authenticate() {

  if (authenticationPromise) {
    return authenticationPromise;
  }


  authenticationPromise =
    (async () => {

      authenticating = true;

      previousCounters = null;


      for (
        let attempt = 1;

        attempt <= MAX_AUTH_RETRIES;

        attempt++
      ) {

        authAttempt =
          attempt;

        routerStatus =
          "authenticating";


        try {

          console.log(
            `Authentication attempt ${attempt}/${MAX_AUTH_RETRIES}`
          );


          // HARD-CODED AUTH PAYLOAD

          const payload = {

            cmd: 100,

            method: "POST",

            sessionId,

            username:
              USERNAME,

            passwd:
              PASSWORD_HASH,

            language:
              "EN"
          };


          const authResult =
            await routerRequest(

              payload,

              "http://192.168.8.1/login.html?t=869365"
            );


          console.log(
            "Authentication response:",
            authResult.data
          );


          const newSessionId =
            findSessionId(
              authResult.data
            );


          if (newSessionId) {

            sessionId =
              newSessionId;
          }


          // Verify authentication

          const verify =
            await getRouterInfo();


          if (
            isInvalidSession(
              verify.data,
              verify.text
            )
          ) {

            throw new Error(
              "Authentication rejected"
            );
          }


          if (
            verify.data &&
            typeof verify.data === "object" &&
            verify.data.success === false
          ) {

            throw new Error(
              "Router returned success:false"
            );
          }


          authenticating =
            false;

          authAttempt =
            0;

          routerStatus =
            "connected";


          console.log(
            "Authentication successful."
          );


          return true;

        } catch (error) {

          console.error(

            `Authentication failed ${attempt}/${MAX_AUTH_RETRIES}:`,

            error.message
          );


          if (
            attempt >=
            MAX_AUTH_RETRIES
          ) {

            authenticating =
              false;

            routerStatus =
              "authentication_failed";

            return false;
          }


          await sleep(
            AUTH_RETRY_DELAY
          );
        }
      }


      authenticating =
        false;

      return false;

    })();


  try {

    return await authenticationPromise;

  } finally {

    authenticationPromise =
      null;
  }
}


// ============================================================
// POLL ROUTER
// ============================================================

async function pollRouter() {

  if (authenticating) {
    return;
  }


  try {

    const result =
      await getRouterInfo();


    // Session expired

    if (
      isInvalidSession(
        result.data,
        result.text
      )
    ) {

      console.log(
        "Session expired."
      );

      await authenticate();

      return;
    }


    // success:false

    if (
      result.data &&
      typeof result.data === "object" &&
      result.data.success === false
    ) {

      console.log(
        "Router returned success:false."
      );

      await authenticate();

      return;
    }


    updateRouterInfo(
      result.data
    );


    const rxBytes =
      Number(
        result.data.wanRxBytes
      );


    const txBytes =
      Number(
        result.data.wanTxBytes
      );


    if (
      !Number.isFinite(rxBytes) ||
      !Number.isFinite(txBytes)
    ) {

      console.log(
        "Invalid traffic counters."
      );

      return;
    }


    const counters = {

      rxBytes,

      txBytes,

      timestamp:
        Date.now()
    };


    currentSpeed =
      calculateSpeed(

        previousCounters,

        counters
      );


    previousCounters =
      counters;


    routerStatus =
      "connected";


  } catch (error) {

    console.error(
      "Router request error:",
      error.message
    );


    await authenticate();
  }
}


// ============================================================
// START ROUTER POLLING
// ============================================================

pollRouter();


// ONE VARIABLE CONTROLS THIS

setInterval(
  pollRouter,
  REFRESH_INTERVAL
);


// ============================================================
// API
// ============================================================

app.get(
  "/api/speed",
  (req, res) => {

    res.setHeader(
      "Cache-Control",
      "no-store"
    );


    res.json({

      status:
        routerStatus,

      authAttempt,

      maxAuthRetries:
        MAX_AUTH_RETRIES,

      speed:
        currentSpeed,

      router:
        routerInfo
    });
  }
);


// ============================================================
// HTML
// ============================================================

app.get(
  "/",
  (req, res) => {

    res.send(`

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>
Internet Speed
</title>


<style>

* {
  box-sizing: border-box;
}


body {

  margin: 0;

  padding: 30px 20px;

  font-family:
    Arial,
    sans-serif;

  background:
    #f5f5f5;

  color:
    #222;
}


.container {

  max-width:
    900px;

  margin:
    auto;
}


h1 {

  text-align:
    center;

  margin-bottom:
    25px;
}


.card {

  background:
    white;

  padding:
    25px;

  border-radius:
    15px;

  box-shadow:
    0 4px 20px
    rgba(0,0,0,0.1);

  margin-bottom:
    20px;
}


.speed {

  display:
    flex;

  justify-content:
    space-between;

  align-items:
    center;

  padding:
    22px;

  margin-bottom:
    15px;

  background:
    #f8f8f8;

  border-radius:
    12px;
}


.speed:last-child {
  margin-bottom: 0;
}


.label {

  color:
    #777;

  font-size:
    14px;

  margin-bottom:
    7px;
}


#downloadKB,
#uploadKB {

  font-size:
    22px;

  font-weight:
    bold;
}


.value {

  font-size:
    32px;

  font-weight:
    bold;
}


#status {

  text-align:
    center;

  margin:
    15px 0 20px;

  color:
    #555;
}


.info-title {

  font-size:
    20px;

  font-weight:
    bold;

  margin-bottom:
    20px;
}


.info-grid {

  display:
    grid;

  grid-template-columns:
    repeat(2, 1fr);

  gap:
    12px;
}


.info-item {

  padding:
    12px;

  background:
    #f7f7f7;

  border-radius:
    8px;
}


.info-label {

  font-size:
    12px;

  color:
    #777;

  margin-bottom:
    5px;
}


.info-value {

  font-size:
    15px;

  font-weight:
    600;

  word-break:
    break-word;
}


.title-option {

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  gap:
    15px;

  padding:
    12px;

  background:
    #f7f7f7;

  border-radius:
    8px;
}


.title-option label {

  font-size:
    14px;

  color:
    #555;
}


.title-option select {

  padding:
    8px 12px;

  border:
    1px solid #ddd;

  border-radius:
    7px;

  background:
    white;

  font-size:
    14px;

  cursor:
    pointer;
}


@media (max-width: 600px) {

  .info-grid {

    grid-template-columns:
      1fr;
  }


  .title-option {

    flex-direction:
      column;

    align-items:
      stretch;
  }

}

</style>

</head>


<body>


<div class="container">


<h1>
Internet Speed
</h1>


<!-- SPEED -->

<div class="card">


  <div class="speed">


    <div>

      <div class="label">
        ↓ Download
      </div>


      <div id="downloadKB">
        0 KB/s
      </div>

    </div>


    <div>

      <div class="label">
        Mbps
      </div>


      <div
        id="downloadMbps"
        class="value"
      >
        0
      </div>

    </div>


  </div>


  <div class="speed">


    <div>

      <div class="label">
        ↑ Upload
      </div>


      <div id="uploadKB">
        0 KB/s
      </div>

    </div>


    <div>

      <div class="label">
        Mbps
      </div>


      <div
        id="uploadMbps"
        class="value"
      >
        0
      </div>

    </div>


  </div>


</div>


<div id="status">
Connecting to router...
</div>


<!-- TITLE FORMAT -->

<div class="card">


  <div class="title-option">


    <label>
      Browser title speed format
    </label>


    <select
      id="titleFormat"
      onchange="changeTitleFormat()"
    >

      <option
        value="KB"
        selected
      >
        ↑ 13 KB | ↓ 191 KB | 105 dBm
      </option>


      <option
        value="KB/s"
      >
        ↑ 13 KB/s | ↓ 191 KB/s | 105 dBm
      </option>


      <option
        value="NONE"
      >
        ↑ 13 | ↓ 191 | 105 dBm
      </option>

    </select>


  </div>


</div>


<!-- ROUTER INFORMATION -->

<div class="card">


  <div class="info-title">
    Router Information
  </div>


  <div class="info-grid">


    <div class="info-item">
      <div class="info-label">RSSI</div>
      <div id="rssi" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">Connection</div>
      <div id="connectStatus" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">WAN IP</div>
      <div id="wanIP" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">WAN IPv6</div>
      <div id="wanIPv6" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">Gateway</div>
      <div id="wanGateway" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">DNS</div>
      <div id="wanDNS" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">DNS 2</div>
      <div id="wanDNS2" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">WAN Mask</div>
      <div id="wanMask" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">WAN MAC</div>
      <div id="wanMac" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">IMEI</div>
      <div id="imei" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">PLMN</div>
      <div id="plmn" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">LAN IP</div>
      <div id="lanIP" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">DHCP Server</div>
      <div id="dhcpServer" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">Router Uptime</div>
      <div id="uptime" class="info-value">--</div>
    </div>


    <div class="info-item">
      <div class="info-label">RX Packets</div>
      <div id="rxPackets" class="info-value">0</div>
    </div>


    <div class="info-item">
      <div class="info-label">TX Packets</div>
      <div id="txPackets" class="info-value">0</div>
    </div>


    <div class="info-item">
      <div class="info-label">Network Device</div>
      <div id="netDevStatus" class="info-value">--</div>
    </div>


  </div>


</div>


</div>


<script>

// ============================================================
// SAME REFRESH INTERVAL AS SERVER
// ============================================================

const REFRESH_INTERVAL = 5000;


// ============================================================
// TITLE FORMAT
// ============================================================

let titleFormat = "KB";


const savedTitleFormat =
  localStorage.getItem(
    "routerTitleFormat"
  );


if (
  savedTitleFormat === "KB" ||
  savedTitleFormat === "KB/s" ||
  savedTitleFormat === "NONE"
) {

  titleFormat =
    savedTitleFormat;


  document.getElementById(
    "titleFormat"
  ).value =
    savedTitleFormat;
}


// ============================================================
// DATA
// ============================================================

let latestSpeed = null;

let latestRouter = null;


// ============================================================
// TITLE FORMAT CHANGE
// ============================================================

function changeTitleFormat() {

  titleFormat =
    document.getElementById(
      "titleFormat"
    ).value;


  localStorage.setItem(
    "routerTitleFormat",
    titleFormat
  );


  updateBrowserTitle();
}


// ============================================================
// UPDATE TITLE
// ============================================================

function updateBrowserTitle() {

  if (
    !latestSpeed ||
    !latestRouter
  ) {
    return;
  }


  const upload =
    Math.floor(
      Number(
        latestSpeed.uploadKB
      )
    );


  const download =
    Math.floor(
      Number(
        latestSpeed.downloadKB
      )
    );


  const rssiNumber =
    Number(
      latestRouter.rssi
    );


  const rssi =
    Number.isFinite(rssiNumber)
      ? Math.abs(rssiNumber)
      : "--";


  let title;


  if (titleFormat === "KB") {

    title =
      "↑ " +
      upload +
      " KB | ↓ " +
      download +
      " KB | " +
      rssi +
      " dBm";

  } else if (titleFormat === "KB/s") {

    title =
      "↑ " +
      upload +
      " KB/s | ↓ " +
      download +
      " KB/s | " +
      rssi +
      " dBm";

  } else {

    title =
      "↑ " +
      upload +
      " | ↓ " +
      download +
      " | " +
      rssi +
      " dBm";
  }


  document.title =
    title;
}


// ============================================================
// UPDATE PAGE
// ============================================================

async function updateSpeed() {

  try {

    const response =
      await fetch(
        "/api/speed?t=" +
        Date.now(),
        {
          cache:
            "no-store"
        }
      );


    const result =
      await response.json();


    const speed =
      result.speed;


    const router =
      result.router;


    latestSpeed =
      speed;


    latestRouter =
      router;


    // ========================================================
    // STATUS
    // ========================================================

    if (
      result.status ===
      "authenticating"
    ) {

      document.title =
        "Auth " +
        result.authAttempt +
        "/" +
        result.maxAuthRetries;


      document.getElementById(
        "status"
      ).textContent =
        "Re-authenticating... " +
        result.authAttempt +
        "/" +
        result.maxAuthRetries;

    } else if (
      result.status ===
      "authentication_failed"
    ) {

      document.title =
        "Authentication Failed";


      document.getElementById(
        "status"
      ).textContent =
        "Authentication failed after " +
        result.maxAuthRetries +
        " attempts";

    } else {

      document.getElementById(
        "status"
      ).textContent =
        "Connected • Live traffic";


      updateBrowserTitle();
    }


    // ========================================================
    // SPEED
    // ========================================================

    document.getElementById(
      "downloadKB"
    ).textContent =
      Number(
        speed.downloadKB
      ).toFixed(2) +
      " KB/s";


    document.getElementById(
      "downloadMbps"
    ).textContent =
      Number(
        speed.downloadMbps
      ).toFixed(2);


    document.getElementById(
      "uploadKB"
    ).textContent =
      Number(
        speed.uploadKB
      ).toFixed(2) +
      " KB/s";


    document.getElementById(
      "uploadMbps"
    ).textContent =
      Number(
        speed.uploadMbps
      ).toFixed(2);


    // ========================================================
    // ROUTER INFORMATION
    // ========================================================

    document.getElementById(
      "rssi"
    ).textContent =
      router.rssi +
      " dBm";


    document.getElementById(
      "connectStatus"
    ).textContent =
      router.connectStatus;


    document.getElementById(
      "wanIP"
    ).textContent =
      router.wanIP;


    document.getElementById(
      "wanIPv6"
    ).textContent =
      router.wanIPv6;


    document.getElementById(
      "wanGateway"
    ).textContent =
      router.wanGateway;


    document.getElementById(
      "wanDNS"
    ).textContent =
      router.wanDNS;


    document.getElementById(
      "wanDNS2"
    ).textContent =
      router.wanDNS2;


    document.getElementById(
      "wanMask"
    ).textContent =
      router.wanMask;


    document.getElementById(
      "wanMac"
    ).textContent =
      router.wanMac;


    document.getElementById(
      "imei"
    ).textContent =
      router.imei;


    document.getElementById(
      "plmn"
    ).textContent =
      router.plmn;


    document.getElementById(
      "lanIP"
    ).textContent =
      router.lanIP;


    document.getElementById(
      "dhcpServer"
    ).textContent =
      router.dhcpServer;


    document.getElementById(
      "uptime"
    ).textContent =
      router.uptime;


    document.getElementById(
      "rxPackets"
    ).textContent =
      Number(
        router.wanRxPackets
      ).toLocaleString();


    document.getElementById(
      "txPackets"
    ).textContent =
      Number(
        router.wanTxPackets
      ).toLocaleString();


    document.getElementById(
      "netDevStatus"
    ).textContent =
      router.netDevStatus;


  } catch (error) {

    console.error(
      error
    );


    document.title =
      "Router Offline";


    document.getElementById(
      "status"
    ).textContent =
      "Unable to connect to router";
  }
}


// ============================================================
// INITIAL LOAD
// ============================================================

updateSpeed();


// ============================================================
// ONE VARIABLE CONTROLS BROWSER REFRESH
// ============================================================

setInterval(
  updateSpeed,
  REFRESH_INTERVAL
);

</script>


</body>

</html>

    `);
  }
);


// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {

    console.log(
      `Router monitor running at http://localhost:${PORT}`
    );

    console.log(
      `Refresh interval: ${REFRESH_INTERVAL / 1000} seconds`
    );

    console.log(
      `Authentication retries: ${MAX_AUTH_RETRIES}`
    );
  }
);