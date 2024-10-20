import html_template from "./choice.html";
import { create_join_elem } from "../core";

declare var Reveal: any;

export class ChoicePoll {
  static class_name = "polli-live-choice";

  container: HTMLElement;
  id: string;
  options: string[];
  options_html: string[];
  option_colors: string[];
  hide_answer_initially: boolean;
  answers_revealed: boolean;
  multiple_choice: boolean;
  allow_more_responses: boolean;

  result_elem: HTMLDivElement;
  join_elem: HTMLDivElement;

  constructor(poll_container: HTMLElement) {
    this.container = poll_container;
    this.id = this.container.id;

    this.options = [];
    this.options_html = [];
    for (const option_elem of Array.from(
      this.container.querySelectorAll("option")
    )) {
      this.options.push(option_elem.innerText);
      this.options_html.push(option_elem.innerHTML);
    }
    this.option_colors = ["#67B8DB", "#DB7873", "#9CDB67", "#DBA667"];

    this.hide_answer_initially =
      this.container.hasAttribute("data-hide-answer");
    this.answers_revealed = !this.hide_answer_initially;
    this.allow_more_responses = true;
    this.multiple_choice = this.container.hasAttribute("data-multiple-choice");
  }

  initialize() {
    this.container.innerHTML = "";

    this.result_elem = document.createElement("div");
    this.container.appendChild(this.result_elem);

    this.join_elem = create_join_elem();
    this.container.appendChild(this.join_elem);
  }

  update_with_responses(response_by_user: Map<string, string>) {
    if (!this.allow_more_responses) {
      return;
    }

    // Clear old results.
    this.result_elem.innerHTML = "";

    const count_by_option = new Map();
    for (const option of this.options) {
      count_by_option.set(option, 0);
    }

    let responses_num = 0;
    for (const choosen_options_json of response_by_user.values()) {
      const choosen_options: string[] = JSON.parse(choosen_options_json);
      if (!this.multiple_choice && choosen_options.length > 1) {
        continue;
      }
      for (const choosen_option of choosen_options) {
        if (!this.options.includes(choosen_option)) {
          continue;
        }
        responses_num += 1;
        count_by_option.set(
          choosen_option,
          count_by_option.get(choosen_option) + 1
        );
      }
    }

    if (!this.answers_revealed) {
      const votes_elem = document.createElement("div");
      this.result_elem.appendChild(votes_elem);
      votes_elem.style.cssText = `
            cursor: pointer;
          `;
      votes_elem.innerHTML = `Responses: ${responses_num}`;
      votes_elem.addEventListener("click", async () => {
        this.answers_revealed = true;
        this.update_with_responses(response_by_user);
        this.allow_more_responses = false;
        if (typeof Reveal !== "undefined") {
          Reveal.layout();
        }
      });
      return;
    }
    this.join_elem.style.display = "none";

    for (const option of this.options) {
      const option_i = this.options.indexOf(option);
      const option_html = this.options_html[option_i];
      const count = count_by_option.get(option);
      const option_elem = document.createElement("div");
      this.result_elem.appendChild(option_elem);

      option_elem.style.cssText = `
            min-width: 2em;
            text-align: left;
            padding-left: 0.5em;
            white-space: nowrap;
            margin: 0.3em;
            border-radius: 0.3em;
            overflow: visible;
            textShadow: black 0 0 2px;
            cursor: pointer;
          `;

      const percentage = (count / Math.max(1, responses_num)) * 100;
      option_elem.style.width = `${percentage * 0.9}%`;

      if (this.answers_revealed) {
        option_elem.innerHTML = `${option_html}: ${count}`;
        option_elem.style.backgroundColor = this.option_colors[option_i];
      } else {
        option_elem.innerHTML = `${count}`;
        option_elem.style.backgroundColor = "#464646";
      }
    }
  }

  async get_poll_page() {
    let page = html_template;
    page = page.replace("POLL_ID", this.id);
    page = page.replace(
      '"MULTIPLE_CHOICE_OPTIONS"',
      JSON.stringify(this.options)
    );
    page = page.replace(
      '"MULTIPLE_CHOICE_COLORS"',
      JSON.stringify(this.option_colors)
    );
    page = page.replace(
      '"IS_MULTIPLE_CHOICE"',
      this.multiple_choice.toString()
    );
    return page;
  }

  is_valid_response(response: string) {
    let choosen_options;
    try {
      choosen_options = JSON.parse(response);
    } catch {
      return false;
    }
    if (!Array.isArray(choosen_options)) {
      return false;
    }
    if (!choosen_options.every((item) => typeof item === "string")) {
      return false;
    }
    if (!this.multiple_choice && choosen_options.length > 1) {
      return false;
    }
    for (const choosen_option of choosen_options) {
      if (!this.options.includes(choosen_option)) {
        return false;
      }
    }
    return true;
  }
}
