// ============================================================
// POPUP.JS
// ============================================================

const REFRESH_INTERVAL = 2000;

let refreshTimer = null;
let isRefreshing = false;


// ============================================================
// DOM
// ============================================================

const titleSpeed =
  document.getElementById("titleSpeed");

const refreshBtn =
  document.getElementById("refreshBtn");

const refreshStatus =
  document.getElementById("refreshStatus");

const wifiToggleBtn =
  document.getElementById("wifiToggleBtn");

const wifiStatus =
  document.getElementById("wifiStatus");


// ============================================================
// FORMAT NUMBER
// ============================================================

function formatSpeed(value) {

  const number =
    Number(value) || 0;

  return Math.round(number);

}


// ============================================================
// UPDATE TITLE
//
// Default format:
//
// ↑ 13 KB | ↓ 191 KB | 105 dBm
// ============================================================

function updateSpeedTitle(data) {

  if (!data) {
    return;
  }


  const upload =
    formatSpeed(
      data?.speed?.uploadKB
    );


  const download =
    formatSpeed(
      data?.speed?.downloadKB
    );


  const rssiValue =
    Number(
      data?.router?.rssi
    );


  const rssi =
    Number.isFinite(rssiValue)
      ? Math.abs(Math.round(rssiValue))
      : "--";


  const title =
    `↑ ${upload} KB | ↓ ${download} KB | ${rssi} dBm`;


  if (titleSpeed) {

    titleSpeed.textContent =
      title;

  }


  document.title =
    title;
}


// ============================================================
// UPDATE WIFI UI
// ============================================================

function updateWifiUI(wifi) {

  if (!wifi) {
    return;
  }


  let visible;


  if (
    wifi.broadcast === "0"
  ) {

    visible = true;

  } else if (
    wifi.broadcast === "1"
  ) {

    visible = false;

  } else if (
    typeof wifi.visible === "boolean"
  ) {

    visible =
      wifi.visible;

  } else {

    wifiStatus.textContent =
      "Unknown";

    wifiToggleBtn.textContent =
      "Unknown";

    return;
  }


  if (visible) {

    wifiStatus.textContent =
      "SSID is visible";


    wifiToggleBtn.textContent =
      "Hide Wi-Fi";


    wifiToggleBtn.classList.add(
      "wifi-visible"
    );


    wifiToggleBtn.classList.remove(
      "wifi-hidden"
    );


    wifiToggleBtn.dataset.state =
      "visible";

  } else {

    wifiStatus.textContent =
      "SSID is hidden";


    wifiToggleBtn.textContent =
      "Show Wi-Fi";


    wifiToggleBtn.classList.add(
      "wifi-hidden"
    );


    wifiToggleBtn.classList.remove(
      "wifi-visible"
    );


    wifiToggleBtn.dataset.state =
      "hidden";
  }
}


// ============================================================
// GET WIFI STATUS
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

            console.error(
              chrome.runtime.lastError.message
            );


            resolve(
              {
                success:
                  false,

                message:
                  chrome.runtime
                    .lastError
                    .message
              }
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

}


// ============================================================
// LOAD WIFI STATUS
// ============================================================

async function loadWifiStatus() {

  if (!wifiToggleBtn) {
    return;
  }


  try {

    wifiToggleBtn.disabled =
      true;


    wifiStatus.textContent =
      "Checking...";


    wifiToggleBtn.textContent =
      "Checking...";


    const result =
      await getWifiVisibility();


    if (
      result &&
      result.success
    ) {

      updateWifiUI(
        result
      );

    } else {

      wifiStatus.textContent =
        result?.message ||
        "Unable to read Wi-Fi status";


      wifiToggleBtn.textContent =
        "Retry";

    }

  } catch (error) {

    console.error(
      "Wi-Fi status error:",
      error
    );


    wifiStatus.textContent =
      "Connection error";


    wifiToggleBtn.textContent =
      "Retry";

  } finally {

    wifiToggleBtn.disabled =
      false;

  }

}


// ============================================================
// TOGGLE WIFI
// ============================================================

