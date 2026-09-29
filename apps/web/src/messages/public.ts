// Side-effect import for public marketing pages: common (registered by default) + marketing strings only.
import { registerMessages } from "@/lib/translate";
import { marketing } from "./marketing";

registerMessages(marketing);
