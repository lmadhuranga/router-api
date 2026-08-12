// ============================================================
// ROUTER MONITOR - background.js
// ============================================================

const ROUTER_URL =
  "http://192.168.8.1/cgi-bin/http.cgi";

const ROUTER_ORIGIN =
  "http://192.168.8.1";

const REFRESH_INTERVAL =
  2000;

const MAX_RETRIES =
  100;

const RETRY_DELAY =
  2000;


// ============================================================
// SESSION
// ============================================================

let sessionId =
  "a608305063ad17d0f85a789a1cbb328faea459b9304412394f5b07a0ef4915af";

let sessionCookie =
  "DekAifiYqaou1BeBRHCMdt+5lHTJJBsW5PC8rF1aJcH08s7pA2nT0YdtGGMTmi6pe0bOmxCE2FpmZKVVhJ4YreTJbhQAsu1RDz79IP8ttfJCWRUzdaUe55n2FRi6hacx";


// ============================================================
// STATE
// ============================================================

let isRefreshing = false;

let isWifiRequestRunning = false;

let isAuthenticating = false;

let routerStatus =
  "connecting";


// ============================================================
// SPEED
// ============================================================

let previousRxBytes = null;

let previousTxBytes = null;

let previousTimestamp = null;

let speed = {
  uploadKB: 0,
  downloadKB: 0,
  uploadMbps: 0,
  downloadMbps: 0
};


// ============================================================
// ROUTER DATA
// ============================================================

let router = {
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


// ============================================================
// WIFI CONFIGURATION
// ============================================================

let wifiConfig = {
  ipMacId: "-1",

  macinfo_mac: "",
  macinfo_ip: "192.168.8.1",

  macinfo_wifiOpen: "yes",

  macinfo_broadcast: "0",

  macinfo_ssid: "",

  macinfo_rts: "",

  macinfo_txPower: "",

  macinfo_channel: "auto",

  macinfo_wifiWorkMode: "",

  macinfo_security_config: "",

  macinfo_pwd: "",

  cmd: 2,

  method: "POST",

  secMode: "",

  secFile: "",

  cypher: "",

  wpa: "",

  debug: "0",

  groupRekey: "",

  gmkRekey: "",

  pskKey: "",

  chMode: "",

  pureg: "0",

  puren: "0",

  rateCtl: "auto",

  manRate: "",

  manRetries: ""
};


// ============================================================
// HELPER
// ============================================================

function sleep(ms) {

  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );

}


// ============================================================
// REQUEST HEADERS
// ============================================================

function getHeaders() {

  return {

    "Accept":
      "text/plain, */*; q=0.01",

    "Accept-Language":
      "en-US,en;q=0.9,tr;q=0.8",

    "Content-Type":
      "application/json; charset=UTF-8",

    "DNT":
      "1",

    "Origin":
      ROUTER_ORIGIN,

    "Referer":
      `${ROUTER_ORIGIN}/mindex.html`,

    "X-Requested-With":
      "XMLHttpRequest"

  };

}


// ============================================================
// ROUTER REQUEST
// ============================================================

