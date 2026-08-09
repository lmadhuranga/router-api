const REFRESH_INTERVAL = 5000;


// ============================================================
// ELEMENTS
// ============================================================

const speedTitle =
  document.getElementById("speedTitle");

const status =
  document.getElementById("status");

const titleFormat =
  document.getElementById("titleFormat");

const refreshButton =
  document.getElementById("refreshButton");


// ============================================================
// DATA
// ============================================================

let latestSpeed = {
  downloadKB: 0,
  uploadKB: 0
};

let latestRouter = {
  rssi: "--"
};


// ============================================================
// TITLE FORMAT
// ============================================================

let selectedTitleFormat =
  localStorage.getItem("titleFormat") || "KB";

if (titleFormat) {
  titleFormat.value =
    selectedTitleFormat;
}


// ============================================================
// CREATE TITLE
// ============================================================

function createSpeedTitle() {

  const upload =
    Math.floor(
      Number(
        latestSpeed.uploadKB
      ) || 0
    );

  const download =
    Math.floor(
      Number(
        latestSpeed.downloadKB
      ) || 0
    );

  const rssiNumber =
    Number(
      latestRouter.rssi
    );

  const rssi =
    Number.isFinite(rssiNumber)
      ? Math.abs(
          Math.round(rssiNumber)
        )
      : "--";


  if (
    selectedTitleFormat === "KB/s"
  ) {

    return (
      `↑ ${upload} KB/s | ` +
      `↓ ${download} KB/s | ` +
      `${rssi} dBm`
    );
  }


  if (
    selectedTitleFormat === "plain"
  ) {

    return (
      `↑ ${upload} | ` +
      `↓ ${download} | ` +
      `${rssi} dBm`
    );
  }


  // Default

  return (
    `↑ ${upload} KB | ` +
    `↓ ${download} KB | ` +
    `${rssi} dBm`
  );
}


// ============================================================
// UPDATE TITLE
// ============================================================

function updateTitle() {

  const title =
    createSpeedTitle();


  if (speedTitle) {
    speedTitle.textContent =
      title;
  }


  // Popup document title
  document.title =
    title;
}


// ============================================================
// UPDATE FROM BACKGROUND
// ============================================================

function updateFromBackground(
  data
) {

  if (!data) {
    return;
  }


  // ----------------------------------------------------------
  // SPEED
  // ----------------------------------------------------------

  if (data.speed) {

    latestSpeed =
      data.speed;
  }


  // ----------------------------------------------------------
  // ROUTER
  // ----------------------------------------------------------

  if (data.router) {

    latestRouter =
      data.router;
  }


  // ----------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------

  if (data.status) {

    if (
      data.status ===
      "connected"
    ) {

      status.textContent =
        "● Connected";

    } else if (
      data.status ===
      "authenticating"
    ) {

      status.textContent =
        "Authenticating...";

    } else if (
      data.status ===
      "authentication_failed"
    ) {

      status.textContent =
        "Authentication failed";

    } else if (
      data.status ===
      "offline"
    ) {

      status.textContent =
        "● Router offline";

    } else {

      status.textContent =
        data.status;
    }
  }


  updateTitle();
}


// ============================================================
// GET STATUS
// ============================================================

function getStatus() {

  chrome.runtime.sendMessage(

    {
      type: "getStatus"
    },

    response => {

      if (
        chrome.runtime.lastError
      ) {

        console.log(
          "getStatus:",
          chrome.runtime.lastError.message
        );

        status.textContent =
          "Waiting for router...";

        return;
      }


      if (response) {

        updateFromBackground(
          response
        );

      } else {

        status.textContent =
          "Waiting for router...";
      }
    }
  );
}


// ============================================================
// FORCE REFRESH
// ============================================================

function forceRefresh() {

  if (!refreshButton) {
    return;
  }


  refreshButton.classList.add(
    "loading"
  );

  refreshButton.disabled =
    true;


  status.textContent =
    "Refreshing router...";


  chrome.runtime.sendMessage(

    {
      type: "forceRefresh"
    },

    response => {

      refreshButton.classList.remove(
        "loading"
      );

      refreshButton.disabled =
        false;


      if (
        chrome.runtime.lastError
      ) {

        console.log(
          "forceRefresh:",
          chrome.runtime.lastError.message
        );

        status.textContent =
          "Waiting for router...";

        // Get whatever data the background
        // already has.
        getStatus();

        return;
      }


      if (response) {

        updateFromBackground(
          response
        );

      } else {

        // Important:
        // Don't leave the popup stuck on
        // "Refreshing router..."

        status.textContent =
          "Waiting for router...";

        getStatus();
      }
    }
  );
}


// ============================================================
// TITLE FORMAT CHANGE
// ============================================================

if (titleFormat) {

  titleFormat.addEventListener(
    "change",
    () => {

      selectedTitleFormat =
        titleFormat.value;


      localStorage.setItem(
        "titleFormat",
        selectedTitleFormat
      );


      updateTitle();
    }
  );
}


// ============================================================
// REFRESH BUTTON
// ============================================================

if (refreshButton) {

  refreshButton.addEventListener(
    "click",
    forceRefresh
  );
}


// ============================================================
// INITIAL STATE
// ============================================================

updateTitle();


// ============================================================
// LOAD CURRENT DATA
// ============================================================

getStatus();


// ============================================================
// AUTO REFRESH
// ============================================================

setInterval(
  getStatus,
  REFRESH_INTERVAL
);