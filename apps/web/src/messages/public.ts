// Side-effect import for public marketing pages: common (registered by default) + marketing strings, and the
// Update 4 strings the public pages use (the privacy policy, the offer line).
import { registerMessages } from "@/lib/translate";
import { launch } from "./launch";
import { marketing } from "./marketing";

registerMessages(marketing, launch);
