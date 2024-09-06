import QRCode from "qrcode";
import settings_html from "./settings.html";

class PollResponses {
  constructor(local_storage_key, is_valid_response_fn) {
    this.local_storage_key = local_storage_key;
    this.is_valid_response_fn = is_valid_response_fn;
    this.responses_by_poll_id = new Map();
  }

  reset() {
    this.clear();
    this.store_in_local_storage();
  }

  clear() {
    this.responses_by_poll_id.clear();
  }

  store_in_local_storage() {
    localStorage.setItem(this.local_storage_key, this.to_storage_string());
  }

  load_from_local_storage() {
    this.try_add_from_storage_string(
      localStorage.getItem(this.local_storage_key)
    );
  }

  to_storage_string() {
    const responses = [];
    for (const [
      poll_id,
      responses_by_user,
    ] of this.responses_by_poll_id.entries()) {
      for (const [user_id, data] of responses_by_user.entries()) {
        responses.push({ poll_id, user_id, data });
      }
    }
    return JSON.stringify(responses);
  }

  try_add_from_storage_string(storage_str) {
    try {
      const responses = JSON.parse(storage_str);
      for (const { poll_id, user_id, data } of responses) {
        this.try_add_response(poll_id, user_id, data);
      }
    } catch {}
  }

  try_add_response(poll_id, user_id, data) {
    if (!poll_id || !user_id || !data) {
      return;
    }
    if (!this.is_valid_response_fn(poll_id, data)) {
      return;
    }
    if (!this.responses_by_poll_id.has(poll_id)) {
      this.responses_by_poll_id.set(poll_id, new Map());
    }
    this.responses_by_poll_id.get(poll_id).set(user_id, data);
  }

  responses_for_poll(poll_id) {
    const responses = this.responses_by_poll_id.get(poll_id);
    if (responses) {
      return responses;
    }
    return new Map();
  }
}

class Polls {
  constructor(poll_types) {
    this.poll_types = poll_types;
    this.polls = [];
  }

  gather(root_elem) {
    for (const poll_type of this.poll_types) {
      for (const poll_container of root_elem.getElementsByClassName(
        poll_type.class_name
      )) {
        this.polls.push(new poll_type(poll_container));
      }
    }
  }

  initialize_all(responses) {
    for (const poll of this.polls) {
      poll.initialize();
    }
    this.update_all(responses);
  }

  update_all(responses) {
    for (const poll of this.polls) {
      poll.update_with_responses(responses.responses_for_poll(poll.id));
    }
  }

  update(poll, responses) {}

  by_container(poll_container) {
    for (const poll of this.polls) {
      if (poll.container === poll_container) {
        return poll;
      }
    }
    return null;
  }

  by_id(poll_id) {
    for (const poll of this.polls) {
      if (poll.id === poll_id) {
        return poll;
      }
    }
    return null;
  }

  by_parent(parent_elem) {
    for (const poll_type of this.poll_types) {
      for (const poll_container of parent_elem.getElementsByClassName(
        poll_type.class_name
      )) {
        return this.by_container(poll_container);
      }
    }
    return null;
  }
}

function response_is_valid(poll_id, response_data) {
  const poll = globals.polls.by_id(poll_id);
  if (!poll) {
    return false;
  }
  return poll.is_valid_response(response_data);
}

class FetchResponsesBadStatusCode extends Error {
  constructor() {
    super(
      "Fetching responses failed with bad status code (not due to internet connection)"
    );
  }
}

class PolliLiveConnection {
  constructor(
    url,
    responses,
    local_storage_key,
    on_session_change,
    on_response_change
  ) {
    this.url = url;
    this.responses = responses;
    this.local_storage_key = local_storage_key;
    this.on_session_change = on_session_change;
    this.on_response_change = on_response_change;
    this.session = null;
    this.token = null;
    this.next_response = 0;
    this.should_fetch_responses = false;
    this.last_set_page = null;
    this.#start_fetch_responses_loop();
  }

  get has_session() {
    return this.session !== null;
  }

