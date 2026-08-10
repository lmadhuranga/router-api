// ============================================================
// ROUTER CONFIGURATION
// ============================================================

const ROUTER_URL =
  "http://192.168.8.1/cgi-bin/http.cgi";

const ROUTER_ORIGIN =
  "http://192.168.8.1";

const ROUTER_REFERER =
  "http://192.168.8.1/mindex.html";


// ============================================================
// REFRESH CONFIGURATION
// ============================================================

const REFRESH_INTERVAL = 2000;

const MAX_AUTH_RETRIES = 100;

const AUTH_RETRY_DELAY = 2000;


// ============================================================
// AUTHENTICATION
// ============================================================

const USERNAME = "admin";

// MD5:
// 21232f297a57a5a743894a0e4a801fc3 = admin
const PASSWORD_HASH =
  "21232f297a57a5a743894a0e4a801fc3";


// Initial SessionID from router
// This is used as the cookie when authenticating.
let sessionCookie =
  "DekAifiYqaou1BeBRHCMdt+5lHTJJBsW5PC8rF1aJcH08s7pA2nT0YdtGGMTmi6pe0bOmxCE2FpmZKVVhJ4YreTJbhQAsu1RDz79IP8ttfJCWRUzdaUe55n2FRi6hacx";


// Current API session ID
let sessionId =
  "a6083050f28651c60b4ec9a6e74d7b62d0028e83c9f30bd4175622505c3520ab";


// ============================================================
// CURRENT DATA
// ============================================================

let latestSpeed = {

  downloadKB: 0,

  uploadKB: 0,

  downloadMbps: 0,

  uploadMbps: 0
};


let latestRouter = {

  rssi: "--",

  wanRxBytes: 0,

  wanTxBytes: 0,

  wanRxPackets: 0,

  wanTxPackets: 0,

  wanIP: "",

  wanGateway: "",

  plmn: "",

  uptime: ""
};


let currentStatus =
  "connecting";


// ============================================================
// PREVIOUS COUNTERS
// ============================================================

let previousRxBytes = null;

let previousTxBytes = null;

let previousTimestamp = null;


// ============================================================
// REQUEST LOCK
// ============================================================

let refreshRunning = false;

let authenticationRunning = false;


// ============================================================
// HELPER - DELAY
// ============================================================

function sleep(ms) {

  return new Promise(
    resolve => setTimeout(resolve, ms)
  );
}


// ============================================================
// BADGE
// ============================================================

function updateBadge() {

  const download =
    Math.floor(
      Number(
        latestSpeed.downloadKB
      ) || 0
    );


  // Badge text = download speed

  chrome.action.setBadgeText({

    text:
      download > 0
        ? String(download)
        : "0"

  });


  // ----------------------------------------------------------
  // RSRP
  // ----------------------------------------------------------

  const rssiNumber =
    Number(
      latestRouter.rssi
    );


  if (
    !Number.isFinite(
      rssiNumber
    )
  ) {

    chrome.action.setBadgeBackgroundColor({

      color: "#64748b"

    });

    return;
  }


  const rssi =
    Math.abs(
      Math.round(
        rssiNumber
      )
    );


  // ----------------------------------------------------------
  // <= 105 = GREEN
  // > 105 = RED
  // ----------------------------------------------------------

  if (rssi <= 105) {

    chrome.action.setBadgeBackgroundColor({

      color: "#22c55e"

    });

  } else {

    chrome.action.setBadgeBackgroundColor({

      color: "#ef4444"

    });
  }
}


// ============================================================
// UPDATE BADGE ERROR STATE
// ============================================================

function setBadgeError() {

  chrome.action.setBadgeText({

    text: "!"

  });


  chrome.action.setBadgeBackgroundColor({

    color: "#ef4444"

  });
}


// ============================================================
// CLEAR BADGE
// ============================================================

function clearBadge() {

  chrome.action.setBadgeText({

    text: ""

  });
}


// ============================================================
// COMMON HEADERS
// ============================================================

function getHeaders() {

  return {

    "Accept":
      "text/plain, */*; q=0.01",

    "Accept-Language":
      "en-US,en;q=0.9,tr;q=0.8",

    "Connection":
      "keep-alive",

    "Content-Type":
      "application/json; charset=UTF-8",

    "DNT":
      "1",

    "Origin":
      ROUTER_ORIGIN,

    "Referer":
      ROUTER_REFERER,

    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",

    "X-Requested-With":
      "XMLHttpRequest"
  };
}


// ============================================================
// API REQUEST
// ============================================================

