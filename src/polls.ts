import { PollResponses } from "./responses";

export class Polls {
  poll_types: any[];
  polls: any[];

  constructor(poll_types: any[]) {
    this.poll_types = poll_types;
    this.polls = [];
  }

  gather(root_elem: HTMLElement) {
    for (const poll_type of this.poll_types) {
      for (const poll_container of Array.from(
        root_elem.getElementsByClassName(poll_type.class_name)
      )) {
        this.polls.push(new poll_type(poll_container));
      }
    }
  }

  initialize_all(responses: PollResponses) {
    for (const poll of this.polls) {
      poll.initialize();
    }
    this.update_all(responses);
  }

  update_all(responses: PollResponses) {
    for (const poll of this.polls) {
      poll.update_with_responses(responses.responses_for_poll(poll.id));
    }
  }

  by_container(poll_container: HTMLElement) {
    for (const poll of this.polls) {
      if (poll.container === poll_container) {
        return poll;
      }
    }
    return null;
  }

  by_id(poll_id: string) {
    for (const poll of this.polls) {
      if (poll.id === poll_id) {
        return poll;
      }
    }
    return null;
  }

  by_parent(parent_elem: HTMLElement) {
    for (const poll_type of this.poll_types) {
      for (const poll_container of Array.from(
        parent_elem.getElementsByClassName(poll_type.class_name)
      )) {
        if (poll_container instanceof HTMLElement) {
          return this.by_container(poll_container);
        }
      }
    }
    return null;
  }
}
