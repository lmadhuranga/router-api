// ============================================================
// POPUP.JS
// ============================================================

const DEFAULT_POPUP_REFRESH = 1000;

let popupRefreshInterval =
  DEFAULT_POPUP_REFRESH;

let popupRefreshTimer =
  null;

let isRefreshing =
  false;


// ============================================================
// DOM ELEMENTS
// ============================================================

const uploadSpeed =
  document.getElementById(
    "uploadSpeed"
  );

const downloadSpeed =
  document.getElementById(
    "downloadSpeed"
  );

const signalValue =
  document.getElementById(
    "signalValue"
  );

const signalCard =
  document.getElementById(
    "signalCard"
  );

const refreshBtn =
  document.getElementById(
    "refreshBtn"
  );

const refreshStatus =
  document.getElementById(
    "refreshStatus"
  );

const refresh500Btn =
  document.getElementById(
    "refresh500Btn"
  );

const refresh1000Btn =
  document.getElementById(
    "refresh1000Btn"
  );

const wifiToggleBtn =
  document.getElementById(
    "wifiToggleBtn"
  );

const wifiStatus =
  document.getElementById(
    "wifiStatus"
  );


// ============================================================
// UPDATE SPEED / SIGNAL
// ============================================================

function updateSpeedUI(data) {

  if (!data) {
    return;
  }


  // ----------------------------------------------------------
  // UPLOAD
  // ----------------------------------------------------------

  const upload =
    Math.round(
      Number(
        data?.speed?.uploadKB
      ) || 0
    );


  // ----------------------------------------------------------
  // DOWNLOAD
  // ----------------------------------------------------------

  const download =
    Math.round(
      Number(
        data?.speed?.downloadKB
      ) || 0
    );


  // ----------------------------------------------------------
  // RSRP
  // ----------------------------------------------------------

  const rssiValue =
    Number(
      data?.router?.rssi
    );


  const rssi =
    Number.isFinite(rssiValue)
      ? Math.abs(
          Math.round(rssiValue)
        )
      : null;


  // ----------------------------------------------------------
  // UPDATE UPLOAD
  // ----------------------------------------------------------

  uploadSpeed.textContent =
    upload;


  // ----------------------------------------------------------
  // UPDATE DOWNLOAD
  // ----------------------------------------------------------

  downloadSpeed.textContent =
    download;


  // ----------------------------------------------------------
  // UPDATE SIGNAL
  // ----------------------------------------------------------

  signalValue.textContent =
    rssi !== null
      ? rssi
      : "--";


  // ----------------------------------------------------------
  // SIGNAL COLOR
  //
  // <= 105 = GREEN
  // > 105  = RED
  // ----------------------------------------------------------

  signalCard.classList.remove(
    "signal-good",
    "signal-bad",
    "signal-unknown"
  );


  if (rssi === null) {

    signalCard.classList.add(
      "signal-unknown"
    );

  }

  else if (rssi <= 105) {

    signalCard.classList.add(
      "signal-good"
    );

  }

  else {

    signalCard.classList.add(
      "signal-bad"
    );

  }

}


// ============================================================
// GET WIFI VISIBILITY
// ============================================================

function getWifiVisibility() {

  return new Promise(
    resolve => {

      chrome.runtime.sendMessage(

        {
          type:
            "getWifiVisibility"
        },

        response => {

          if (
            chrome.runtime.lastError
          ) {

            resolve({

              success: false,

              message:
                chrome.runtime
                  .lastError
                  .message

            });

            return;

          }


          resolve(
            response
          );

        }

      );

    }
  );

}


// ============================================================
// UPDATE WIFI UI
// ============================================================

function updateWifiUI(wifi) {

  if (!wifi) {
    return;
  }


  let visible =
    null;


  // ----------------------------------------------------------
  // 0 = VISIBLE
  // 1 = HIDDEN
  // ----------------------------------------------------------

  if (
    String(
      wifi.broadcast
    ) === "0"
  ) {

    visible =
      true;

  }

  else if (
    String(
      wifi.broadcast
    ) === "1"
  ) {

    visible =
      false;

  }

  else if (
    typeof wifi.visible ===
    "boolean"
  ) {

    visible =
      wifi.visible;

  }


  // ----------------------------------------------------------
  // UNKNOWN
  // ----------------------------------------------------------

  if (visible === null) {

    wifiStatus.textContent =
      "Unknown";

    wifiToggleBtn.textContent =
      "Retry";

    wifiToggleBtn.dataset.state =
      "unknown";

    wifiToggleBtn.classList.remove(
      "wifi-visible",
      "wifi-hidden"
    );

    return;

  }


  // ----------------------------------------------------------
  // VISIBLE
  // ----------------------------------------------------------

  if (visible) {

    wifiStatus.textContent =
      "Visible";


    wifiToggleBtn.textContent =
      "Hide Wi-Fi";


    wifiToggleBtn.dataset.state =
      "visible";


    wifiToggleBtn.classList.add(
      "wifi-visible"
    );


    wifiToggleBtn.classList.remove(
      "wifi-hidden"
    );

  }


  // ----------------------------------------------------------
  // HIDDEN
  // ----------------------------------------------------------

  else {

    wifiStatus.textContent =
      "Hidden";


    wifiToggleBtn.textContent =
      "Show Wi-Fi";


    wifiToggleBtn.dataset.state =
      "hidden";


    wifiToggleBtn.classList.add(
      "wifi-hidden"
    );


    wifiToggleBtn.classList.remove(
      "wifi-visible"
    );

  }

}


// ============================================================
// LOAD WIFI STATUS
// ============================================================