async function routerRequest(
  payload,
  useCookie = true
) {

  const headers =
    getHeaders();


  // ----------------------------------------------------------
  // Cookie
  // ----------------------------------------------------------

  if (
    useCookie &&
    sessionCookie
  ) {

    headers["Cookie"] =
      `SessionID=${sessionCookie}; sessionId=${sessionId}`;
  }


  const response =
    await fetch(
      ROUTER_URL,
      {

        method: "POST",

        headers,

        body:
          JSON.stringify(
            payload
          ),

        cache: "no-store"
      }
    );


  if (!response.ok) {

    throw new Error(
      `HTTP ${response.status}`
    );
  }


  const text =
    await response.text();


  if (!text) {

    throw new Error(
      "Empty router response"
    );
  }


  let data;


  try {

    data =
      JSON.parse(text);

  } catch (error) {

    console.error(
      "Invalid JSON:",
      text
    );

    throw new Error(
      "Invalid router response"
    );
  }


  return data;
}


// ============================================================
// AUTHENTICATION
// ============================================================

async function authenticate() {

  if (
    authenticationRunning
  ) {

    return false;
  }


  authenticationRunning =
    true;


  currentStatus =
    "authenticating";


  console.log(
    "Starting router authentication..."
  );


  try {

    for (
      let attempt = 1;
      attempt <= MAX_AUTH_RETRIES;
      attempt++
    ) {

      console.log(
        `Authentication attempt ${attempt}/${MAX_AUTH_RETRIES}`
      );


      try {

        const payload = {

          cmd: 100,

          method: "POST",

          sessionId:
            sessionId,

          username:
            USERNAME,

          passwd:
            PASSWORD_HASH,

          language:
            "EN"
        };


        const data =
          await routerRequest(
            payload,
            true
          );


        console.log(
          "Authentication response:",
          data
        );


        // ----------------------------------------------------
        // Authentication failed
        // ----------------------------------------------------

        if (
          !data ||
          data.success === false
        ) {

          throw new Error(
            "Authentication failed"
          );
        }


        // ----------------------------------------------------
        // Get new sessionId
        // ----------------------------------------------------

        const newSessionId =
          findSessionId(
            data
          );


        if (newSessionId) {

          sessionId =
            newSessionId;

          console.log(
            "New sessionId:",
            sessionId
          );
        }


        // ----------------------------------------------------
        // Get SessionID if returned
        // ----------------------------------------------------

        const newSessionCookie =
          findSessionCookie(
            data
          );


        if (newSessionCookie) {

          sessionCookie =
            newSessionCookie;
        }


        currentStatus =
          "connected";


        authenticationRunning =
          false;


        console.log(
          "Router authentication successful"
        );


        clearBadge();


        return true;

      } catch (error) {

        console.error(
          `Authentication attempt ${attempt} failed:`,
          error
        );


        currentStatus =
          "authentication_failed";


        if (
          attempt >=
          MAX_AUTH_RETRIES
        ) {

          console.error(
            "Maximum authentication attempts reached."
          );


          setBadgeError();

          authenticationRunning =
            false;

          return false;
        }


        await sleep(
          AUTH_RETRY_DELAY
        );
      }
    }

  } finally {

    authenticationRunning =
      false;
  }


  return false;
}


// ============================================================
// FIND SESSION ID
// ============================================================

function findSessionId(data) {

  if (!data) {
    return null;
  }


  const possibleKeys = [

    "sessionId",

    "sessionID",

    "SessionID",

    "session",

    "sid"

  ];


  for (
    const key of possibleKeys
  ) {

    if (
      typeof data[key] ===
      "string" &&
      data[key].length > 0
    ) {

      return data[key];
    }
  }


  return null;
}


// ============================================================
// FIND SESSION COOKIE
// ============================================================

function findSessionCookie(data) {

  if (!data) {
    return null;
  }


  const possibleKeys = [

    "SessionID",

    "sessionID",

    "sessionCookie",

    "cookie"

  ];


  for (
    const key of possibleKeys
  ) {

    if (
      typeof data[key] ===
      "string" &&
      data[key].length > 0
    ) {

      return data[key];
    }
  }


  return null;
}


// ============================================================
// GET BASIC ROUTER INFORMATION
// cmd: 0
// ============================================================