async function routerRequest(
  payload
) {

  console.log(
    "Router request:",
    payload
  );


  const response =
    await fetch(
      ROUTER_URL,
      {
        method: "POST",

        headers:
          getHeaders(),

        credentials:
          "include",

        cache:
          "no-store",

        body:
          JSON.stringify(
            payload
          )
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


  console.log(
    "Router response:",
    text
  );


  return text;

}


// ============================================================
// TRY JSON
// ============================================================

function tryParseJSON(
  text
) {

  try {

    return JSON.parse(
      text
    );

  } catch {

    return null;

  }

}


// ============================================================
// SESSION INVALID CHECK
// ============================================================

function isSessionInvalid(
  text
) {

  if (!text) {

    return true;

  }


  const lower =
    String(text)
      .toLowerCase();


  const invalidWords = [

    "invalid session",

    "session expired",

    "sessionid invalid",

    "invalid sessionid",

    "authentication failed",

    "unauthorized",

    "login required",

    "not login",

    "not logged"

  ];


  return invalidWords.some(
    word =>
      lower.includes(word)
  );

}


// ============================================================
// FIND SESSION ID
// ============================================================

function findSessionId(
  text
) {

  const json =
    tryParseJSON(
      text
    );


  if (!json) {

    return null;

  }


  const keys = [

    "sessionId",

    "sessionID",

    "SessionID",

    "sid",

    "session"

  ];


  for (
    const key of keys
  ) {

    if (
      typeof json[key] ===
        "string" &&
      json[key].length > 0
    ) {

      return json[key];

    }

  }


  return null;

}


// ============================================================
// FIND SESSION COOKIE
// ============================================================

function findSessionCookie(
  text
) {

  const json =
    tryParseJSON(
      text
    );


  if (!json) {

    return null;

  }


  const keys = [

    "SessionID",

    "sessionID",

    "sessionCookie",

    "cookie"

  ];


  for (
    const key of keys
  ) {

    if (
      typeof json[key] ===
        "string" &&
      json[key].length > 0
    ) {

      return json[key];

    }

  }


  return null;

}


// ============================================================
// AUTHENTICATION
// ============================================================

async function authenticate() {

  if (
    isAuthenticating
  ) {

    return false;

  }


  isAuthenticating =
    true;

  routerStatus =
    "authenticating";


  try {

    for (
      let attempt = 1;
      attempt <= MAX_RETRIES;
      attempt++
    ) {

      console.log(
        `Authentication attempt ${attempt}/${MAX_RETRIES}`
      );


      try {

        const payload = {

          cmd: 100,

          method: "POST",

          language: "EN",

          sessionId:
            sessionId

        };


        const response =
          await routerRequest(
            payload
          );


        if (
          !isSessionInvalid(
            response
          )
        ) {

          const newSessionId =
            findSessionId(
              response
            );


          const newCookie =
            findSessionCookie(
              response
            );


          if (
            newSessionId
          ) {

            sessionId =
              newSessionId;

          }


          if (
            newCookie
          ) {

            sessionCookie =
              newCookie;

          }


          routerStatus =
            "connected";


          return true;

        }

      } catch (error) {

        console.error(
          "Authentication error:",
          error
        );

      }


      if (
        attempt <
        MAX_RETRIES
      ) {

        await sleep(
          RETRY_DELAY
        );

      }

    }


    routerStatus =
      "authentication_failed";


    clearBadge();


    return false;

  } finally {

    isAuthenticating =
      false;

  }

}


// ============================================================
// GET ROUTER INFORMATION
// CMD 0
// ============================================================

async function getRouterInformation() {

  const payload = {

    cmd: 0,

    method: "GET",

    language: "EN",

    sessionId:
      sessionId

  };


  const response =
    await routerRequest(
      payload
    );


  if (
    isSessionInvalid(
      response
    )
  ) {

    throw new Error(
      "SESSION_EXPIRED"
    );

  }


  const data =
    tryParseJSON(
      response
    );


  if (
    !data ||
    typeof data !== "object"
  ) {

    throw new Error(
      "Invalid router JSON response"
    );

  }


  router.rssi =
    data.rssi ??
    router.rssi;


  router.wanRxBytes =
    Number(
      data.wanRxBytes
    ) || 0;


  router.wanTxBytes =
    Number(
      data.wanTxBytes
    ) || 0;


  router.wanRxPackets =
    Number(
      data.wanRxPackets
    ) || 0;


  router.wanTxPackets =
    Number(
      data.wanTxPackets
    ) || 0;


  router.wanIP =
    data.wanIP ??
    "";


  router.wanGateway =
    data.wanGateway ??
    "";


  router.plmn =
    data.plmn ??
    "";


  router.uptime =
    data.uptime ??
    "";


  calculateSpeed();


  updateBadge();


  return data;

}


// ============================================================
// SPEED CALCULATION
// ============================================================

function calculateSpeed() {

  const rxBytes =
    Number(
      router.wanRxBytes
    );


  const txBytes =
    Number(
      router.wanTxBytes
    );


  const now =
    Date.now();


  if (
    !Number.isFinite(
      rxBytes
    ) ||
    !Number.isFinite(
      txBytes
    )
  ) {

    return;

  }


  if (
    previousRxBytes === null ||
    previousTxBytes === null ||
    previousTimestamp === null
  ) {

    previousRxBytes =
      rxBytes;

    previousTxBytes =
      txBytes;

    previousTimestamp =
      now;

    return;

  }


  const elapsed =
    (
      now -
      previousTimestamp
    ) / 1000;


  if (
    elapsed <= 0
  ) {

    return;

  }


  let rxDifference =
    rxBytes -
    previousRxBytes;


  let txDifference =
    txBytes -
    previousTxBytes;


  if (
    rxDifference < 0
  ) {

    rxDifference =
      0;

  }


  if (
    txDifference < 0
  ) {

    txDifference =
      0;

  }


  speed.downloadKB =
    Number(
      (
        rxDifference /
        elapsed /
        1024
      ).toFixed(2)
    );


  speed.uploadKB =
    Number(
      (
        txDifference /
        elapsed /
        1024
      ).toFixed(2)
    );


  speed.downloadMbps =
    Number(
      (
        rxDifference *
        8 /
        elapsed /
        1000000
      ).toFixed(3)
    );


  speed.uploadMbps =
    Number(
      (
        txDifference *
        8 /
        elapsed /
        1000000
      ).toFixed(3)
    );


  previousRxBytes =
    rxBytes;

  previousTxBytes =
    txBytes;

  previousTimestamp =
    now;

}


// ============================================================
// RESET SPEED
// ============================================================

function resetSpeed() {

  previousRxBytes =
    null;

  previousTxBytes =
    null;

  previousTimestamp =
    null;


  speed = {

    uploadKB: 0,

    downloadKB: 0,

    uploadMbps: 0,

    downloadMbps: 0

  };

}


// ============================================================
// BADGE
// ============================================================

function updateBadge() {

  const download =
    Math.floor(
      Number(
        speed.downloadKB
      ) || 0
    );


  const hidden =
    String(
      wifiConfig.macinfo_broadcast
    ) === "1";


  const badgeText =
    hidden
      ? `*${download}`
      : `${download}`;


  chrome.action.setBadgeText({

    text:
      badgeText

  });


  const rssi =
    Number(
      router.rssi
    );


  if (
    !Number.isFinite(
      rssi
    )
  ) {

    chrome.action.setBadgeBackgroundColor({

      color:
        "#334155"

    });


    return;

  }


  /*
   * RSRP/RSSI threshold
   *
   * <= 105 = green
   * > 105  = red
   */

  const signal =
    Math.abs(
      Math.round(
        rssi
      )
    );


  if (
    signal <= 105
  ) {

    chrome.action.setBadgeBackgroundColor({

      color:
        "#14532d"

    });

  } else {

    chrome.action.setBadgeBackgroundColor({

      color:
        "#7f1d1d"

    });

  }

}


// ============================================================
// CLEAR BADGE
// ============================================================

function clearBadge() {

  chrome.action.setBadgeText({

    text:
      ""

  });

}


// ============================================================
// ERROR BADGE
// ============================================================

function setErrorBadge() {

  chrome.action.setBadgeText({

    text:
      "!"

  });


  chrome.action.setBadgeBackgroundColor({

    color:
      "#7f1d1d"

  });

}


// ============================================================
// GET WIFI VISIBILITY
//
// CMD 117 GET
//
// Payload:
//
// {
//   cmd: 117,
//   method: "GET",
//   language: "EN",
//   sessionId: "..."
// }
//
// Response is PLAIN TEXT.
//
// values[4] = macinfo_broadcast
//
// 0 = Visible
// 1 = Hidden
// ============================================================

async function getWifiVisibility() {

  const payload = {

    cmd: 117,

    method: "GET",

    language: "EN",

    sessionId:
      sessionId

  };


  console.log(
    "CMD 117 GET payload:",
    payload
  );


  const response =
    await routerRequest(
      payload
    );


  if (
    isSessionInvalid(
      response
    )
  ) {

    throw new Error(
      "SESSION_EXPIRED"
    );

  }


  const result =
    parseWifiResponse(
      response
    );


  updateBadge();


  return result;

}


// ============================================================
// PARSE WIFI RESPONSE
// ============================================================

function parseWifiResponse(
  responseText
) {

  if (
    typeof responseText !==
    "string"
  ) {

    throw new Error(
      "Wi-Fi response is not text"
    );

  }


  console.log(
    "Raw CMD 117 response:",
    responseText
  );


  /*
   * Router response example:
   *
   * D8:D8:66:1D:41:EE,
   * 192.168.8.1,
   * yes,
   * office,
   * 0,
   * auto,
   * 23,
   * WPA,
   * 3,
   * PSK,
   * 11111111,
   * CCMP,
   * 11NGHT20,
   * 0,
   * 0,
   * m11ng,
   * auto,
   * ,
   */


  const values =
    responseText
      .split(",")
      .map(
        value =>
          value.trim()
      );


  console.log(
    "CMD 117 parsed values:",
    values
  );


  /*
   * IMPORTANT:
   *
   * index 0  MAC
   * index 1  IP
   * index 2  wifiOpen
   * index 3  SSID
   * index 4  broadcast
   * index 5  channel
   * index 6  txPower
   * index 7  security
   * index 8  WPA
   * index 9  PSK
   * index 10 password
   * index 11 cipher
   * index 12 channel mode
   * index 13 pureg
   * index 14 puren
   * index 15 wifiWorkMode
   * index 16 rateCtl
   * index 17 manRate
   * index 18 manRetries
   */


  const broadcast =
    values[4];


  if (
    broadcast !== "0" &&
    broadcast !== "1"
  ) {

    console.error(
      "Invalid macinfo_broadcast:",
      broadcast,
      values
    );


    throw new Error(
      `Invalid macinfo_broadcast value: ${broadcast}`
    );

  }


  /*
   * Save CURRENT router configuration.
   */

  wifiConfig.ipMacId =
    "-1";


  wifiConfig.macinfo_mac =
    values[0] ||
    wifiConfig.macinfo_mac;


  wifiConfig.macinfo_ip =
    values[1] ||
    wifiConfig.macinfo_ip;


  wifiConfig.macinfo_wifiOpen =
    values[2] ||
    wifiConfig.macinfo_wifiOpen;


  wifiConfig.macinfo_ssid =
    values[3] ||
    wifiConfig.macinfo_ssid;


  wifiConfig.macinfo_broadcast =
    broadcast;


  wifiConfig.macinfo_channel =
    values[5] ||
    wifiConfig.macinfo_channel;


  wifiConfig.macinfo_txPower =
    values[6] ||
    wifiConfig.macinfo_txPower;


  wifiConfig.secMode =
    values[7] ||
    wifiConfig.secMode;


  wifiConfig.wpa =
    values[8] ||
    wifiConfig.wpa;


  wifiConfig.secFile =
    values[9] ||
    wifiConfig.secFile;


  wifiConfig.macinfo_pwd =
    values[10] ||
    wifiConfig.macinfo_pwd;


  wifiConfig.pskKey =
    values[10] ||
    wifiConfig.pskKey;


  wifiConfig.cypher =
    values[11] ||
    wifiConfig.cypher;


  wifiConfig.chMode =
    values[12] ||
    wifiConfig.chMode;


  wifiConfig.pureg =
    values[13] ||
    wifiConfig.pureg;


  wifiConfig.puren =
    values[14] ||
    wifiConfig.puren;


  wifiConfig.macinfo_wifiWorkMode =
    values[15] ||
    wifiConfig.macinfo_wifiWorkMode;


  wifiConfig.rateCtl =
    values[16] ||
    wifiConfig.rateCtl;


  wifiConfig.manRate =
    values[17] ||
    wifiConfig.manRate;


  wifiConfig.manRetries =
    values[18] ||
    wifiConfig.manRetries;


  const visible =
    broadcast === "0";


  console.log(
    "Wi-Fi:",
    visible
      ? "VISIBLE"
      : "HIDDEN"
  );


  return {

    success:
      true,

    visible:
      visible,

    hidden:
      !visible,

    broadcast:
      broadcast,

    ssid:
      wifiConfig.macinfo_ssid

  };

}


// ============================================================
// SET WIFI VISIBILITY
//
// broadcast:
//
// "0" = visible
// "1" = hidden
// ============================================================

async function setWifiVisibility(
  broadcast
) {

  broadcast =
    String(
      broadcast
    );


  console.log(
    "setWifiVisibility:",
    broadcast
  );


  if (
    broadcast !== "0" &&
    broadcast !== "1"
  ) {

    return {

      success:
        false,

      message:
        "Invalid broadcast value"

    };

  }


  if (
    isWifiRequestRunning
  ) {

    return {

      success:
        false,

      message:
        "Wi-Fi request already running"

    };

  }


  isWifiRequestRunning =
    true;


  try {

    /*
     * ========================================================
     * STEP 1
     *
     * GET CURRENT WIFI CONFIGURATION
     * ========================================================
     */

    let current;


    try {

      current =
        await getWifiVisibility();

    } catch (error) {

      if (
        error.message !==
        "SESSION_EXPIRED"
      ) {

        throw error;

      }


      console.log(
        "Wi-Fi GET session expired"
      );


      const authenticated =
        await authenticate();


      if (
        !authenticated
      ) {

        return {

          success:
            false,

          message:
            "Authentication failed"

        };

      }


      current =
        await getWifiVisibility();

    }


    console.log(
      "Current Wi-Fi:",
      current
    );


    /*
     * ========================================================
     * STEP 2
     *
     * UPDATE ONLY BROADCAST
     * ========================================================
     */

    wifiConfig.macinfo_broadcast =
      broadcast;


    /*
     * ========================================================
     * STEP 3
     *
     * BUILD EXACT CMD 117 POST
     * ========================================================
     */

    const wifiData = {

      /*
       * Basic information
       */

      ipMacId:
        "-1",

      macinfo_mac:
        wifiConfig.macinfo_mac,

      macinfo_ip:
        wifiConfig.macinfo_ip,

      macinfo_wifiOpen:
        wifiConfig.macinfo_wifiOpen,

      macinfo_ssid:
        wifiConfig.macinfo_ssid,

      macinfo_rts:
        wifiConfig.macinfo_rts,

      macinfo_txPower:
        wifiConfig.macinfo_txPower,

      macinfo_channel:
        wifiConfig.macinfo_channel,

      macinfo_wifiWorkMode:
        wifiConfig.macinfo_wifiWorkMode,

      macinfo_security_config:
        wifiConfig.macinfo_security_config,

      macinfo_pwd:
        wifiConfig.macinfo_pwd,

      /*
       * ======================================================
       * THIS IS THE IMPORTANT FIELD
       * ======================================================
       */

      macinfo_broadcast:
        broadcast,

      /*
       * Wi-Fi command
       */

      cmd:
        2,

      method:
        "POST",

      secMode:
        wifiConfig.secMode,

      secFile:
        wifiConfig.secFile,

      cypher:
        wifiConfig.cypher,

      wpa:
        wifiConfig.wpa,

      debug:
        wifiConfig.debug,

      groupRekey:
        wifiConfig.groupRekey,

      gmkRekey:
        wifiConfig.gmkRekey,

      pskKey:
        wifiConfig.pskKey,

      chMode:
        wifiConfig.chMode,

      pureg:
        wifiConfig.pureg,

      puren:
        wifiConfig.puren,

      rateCtl:
        wifiConfig.rateCtl,

      manRate:
        wifiConfig.manRate,

      manRetries:
        wifiConfig.manRetries

    };


    /*
     * ========================================================
     * CMD 117 POST
     * ========================================================
     */

    const payload = {

      cmd:
        117,

      method:
        "POST",

      datas: [

        wifiData

      ],

      language:
        "EN",

      sessionId:
        sessionId

    };


    console.log(
      "================================================"
    );


    console.log(
      "CMD 117 POST PAYLOAD:"
    );


    console.log(
      JSON.stringify(
        payload,
        null,
        2
      )
    );


    console.log(
      "================================================"
    );


    /*
     * ========================================================
     * SEND POST
     * ========================================================
     */

    let response;


    try {

      response =
        await routerRequest(
          payload
        );

    } catch (error) {

      console.error(
        "Wi-Fi POST request error:",
        error
      );


      throw error;

    }


    console.log(
      "CMD 117 POST RESPONSE:",
      response
    );


    /*
     * ========================================================
     * SESSION EXPIRED?
     * ========================================================
     */

    if (
      isSessionInvalid(
        response
      )
    ) {

      console.log(
        "POST session expired"
      );


      const authenticated =
        await authenticate();


      if (
        !authenticated
      ) {

        return {

          success:
            false,

          message:
            "Authentication failed"

        };

      }


      payload.sessionId =
        sessionId;


      response =
        await routerRequest(
          payload
        );


      console.log(
        "CMD 117 POST RETRY RESPONSE:",
        response
      );

    }


    /*
     * ========================================================
     * WAIT FOR ROUTER
     * ========================================================
     */

    await sleep(
      500
    );


    /*
     * ========================================================
     * VERIFY WITH CMD 117 GET
     * ========================================================
     */

    let verified;


    try {

      verified =
        await getWifiVisibility();

    } catch (error) {

      if (
        error.message ===
        "SESSION_EXPIRED"
      ) {

        const authenticated =
          await authenticate();


        if (
          !authenticated
        ) {

          return {

            success:
              false,

            message:
              "Authentication failed after POST"

          };

        }


        verified =
          await getWifiVisibility();

      } else {

        throw error;

      }

    }


    console.log(
      "VERIFIED WIFI:",
      verified
    );


    /*
     * ========================================================
     * CHECK RESULT
     * ========================================================
     */

    if (
      verified.broadcast !==
      broadcast
    ) {

      console.error(
        "Router did not apply visibility change"
      );


      return {

        success:
          false,

        message:
          "Router did not apply the visibility change",

        broadcast:
          verified.broadcast,

        visible:
          verified.visible,

        hidden:
          verified.hidden

      };

    }


    /*
     * ========================================================
     * SUCCESS
     * ========================================================
     */

    updateBadge();


    return {

      success:
        true,

      message:
        broadcast === "1"
          ? "Wi-Fi is now hidden"
          : "Wi-Fi is now visible",

      broadcast:
        verified.broadcast,

      visible:
        verified.visible,

      hidden:
        verified.hidden,

      ssid:
        verified.ssid

    };

  } catch (error) {

    console.error(
      "Wi-Fi visibility error:",
      error
    );


    return {

      success:
        false,

      message:
        error.message ||
        "Wi-Fi visibility request failed"

    };

  } finally {

    isWifiRequestRunning =
      false;

  }

}


// ============================================================
// GET STATUS
// ============================================================

function getStatus() {

  return {

    status:
      routerStatus,

    speed: {

      uploadKB:
        speed.uploadKB,

      downloadKB:
        speed.downloadKB,

      uploadMbps:
        speed.uploadMbps,

      downloadMbps:
        speed.downloadMbps

    },

    router: {

      rssi:
        router.rssi,

      wanRxBytes:
        router.wanRxBytes,

      wanTxBytes:
        router.wanTxBytes,

      wanRxPackets:
        router.wanRxPackets,

      wanTxPackets:
        router.wanTxPackets,

      wanIP:
        router.wanIP,

      wanGateway:
        router.wanGateway,

      plmn:
        router.plmn,

      uptime:
        router.uptime

    },

    wifi: {

      visible:
        wifiConfig.macinfo_broadcast ===
        "0",

      hidden:
        wifiConfig.macinfo_broadcast ===
        "1",

      broadcast:
        wifiConfig.macinfo_broadcast,

      ssid:
        wifiConfig.macinfo_ssid

    }

  };

}


// ============================================================
// REFRESH ROUTER
// ============================================================

async function refreshRouter() {

  if (
    isRefreshing ||
    isAuthenticating
  ) {

    return;

  }


  isRefreshing =
    true;


  try {

    try {

      await getRouterInformation();


      /*
       * Also keep Wi-Fi visibility synchronized.
       */

      try {

        await getWifiVisibility();

      } catch (wifiError) {

        console.warn(
          "Wi-Fi visibility check failed:",
          wifiError
        );

      }


      routerStatus =
        "connected";


    } catch (error) {

      console.error(
        "Router refresh error:",
        error
      );


      if (
        error.message ===
        "SESSION_EXPIRED"
      ) {

        resetSpeed();


        const authenticated =
          await authenticate();


        if (
          authenticated
        ) {

          try {

            await getRouterInformation();


            try {

              await getWifiVisibility();

            } catch (wifiError) {

              console.warn(
                "Wi-Fi visibility retry failed:",
                wifiError
              );

            }


            routerStatus =
              "connected";

          } catch (retryError) {

            console.error(
              "Retry failed:",
              retryError
            );


            routerStatus =
              "server_error";


            clearBadge();

          }

        } else {

          routerStatus =
            "authentication_failed";


          clearBadge();

        }

      } else {

        routerStatus =
          "server_error";


        /*
         * Remove extension badge when
         * server/router is unavailable.
         */

        clearBadge();

      }

    }

  } finally {

    isRefreshing =
      false;

  }

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

    console.log(
      "Background message:",
      message
    );


    // ========================================================
    // GET STATUS
    // ========================================================

    if (
      message.type ===
      "getStatus"
    ) {

      sendResponse(
        getStatus()
      );


      return true;

    }


    // ========================================================
    // FORCE REFRESH
    // ========================================================

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
              "Force refresh error:",
              error
            );


            sendResponse(
              getStatus()
            );

          }
        );


      return true;

    }


    // ========================================================
    // GET WIFI VISIBILITY
    // ========================================================

    if (
      message.type ===
      "getWifiVisibility"
    ) {

      getWifiVisibility()

        .then(
          result => {

            sendResponse(
              result
            );

          }
        )

        .catch(
          async error => {

            console.error(
              "Wi-Fi GET error:",
              error
            );


            if (
              error.message ===
              "SESSION_EXPIRED"
            ) {

              const authenticated =
                await authenticate();


              if (
                authenticated
              ) {

                try {

                  const result =
                    await getWifiVisibility();


                  sendResponse(
                    result
                  );

                } catch (
                  retryError
                ) {

                  sendResponse({

                    success:
                      false,

                    message:
                      retryError.message

                  });

                }

              } else {

                sendResponse({

                  success:
                    false,

                  message:
                    "Authentication failed"

                });

              }

            } else {

              sendResponse({

                success:
                  false,

                message:
                  error.message

              });

            }

          }
        );


      return true;

    }


    // ========================================================
    // SET WIFI VISIBILITY
    // ========================================================

    if (
      message.type ===
      "setWifiVisibility"
    ) {

      console.log(
        "SET WIFI VISIBILITY MESSAGE:",
        message
      );


      const broadcast =
        String(
          message.broadcast
        );


      console.log(
        "Requested broadcast:",
        broadcast
      );


      setWifiVisibility(
        broadcast
      )

        .then(
          result => {

            console.log(
              "SET WIFI RESULT:",
              result
            );


            sendResponse(
              result
            );

          }
        )

        .catch(
          error => {

            console.error(
              "Wi-Fi POST error:",
              error
            );


            sendResponse({

              success:
                false,

              message:
                error.message

            });

          }
        );


      return true;

    }


    return false;

  }
);


// ============================================================
// INITIAL BADGE
// ============================================================

chrome.action.setBadgeText({

  text:
    "0"

});


chrome.action.setBadgeBackgroundColor({

  color:
    "#334155"

});


// ============================================================
// START
// ============================================================

console.log(
  "Router Monitor background started"
);


// ============================================================
// INITIAL REFRESH
// ============================================================

refreshRouter();


// ============================================================
// REFRESH EVERY 2 SECONDS
// ============================================================

setInterval(
  () => {

    refreshRouter();

  },
  REFRESH_INTERVAL
);