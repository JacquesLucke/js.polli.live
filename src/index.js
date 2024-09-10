import { register_poll_type } from "./core";
import { ContinuumPoll } from "./poll_types/continuum.ts";
import { ChoicePoll } from "./poll_types/choice.ts";

export { initialize, register_poll_type } from "./core";

register_poll_type(ContinuumPoll);
register_poll_type(ChoicePoll);
