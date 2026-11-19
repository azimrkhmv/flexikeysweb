import { SCHEMES } from "./theme";

// The look's storage keys and the script that puts the saved look on <html> before the first paint (B107). A plain
// module (no "use client"), so the root layout can put the script in the page; lib/appearance.ts does the rest.
export const KEY = "fk-look";
/** 15 Nov: the scheme only ("hills", "sky", "mint", "lilac"); read once, as the start of `fk-look`. */
export const OLD_KEY = "fk-pal";
/** The last child look shown, for the script on /play. */
export const PLAY_KEY = "fk-look-play";

/** Runs before the first paint (root layout): the saved look, the child's on /play. Keep in step with the above. */
export const APPEARANCE_SCRIPT = `try{var d=document.documentElement,S=${JSON.stringify(SCHEMES)},j=function(k){try{var v=JSON.parse(localStorage.getItem(k)||"null");return v&&typeof v=="object"?v:{}}catch(e){return {}}},p=j("${KEY}");if(!p.scheme){var o=localStorage.getItem("${OLD_KEY}");if(o)p.scheme=o=="hills"?"warm":o}var s=S.indexOf(p.scheme)>=0?p.scheme:"warm",m=p.mode=="dark"?"dark":"light",t=p.style=="sharp"?"sharp":"soft";if(location.pathname.indexOf("/play")==0){var c=j("${PLAY_KEY}");if(S.indexOf(c.scheme)>=0){s=c.scheme;t=c.style=="sharp"?"sharp":"soft"}}d.dataset.scheme=s;d.dataset.mode=s=="night"?"dark":m;d.dataset.style=t}catch(e){}`;