async function getRouterInformation() {

  const payload = {

    cmd: 0,

    method: "GET",

    language: "EN",

    sessionId:
      sessionId
  };


  const data =
    await routerRequest(
      payload
    );


  // ----------------------------------------------------------
  // Session invalid
  // ----------------------------------------------------------

  if (
    isSessionInvalid(data)
  ) {

    throw new Error(
      "SESSION_EXPIRED"
    );
  }


  if (
    data &&
    data.success === false
  ) {

    throw new Error(
      "SESSION_EXPIRED"
    );
  }


  // ----------------------------------------------------------
  // Router data
  // ----------------------------------------------------------

  latestRouter = {

    ...latestRouter,

    rssi:
      data.rssi ??
      latestRouter.rssi,

    wanRxBytes:
      Number(
        data.wanRxBytes
      ) ||
      latestRouter.wanRxBytes,

    wanTxBytes:
      Number(
        data.wanTxBytes
      ) ||
      latestRouter.wanTxBytes,

    wanRxPackets:
      Number(
        data.wanRxPackets
      ) ||
      latestRouter.wanRxPackets,

    wanTxPackets:
      Number(
        data.wanTxPackets
      ) ||
      latestRouter.wanTxPackets,

    wanIP:
      data.wanIP ??
      latestRouter.wanIP,

    wanGateway:
      data.wanGateway ??
      latestRouter.wanGateway,

    plmn:
      data.plmn ??
      latestRouter.plmn,

    uptime:
      data.uptime ??
      latestRouter.uptime
  };


  // ----------------------------------------------------------
  // Calculate speed from bytes
  // ----------------------------------------------------------

  calculateSpeed();


  // ----------------------------------------------------------
  // Update extension badge
  // ----------------------------------------------------------

  updateBadge();


  return data;
}


// ============================================================
// SESSION INVALID CHECK
// ============================================================

function isSessionInvalid(data) {

  if (!data) {

    return true;
  }


  const text =
    JSON.stringify(
      data
    ).toLowerCase();


  const invalidWords = [

    "invalid session",

    "session expired",

    "sessionid invalid",

    "invalid sessionid",

    "not login",

    "not logged",

    "unauthorized",

    "authentication failed",

    "login required"

  ];


  return invalidWords.some(
    word =>
      text.includes(word)
  );
}


// ============================================================
// SPEED CALCULATION
// ============================================================
//
// wanRxBytes / wanTxBytes are cumulative counters.
//
// Example:
//
// Previous RX = 844350405
// Current RX  = 844541999
//
// Difference = bytes transferred
//
// KB/s = bytes / elapsed seconds / 1024
//
// Mbps = bytes * 8 / seconds / 1,000,000
//
// ============================================================

function calculateSpeed() {

  const currentRx =
    Number(
      latestRouter.wanRxBytes
    );


  const currentTx =
    Number(
      latestRouter.wanTxBytes
    );


  const now =
    Date.now();


  if (
    !Number.isFinite(
      currentRx
    ) ||
    !Number.isFinite(
      currentTx
    )
  ) {

    return;
  }


  // ----------------------------------------------------------
  // First reading
  // ----------------------------------------------------------

  if (
    previousRxBytes === null ||
    previousTxBytes === null ||
    previousTimestamp === null
  ) {

    previousRxBytes =
      currentRx;

    previousTxBytes =
      currentTx;

    previousTimestamp =
      now;


    latestSpeed = {

      downloadKB: 0,

      uploadKB: 0,

      downloadMbps: 0,

      uploadMbps: 0
    };


    return;
  }


  // ----------------------------------------------------------
  // Time elapsed
  // ----------------------------------------------------------

  const elapsedSeconds =
    (
      now -
      previousTimestamp
    ) / 1000;


  if (
    elapsedSeconds <= 0
  ) {

    return;
  }


  // ----------------------------------------------------------
  // Byte differences
  // ----------------------------------------------------------

  let rxDiff =
    currentRx -
    previousRxBytes;


  let txDiff =
    currentTx -
    previousTxBytes;


  // ----------------------------------------------------------
  // Router counter reset
  // ----------------------------------------------------------

  if (
    rxDiff < 0
  ) {

    rxDiff = 0;
  }


  if (
    txDiff < 0
  ) {

    txDiff = 0;
  }


  // ----------------------------------------------------------
  // KB/s
  // ----------------------------------------------------------

  const downloadKB =
    rxDiff /
    elapsedSeconds /
    1024;


  const uploadKB =
    txDiff /
    elapsedSeconds /
    1024;


  // ----------------------------------------------------------
  // Mbps
  // ----------------------------------------------------------

  const downloadMbps =
    (
      rxDiff *
      8 /
      elapsedSeconds /
      1000000
    );


  const uploadMbps =
    (
      txDiff *
      8 /
      elapsedSeconds /
      1000000
    );


  latestSpeed = {

    downloadKB:
      Number(
        downloadKB.toFixed(2)
      ),

    uploadKB:
      Number(
        uploadKB.toFixed(2)
      ),

    downloadMbps:
      Number(
        downloadMbps.toFixed(3)
      ),

    uploadMbps:
      Number(
        uploadMbps.toFixed(3)
      )
  };


  // ----------------------------------------------------------
  // Save counters
  // ----------------------------------------------------------

  previousRxBytes =
    currentRx;

  previousTxBytes =
    currentTx;

  previousTimestamp =
    now;
}