  get poll_link() {
    if (this.session) {
      return `${this.url}/page?session=${this.session}`;
    }
    return null;
  }

  async init_session() {
    this.session = null;
    this.token = null;
    this.next_response = 0;
    try {
      let desired_session = localStorage.getItem(this.local_storage_key);
      const res = await fetch(`${this.url}/new`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: desired_session,
      });
      if (res.ok) {
        const new_session = await res.json();
        localStorage.setItem(
          this.local_storage_key,
          JSON.stringify(new_session)
        );
        this.session = new_session.session;
        this.token = new_session.token;
        return;
      }
    } finally {
      this.on_session_change();
    }
    console.error(`Could not initialize session on ${this.url}.`);
  }

  async make_new_session() {
    localStorage.removeItem(this.local_storage_key);
    await this.init_session();
  }

  async set_page(page) {
    this.last_set_page = page;
    if (!this.session || !this.token) {
      return false;
    }
    try {
      const res = await fetch(`${this.url}/page?session=${this.session}`, {
        method: "POST",
        body: page,
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      if (res.ok) {
        return true;
      }
    } catch {}
    console.error(`Could not set poll page.`);
    return false;
  }

  start_fetching_responses() {
    this.should_fetch_responses = true;
  }

  stop_fetching_responses() {
    this.should_fetch_responses = false;
  }

  #start_fetch_responses_loop() {
    this.last_fetch_loop_interval = globals.options.min_poll_interval_ms;
    const handler = async () => {
      let use_interval_backoff = false;
      try {
        if (!this.session) {
          return;
        }
        if (!this.should_fetch_responses) {
          return;
        }
        try {
          if (await this.#fetch_new_responses()) {
            this.on_response_change();
          }
        } catch (err) {
          use_interval_backoff = true;
          if (err instanceof FetchResponsesBadStatusCode) {
            if (this.last_set_page) {
              if (await this.set_page(this.last_set_page)) {
                use_interval_backoff = false;
              }
            }
          }
        }
      } finally {
        let next_timeout = globals.options.min_poll_interval_ms;
        if (use_interval_backoff) {
          next_timeout = Math.min(10000, this.last_fetch_loop_interval * 2);
        }
        this.last_fetch_loop_interval = next_timeout;
        setTimeout(handler, next_timeout);
      }
    };

    handler();
  }

  async #fetch_new_responses() {
    if (!this.session) {
      return false;
    }

    let responses = await fetch(
      `${this.url}/responses?session=${this.session}&start=${this.next_response}`
    );
    if (!responses.ok) {
      throw new FetchResponsesBadStatusCode();
    }
    responses = await responses.json();
    this.next_response = responses.next_start;

    let found_new_responses = false;
    for (const [user_id, response] of Object.entries(
      responses.responses_by_user
    )) {
      const { poll_id, data } = JSON.parse(response);
      this.responses.try_add_response(poll_id, user_id, data);
      found_new_responses = true;
    }
    return found_new_responses;
  }
}

export function initialize(options) {
  options = {
    server: "https://polli.live",
    min_poll_interval_ms: 100,
    qr_code_size: 256,
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

export function create_join_elem() {
  const join_elem = document.createElement("div");
  join_elem.classList.add("join-poll");
  join_elem.innerHTML = `
    Join at <code>${globals.host}</code> with <code class="session-id"></code>
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
  const container = document;
  if (typeof Reveal !== "undefined") {
    container = Reveal.getCurrentSlide();
  }
  return globals.polls.by_parent(container);
}

async function update_poll_qr_codes() {
  const poll_link = globals.connection.poll_link;
  const data_link = await QRCode.toDataURL(poll_link, {
    color: {
      light: "#00000000",
      dark: "#000000ff",
    },
    margin: 0,
    errorCorrectionLevel: "Q",
  });
  for (const elem of document.getElementsByClassName("polli-live-qr-code")) {
    elem.src = data_link;
  }
}

async function polli_live_session_changed() {
  for (const session_id_elem of document.getElementsByClassName("session-id")) {
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
