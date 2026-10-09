// Side-effect import for adult routes (auth pages and the parent / teacher / therapist / admin dashboards).
import { registerMessages } from "@/lib/translate";
import { auth } from "./auth";
import { intake } from "./intake";
import { parent } from "./parent";
import { pro } from "./pro";

registerMessages(auth, parent, pro, intake);