// ============================================================
// RESET SPEED COUNTERS
// ============================================================

function resetSpeedCounters() {

  previousRxBytes =
    null;

  previousTxBytes =
    null;

  previousTimestamp =
    null;


  latestSpeed = {

    downloadKB: 0,

    uploadKB: 0,

    downloadMbps: 0,

    uploadMbps: 0
  };
}


// ============================================================
// MAIN REFRESH
// ============================================================

async function refreshRouter() {

  if (
    refreshRunning
  ) {

    return;
  }


  if (
    authenticationRunning
  ) {

    return;
  }


  refreshRunning =
    true;


  try {

    currentStatus =
      "connecting";


    try {

      // ------------------------------------------------------
      // Get router information
      // ------------------------------------------------------

      await getRouterInformation();


      currentStatus =
        "connected";

    } catch (error) {

      console.error(
        "Router request failed:",
        error
      );


      // ------------------------------------------------------
      // Session expired
      // ------------------------------------------------------

      if (
        error.message ===
        "SESSION_EXPIRED"
      ) {

        console.log(
          "Session expired. Re-authenticating..."
        );


        resetSpeedCounters();


        const authenticated =
          await authenticate();


        if (
          authenticated
        ) {

          try {

            await getRouterInformation();

            currentStatus =
              "connected";

          } catch (
            retryError
          ) {

            console.error(
              "Request after authentication failed:",
              retryError
            );

            currentStatus =
              "server_error";
          }

        } else {

          currentStatus =
            "authentication_failed";
        }

      } else {

        currentStatus =
          "server_error";
      }
    }

  } finally {

    refreshRunning =
      false;
  }
}


// ============================================================
// GET STATUS FOR POPUP
// ============================================================

function getStatus() {

  return {

    status:
      currentStatus,

    speed: {

      downloadKB:
        latestSpeed.downloadKB,

      uploadKB:
        latestSpeed.uploadKB,

      downloadMbps:
        latestSpeed.downloadMbps,

      uploadMbps:
        latestSpeed.uploadMbps
    },

    router: {

      rssi:
        latestRouter.rssi,

      wanRxBytes:
        latestRouter.wanRxBytes,

      wanTxBytes:
        latestRouter.wanTxBytes,

      wanRxPackets:
        latestRouter.wanRxPackets,

      wanTxPackets:
        latestRouter.wanTxPackets,

      wanIP:
        latestRouter.wanIP,

      wanGateway:
        latestRouter.wanGateway,

      plmn:
        latestRouter.plmn,

      uptime:
        latestRouter.uptime
    }
  };
}


// ============================================================
// MESSAGE HANDLER
// ============================================================

chrome.runtime.onMessage.addListener(

  (
    message,
    sender,
    sendResponse
  ) => {

    // --------------------------------------------------------
    // Popup asks for current data
    // --------------------------------------------------------

    if (
      message.type ===
      "getStatus"
    ) {

      sendResponse(
        getStatus()
      );

      return true;
    }


    // --------------------------------------------------------
    // Popup requests immediate refresh
    // --------------------------------------------------------

    if (
      message.type ===
      "forceRefresh"
    ) {

      refreshRouter()
        .then(
          () => {

            sendResponse(
              getStatus()
            );
          }
        )
        .catch(
          error => {

            console.error(
              error
            );

            sendResponse(
              getStatus()
            );
          }
        );


      return true;
    }


    return false;
  }
);


// ============================================================
// EXTENSION STARTUP
// ============================================================

console.log(
  "Internet Speed Monitor started"
);


// Initial badge

chrome.action.setBadgeText({

  text: "0"

});


chrome.action.setBadgeBackgroundColor({

  color: "#64748b"

});


// ============================================================
// INITIAL REQUEST
// ============================================================

refreshRouter();


// ============================================================
// AUTO REFRESH
// ============================================================

setInterval(

  () => {

    refreshRouter();

  },

  REFRESH_INTERVAL

);