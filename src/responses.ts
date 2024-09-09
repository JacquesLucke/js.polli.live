export class PollResponses {
  local_storage_key: string;
  is_valid_response_fn: (poll_id: string, response: string) => boolean;
  responses_by_poll_id: Map<string, Map<string, string>>;

  constructor(
    local_storage_key: string,
    is_valid_response_fn: (poll_id: string, response: string) => boolean
  ) {
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

  try_add_from_storage_string(storage_str: string) {
    try {
      const responses = JSON.parse(storage_str);
      for (const { poll_id, user_id, data } of responses) {
        this.try_add_response(poll_id, user_id, data);
      }
    } catch {}
  }

  try_add_response(poll_id: string, user_id: string, data: string) {
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

  responses_for_poll(poll_id: string): Map<string, string> {
    const responses = this.responses_by_poll_id.get(poll_id);
    if (responses) {
      return responses;
    }
    return new Map();
  }
}