async function loadWifiStatus() {

  try {

    wifiToggleBtn.disabled =
      true;


    wifiStatus.textContent =
      "Checking...";


    wifiToggleBtn.textContent =
      "...";


    const result =
      await getWifiVisibility();


    if (
      result &&
      result.success
    ) {

      updateWifiUI(
        result
      );

    }

    else {

      wifiStatus.textContent =
        result?.message ||
        "Unavailable";


      wifiToggleBtn.textContent =
        "Retry";


      wifiToggleBtn.dataset.state =
        "unknown";

    }

  }

  catch (error) {

    console.error(
      "Wi-Fi status error:",
      error
    );


    wifiStatus.textContent =
      "Error";


    wifiToggleBtn.textContent =
      "Retry";


    wifiToggleBtn.dataset.state =
      "unknown";

  }

  finally {

    wifiToggleBtn.disabled =
      false;

  }

}


// ============================================================
// SET WIFI VISIBILITY
// ============================================================

function setWifiVisibility(
  broadcast
) {

  return new Promise(
    resolve => {

      chrome.runtime.sendMessage(

        {
          type:
            "setWifiVisibility",

          broadcast:
            String(broadcast)

        },

        response => {

          if (
            chrome.runtime.lastError
          ) {

            resolve({

              success: false,

              message:
                chrome.runtime
                  .lastError
                  .message

            });

            return;

          }


          resolve(
            response
          );

        }

      );

    }
  );

}


// ============================================================
// TOGGLE WIFI
// ============================================================

async function toggleWifiVisibility() {

  if (
    wifiToggleBtn.disabled
  ) {

    return;

  }


  const currentState =
    wifiToggleBtn.dataset.state;


  // ----------------------------------------------------------
  // UNKNOWN -> REFRESH STATUS
  // ----------------------------------------------------------

  if (
    currentState !== "visible" &&
    currentState !== "hidden"
  ) {

    await loadWifiStatus();

    return;

  }


  // ----------------------------------------------------------
  // VISIBLE -> HIDDEN
  // HIDDEN -> VISIBLE
  // ----------------------------------------------------------

  const newBroadcast =
    currentState === "visible"
      ? "1"
      : "0";


  wifiToggleBtn.disabled =
    true;


  wifiToggleBtn.textContent =
    "...";


  wifiStatus.textContent =
    newBroadcast === "1"
      ? "Hiding..."
      : "Showing...";


  try {

    const result =
      await setWifiVisibility(
        newBroadcast
      );


    if (
      result &&
      result.success
    ) {

      updateWifiUI(
        result
      );

    }

    else {

      wifiStatus.textContent =
        result?.message ||
        "Failed";


      await loadWifiStatus();

    }

  }

  catch (error) {

    console.error(
      "Wi-Fi toggle error:",
      error
    );


    wifiStatus.textContent =
      "Error";


    await loadWifiStatus();

  }

  finally {

    wifiToggleBtn.disabled =
      false;

  }

}


// ============================================================
// REFRESH ROUTER
// ============================================================

async function refreshRouter() {

  if (isRefreshing) {
    return;
  }


  isRefreshing =
    true;


  refreshStatus.textContent =
    "Refreshing...";


  try {

    const result =
      await new Promise(
        resolve => {

          chrome.runtime.sendMessage(

            {
              type:
                "forceRefresh"
            },

            response => {

              if (
                chrome.runtime.lastError
              ) {

                resolve(
                  null
                );

                return;

              }


              resolve(
                response
              );

            }

          );

        }
      );


    if (result) {

      updateSpeedUI(
        result
      );


      if (
        result.wifi
      ) {

        updateWifiUI(
          result.wifi
        );

      }


      if (
        result.status ===
        "connected"
      ) {

        refreshStatus.textContent =
          "Connected";

      }

      else {

        refreshStatus.textContent =
          result.status ||
          "Router error";

      }

    }

    else {

      refreshStatus.textContent =
        "No response";

    }

  }

  catch (error) {

    console.error(
      "Router refresh error:",
      error
    );


    refreshStatus.textContent =
      "Connection error";

  }

  finally {

    isRefreshing =
      false;

  }

}


// ============================================================
// SET POPUP REFRESH RATE
//
// ONLY RUNS WHILE POPUP IS OPEN
// ============================================================

function setPopupRefreshInterval(
  interval
) {

  popupRefreshInterval =
    interval;


  if (popupRefreshTimer) {

    clearInterval(
      popupRefreshTimer
    );

  }


  popupRefreshTimer =
    setInterval(
      refreshRouter,
      popupRefreshInterval
    );


  refresh500Btn.classList.toggle(
    "active",
    interval === 500
  );


  refresh1000Btn.classList.toggle(
    "active",
    interval === 1000
  );

}


// ============================================================
// 500ms
// ============================================================

refresh500Btn.addEventListener(
  "click",
  () => {

    setPopupRefreshInterval(
      500
    );

  }
);


// ============================================================
// 1000ms
// ============================================================

refresh1000Btn.addEventListener(
  "click",
  () => {

    setPopupRefreshInterval(
      1000
    );

  }
);


// ============================================================
// MANUAL REFRESH
// ============================================================

refreshBtn.addEventListener(
  "click",
  async () => {

    refreshBtn.disabled =
      true;


    try {

      await refreshRouter();

      await loadWifiStatus();

    }

    finally {

      refreshBtn.disabled =
        false;

    }

  }
);


// ============================================================
// WIFI TOGGLE
// ============================================================

wifiToggleBtn.addEventListener(
  "click",
  toggleWifiVisibility
);


// ============================================================
// INITIALIZE
// ============================================================

async function initialize() {

  await refreshRouter();

  await loadWifiStatus();


  setPopupRefreshInterval(
    DEFAULT_POPUP_REFRESH
  );

}


// ============================================================
// START
// ============================================================

initialize();