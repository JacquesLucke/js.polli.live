import QRCode from "qrcode";
import settings_html from "./settings.html";

import { PollResponses } from "./responses";
import { Polls } from "./polls";
import { PolliLiveConnection } from "./connection";

export function initialize(options) {
  options = {
    server: "https://polli.live",
    min_poll_interval_ms: 100,
    ...options,
  };

  globals.options = options;
  globals.polls = new Polls(globals.poll_types);
  globals.responses = new PollResponses(
    "polli_live_responses",
    response_is_valid
  );
  globals.connection = new PolliLiveConnection(
    options.server,
    globals.responses,
    "polli-live",
    polli_live_session_changed,
    polli_live_has_new_responses
  );
  globals.host = options.server.replace("http://", "").replace("https://", "");
  globals.settings_elem = prepare_settings_popover();
  init_empty_qr_codes();

  setTimeout(async () => {
    await globals.connection.init_session();
  }, 0);

  globals.polls.gather(document);

  // Old responses are stored in local storage so that they are still available
  // after a reload.
  globals.responses.load_from_local_storage();

  globals.polls.initialize_all(globals.responses);

  if (typeof Reveal !== "undefined") {
    Reveal.on("slidechanged", async function (event) {
      globals.connection.stop_fetching_responses();
      const poll = find_poll_on_current_slide();
      if (poll) {
        await start_poll(poll);
      }
    });
  }
}

function response_is_valid(poll_id, response_data) {
  const poll = globals.polls.by_id(poll_id);
  if (!poll) {
    return false;
  }
  return poll.is_valid_response(response_data);
}

export function create_join_elem() {
  const join_elem = document.createElement("div");
  join_elem.classList.add("join-poll");
  join_elem.innerHTML = `
    Join at <code>${globals.host}</code> with <code class="polli-live-session-id"></code>
    `;
  join_elem.addEventListener("click", show_settings);
  return join_elem;
}

function prepare_settings_popover() {
  document.getElementsByTagName("body")[0].innerHTML += settings_html;

  document
    .getElementById("polli-live-new-session-btn")
    .addEventListener("click", (e) => {
      e.stopPropagation();
      globals.responses.reset();
      globals.connection.make_new_session();
    });
  document
    .getElementById("polli-live-close-settings-btn")
    .addEventListener("click", hide_settings);
  document
    .getElementById("polli-live-settings")
    .addEventListener("click", hide_settings);

  return document.getElementById("polli-live-settings");
}

function hide_settings() {
  globals.settings_elem.style.display = "none";
}

function show_settings() {
  globals.settings_elem.style.display = "block";
}

async function start_poll(poll) {
  const page = await poll.get_poll_page();
  await globals.connection.set_page(page);
  globals.connection.start_fetching_responses();
}

function find_poll_on_current_slide() {
  let container = document;
  if (typeof Reveal !== "undefined") {
    container = Reveal.getCurrentSlide();
  }
  return globals.polls.by_parent(container);
}

async function update_poll_qr_codes() {
  const poll_link = globals.connection.poll_link;
  let data_link;
  if (poll_link) {
    data_link = await QRCode.toDataURL(poll_link, {
      color: {
        light: "#00000000",
        dark: "#000000ff",
      },
      margin: 0,
      errorCorrectionLevel: "Q",
    });
  } else {
    data_link = init_empty_qr_codes();
  }
  for (const elem of get_qr_code_image_elems()) {
    elem.src = data_link;
  }
}

function get_single_white_pixel_data_link() {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+P///38ACfsD/QVDRcoAAAAASUVORK5CYII=";
}

function init_empty_qr_codes() {
  for (const elem of get_qr_code_image_elems()) {
    elem.src = get_single_white_pixel_data_link();
  }
}

function get_qr_code_image_elems() {
  return document.getElementsByClassName("polli-live-qr-code");
}

async function polli_live_session_changed() {
  for (const session_id_elem of document.getElementsByClassName(
    "polli-live-session-id"
  )) {
    if (globals.connection.has_session) {
      session_id_elem.innerText = globals.connection.session;
    } else {
      session_id_elem.innerText = "...";
    }
  }

  update_poll_qr_codes();
  globals.polls.update_all(globals.responses);
  if (globals.connection.has_session) {
    const poll = find_poll_on_current_slide();
    if (poll) {
      start_poll(poll);
    }
  }
}

function polli_live_has_new_responses() {
  globals.responses.store_in_local_storage();
  const poll = find_poll_on_current_slide();
  if (poll) {
    poll.update_with_responses(globals.responses.responses_for_poll(poll.id));
  }
}

export function register_poll_type(poll_type) {
  globals.poll_types.push(poll_type);
}

const globals = {
  poll_types: [],
};
