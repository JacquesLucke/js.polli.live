export class Polls {
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
