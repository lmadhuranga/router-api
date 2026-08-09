const ROUTER_URL =
  "http://192.168.8.1/cgi-bin/http.cgi";


// ============================================================
// ONE REFRESH VARIABLE
// ============================================================

const REFRESH_INTERVAL = 5000;


// ============================================================
// AUTH
// ============================================================

const USERNAME = "admin";

const PASSWORD_HASH =
  "21232f297a57a5a743894a0e4a801fc3";

const MAX_AUTH_RETRIES = 100;

const AUTH_RETRY_DELAY = 5000;


// ============================================================
// SESSION
// ============================================================

let sessionId = "";

let sessionCookie = "";

let authenticating = false;

let authenticationPromise = null;

let authAttempt = 0;


// ============================================================
// STATE
// ============================================================

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
// BADGE
// ============================================================

async function updateBadge() {
  const rssiNumber = Number(routerInfo.rssi);

  const rssi = Number.isFinite(rssiNumber)
    ? Math.abs(Math.round(rssiNumber))
    : "--";

  const upload = Math.floor(
    Number(currentSpeed.uploadKB) || 0
  );

  const download = Math.floor(
    Number(currentSpeed.downloadKB) || 0
  );

  // Badge shows download speed
  await chrome.action.setBadgeText({
    text: `↓${download} `
  });

  await chrome.action.setBadgeBackgroundColor({
    color: "#1976D2"
  });

  // Hover title
  await chrome.action.setTitle({
    title:
      `↑ ${upload} KB/s | ↓ ${download} KB/s | ${rssi} dBm`
  });
}


// ============================================================
// LOAD SESSION
// ============================================================

async function loadSession() {

  const data =
    await chrome.storage.local.get([
      "sessionId",
      "sessionCookie"
    ]);


  sessionId =
    data.sessionId || "";

  sessionCookie =
    data.sessionCookie || "";
}


// ============================================================
// SAVE SESSION
// ============================================================

async function saveSession() {

  await chrome.storage.local.set({

    sessionId,

    sessionCookie
  });
}


// ============================================================
// SLEEP
// ============================================================

function sleep(ms) {

  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


// ============================================================
// ROUTER REQUEST
// ============================================================

async function routerRequest(
  payload,
  referer
) {

  const response =
    await fetch(
      ROUTER_URL,
      {

        method:
          "POST",

        credentials:
          "include",

        headers: {

          "Accept":
            "text/plain, */*; q=0.01",

          "Accept-Language":
            "en-US,en;q=0.9,tr;q=0.8",

          "Content-Type":
            "application/json; charset=UTF-8",

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


  const text =
    await response.text();


  let data;


  try {

    data =
      JSON.parse(text);

  } catch {

    data =
      text;
  }


  if (!response.ok) {

    throw new Error(
      `HTTP ${response.status}`
    );
  }


  return {
    data,
    text
  };
}


// ============================================================
// INVALID SESSION
// ============================================================

function isInvalidSession(
  data,
  text = ""
) {

  const value =
    (
      JSON.stringify(data) +
      " " +
      text
    ).toLowerCase();


  const words = [

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


  return words.some(
    word =>
      value.includes(word)
  );
}


// ============================================================
// FIND SESSION
// ============================================================

function findSessionId(data) {

  if (
    !data ||
    typeof data !== "object"
  ) {

    return null;
  }


  const keys = [

    "sessionId",

    "sessionID",

    "session_id",

    "sid"
  ];


  for (
    const key of keys
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
// GET ROUTER INFO
// ============================================================

async function getRouterInfo() {

  return routerRequest(

    {

      cmd: 0,

      method: "GET",

      language: "EN",

      sessionId
    },

    "http://192.168.8.1/mindex.html"
  );
}


// ============================================================
// UPDATE ROUTER INFO
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


  // Update extension icon immediately
  updateBadge();
}


// ============================================================
// SPEED
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


  if (rxBytes < 0) {

    rxBytes = 0;
  }


  if (txBytes < 0) {

    txBytes = 0;
  }


  const rxPerSecond =
    rxBytes / seconds;


  const txPerSecond =
    txBytes / seconds;


  return {

    downloadKB:
      rxPerSecond / 1024,

    uploadKB:
      txPerSecond / 1024,

    downloadMbps:
      (
        rxPerSecond * 8
      ) / 1000000,

    uploadMbps:
      (
        txPerSecond * 8
      ) / 1000000
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

      authenticating =
        true;

      routerStatus =
        "authenticating";

      previousCounters =
        null;


      for (
        let attempt = 1;

        attempt <= MAX_AUTH_RETRIES;

        attempt++
      ) {

        authAttempt =
          attempt;


        try {

          const result =
            await routerRequest(

              {

                cmd: 100,

                method: "POST",

                sessionId,

                username:
                  USERNAME,

                passwd:
                  PASSWORD_HASH,

                language:
                  "EN"
              },

              "http://192.168.8.1/login.html"
            );


          const newSessionId =
            findSessionId(
              result.data
            );


          if (newSessionId) {

            sessionId =
              newSessionId;

            await saveSession();
          }


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
              "Authentication failed"
            );
          }


          updateRouterInfo(
            verify.data
          );


          authenticating =
            false;

          authAttempt =
            0;

          routerStatus =
            "connected";


          return true;


        } catch (error) {

          console.error(
            `Auth ${attempt}/${MAX_AUTH_RETRIES}:`,
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

            await updateBadge();

            return false;
          }


          await sleep(
            AUTH_RETRY_DELAY
          );
        }
      }


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
// POLL
// ============================================================

async function pollRouter() {

  if (authenticating) {

    return;
  }


  try {

    const result =
      await getRouterInfo();


    if (
      isInvalidSession(
        result.data,
        result.text
      )
    ) {

      await authenticate();

      return;
    }


    if (
      result.data &&
      typeof result.data === "object" &&
      result.data.success === false
    ) {

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

      throw new Error(
        "Invalid traffic counters"
      );
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

    // Update icon badge + hover title
    await updateBadge();


  } catch (error) {

    console.error(
      "Router error:",
      error.message
    );


    routerStatus =
      "offline";


    await updateBadge();
  }
}


// ============================================================
// POPUP MESSAGE
// ============================================================

chrome.runtime.onMessage.addListener(

  (
    message,
    sender,
    sendResponse
  ) => {

    if (
      message.type ===
      "getStatus"
    ) {

      sendResponse({

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


      return true;
    }


    if (
      message.type ===
      "forceRefresh"
    ) {

      pollRouter()
        .then(() => {

          sendResponse({

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

        });


      return true;
    }
  }
);


// ============================================================
// START
// ============================================================

(async () => {

  await loadSession();


  // Immediately set badge state
  await updateBadge();


  // First router request
  await pollRouter();

})();


// ============================================================
// REFRESH EVERY 5 SECONDS
// ============================================================

setInterval(

  pollRouter,

  REFRESH_INTERVAL

);