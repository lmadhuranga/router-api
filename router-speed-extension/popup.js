const REFRESH_INTERVAL = 5000;


// ============================================================
// ELEMENTS
// ============================================================

const downloadKB =
  document.getElementById(
    "downloadKB"
  );

const downloadMbps =
  document.getElementById(
    "downloadMbps"
  );

const uploadKB =
  document.getElementById(
    "uploadKB"
  );

const uploadMbps =
  document.getElementById(
    "uploadMbps"
  );

const status =
  document.getElementById(
    "status"
  );

const titleFormat =
  document.getElementById(
    "titleFormat"
  );


// ============================================================
// TITLE FORMAT
// ============================================================

let selectedTitleFormat =
  localStorage.getItem(
    "titleFormat"
  ) || "KB";


titleFormat.value =
  selectedTitleFormat;


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


// ============================================================
// DATA
// ============================================================

let latestSpeed = null;

let latestRouter = null;


// ============================================================
// SAFE VALUE
// ============================================================

function value(
  item,
  fallback = "--"
) {

  if (
    item === undefined ||
    item === null ||
    item === ""
  ) {

    return fallback;
  }


  return item;
}


// ============================================================
// TITLE
// ============================================================

function updateTitle() {

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
    ) || 0;


  const download =
    Math.floor(
      Number(
        latestSpeed.downloadKB
      )
    ) || 0;


  const rssiNumber =
    Number(
      latestRouter.rssi
    );


  const rssi =
    Number.isFinite(rssiNumber)
      ? Math.abs(
          Math.round(
            rssiNumber
          )
        )
      : "--";


  if (
    selectedTitleFormat ===
    "KB"
  ) {

    document.title =
      `↑ ${upload} KB | ↓ ${download} KB | ${rssi} dBm`;

  } else if (
    selectedTitleFormat ===
    "KB/s"
  ) {

    document.title =
      `↑ ${upload} KB/s | ↓ ${download} KB/s | ${rssi} dBm`;

  } else {

    document.title =
      `↑ ${upload} | ↓ ${download} | ${rssi} dBm`;
  }
}


// ============================================================
// UPDATE POPUP
// ============================================================

function updatePopup(data) {

  if (!data) {

    status.textContent =
      "Waiting for router data...";

    return;
  }


  latestSpeed =
    data.speed || {

      downloadKB: 0,

      downloadMbps: 0,

      uploadKB: 0,

      uploadMbps: 0
    };


  latestRouter =
    data.router || {};


  // ==========================================================
  // SPEED
  // ==========================================================

  downloadKB.textContent =
    Number(
      latestSpeed.downloadKB
    ).toFixed(2) +
    " KB/s";


  downloadMbps.textContent =
    Number(
      latestSpeed.downloadMbps
    ).toFixed(2);


  uploadKB.textContent =
    Number(
      latestSpeed.uploadKB
    ).toFixed(2) +
    " KB/s";


  uploadMbps.textContent =
    Number(
      latestSpeed.uploadMbps
    ).toFixed(2);


  // ==========================================================
  // STATUS
  // ==========================================================

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
      `Authenticating ${data.authAttempt}/${data.maxAuthRetries}`;

  } else if (
    data.status ===
    "authentication_failed"
  ) {

    status.textContent =
      "Authentication failed";

  } else {

    status.textContent =
      "Router offline";
  }


  // ==========================================================
  // ROUTER
  // ==========================================================

  document.getElementById(
    "rssi"
  ).textContent =
    value(
      latestRouter.rssi
    ) +
    " dBm";


  document.getElementById(
    "connectStatus"
  ).textContent =
    value(
      latestRouter.connectStatus
    );


  document.getElementById(
    "wanIP"
  ).textContent =
    value(
      latestRouter.wanIP
    );


  document.getElementById(
    "wanGateway"
  ).textContent =
    value(
      latestRouter.wanGateway
    );


  document.getElementById(
    "wanDNS"
  ).textContent =
    value(
      latestRouter.wanDNS
    );


  document.getElementById(
    "wanDNS2"
  ).textContent =
    value(
      latestRouter.wanDNS2
    );


  document.getElementById(
    "imei"
  ).textContent =
    value(
      latestRouter.imei
    );


  document.getElementById(
    "plmn"
  ).textContent =
    value(
      latestRouter.plmn
    );


  document.getElementById(
    "lanIP"
  ).textContent =
    value(
      latestRouter.lanIP
    );


  document.getElementById(
    "dhcpServer"
  ).textContent =
    value(
      latestRouter.dhcpServer
    );


  document.getElementById(
    "rxPackets"
  ).textContent =
    Number(
      latestRouter.wanRxPackets || 0
    ).toLocaleString();


  document.getElementById(
    "txPackets"
  ).textContent =
    Number(
      latestRouter.wanTxPackets || 0
    ).toLocaleString();


  document.getElementById(
    "uptime"
  ).textContent =
    value(
      latestRouter.uptime
    );


  updateTitle();
}


// ============================================================
// GET STATUS
// ============================================================

function getStatus() {

  chrome.runtime.sendMessage(

    {
      type:
        "getStatus"
    },

    response => {

      if (
        chrome.runtime.lastError
      ) {

        status.textContent =
          "Extension service unavailable";

        console.error(
          chrome.runtime.lastError
        );

        return;
      }


      updatePopup(
        response
      );
    }
  );
}


// ============================================================
// INITIAL DATA
// ============================================================

getStatus();


// ============================================================
// ASK SERVICE WORKER TO REFRESH NOW
// ============================================================

chrome.runtime.sendMessage(

  {
    type:
      "forceRefresh"
  },

  response => {

    if (
      chrome.runtime.lastError
    ) {

      return;
    }


    if (response) {

      updatePopup(
        response
      );
    }
  }
);


// ============================================================
// POPUP REFRESH
// ============================================================

setInterval(

  getStatus,

  REFRESH_INTERVAL

);