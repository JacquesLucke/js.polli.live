import html_template from "./continuum.html";
import { create_join_elem } from "../core";

export class ContinuumPoll {
  static class_name = "polli-live-continuum";

  container: HTMLElement;
  id: string;
  options: string[];

  result_elem: HTMLDivElement;
  options_elem: HTMLDivElement;

  constructor(poll_container: HTMLElement) {
    this.container = poll_container;
    this.id = this.container.id;

    this.options = [];
    for (const option_elem of Array.from(
      this.container.querySelectorAll("option")
    )) {
      this.options.push(option_elem.innerHTML);
    }
  }

  initialize() {
    this.container.innerHTML = "";

    this.result_elem = document.createElement("div");
    this.result_elem.style.marginTop = "1em";
    this.container.appendChild(this.result_elem);

    this.options_elem = document.createElement("div");
    this.container.appendChild(this.options_elem);
    this.options_elem.style.display = "flex";
    this.options_elem.style.justifyContent = "space-between";
    this.options_elem.style.marginBottom = "1em";
    for (const option of this.options) {
      const option_elem = document.createElement("div");
      option_elem.innerHTML = option;
      this.options_elem.appendChild(option_elem);
    }

    const join_elem = create_join_elem();
    this.container.appendChild(join_elem);
  }

  update_with_responses(response_by_user: Map<string, string>) {
    this.result_elem.innerHTML = "";

    this.result_elem.style.backgroundColor = "#dba667";
    this.result_elem.style.width = "100%";
    this.result_elem.style.height = "5em";

    const responses = Array.from(response_by_user.values());

    const resolution = 300;

    const falloffs = [];

    const falloffs_num = Math.floor(resolution * 0.1);
    for (let i = 0; i < falloffs_num; i++) {
      const x = ((i + 1) / falloffs_num) * 2.3;
      falloffs.push(Math.exp(-x * x));
    }

    let heights = Array(resolution).fill(0);
    for (const value of responses) {
      const value_f = parseFloat(value) / 100;
      const center_index = Math.floor(value_f * resolution);
      if (center_index < heights.length) {
        heights[center_index] += 1;
      }
      for (let falloff_i = 0; falloff_i < falloffs.length; falloff_i++) {
        const falloff = falloffs[falloff_i];
        const index_offset = falloff_i + 1;
        const left_index = center_index - index_offset;
        if (left_index >= 0) {
          heights[left_index] += falloff;
        }
        const right_index = center_index + index_offset;
        if (right_index < heights.length) {
          heights[right_index] += falloff;
        }
      }
    }

    const max_height = Math.max(...heights);
    if (max_height > 0) {
      heights = heights.map((h) => h / max_height);
    }
    heights = heights.map((h) => Math.max(h, 0.02));

    const points = [];
    points.push([0, 1]);
    for (let i = 0; i < heights.length; i++) {
      const height = heights[i];
      points.push([i / (heights.length - 1), 1 - height]);
    }
    points.push([1, 1]);

    let polygon_str = "polygon(";
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      polygon_str += `${point[0] * 100}% ${point[1] * 100}%`;
      if (i < points.length - 1) {
        polygon_str += ",";
      }
    }
    polygon_str += ")";

    this.result_elem.style.clipPath = polygon_str;

    this.result_elem.innerHTML = "";
  }

  async get_poll_page() {
    let page = html_template;
    page = page.replace("POLL_ID", this.id);
    return page;
  }

  is_valid_response(response: string) {
    return true;
  }
}
