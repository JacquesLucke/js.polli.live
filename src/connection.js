class FetchResponsesBadStatusCode extends Error {
  constructor() {
    super(
      "Fetching responses failed with bad status code (not due to internet connection)"
    );
  }
}

export class PolliLiveConnection {
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
    const min_poll_interval_ms = 100;
    this.last_fetch_loop_interval = min_poll_interval_ms;
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
        let next_timeout = min_poll_interval_ms;
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
