import { register_poll_type } from "./core";
import { SlidePoll } from "./poll_types/slide.ts";
import { SingleChoicePoll } from "./poll_types/single_choice.ts";

export { initialize, register_poll_type } from "./core";

register_poll_type(SlidePoll);
register_poll_type(SingleChoicePoll);