async function toggleWifiVisibility() {

  if (
    !wifiToggleBtn ||
    wifiToggleBtn.disabled
  ) {

    return;
  }


  const currentState =
    wifiToggleBtn.dataset.state;


  if (
    currentState !== "visible" &&
    currentState !== "hidden"
  ) {

    await loadWifiStatus();

    return;
  }


  /*
   * visible -> hidden
   *
   * hidden -> visible
   */

  const newBroadcast =
    currentState === "visible"
      ? "1"
      : "0";


  wifiToggleBtn.disabled =
    true;


  if (
    newBroadcast === "1"
  ) {

    wifiStatus.textContent =
      "Hiding Wi-Fi...";

  } else {

    wifiStatus.textContent =
      "Showing Wi-Fi...";

  }


  wifiToggleBtn.textContent =
    "Updating...";


  try {

    const result =
      await new Promise(
        resolve => {

          chrome.runtime.sendMessage(

            {
              type:
                "setWifiVisibility",

              broadcast:
                newBroadcast
            },

            response => {

              if (
                chrome.runtime.lastError
              ) {

                resolve(
                  {
                    success:
                      false,

                    message:
                      chrome.runtime
                        .lastError
                        .message
                  }
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


    if (
      result &&
      result.success
    ) {

      /*
       * background.js verifies the
       * actual router state after POST.
       */

      updateWifiUI(
        result
      );

    } else {

      console.error(
        "Wi-Fi toggle failed:",
        result
      );


      wifiStatus.textContent =
        result?.message ||
        "Failed to change Wi-Fi";


      /*
       * Re-read actual router state.
       */

      await loadWifiStatus();

    }

  } catch (error) {

    console.error(
      "Wi-Fi toggle error:",
      error
    );


    wifiStatus.textContent =
      "Request failed";


    await loadWifiStatus();

  } finally {

    wifiToggleBtn.disabled =
      false;

  }

}


// ============================================================
// GET ROUTER STATUS
// ============================================================

function getRouterStatus() {

  return new Promise(
    resolve => {

      chrome.runtime.sendMessage(

        {
          type:
            "getStatus"
        },

        response => {

          if (
            chrome.runtime.lastError
          ) {

            console.error(
              chrome.runtime.lastError.message
            );


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

}


// ============================================================
// REFRESH ROUTER
// ============================================================

async function refreshRouter() {

  if (
    isRefreshing
  ) {

    return;

  }


  isRefreshing =
    true;


  if (refreshStatus) {

    refreshStatus.textContent =
      "Refreshing router...";

  }


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

                console.error(
                  chrome.runtime
                    .lastError
                    .message
                );


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

      updateSpeedTitle(
        result
      );


      /*
       * Also update Wi-Fi state if it
       * is already available.
       */

      if (
        result.wifi
      ) {

        updateWifiUI(
          result.wifi
        );

      }


      if (refreshStatus) {

        if (
          result.status ===
          "connected"
        ) {

          refreshStatus.textContent =
            "Connected";

        } else {

          refreshStatus.textContent =
            result.status ||
            "Router error";

        }

      }

    } else {

      if (refreshStatus) {

        refreshStatus.textContent =
          "No response";

      }

    }

  } catch (error) {

    console.error(
      "Refresh error:",
      error
    );


    if (refreshStatus) {

      refreshStatus.textContent =
        "Refresh failed";

    }

  } finally {

    isRefreshing =
      false;

  }

}


// ============================================================
// MANUAL REFRESH BUTTON
// ============================================================

if (refreshBtn) {

  refreshBtn.addEventListener(

    "click",

    async () => {

      refreshBtn.disabled =
        true;


      try {

        await refreshRouter();


        await loadWifiStatus();

      } finally {

        refreshBtn.disabled =
          false;

      }

    }

  );

}


// ============================================================
// WIFI TOGGLE BUTTON
// ============================================================

if (wifiToggleBtn) {

  wifiToggleBtn.addEventListener(

    "click",

    toggleWifiVisibility

  );

}


// ============================================================
// INITIAL LOAD
// ============================================================

async function initialize() {

  /*
   * Get router status immediately.
   */

  await refreshRouter();


  /*
   * Get actual Wi-Fi visibility
   * directly from cmd 117 GET.
   */

  await loadWifiStatus();

}


// ============================================================
// AUTO REFRESH
//
// Everything remains on 2 seconds.
// ============================================================

refreshTimer =
  setInterval(

    () => {

      refreshRouter();

    },

    REFRESH_INTERVAL

  );


initialize();